import { CATEGORY_TRANSLATIONS } from "./categoryTranslations";
import { PHRASE_TRANSLATIONS } from "./phrases";

// Register canonical category/group labels with the same runtime translation
// dictionary used by the global LanguageProvider. Because option values remain
// untouched, only visible labels change when the user switches language.
Object.assign(PHRASE_TRANSLATIONS, CATEGORY_TRANSLATIONS);
