"use client";

import { useEffect } from "react";
import {
  LANGUAGE_COOKIE_NAME,
  LANGUAGE_STORAGE_KEY,
  isFiconterLanguage,
  normalizeLanguage,
  type FiconterLanguage,
} from "@/lib/i18n/config";
import { useLanguage } from "./LanguageProvider";

function browserLanguagePreference(): FiconterLanguage | null {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isFiconterLanguage(stored)) return stored;

    const cookieMatch = document.cookie.match(
      new RegExp(`(?:^|; )${LANGUAGE_COOKIE_NAME}=([^;]*)`),
    );

    if (cookieMatch) {
      return normalizeLanguage(decodeURIComponent(cookieMatch[1]));
    }
  } catch {
    // The authenticated account preference remains the fallback.
  }

  return null;
}

export function AuthenticatedLanguageBootstrap({
  language,
}: {
  language?: string;
}) {
  const { changeLanguage } = useLanguage();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const browserLanguage = browserLanguagePreference();

      if (browserLanguage) {
        const accountLanguage = language
          ? normalizeLanguage(language)
          : null;

        // A language deliberately selected on the landing/login experience is
        // the same preference used after authentication. If the account still
        // carries an older value, synchronize it in the background.
        void changeLanguage(
          browserLanguage,
          accountLanguage !== browserLanguage,
        );
        return;
      }

      if (language) {
        // On a new browser/device with no public preference, inherit the saved
        // account language and mirror it back to the public experience.
        void changeLanguage(normalizeLanguage(language), false);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [changeLanguage, language]);

  return null;
}
