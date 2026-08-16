export type FinancialDocumentLanguageCode = "en" | "de" | "es" | "sq" | "ar" | "pt" | "it" | "ru" | "unknown";
export type FinancialDocumentLanguageConfidence = "high" | "medium" | "low";

export type FinancialDocumentLanguage = {
  code: FinancialDocumentLanguageCode;
  label: string;
  confidence: FinancialDocumentLanguageConfidence;
};

const LANGUAGE_LABELS: Record<FinancialDocumentLanguageCode, string> = {
  en: "English",
  de: "German",
  es: "Spanish",
  sq: "Albanian",
  ar: "Arabic",
  pt: "Portuguese",
  it: "Italian",
  ru: "Russian",
  unknown: "Unknown / mixed",
};

const ARABIC_INDIC_DIGITS: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

export function normalizeFinancialDigits(value: string) {
  return value
    .replace(/[٠-٩۰-۹]/g, (digit) => ARABIC_INDIC_DIGITS[digit] ?? digit)
    .replace(/٫/g, ".")
    .replace(/٬/g, ",")
    .replace(/٪/g, "%")
    .replace(/[−–—]/g, "-");
}

export function normalizeFinancialCurrencyMarkers(value: string) {
  return normalizeFinancialDigits(value)
    .replace(/ر\.?\s*س/giu, " SAR ")
    .replace(/د\.?\s*[إا]/giu, " AED ")
    .replace(/ر\.?\s*ق/giu, " QAR ")
    .replace(/₽/g, " RUB ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeFinancialText(value: string) {
  return normalizeFinancialCurrencyMarkers(value)
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/ـ/g, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function foldFinancialText(value: string) {
  return normalizeFinancialText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/ł/g, "l")
    .replace(/ß/g, "ss");
}

export function financialTextIncludes(value: string, term: string) {
  const comparable = (input: string) => foldFinancialText(input)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normalizedValue = comparable(value);
  const normalizedTerm = comparable(term);
  if (!normalizedValue || !normalizedTerm) return false;
  return ` ${normalizedValue} `.includes(` ${normalizedTerm} `);
}

const LANGUAGE_HINTS: Record<Exclude<FinancialDocumentLanguageCode, "unknown">, string[]> = {
  en: [
    "account statement", "bank statement", "statement date", "amount due", "due date", "net pay", "salary", "invoice", "receipt", "credit card", "current balance", "minimum payment",
  ],
  de: [
    "kontoauszug", "buchungsdatum", "verwendungszweck", "rechnung", "rechnungsbetrag", "fallig", "fällig", "gehaltsabrechnung", "nettoverdienst", "kreditkarte", "mindestzahlung", "restschuld",
  ],
  es: [
    "extracto bancario", "estado de cuenta", "fecha de operación", "fecha de operacion", "importe", "factura", "fecha de vencimiento", "salario neto", "nómina", "nomina", "tarjeta de crédito", "tarjeta de credito", "pago mínimo", "pago minimo",
  ],
  sq: [
    "pasqyra bankare", "pasqyra e llogarisë", "pasqyra e llogarise", "data e transaksionit", "përshkrimi", "pershkrimi", "shuma", "faturë", "fature", "afati i pagesës", "afati i pageses", "paga neto", "kartë krediti", "karte krediti",
  ],
  ar: [
    "كشف حساب", "كشف الحساب", "تاريخ العملية", "تاريخ المعاملة", "الوصف", "المبلغ", "فاتورة", "تاريخ الاستحقاق", "صافي الراتب", "بطاقة ائتمان", "بطاقة الائتمان", "الحد الأدنى للدفع", "الرصيد الحالي",
  ],
  pt: [
    "extrato bancário", "extrato bancario", "data da transação", "data da transacao", "descrição", "descricao", "fatura", "data de vencimento", "salário líquido", "salario liquido", "cartão de crédito", "cartao de credito", "pagamento mínimo", "pagamento minimo",
  ],
  it: [
    "estratto conto", "data operazione", "descrizione", "importo", "fattura", "data di scadenza", "stipendio netto", "busta paga", "carta di credito", "pagamento minimo", "saldo attuale",
  ],
  ru: [
    "выписка по счету", "банковская выписка", "дата операции", "описание", "сумма", "счет на оплату", "счёт на оплату", "срок оплаты", "заработная плата", "к выплате", "кредитная карта", "минимальный платеж", "минимальный платёж", "текущий баланс",
  ],
};

export function detectFinancialDocumentLanguage(lines: string[]): FinancialDocumentLanguage {
  const sample = normalizeFinancialText(lines.slice(0, 220).join("\n"));
  if (!sample) return { code: "unknown", label: LANGUAGE_LABELS.unknown, confidence: "low" };

  const scores = (Object.entries(LANGUAGE_HINTS) as Array<[Exclude<FinancialDocumentLanguageCode, "unknown">, string[]]>).map(([code, hints]) => {
    const rawMatches = hints.reduce((count, hint) => count + (financialTextIncludes(sample, hint) ? 1 : 0), 0);
    let scriptBonus = 0;
    if (code === "ar" && /[\u0600-\u06FF]/.test(sample)) scriptBonus = 3;
    if (code === "ru" && /[\u0400-\u04FF]/.test(sample)) scriptBonus = 3;
    return { code, score: rawMatches + scriptBonus, rawMatches };
  }).sort((a, b) => b.score - a.score);

  const best = scores[0];
  const second = scores[1];
  if (!best || best.score <= 0) return { code: "unknown", label: LANGUAGE_LABELS.unknown, confidence: "low" };

  const margin = best.score - (second?.score ?? 0);
  const confidence: FinancialDocumentLanguageConfidence = best.score >= 5 && margin >= 2
    ? "high"
    : best.score >= 2 && margin >= 1
      ? "medium"
      : "low";

  return { code: best.code, label: LANGUAGE_LABELS[best.code], confidence };
}
