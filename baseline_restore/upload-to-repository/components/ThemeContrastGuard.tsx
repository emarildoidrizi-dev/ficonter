"use client";

import { useEffect } from "react";

type Rgba = { r: number; g: number; b: number; a: number };

const TEXT_SELECTOR = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "span",
  "small",
  "strong",
  "label",
  "legend",
  "li",
  "dt",
  "dd",
  "th",
  "td",
  "a",
  "button",
  "input",
  "select",
  "textarea",
].join(",");

const MIN_CONTRAST = 3.75;

function parseColor(value: string): Rgba | null {
  if (!value || value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };

  const match = value.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;

  const normalized = match[1].replace(/\//g, " ").replace(/,/g, " ");
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length < 3) return null;

  function channel(token: string) {
    if (token.endsWith("%")) {
      return Math.max(0, Math.min(255, (Number.parseFloat(token) / 100) * 255));
    }
    return Math.max(0, Math.min(255, Number.parseFloat(token)));
  }

  const r = channel(parts[0]);
  const g = channel(parts[1]);
  const b = channel(parts[2]);
  let a = 1;

  if (parts[3] !== undefined) {
    a = parts[3].endsWith("%")
      ? Number.parseFloat(parts[3]) / 100
      : Number.parseFloat(parts[3]);
  }

  if (![r, g, b, a].every(Number.isFinite)) return null;

  return { r, g, b, a: Math.max(0, Math.min(1, a)) };
}

function composite(foreground: Rgba, background: Rgba): Rgba {
  const a = foreground.a + background.a * (1 - foreground.a);
  if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 };

  return {
    r:
      (foreground.r * foreground.a +
        background.r * background.a * (1 - foreground.a)) /
      a,
    g:
      (foreground.g * foreground.a +
        background.g * background.a * (1 - foreground.a)) /
      a,
    b:
      (foreground.b * foreground.a +
        background.b * background.a * (1 - foreground.a)) /
      a,
    a,
  };
}

function effectiveBackground(element: Element): Rgba {
  const layers: Rgba[] = [];
  let node: Element | null = element;

  while (node) {
    const background = parseColor(getComputedStyle(node).backgroundColor);
    if (background && background.a > 0) layers.push(background);
    node = node.parentElement;
  }

  const rootStyle = getComputedStyle(document.documentElement);
  const fallback =
    parseColor(rootStyle.getPropertyValue("--surface-canvas").trim()) ??
    (document.documentElement.dataset.resolvedTheme === "dark"
      ? { r: 16, g: 19, b: 21, a: 1 }
      : { r: 245, g: 242, b: 236, a: 1 });

  let result: Rgba = { ...fallback, a: 1 };
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    result = composite(layers[index], result);
  }

  return result;
}

function linearChannel(value: number) {
  const channel = value / 255;
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function luminance(color: Rgba) {
  return (
    0.2126 * linearChannel(color.r) +
    0.7152 * linearChannel(color.g) +
    0.0722 * linearChannel(color.b)
  );
}

function contrastRatio(first: Rgba, second: Rgba) {
  const a = luminance(first);
  const b = luminance(second);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function textColor(element: Element): Rgba | null {
  const parsed = parseColor(getComputedStyle(element).color);
  if (!parsed) return null;
  if (parsed.a >= 0.999) return parsed;
  return composite(parsed, effectiveBackground(element));
}

function isVisibleTextElement(element: HTMLElement) {
  const style = getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    Number.parseFloat(style.opacity || "1") <= 0.05
  ) {
    return false;
  }

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  ) {
    return true;
  }

  return Boolean(element.textContent?.trim());
}

function readCandidate(variable: string, fallback: Rgba): Rgba {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim();
  return parseColor(value) ?? fallback;
}

function chooseReadableColor(background: Rgba) {
  const candidates = [
    readCandidate("--text-primary", { r: 31, g: 35, b: 38, a: 1 }),
    readCandidate("--sidebar-text", { r: 255, g: 250, b: 242, a: 1 }),
    { r: 17, g: 20, b: 22, a: 1 },
    { r: 255, g: 250, b: 242, a: 1 },
  ];

  return candidates.reduce((best, candidate) =>
    contrastRatio(candidate, background) > contrastRatio(best, background)
      ? candidate
      : best,
  );
}

function rgbaToCss(color: Rgba) {
  return `rgb(${Math.round(color.r)} ${Math.round(color.g)} ${Math.round(color.b)})`;
}

export function ThemeContrastGuard() {
  useEffect(() => {
    let frame = 0;
    let timer = 0;
    const adjusted = new Set<HTMLElement>();

    function clearAdjustments() {
      adjusted.forEach((element) => {
        element.classList.remove("ficonter-auto-contrast");
        element.style.removeProperty("--ficonter-auto-text");
      });
      adjusted.clear();
    }

    function audit() {
      frame = 0;
      timer = 0;
      clearAdjustments();

      const scope = document.querySelector(".app-shell") ?? document.body;
      const elements = Array.from(scope.querySelectorAll<HTMLElement>(TEXT_SELECTOR));

      for (const element of elements) {
        if (!isVisibleTextElement(element)) continue;
        if (element.closest("[data-ficonter-contrast-ignore='true']")) continue;

        const foreground = textColor(element);
        if (!foreground) continue;

        const background = effectiveBackground(element);
        if (contrastRatio(foreground, background) >= MIN_CONTRAST) continue;

        const replacement = chooseReadableColor(background);
        element.style.setProperty("--ficonter-auto-text", rgbaToCss(replacement));
        element.classList.add("ficonter-auto-contrast");
        adjusted.add(element);
      }
    }

    function scheduleAudit() {
      if (frame || timer) return;
      timer = window.setTimeout(() => {
        timer = 0;
        frame = window.requestAnimationFrame(audit);
      }, 80);
    }

    const rootObserver = new MutationObserver(scheduleAudit);
    rootObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        "data-theme",
        "data-resolved-theme",
        "data-wallpaper-scene",
        "data-background-motion",
      ],
    });

    const contentObserver = new MutationObserver(scheduleAudit);
    contentObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    window.addEventListener("resize", scheduleAudit, { passive: true });
    window.addEventListener("ficonter:preferences-updated", scheduleAudit);

    scheduleAudit();

    return () => {
      rootObserver.disconnect();
      contentObserver.disconnect();
      window.removeEventListener("resize", scheduleAudit);
      window.removeEventListener("ficonter:preferences-updated", scheduleAudit);
      if (frame) window.cancelAnimationFrame(frame);
      if (timer) window.clearTimeout(timer);
      clearAdjustments();
    };
  }, []);

  return (
    <style>{`
      .ficonter-auto-contrast {
        color: var(--ficonter-auto-text) !important;
        -webkit-text-fill-color: var(--ficonter-auto-text) !important;
      }

      .ficonter-auto-contrast::placeholder {
        color: color-mix(in srgb, var(--ficonter-auto-text) 72%, transparent) !important;
        -webkit-text-fill-color: color-mix(in srgb, var(--ficonter-auto-text) 72%, transparent) !important;
        opacity: 1 !important;
      }
    `}</style>
  );
}
