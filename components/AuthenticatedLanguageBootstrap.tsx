"use client";

import { useEffect } from "react";
import { normalizeLanguage } from "@/lib/i18n/config";
import { useLanguage } from "./LanguageProvider";

export function AuthenticatedLanguageBootstrap({
  language,
}: {
  language?: string;
}) {
  const { changeLanguage } = useLanguage();

  useEffect(() => {
    if (!language) return;
    const timer = window.setTimeout(() => {
      void changeLanguage(normalizeLanguage(language), false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [changeLanguage, language]);

  return null;
}
