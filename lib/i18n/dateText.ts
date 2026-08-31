import { getLanguageOption, type FiconterLanguage } from "./config";

type NonEnglishLanguage = Exclude<FiconterLanguage, "en">;

type ConfigUiTranslationRow = Record<NonEnglishLanguage, string>;

const CONFIG_UI_TRANSLATIONS: Record<string, ConfigUiTranslationRow> = {
  "About 10 seconds": {
    de: "Etwa 10 Sekunden",
    es: "Unos 10 segundos",
    sq: "Rreth 10 sekonda",
    ar: "حوالي 10 ثوانٍ",
    pt: "Cerca de 10 segundos",
    it: "Circa 10 secondi",
    ru: "Около 10 секунд",
  },
  "One screen · 3 choices": {
    de: "Ein Bildschirm · 3 Auswahlmöglichkeiten",
    es: "Una pantalla · 3 opciones",
    sq: "Një ekran · 3 zgjedhje",
    ar: "شاشة واحدة · 3 خيارات",
    pt: "Um ecrã · 3 escolhas",
    it: "Una schermata · 3 scelte",
    ru: "Один экран · 3 варианта",
  },
  "About 30 seconds": {
    de: "Etwa 30 Sekunden",
    es: "Unos 30 segundos",
    sq: "Rreth 30 sekonda",
    ar: "حوالي 30 ثانية",
    pt: "Cerca de 30 segundos",
    it: "Circa 30 secondi",
    ru: "Около 30 секунд",
  },
  "3 steps · optional details": {
    de: "3 Schritte · optionale Details",
    es: "3 pasos · detalles opcionales",
    sq: "3 hapa · detaje opsionale",
    ar: "3 خطوات · تفاصيل اختيارية",
    pt: "3 passos · detalhes opcionais",
    it: "3 passaggi · dettagli facoltativi",
    ru: "3 шага · дополнительные детали",
  },
  "Maximum control": {
    de: "Maximale Kontrolle",
    es: "Control máximo",
    sq: "Kontroll maksimal",
    ar: "أقصى تحكم",
    pt: "Controlo máximo",
    it: "Controllo massimo",
    ru: "Максимальный контроль",
  },
  "Full form · all fields": {
    de: "Vollständiges Formular · alle Felder",
    es: "Formulario completo · todos los campos",
    sq: "Formular i plotë · të gjitha fushat",
    ar: "نموذج كامل · جميع الحقول",
    pt: "Formulário completo · todos os campos",
    it: "Modulo completo · tutti i campi",
    ru: "Полная форма · все поля",
  },
};

const MONTH_TOKENS: Record<string, { index: number; style: "short" | "long" }> = {
  jan: { index: 0, style: "short" },
  january: { index: 0, style: "long" },
  feb: { index: 1, style: "short" },
  february: { index: 1, style: "long" },
  mar: { index: 2, style: "short" },
  march: { index: 2, style: "long" },
  apr: { index: 3, style: "short" },
  april: { index: 3, style: "long" },
  may: { index: 4, style: "long" },
  jun: { index: 5, style: "short" },
  june: { index: 5, style: "long" },
  jul: { index: 6, style: "short" },
  july: { index: 6, style: "long" },
  aug: { index: 7, style: "short" },
  august: { index: 7, style: "long" },
  sep: { index: 8, style: "short" },
  sept: { index: 8, style: "short" },
  september: { index: 8, style: "long" },
  oct: { index: 9, style: "short" },
  october: { index: 9, style: "long" },
  nov: { index: 10, style: "short" },
  november: { index: 10, style: "long" },
  dec: { index: 11, style: "short" },
  december: { index: 11, style: "long" },
};

const WEEKDAY_TOKENS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const ALBANIAN_MONTHS_SHORT = ["Jan", "Shk", "Mar", "Pri", "Maj", "Qer", "Kor", "Gus", "Sht", "Tet", "Nën", "Dhj"] as const;
const ALBANIAN_MONTHS_LONG = ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"] as const;
const ALBANIAN_WEEKDAYS_SHORT = ["Die", "Hën", "Mar", "Mër", "Enj", "Pre", "Sht"] as const;
const ALBANIAN_WEEKDAYS_LONG = ["e diel", "e hënë", "e martë", "e mërkurë", "e enjte", "e premte", "e shtunë"] as const;

function localizeMonth(token: string, language: FiconterLanguage): string {
  const entry = MONTH_TOKENS[token.toLowerCase()];
  if (!entry) return token;

  if (language === "sq") {
    return entry.style === "short"
      ? ALBANIAN_MONTHS_SHORT[entry.index]
      : ALBANIAN_MONTHS_LONG[entry.index];
  }

  return new Intl.DateTimeFormat(getLanguageOption(language).locale, {
    month: entry.style,
  }).format(new Date(2026, entry.index, 1));
}

function localizeWeekday(token: string, language: FiconterLanguage): string {
  const index = WEEKDAY_TOKENS[token.toLowerCase()];
  if (index === undefined) return token;
  const style = token.length <= 5 ? "short" : "long";

  if (language === "sq") {
    return style === "short"
      ? ALBANIAN_WEEKDAYS_SHORT[index]
      : ALBANIAN_WEEKDAYS_LONG[index];
  }

  // 2026-01-04 is a Sunday.
  return new Intl.DateTimeFormat(getLanguageOption(language).locale, {
    weekday: style,
  }).format(new Date(2026, 0, 4 + index));
}

function monthLooksDateLike(source: string, start: number, end: number): boolean {
  const before = source.slice(Math.max(0, start - 8), start);
  const after = source.slice(end, Math.min(source.length, end + 12));

  // Standalone chart/month-selector labels are date labels by definition.
  if (!source.slice(0, start).trim() && !source.slice(end).trim()) return true;

  return (
    /(?:\d{1,2}[\s./-]|[,–—-]\s*)$/u.test(before) ||
    /^\s*(?:\d{1,2}(?:st|nd|rd|th)?\b|[,./-]?\s*\d{4}\b)/iu.test(after)
  );
}

/**
 * Localizes English month/weekday tokens embedded in runtime-generated date
 * labels and exact configuration-driven UI fragments that are rendered from
 * non-component data structures. This keeps the selected FICONTER language as
 * the single visual source of truth without touching user-entered values.
 */
export function localizeEnglishDateTokens(
  source: string,
  language: FiconterLanguage,
): string {
  if (language === "en" || !source.trim()) return source;

  const configTranslation = CONFIG_UI_TRANSLATIONS[source]?.[language];
  if (configTranslation) return configTranslation;

  let result = source.replace(
    /\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sun|Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat)\b/gi,
    (token) => localizeWeekday(token, language),
  );

  result = result.replace(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b/gi,
    (token, offset: number) => {
      const start = Number(offset);
      const end = start + token.length;
      return monthLooksDateLike(result, start, end)
        ? localizeMonth(token, language)
        : token;
    },
  );

  return result;
}
