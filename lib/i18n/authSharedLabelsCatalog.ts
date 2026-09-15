import type { FiconterLanguage } from "./config";
import { PHRASE_TRANSLATIONS } from "./phrases";

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

/** Small shared labels used by the login/registration preview cards and chrome. */
export const AUTH_SHARED_LABEL_TRANSLATIONS: Record<string, TranslationRow> = {
  "Private by design": row(
    "Von Grund auf privat",
    "Privado por diseño",
    "Private që nga projektimi",
    "خاص بحكم التصميم",
    "Privado desde a conceção",
    "Privato per progettazione",
    "Приватность по замыслу",
  ),
  "Access": row("Zugang", "Acceso", "Qasje", "الوصول", "Acesso", "Accesso", "Доступ"),
  "Money": row("Geld", "Dinero", "Paratë", "المال", "Dinheiro", "Denaro", "Деньги"),
  "Planning": row("Planung", "Planificación", "Planifikimi", "التخطيط", "Planeamento", "Pianificazione", "Планирование"),
  "Wealth": row("Vermögen", "Patrimonio", "Pasuria", "الثروة", "Património", "Patrimonio", "Капитал"),
  "Copyright notice": row(
    "Copyright-Hinweis",
    "Aviso de derechos de autor",
    "Njoftim për të drejtat e autorit",
    "إشعار حقوق النشر",
    "Aviso de direitos de autor",
    "Avviso sul copyright",
    "Уведомление об авторских правах",
  ),
  "Ficonter homepage": row(
    "Ficonter-Startseite",
    "Página de inicio de Ficonter",
    "Faqja kryesore e Ficonter",
    "الصفحة الرئيسية لـ Ficonter",
    "Página inicial da Ficonter",
    "Homepage Ficonter",
    "Главная страница Ficonter",
  ),
};

Object.assign(PHRASE_TRANSLATIONS, AUTH_SHARED_LABEL_TRANSLATIONS);
