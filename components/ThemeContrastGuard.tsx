"use client";

import { useEffect } from "react";

type Rgba = { r: number; g: number; b: number; a: number };
type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout?: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

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
const CONTENT_AUDIT_DELAY_MS = 90;
const FULL_AUDIT_DELAY_MS = 180;

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
    const adjusted = new Set<HTMLElement>();
    const pendingRoots = new Set<Element>();
    const idleWindow = window as IdleWindow;

    let timer = 0;
    let idleHandle = 0;
    let fullAuditRequested = false;

    function removeAdjustment(element: HTMLElement) {
      element.classList.remove("ficonter-auto-contrast");
      element.style.removeProperty("--ficonter-auto-text");
      adjusted.delete(element);
    }

    function clearAdjustments() {
      for (const element of adjusted) {
        if (element.isConnected) {
          element.classList.remove("ficonter-auto-contrast");
          element.style.removeProperty("--ficonter-auto-text");
        }
      }
      adjusted.clear();
    }

    function purgeDisconnectedAdjustments() {
      for (const element of adjusted) {
        if (!element.isConnected) adjusted.delete(element);
      }
    }

    function auditElement(element: HTMLElement) {
      if (!element.isConnected) return;

      if (adjusted.has(element)) removeAdjustment(element);
      if (!isVisibleTextElement(element)) return;
      if (element.closest("[data-ficonter-contrast-ignore='true']")) return;

      const foreground = textColor(element);
      if (!foreground) return;

      const background = effectiveBackground(element);
      if (contrastRatio(foreground, background) >= MIN_CONTRAST) return;

      const replacement = chooseReadableColor(background);
      element.style.setProperty("--ficonter-auto-text", rgbaToCss(replacement));
      element.classList.add("ficonter-auto-contrast");
      adjusted.add(element);
    }

    function collectElements(root: Element) {
      const elements: HTMLElement[] = [];
      if (root instanceof HTMLElement && root.matches(TEXT_SELECTOR)) {
        elements.push(root);
      }
      elements.push(...Array.from(root.querySelectorAll<HTMLElement>(TEXT_SELECTOR)));
      return elements;
    }

    function fullAudit() {
      clearAdjustments();
      pendingRoots.clear();

      const scope = document.querySelector(".app-shell") ?? document.body;
      const elements = Array.from(scope.querySelectorAll<HTMLElement>(TEXT_SELECTOR));
      for (const element of elements) auditElement(element);
    }

    function incrementalAudit() {
      purgeDisconnectedAdjustments();
      if (!pendingRoots.size) return;

      const seen = new Set<HTMLElement>();
      for (const root of pendingRoots) {
        if (!root.isConnected) continue;
        for (const element of collectElements(root)) seen.add(element);
      }
      pendingRoots.clear();

      for (const element of seen) auditElement(element);
    }

    function runScheduledAudit() {
      idleHandle = 0;
      if (fullAuditRequested) {
        fullAuditRequested = false;
        fullAudit();
      } else {
        incrementalAudit();
      }
    }

    function scheduleRunner(delay: number) {
      if (timer || idleHandle) return;

      timer = window.setTimeout(() => {
        timer = 0;
        if (idleWindow.requestIdleCallback) {
          idleHandle = idleWindow.requestIdleCallback(runScheduledAudit, {
            timeout: 450,
          });
        } else {
          idleHandle = window.setTimeout(runScheduledAudit, 0);
        }
      }, delay);
    }

    function scheduleFullAudit() {
      fullAuditRequested = true;
      pendingRoots.clear();
      scheduleRunner(FULL_AUDIT_DELAY_MS);
    }

    function scheduleIncrementalAudit(root: Element) {
      if (fullAuditRequested) return;
      pendingRoots.add(root);
      scheduleRunner(CONTENT_AUDIT_DELAY_MS);
    }

    function clearRemovedTree(root: Element) {
      if (root instanceof HTMLElement && adjusted.has(root)) removeAdjustment(root);
      for (const element of root.querySelectorAll<HTMLElement>(".ficonter-auto-contrast")) {
        removeAdjustment(element);
      }
    }

    const rootObserver = new MutationObserver(scheduleFullAudit);
    rootObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        "data-theme",
        "data-resolved-theme",
        "data-wallpaper-scene",
        "data-background-motion",
      ],
    });

    const contentObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) scheduleIncrementalAudit(node);
          else if (node.parentElement) scheduleIncrementalAudit(node.parentElement);
        }
        for (const node of mutation.removedNodes) {
          if (node instanceof Element) clearRemovedTree(node);
        }
      }
    });
    contentObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    let resizeTimer = 0;
    function onResize() {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = 0;
        scheduleFullAudit();
      }, 320);
    }

    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("ficonter:preferences-updated", scheduleFullAudit);

    scheduleFullAudit();

    return () => {
      rootObserver.disconnect();
      contentObserver.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("ficonter:preferences-updated", scheduleFullAudit);
      if (resizeTimer) window.clearTimeout(resizeTimer);
      if (timer) window.clearTimeout(timer);
      if (idleHandle) {
        if (idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(idleHandle);
        else window.clearTimeout(idleHandle);
      }
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
