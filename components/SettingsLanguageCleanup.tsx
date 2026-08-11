"use client";

import { useEffect } from "react";
import { useLanguage } from "./LanguageProvider";

const LANGUAGE_LABELS = new Set([
  "language",
  "sprache",
  "idioma",
  "gjuha",
  "اللغة",
  "lingua",
  "язык",
]);

function normalized(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function removeLanguageSettingsEntry() {
  if (!window.location.pathname.startsWith("/dashboard/settings")) {
    return;
  }

  const navigation =
    document.querySelector<HTMLElement>('[aria-label="Settings sections"]') ??
    document.querySelector<HTMLElement>("aside");

  if (!navigation) return;

  const buttons = Array.from(
    navigation.querySelectorAll<HTMLButtonElement>("button"),
  );

  let removedActive = false;

  for (const button of buttons) {
    const firstStrong = button.querySelector("strong");
    const label = normalized(firstStrong?.textContent);

    if (LANGUAGE_LABELS.has(label)) {
      if (
        button.getAttribute("aria-current") === "page" ||
        button.className.toLocaleLowerCase().includes("active")
      ) {
        removedActive = true;
      }

      button.hidden = true;
      button.setAttribute("aria-hidden", "true");
      button.tabIndex = -1;
    }
  }

  const params = new URLSearchParams(window.location.search);
  const requestedLanguageSection =
    params.get("section")?.toLocaleLowerCase() === "language";

  const heading = document.querySelector<HTMLElement>("main h2");
  const activeHeadingIsLanguage =
    heading && LANGUAGE_LABELS.has(normalized(heading.textContent));

  if (
    requestedLanguageSection ||
    removedActive ||
    activeHeadingIsLanguage
  ) {
    const firstVisible = buttons.find(
      (button) => !button.hidden && button.tabIndex !== -1,
    );

    if (firstVisible) {
      params.delete("section");
      const query = params.toString();
      const nextUrl =
        window.location.pathname +
        (query ? `?${query}` : "") +
        window.location.hash;

      window.history.replaceState(
        window.history.state,
        "",
        nextUrl,
      );

      firstVisible.click();
    }
  }
}

export function SettingsLanguageCleanup() {
  const { language } = useLanguage();

  useEffect(() => {
    let frame = 0;

    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(
        removeLanguageSettingsEntry,
      );
    };

    schedule();

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("popstate", schedule);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("popstate", schedule);
    };
  }, [language]);

  return null;
}
