import type { FiconterLanguage } from "./config";
import { LANDING_UI_TRANSLATIONS } from "./landingUiCatalog";

type NonEnglishLanguage = Exclude<FiconterLanguage, "en">;
type TranslationRow = Record<NonEnglishLanguage, string>;

function row(
  de: string,
  es: string,
  sq: string,
  ar: string,
  pt: string,
  it: string,
  ru: string,
): TranslationRow {
  return { de, es, sq, ar, pt, it, ru };
}

/** Current public-entry phrases added after the larger landing/public catalogs. */
export const PUBLIC_ENTRY_PATCH_TRANSLATIONS: Record<string, TranslationRow> = {
  "Explore privacy & trust": row(
    "Datenschutz & Vertrauen entdecken",
    "Explorar privacidad y confianza",
    "Eksploro privatësinë dhe besimin",
    "استكشف الخصوصية والثقة",
    "Explorar privacidade e confiança",
    "Esplora privacy e fiducia",
    "Изучить конфиденциальность и доверие",
  ),
  "Public guidance and support paths": row(
    "Öffentliche Hilfe und Support-Wege",
    "Guía pública y vías de soporte",
    "Udhëzime publike dhe rrugë mbështetjeje",
    "إرشادات عامة ومسارات الدعم",
    "Orientação pública e canais de suporte",
    "Guida pubblica e percorsi di assistenza",
    "Открытые материалы и пути поддержки",
  ),
  "Help": row(
    "Hilfe",
    "Ayuda",
    "Ndihmë",
    "المساعدة",
    "Ajuda",
    "Aiuto",
    "Помощь",
  ),
  "FAQ": row("FAQ", "FAQ", "FAQ", "الأسئلة الشائعة", "FAQ", "FAQ", "FAQ"),
};

Object.assign(LANDING_UI_TRANSLATIONS, PUBLIC_ENTRY_PATCH_TRANSLATIONS);
