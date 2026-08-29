import type { FiconterLanguage } from "./config";

type NonEnglishLanguage = Exclude<FiconterLanguage, "en">;
type TemplateRow = Record<NonEnglishLanguage, string>;

function row(de: string, es: string, sq: string, ar: string, pt: string, it: string, ru: string): TemplateRow {
  return { de, es, sq, ar, pt, it, ru };
}

export const GOVERNANCE_RUNTIME_TEMPLATES: Record<string, TemplateRow> = {
  "· Signed {0}": row("· Unterzeichnet {0}", "· Firmado {0}", "· Nënshkruar {0}", "· تم التوقيع {0}", "· Assinado {0}", "· Firmato {0}", "· Подписано {0}"),
  "Base currency equivalent: {0} no conversion required": row("Gegenwert in Basiswährung: {0} · keine Umrechnung erforderlich", "Equivalente en moneda base: {0} · no se requiere conversión", "Ekuivalenti në monedhën bazë: {0} · nuk kërkohet konvertim", "المعادل بالعملة الأساسية: {0} · لا يلزم تحويل", "Equivalente na moeda base: {0} · não é necessária conversão", "Equivalente nella valuta di base: {0} · nessuna conversione necessaria", "Эквивалент в базовой валюте: {0} · конвертация не требуется"),
  "Base currency equivalent: {0} displayed in {1}": row("Gegenwert in Basiswährung: {0} · angezeigt in {1}", "Equivalente en moneda base: {0} · mostrado en {1}", "Ekuivalenti në monedhën bazë: {0} · shfaqur në {1}", "المعادل بالعملة الأساسية: {0} · معروض بـ {1}", "Equivalente na moeda base: {0} · apresentado em {1}", "Equivalente nella valuta di base: {0} · visualizzato in {1}", "Эквивалент в базовой валюте: {0} · отображается в {1}"),
  "· DOB {0}": row("· Geburtsdatum {0}", "· Fecha de nacimiento {0}", "· Datëlindja {0}", "· تاريخ الميلاد {0}", "· Data de nascimento {0}", "· Data di nascita {0}", "· Дата рождения {0}"),
  "FICONTER recorded your consent on {0}.": row("FICONTER hat deine Einwilligung am {0} erfasst.", "FICONTER registró tu consentimiento el {0}.", "FICONTER regjistroi pëlqimin tënd më {0}.", "سجّل FICONTER موافقتك بتاريخ {0}.", "A FICONTER registou o seu consentimento em {0}.", "FICONTER ha registrato il tuo consenso il {0}.", "FICONTER зарегистрировал ваше согласие {0}."),
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileTemplate(template: string): RegExp {
  let pattern = "^";
  let cursor = 0;
  const matcher = /\{(\d+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(template))) {
    pattern += escapeRegex(template.slice(cursor, match.index));
    pattern += "(.+?)";
    cursor = match.index + match[0].length;
  }
  pattern += escapeRegex(template.slice(cursor));
  pattern += "$";
  return new RegExp(pattern, "u");
}

const COMPILED = Object.entries(GOVERNANCE_RUNTIME_TEMPLATES).map(([source, translations]) => ({
  translations,
  regex: compileTemplate(source),
}));

export function translateGovernanceTemplate(language: FiconterLanguage, source: string): string | null {
  if (language === "en") return source;
  for (const entry of COMPILED) {
    const match = source.match(entry.regex);
    if (!match) continue;
    return entry.translations[language].replace(/\{(\d+)\}/g, (_, rawIndex: string) => {
      const index = Number(rawIndex) + 1;
      return match[index] ?? "";
    });
  }
  return null;
}
