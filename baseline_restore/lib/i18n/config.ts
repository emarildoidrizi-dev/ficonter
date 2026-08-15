export const FICONTER_LANGUAGES = [
  "en",
  "de",
  "es",
  "sq",
  "ar",
  "pt",
  "it",
  "ru",
] as const;

export type FiconterLanguage = (typeof FICONTER_LANGUAGES)[number];

export type LanguageOption = {
  code: FiconterLanguage;
  nativeName: string;
  englishName: string;
  locale: string;
  direction: "ltr" | "rtl";
};

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: "en", nativeName: "English", englishName: "English", locale: "en-GB", direction: "ltr" },
  { code: "de", nativeName: "Deutsch", englishName: "German", locale: "de-DE", direction: "ltr" },
  { code: "es", nativeName: "Español", englishName: "Spanish", locale: "es-ES", direction: "ltr" },
  { code: "sq", nativeName: "Shqip", englishName: "Albanian", locale: "sq-AL", direction: "ltr" },
  { code: "ar", nativeName: "العربية", englishName: "Arabic", locale: "ar", direction: "rtl" },
  { code: "pt", nativeName: "Português", englishName: "Portuguese", locale: "pt-PT", direction: "ltr" },
  { code: "it", nativeName: "Italiano", englishName: "Italian", locale: "it-IT", direction: "ltr" },
  { code: "ru", nativeName: "Русский", englishName: "Russian", locale: "ru-RU", direction: "ltr" },
] as const;

export const DEFAULT_LANGUAGE: FiconterLanguage = "en";
export const LANGUAGE_STORAGE_KEY = "ficonter-language";
export const LANGUAGE_COOKIE_NAME = "ficonter_language";
export const LANGUAGE_CHANGED_EVENT = "ficonter:language-changed";

export function isFiconterLanguage(value: unknown): value is FiconterLanguage {
  return typeof value === "string" && (FICONTER_LANGUAGES as readonly string[]).includes(value);
}

export function normalizeLanguage(value: unknown): FiconterLanguage {
  if (isFiconterLanguage(value)) return value;

  if (typeof value === "string") {
    const compact = value.trim().toLowerCase().split(/[-_]/)[0];
    if (isFiconterLanguage(compact)) return compact;
  }

  return DEFAULT_LANGUAGE;
}

export function getLanguageOption(language: FiconterLanguage): LanguageOption {
  return LANGUAGE_OPTIONS.find((option) => option.code === language) ?? LANGUAGE_OPTIONS[0];
}

export function isRtlLanguage(language: FiconterLanguage): boolean {
  return getLanguageOption(language).direction === "rtl";
}
