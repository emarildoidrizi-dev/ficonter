import { CATEGORY_ITEMS } from "@/lib/financialOptions";
import {
  parseStatementDate,
  suggestCategory,
  transactionSignature,
  type ExistingTransactionForImport,
  type StatementRule,
} from "@/lib/statementImport";
import { extractTransactionsFromPdfLines } from "@/lib/pdfFinancialImport";
import type { DocumentCategory } from "@/lib/documentVault";
import {
  detectFinancialDocumentLanguage,
  financialTextIncludes,
  normalizeFinancialCurrencyMarkers,
  normalizeFinancialText,
  type FinancialDocumentLanguage,
} from "@/lib/financialDocumentLanguage";

export type FinancialImportDestination =
  | "transactions"
  | "bills"
  | "debt"
  | "credit_card"
  | "review";

export type ExtractionConfidence = "high" | "medium" | "low";

export const BILL_IMPORT_CATEGORIES = [
  "Housing",
  "Electricity",
  "Gas",
  "Water",
  "Internet",
  "Mobile phone",
  "Insurance",
  "Loan payment",
  "Credit card",
  "Taxes",
  "Subscriptions",
  "Streaming",
  "Transport",
  "Childcare",
  "Education",
  "Healthcare",
  "Membership",
  "Business",
  "Other",
] as const;

export type ExtractedTransactionDraft = {
  sourceRowNumber: number;
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: "income" | "expense" | "saving";
  category: string;
  included: boolean;
  possibleDuplicate: boolean;
  duplicateReason: string | null;
};

export type ExtractedBillDraft = {
  name: string;
  company: string;
  amount: number | null;
  currency: string;
  dueDate: string;
  category: string;
  recurrence: "none" | "monthly" | "yearly";
  notes: string;
};

export type ExtractedDebtDraft = {
  name: string;
  lender: string;
  category: string;
  originalBalance: number | null;
  currentBalance: number | null;
  currency: string;
  annualInterestRate: number | null;
  minimumPayment: number | null;
  paymentDueDate: string;
  startDate: string;
  maturityDate: string;
  creditLimit: number | null;
  statementBalance: number | null;
  statementDate: string;
  interestCharged: number | null;
  cardLastFour: string;
  description: string;
};

export type FinancialDocumentExtraction = {
  sourceDocumentId: string;
  sourceFileName: string;
  sourceDisplayName: string;
  sourceCategory: DocumentCategory;
  documentType: string;
  destination: FinancialImportDestination;
  confidence: ExtractionConfidence;
  documentLanguage: FinancialDocumentLanguage;
  summary: string;
  warnings: string[];
  extractedLineCount: number;
  textPreview: string[];
  transactions?: ExtractedTransactionDraft[];
  bill?: ExtractedBillDraft;
  debt?: ExtractedDebtDraft;
};

type ExtractFinancialDocumentArgs = {
  documentId: string;
  fileName: string;
  displayName: string;
  category: DocumentCategory;
  documentDate: string | null;
  lines: string[];
  baseCurrency: string;
  rules: StatementRule[];
  existingTransactions: ExistingTransactionForImport[];
};

type MoneyMatch = {
  amount: number;
  currency: string;
  line: string;
  score: number;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  "€": "EUR",
  "$": "USD",
  "£": "GBP",
  "₽": "RUB",
};

const CURRENCY_CODES = new Set([
  "EUR", "USD", "GBP", "CHF", "CAD", "AUD", "JPY", "CNY", "PLN", "SEK", "NOK", "DKK",
  "CZK", "HUF", "RON", "BGN", "TRY", "ALL", "MKD", "RSD", "BAM", "RUB", "AED", "SAR", "QAR",
]);

const MONEY_TOKEN = /(?:EUR|USD|GBP|CHF|CAD|AUD|JPY|CNY|PLN|SEK|NOK|DKK|CZK|HUF|RON|BGN|TRY|ALL|MKD|RSD|BAM|RUB|AED|SAR|QAR|€|\$|£|₽)?\s*[-+]?\s*(?:\d{1,3}(?:[.\s,]\d{3})+|\d+)(?:[.,]\d{2})\s*(?:EUR|USD|GBP|CHF|CAD|AUD|JPY|CNY|PLN|SEK|NOK|DKK|CZK|HUF|RON|BGN|TRY|ALL|MKD|RSD|BAM|RUB|AED|SAR|QAR|€|\$|£|₽)?/gi;

const DATE_GLOBAL = /(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/g;

const NET_PAY_TERMS = [
  "net pay", "net salary", "take home",
  "nettoverdienst", "auszahlungsbetrag", "netto auszahlung", "nettobezug",
  "salario neto", "sueldo neto", "líquido a percibir", "liquido a percibir", "neto a pagar",
  "paga neto", "paga e pastër", "paga e paster", "shuma neto", "për t'u paguar", "per t'u paguar",
  "صافي الراتب", "صافي الأجر", "صافي الاجر", "صافي المستحق", "المبلغ الصافي",
  "salário líquido", "salario liquido", "vencimento líquido", "vencimento liquido", "valor líquido", "valor liquido",
  "stipendio netto", "netto in busta", "netto da pagare",
  "чистая зарплата", "заработная плата", "к выплате", "сумма к выплате",
];

const TOTAL_DUE_TERMS = [
  "amount due", "total due", "balance due", "invoice total", "grand total", "total amount",
  "rechnungsbetrag", "gesamtbetrag", "zahlbetrag", "zu zahlen", "fälliger betrag", "faelliger betrag",
  "importe a pagar", "total a pagar", "importe total", "saldo pendiente",
  "shuma për t'u paguar", "shuma per t'u paguar", "totali për pagesë", "totali per pagese", "shuma totale",
  "المبلغ المستحق", "إجمالي المستحق", "اجمالي المستحق", "المبلغ الإجمالي", "المبلغ الاجمالي", "الإجمالي", "الاجمالي",
  "valor a pagar", "total a pagar", "montante devido", "valor total",
  "importo dovuto", "totale da pagare", "importo totale",
  "сумма к оплате", "итого к оплате", "общая сумма",
];

const RECEIPT_TOTAL_TERMS = [
  ...TOTAL_DUE_TERMS,
  "total",
  "total paid",
  "amount paid",
  "paid amount",
  "summe",
  "gesamt",
  "betrag",
];

const PAID_RECEIPT_TERMS = [
  "receipt", "paid", "payment completed", "payment complete", "payment method", "cash", "card payment",
  "quittung", "bezahlt", "barzahlung", "kartenzahlung",
  "recibo", "pagado", "pago realizado", "método de pago", "metodo de pago", "efectivo", "pago con tarjeta",
  "faturë e paguar", "fature e paguar", "paguar", "pagesa u krye", "mënyra e pagesës", "menyra e pageses", "para në dorë", "para ne dore", "pagesë me kartë", "pagese me karte",
  "إيصال", "ايصال", "مدفوع", "تم الدفع", "طريقة الدفع", "نقداً", "نقدا", "دفع بالبطاقة",
  "recibo", "pago", "pagamento concluído", "pagamento concluido", "método de pagamento", "metodo de pagamento", "dinheiro", "pagamento com cartão", "pagamento com cartao",
  "ricevuta", "pagato", "pagamento completato", "metodo di pagamento", "contanti", "pagamento con carta",
  "чек", "оплачено", "платеж выполнен", "платёж выполнен", "способ оплаты", "наличные", "оплата картой",
];

const CURRENT_BALANCE_TERMS = [
  "current balance", "outstanding balance", "remaining balance", "statement balance", "balance outstanding",
  "restschuld", "offener saldo", "aktueller saldo",
  "saldo actual", "saldo pendiente", "saldo restante",
  "gjendja aktuale", "bilanci aktual", "shuma e mbetur",
  "الرصيد الحالي", "الرصيد المستحق", "الرصيد المتبقي",
  "saldo atual", "saldo em dívida", "saldo em divida", "saldo restante",
  "saldo attuale", "saldo residuo", "saldo dovuto",
  "текущий баланс", "остаток задолженности", "остаток долга",
];

const ORIGINAL_BALANCE_TERMS = [
  "original balance", "original loan amount", "loan amount", "principal amount",
  "kreditbetrag", "darlehensbetrag", "ursprünglicher betrag", "urspruenglicher betrag",
  "importe original", "importe del préstamo", "importe del prestamo", "capital inicial",
  "shuma fillestare", "shuma e kredisë", "shuma e kredise", "principali",
  "المبلغ الأصلي", "المبلغ الاصلي", "مبلغ القرض", "أصل القرض", "اصل القرض",
  "saldo original", "valor do empréstimo", "valor do emprestimo", "capital inicial",
  "saldo originale", "importo del prestito", "capitale iniziale",
  "первоначальная сумма", "сумма кредита", "основной долг",
];

const MINIMUM_PAYMENT_TERMS = [
  "minimum payment", "minimum due", "monthly payment", "monthly instalment", "monthly installment",
  "mindestzahlung", "monatliche rate", "monatsrate",
  "pago mínimo", "pago minimo", "cuota mensual", "importe mínimo", "importe minimo",
  "pagesa minimale", "kësti mujor", "kesti mujor", "pagesa mujore",
  "الحد الأدنى للدفع", "الحد الادنى للدفع", "الدفعة الشهرية", "القسط الشهري",
  "pagamento mínimo", "pagamento minimo", "prestação mensal", "prestacao mensal",
  "pagamento minimo", "rata mensile", "importo minimo",
  "минимальный платеж", "минимальный платёж", "ежемесячный платеж", "ежемесячный платёж",
];

const CREDIT_LIMIT_TERMS = [
  "credit limit", "kreditlimit", "kartenlimit",
  "límite de crédito", "limite de credito",
  "limiti i kredisë", "limiti i kredise",
  "الحد الائتماني", "حد الائتمان",
  "limite de crédito", "limite de credito",
  "limite di credito",
  "кредитный лимит",
];

const INTEREST_CHARGED_TERMS = [
  "interest charged", "interest charge", "finance charge", "berechnete zinsen", "zinsen belastet",
  "intereses cobrados", "cargo por intereses",
  "interesi i ngarkuar", "interes i aplikuar",
  "الفائدة المحتسبة", "الفائده المحتسبه", "رسوم الفائدة", "رسوم الفائده",
  "juros cobrados", "encargos de juros",
  "interessi addebitati", "oneri finanziari",
  "начисленные проценты", "проценты начислены",
];

const DUE_DATE_TERMS = [
  "due date", "payment due", "pay by", "fällig am", "faellig am", "zahlbar bis", "zahlungsziel",
  "fecha de vencimiento", "fecha límite de pago", "fecha limite de pago", "pagar antes de",
  "afati i pagesës", "afati i pageses", "data e pagesës", "data e pageses", "paguaj deri më", "paguaj deri me",
  "تاريخ الاستحقاق", "موعد الاستحقاق", "الدفع قبل",
  "data de vencimento", "vencimento", "pagar até", "pagar ate",
  "data di scadenza", "scadenza", "pagare entro",
  "срок оплаты", "дата платежа", "оплатить до",
];

const STATEMENT_DATE_TERMS = [
  "statement date", "billing date", "abrechnungsdatum",
  "fecha del extracto", "fecha del estado de cuenta",
  "data e pasqyrës", "data e pasqyres", "data e ekstraktit",
  "تاريخ كشف الحساب", "تاريخ البيان",
  "data do extrato", "data da fatura",
  "data estratto conto", "data dell'estratto",
  "дата выписки", "дата отчета", "дата отчёта",
];

const CREDIT_CARD_TERMS = [
  "credit card", "credit-card", "card statement", "kreditkarte", "kartenabrechnung",
  "tarjeta de crédito", "tarjeta de credito", "estado de cuenta de tarjeta",
  "kartë krediti", "karte krediti", "pasqyra e kartës", "pasqyra e kartes",
  "بطاقة ائتمان", "بطاقة الائتمان", "كشف بطاقة ائتمان",
  "cartão de crédito", "cartao de credito", "fatura do cartão", "fatura do cartao",
  "carta di credito", "estratto carta",
  "кредитная карта", "выписка по кредитной карте",
  "visa", "mastercard", "american express", "amex",
];

function normalizeLine(value: string) {
  return normalizeFinancialCurrencyMarkers(value).replace(/\s+/g, " ").trim();
}

function parseMoneyNumber(raw: string): number | null {
  let value = normalizeFinancialCurrencyMarkers(raw).trim().replace(/\u00a0/g, " ");
  value = value
    .replace(/EUR|USD|GBP|CHF|CAD|AUD|JPY|CNY|PLN|SEK|NOK|DKK|CZK|HUF|RON|BGN|TRY|ALL|MKD|RSD|BAM|RUB|AED|SAR|QAR/gi, "")
    .replace(/[€$£₽]/g, "")
    .replace(/\s/g, "")
    .replace(/^\+/, "");

  let negative = false;
  if (value.startsWith("-")) {
    negative = true;
    value = value.slice(1);
  }
  if (value.endsWith("-")) {
    negative = true;
    value = value.slice(0, -1);
  }

  value = value.replace(/[^0-9.,]/g, "");
  if (!value) return null;

  const comma = value.lastIndexOf(",");
  const dot = value.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    value = comma > dot
      ? value.replace(/\./g, "").replace(",", ".")
      : value.replace(/,/g, "");
  } else if (comma >= 0) {
    const decimals = value.length - comma - 1;
    value = decimals === 2 ? value.replace(/\./g, "").replace(",", ".") : value.replace(/,/g, "");
  } else if (dot >= 0) {
    const decimals = value.length - dot - 1;
    if (decimals !== 2) value = value.replace(/\./g, "");
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

function currencyFromToken(raw: string, fallback: string) {
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (raw.includes(symbol)) return code;
  }
  const upper = raw.toUpperCase();
  for (const code of CURRENCY_CODES) {
    if (new RegExp(`\\b${code}\\b`).test(upper)) return code;
  }
  return fallback;
}

function amountMatches(line: string, fallbackCurrency: string): Array<{ amount: number; currency: string }> {
  const normalizedLine = normalizeFinancialCurrencyMarkers(line);
  const matches = normalizedLine.match(MONEY_TOKEN) ?? [];
  return matches
    .map((raw) => ({ amount: parseMoneyNumber(raw), currency: currencyFromToken(raw, fallbackCurrency) }))
    .filter((item): item is { amount: number; currency: string } => item.amount !== null && Math.abs(item.amount) > 0);
}

function keywordScore(line: string, keywords: string[]) {
  const normalized = normalizeFinancialText(line);
  let best = 0;
  for (const keyword of keywords) {
    const key = normalizeFinancialText(keyword);
    if (normalized === key) best = Math.max(best, 10);
    else if (financialTextIncludes(normalized, key)) best = Math.max(best, 8);
  }
  return best;
}

function findMoneyNearKeywords(lines: string[], keywords: string[], fallbackCurrency: string): MoneyMatch | null {
  let best: MoneyMatch | null = null;
  lines.forEach((line, index) => {
    const score = keywordScore(line, keywords);
    if (!score) return;

    const candidates: Array<{ line: string; proximity: number }> = [
      { line, proximity: 3 },
      { line: lines[index + 1] ?? "", proximity: 2 },
      { line: lines[index - 1] ?? "", proximity: 1 },
    ];

    for (const candidate of candidates) {
      const amounts = amountMatches(candidate.line, fallbackCurrency);
      for (const amount of amounts) {
        const finalScore = score * 10 + candidate.proximity;
        if (!best || finalScore > best.score || (finalScore === best.score && Math.abs(amount.amount) > Math.abs(best.amount))) {
          best = {
            amount: Math.abs(amount.amount),
            currency: amount.currency,
            line: candidate.line,
            score: finalScore,
          };
        }
      }
    }
  });
  return best;
}

function allDates(line: string) {
  return (normalizeFinancialCurrencyMarkers(line).match(DATE_GLOBAL) ?? [])
    .map((value) => parseStatementDate(value, "auto"))
    .filter((value): value is string => Boolean(value));
}

function findDateNearKeywords(lines: string[], keywords: string[]): string {
  let bestDate = "";
  let bestScore = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const score = keywordScore(line, keywords);
    if (!score) continue;

    const candidates = [line, lines[index + 1] ?? "", lines[index - 1] ?? ""];
    for (let proximityIndex = 0; proximityIndex < candidates.length; proximityIndex += 1) {
      const candidate = candidates[proximityIndex] ?? "";
      for (const date of allDates(candidate)) {
        const finalScore = score * 10 + (3 - proximityIndex);
        if (finalScore > bestScore) {
          bestDate = date;
          bestScore = finalScore;
        }
      }
    }
  }

  return bestDate;
}

function firstLikelyDate(lines: string[]) {
  for (const line of lines.slice(0, 80)) {
    const date = allDates(line)[0];
    if (date) return date;
  }
  return "";
}

function detectApr(lines: string[]) {
  const keywords = [
    "apr",
    "annual percentage rate",
    "annual interest rate",
    "interest rate",
    "effektiver jahreszins",
    "sollzins",
    "zinssatz",
    "taux annuel",
    "taux d'intérêt",
    "taux d interet",
    "tasa anual", "tasa de interés", "tasa de interes", "tae",
    "norma vjetore e interesit", "interesi vjetor",
    "معدل النسبة السنوية", "معدل الفائدة السنوي", "معدل الفائده السنوي",
    "taxa anual", "taxa de juro", "taxa de juros",
    "tasso annuo", "tasso di interesse",
    "годовая процентная ставка", "процентная ставка",
  ];
  for (const line of lines) {
    if (!keywordScore(line, keywords)) continue;
    const normalizedLine = normalizeFinancialCurrencyMarkers(line);
    const matches = [...normalizedLine.matchAll(/(\d{1,2}(?:[.,]\d{1,3})?)\s*%/g)];
    if (!matches.length) continue;
    const value = Number(matches[matches.length - 1][1].replace(",", "."));
    if (Number.isFinite(value) && value >= 0 && value <= 100) return value;
  }
  return null;
}

function detectCardLastFour(lines: string[]) {
  for (const line of lines.slice(0, 120)) {
    const normalized = normalizeLine(line);
    const match = normalized.match(/(?:ending|ends|endend|endet|last\s*4|letzte\s*4|últimos\s*4|ultimos\s*4|4\s*shifrat|آخر\s*4|ultimos\s*4|ultime\s*4|последние\s*4|\*{2,}|x{2,})[^0-9]{0,8}(\d{4})\b/i);
    if (match) return match[1];
  }
  return "";
}

function likelyCompany(lines: string[], displayName: string) {
  const ignored = [
    "invoice", "rechnung", "statement", "kontoauszug", "payslip", "gehaltsabrechnung", "salary", "receipt", "quittung",
    "factura", "extracto", "nómina", "nomina", "recibo",
    "faturë", "fature", "pasqyra bankare", "paga",
    "فاتورة", "كشف حساب", "راتب", "إيصال", "ايصال",
    "fatura", "extrato", "salário", "salario", "recibo",
    "fattura", "estratto conto", "busta paga", "ricevuta",
    "счет", "счёт", "выписка", "зарплата", "чек",
  ];
  for (const raw of lines.slice(0, 12)) {
    const line = normalizeLine(raw);
    const normalized = normalizeFinancialText(line);
    if (line.length < 3 || line.length > 90) continue;
    if (/^\d/.test(line) || amountMatches(line, "EUR").length || /%/.test(line)) continue;
    if (ignored.some((term) => financialTextIncludes(normalized, term))) continue;
    if (line.includes("@") || /^https?:/i.test(line)) continue;
    return line;
  }
  return displayName.replace(/\.[^.]+$/, "").slice(0, 80);
}

function billCategoryFromText(text: string) {
  const rules: Array<[string[], string]> = [
    [["electricity", "strom", "electricidad", "energía eléctrica", "luz eléctrica", "luz electrica", "energji elektrike", "energjia elektrike", "rrymë", "كهرباء", "eletricidade", "energia elétrica", "energia eletrica", "energia elettrica", "электричество", "электроэнергия", "eon", "e.on", "vattenfall", "stadtwerke"], "Electricity"],
    [["gas", "erdgas", "gas natural", "gaz", "غاز", "gás", "metano", "газ"], "Gas"],
    [["internet", "internetvertrag", "fibra", "banda ancha", "interneti", "إنترنت", "انترنت", "banda larga", "rete internet", "интернет", "vodafone", "telekom", "telefonica", "o2"], "Internet"],
    [["mobile", "mobilfunk", "handyvertrag", "móvil", "movil", "telefon celular", "telefon celular", "celular", "telefonia mobile", "هاتف محمول", "هاتف", "мобильная связь", "мобильный"], "Mobile phone"],
    [["insurance", "versicherung", "seguro", "sigurim", "تأمين", "تامين", "seguro", "assicurazione", "страхование", "страховка"], "Insurance"],
    [["rent", "miete", "alquiler", "qira", "إيجار", "ايجار", "aluguel", "affitto", "аренда", "housing", "wohnung"], "Housing"],
    [["water", "wasser", "agua", "ujë", "uje", "مياه", "água", "acqua", "вода"], "Water"],
  ];
  for (const [terms, category] of rules) {
    if (terms.some((term) => financialTextIncludes(text, term))) return category;
  }
  return "Other";
}
function detectRecurrence(text: string): "none" | "monthly" | "yearly" {
  const monthly = ["monthly", "monatlich", "per month", "mensualmente", "mensual", "çdo muaj", "cdo muaj", "mujore", "شهري", "شهرياً", "شهريا", "mensal", "mensile", "ежемесячно", "ежемесячный"];
  const yearly = ["yearly", "annual", "annually", "jahrlich", "jährlich", "per year", "anual", "çdo vit", "cdo vit", "vjetore", "سنوي", "سنوياً", "سنويا", "anual", "annuale", "ежегодно", "годовой"];
  if (monthly.some((term) => financialTextIncludes(text, term))) return "monthly";
  if (yearly.some((term) => financialTextIncludes(text, term))) return "yearly";
  return "none";
}
function transactionRowsFromStatement(
  lines: string[],
  rules: StatementRule[],
  existingTransactions: ExistingTransactionForImport[],
) {
  const extracted = extractTransactionsFromPdfLines(lines, 2000);
  const existing = new Set(existingTransactions.map((transaction) => transactionSignature({
    date: transaction.transaction_date,
    description: transaction.description,
    amount: Number(transaction.amount),
    currency: transaction.currency || "EUR",
    type: transaction.type,
  })));

  const dataRows = extracted.rows.slice(1);
  return {
    summary: extracted,
    rows: dataRows.map((row, index): ExtractedTransactionDraft => {
      const date = row[0] ?? "";
      const description = (row[1] ?? "").slice(0, 120);
      const signed = Number(row[2] ?? 0);
      const amount = Math.abs(Number.isFinite(signed) ? signed : 0);
      const currency = (row[3] || "EUR").toUpperCase();
      const type: "income" | "expense" = signed >= 0 ? "income" : "expense";
      const category = suggestCategory(description, type, rules);
      const signature = transactionSignature({ date, description, amount, currency, type });
      const possibleDuplicate = existing.has(signature);
      return {
        sourceRowNumber: index + 1,
        date,
        description,
        amount,
        currency,
        type,
        category: CATEGORY_ITEMS.includes(category) ? category : type === "income" ? "Other income" : "Other / custom",
        included: Boolean(date && description && amount > 0 && /^[A-Z]{3}$/.test(currency) && !possibleDuplicate),
        possibleDuplicate,
        duplicateReason: possibleDuplicate ? "A matching transaction already exists in FICONTER." : null,
      };
    }),
  };
}

export function extractFinancialDocumentDraft({
  documentId,
  fileName,
  displayName,
  category,
  documentDate,
  lines: rawLines,
  baseCurrency,
  rules,
  existingTransactions,
}: ExtractFinancialDocumentArgs): FinancialDocumentExtraction {
  const lines = rawLines.map(normalizeLine).filter(Boolean).slice(0, 6000);
  const text = lines.join("\n");
  const normalized = normalizeFinancialText(text);
  const fallbackCurrency = currencyFromToken(text, baseCurrency || "EUR");
  const textPreview = lines.slice(0, 24);
  const documentLanguage = detectFinancialDocumentLanguage(lines);
  const common = {
    sourceDocumentId: documentId,
    sourceFileName: fileName,
    sourceDisplayName: displayName,
    sourceCategory: category,
    documentLanguage,
    extractedLineCount: lines.length,
    textPreview,
  } as const;

  if (category === "bank_statement") {
    const statement = transactionRowsFromStatement(lines, rules, existingTransactions);
    const valid = statement.rows.filter((row) => row.date && row.description && row.amount > 0);
    if (valid.length) {
      const duplicateCount = valid.filter((row) => row.possibleDuplicate).length;
      const warnings: string[] = [];
      if (statement.summary.assumedDirectionCount > 0) {
        warnings.push(`${statement.summary.assumedDirectionCount} row${statement.summary.assumedDirectionCount === 1 ? "" : "s"} had no explicit debit/credit direction. Review those amounts before importing.`);
      }
      if (duplicateCount > 0) warnings.push(`${duplicateCount} possible duplicate${duplicateCount === 1 ? " was" : "s were"} excluded automatically.`);
      return {
        ...common,
        documentType: "Bank statement",
        destination: "transactions",
        confidence: valid.length >= 3 ? "high" : "medium",
        summary: `${valid.length} transaction${valid.length === 1 ? "" : "s"} detected for the Transactions module.`,
        warnings,
        transactions: statement.rows,
      };
    }
    return {
      ...common,
      documentType: "Bank statement",
      destination: "review",
      confidence: "low",
      summary: "The PDF is readable, but FICONTER could not safely identify transaction rows.",
      warnings: ["Try a searchable bank statement with visible transaction dates and amounts, or use the bank's CSV export."],
    };
  }

  if (category === "payslip") {
    const net = findMoneyNearKeywords(lines, NET_PAY_TERMS, fallbackCurrency);
    const payDate = documentDate || findDateNearKeywords(lines, ["pay date", "payment date", "zahlungsdatum", "auszahlung", "fecha de pago", "data e pagesës", "data e pageses", "تاريخ الدفع", "data de pagamento", "data di pagamento", "дата выплаты", "дата платежа"]) || firstLikelyDate(lines);
    const employer = likelyCompany(lines, displayName);
    const warnings: string[] = [];
    if (!net) warnings.push("Net salary was not detected confidently. Enter the amount manually before importing.");
    if (!payDate) warnings.push("Payment date was not detected. Choose the correct date before importing.");
    return {
      ...common,
      documentType: "Payslip",
      destination: "transactions",
      confidence: net ? "high" : "medium",
      summary: "FICONTER mapped this payslip to Income in Transactions.",
      warnings,
      transactions: [{
        sourceRowNumber: 1,
        date: payDate,
        description: employer ? `Salary — ${employer}`.slice(0, 120) : "Salary",
        amount: net?.amount ?? 0,
        currency: net?.currency ?? fallbackCurrency,
        type: "income",
        category: "Salary",
        included: Boolean(net && payDate),
        possibleDuplicate: false,
        duplicateReason: null,
      }],
    };
  }

  if (category === "invoice_receipt" || category === "insurance") {
    const dueDateDetected = findDateNearKeywords(lines, DUE_DATE_TERMS);
    const company = likelyCompany(lines, displayName);

    // A paid receipt belongs in Transactions, while an unpaid invoice/insurance
    // document belongs in Bills. The distinction stays deterministic and is
    // always shown to the user for review before anything is committed.
    const paidReceiptSignal = category === "invoice_receipt" &&
      PAID_RECEIPT_TERMS.some((term) => financialTextIncludes(normalized, term)) &&
      !dueDateDetected;

    if (paidReceiptSignal) {
      const total = findMoneyNearKeywords(lines, RECEIPT_TOTAL_TERMS, fallbackCurrency);
      const transactionDate = documentDate || firstLikelyDate(lines);
      const description = (company || displayName.replace(/\.[^.]+$/, "") || "Imported receipt").slice(0, 120);
      const suggested = suggestCategory(`${description} ${text.slice(0, 1200)}`, "expense", rules);
      const transactionCategory = CATEGORY_ITEMS.includes(suggested) ? suggested : "Other / custom";
      const signature = total && transactionDate
        ? transactionSignature({
            date: transactionDate,
            description,
            amount: total.amount,
            currency: total.currency,
            type: "expense",
          })
        : "";
      const existing = new Set(existingTransactions.map((transaction) => transactionSignature({
        date: transaction.transaction_date,
        description: transaction.description,
        amount: Number(transaction.amount),
        currency: transaction.currency || "EUR",
        type: transaction.type,
      })));
      const possibleDuplicate = Boolean(signature && existing.has(signature));
      const warnings: string[] = [];
      if (!total) warnings.push("The receipt total was not detected confidently. Enter it manually before importing.");
      if (!transactionDate) warnings.push("The receipt date was not detected. Choose the correct date before importing.");
      if (possibleDuplicate) warnings.push("A matching transaction already exists in FICONTER and is excluded automatically.");

      return {
        ...common,
        documentType: "Paid receipt",
        destination: "transactions",
        confidence: total && transactionDate ? "high" : total || transactionDate ? "medium" : "low",
        summary: "FICONTER mapped this paid receipt to an Expense in Transactions. Review it before importing.",
        warnings,
        transactions: [{
          sourceRowNumber: 1,
          date: transactionDate,
          description,
          amount: total?.amount ?? 0,
          currency: total?.currency ?? fallbackCurrency,
          type: "expense",
          category: transactionCategory,
          included: Boolean(total && transactionDate && !possibleDuplicate),
          possibleDuplicate,
          duplicateReason: possibleDuplicate ? "A matching transaction already exists in FICONTER." : null,
        }],
      };
    }

    const total = findMoneyNearKeywords(
      lines,
      category === "insurance" ? [...TOTAL_DUE_TERMS, "premium", "beitrag", "prämie", "praemie", "prima", "primi", "قسط التأمين", "prêmio", "premio", "premio assicurativo", "страховая премия"] : TOTAL_DUE_TERMS,
      fallbackCurrency,
    );
    const dueDate = dueDateDetected || documentDate || "";
    const recurrence = detectRecurrence(text);
    const billCategory = category === "insurance" ? "Insurance" : billCategoryFromText(text);
    const warnings: string[] = [];
    if (!total) warnings.push("The amount due was not detected confidently. Enter it manually before importing.");
    if (!dueDate) warnings.push("The due date was not detected. Choose the correct date before importing.");
    return {
      ...common,
      documentType: category === "insurance" ? "Insurance bill / policy" : "Invoice",
      destination: "bills",
      confidence: total && dueDate ? "high" : total || dueDate ? "medium" : "low",
      summary: "FICONTER mapped this document to Bills. Nothing will be saved until you review and confirm it.",
      warnings,
      bill: {
        name: displayName.replace(/\.[^.]+$/, "").slice(0, 120) || company || "Imported bill",
        company,
        amount: total?.amount ?? null,
        currency: total?.currency ?? fallbackCurrency,
        dueDate,
        category: billCategory,
        recurrence,
        notes: `Imported from Document Vault · ${fileName}`.slice(0, 1000),
      },
    };
  }

  if (category === "loan_document") {
    const looksLikeCard = CREDIT_CARD_TERMS.some((term) => financialTextIncludes(normalized, term));
    const currentBalance = findMoneyNearKeywords(lines, CURRENT_BALANCE_TERMS, fallbackCurrency);
    const originalBalance = findMoneyNearKeywords(lines, ORIGINAL_BALANCE_TERMS, currentBalance?.currency ?? fallbackCurrency);
    const minimumPayment = findMoneyNearKeywords(lines, MINIMUM_PAYMENT_TERMS, currentBalance?.currency ?? fallbackCurrency);
    const creditLimit = findMoneyNearKeywords(lines, CREDIT_LIMIT_TERMS, currentBalance?.currency ?? fallbackCurrency);
    const interestCharged = findMoneyNearKeywords(lines, INTEREST_CHARGED_TERMS, currentBalance?.currency ?? fallbackCurrency);
    const paymentDueDate = findDateNearKeywords(lines, DUE_DATE_TERMS);
    const statementDate = findDateNearKeywords(lines, STATEMENT_DATE_TERMS) || documentDate || "";
    const lender = likelyCompany(lines, displayName);
    const currency = currentBalance?.currency || originalBalance?.currency || fallbackCurrency;
    const apr = detectApr(lines);
    const lastFour = looksLikeCard ? detectCardLastFour(lines) : "";
    const warnings: string[] = [];
    if (!currentBalance) warnings.push("Current balance was not detected confidently. Enter it manually before importing.");
    if (looksLikeCard && !creditLimit) warnings.push("Credit limit was not detected. Add it if it appears on the statement.");
    if (!looksLikeCard && !originalBalance) warnings.push("Original loan balance was not detected. Review the opening balance before importing.");

    return {
      ...common,
      documentType: looksLikeCard ? "Credit-card statement" : "Loan document",
      destination: looksLikeCard ? "credit_card" : "debt",
      confidence: currentBalance ? "medium" : "low",
      summary: looksLikeCard
        ? "FICONTER mapped this document to Credit Cards. Review the detected statement values before importing."
        : "FICONTER mapped this document to Debt. Review the detected loan values before importing.",
      warnings,
      debt: {
        name: displayName.replace(/\.[^.]+$/, "").slice(0, 120) || (looksLikeCard ? "Imported credit card" : "Imported debt"),
        lender,
        category: looksLikeCard ? "Credit card" : "Personal loan",
        originalBalance: originalBalance?.amount ?? currentBalance?.amount ?? null,
        currentBalance: currentBalance?.amount ?? null,
        currency,
        annualInterestRate: apr,
        minimumPayment: minimumPayment?.amount ?? null,
        paymentDueDate,
        startDate: "",
        maturityDate: "",
        creditLimit: creditLimit?.amount ?? null,
        statementBalance: looksLikeCard ? currentBalance?.amount ?? null : null,
        statementDate: looksLikeCard ? statementDate : "",
        interestCharged: looksLikeCard ? interestCharged?.amount ?? null : null,
        cardLastFour: lastFour,
        description: `Imported from Document Vault · ${fileName}`.slice(0, 1000),
      },
    };
  }

  return {
    ...common,
    documentType:
      category === "tax_document" ? "Tax document" :
      category === "pension_record" ? "Pension record" :
      category === "contract" ? "Financial contract" : "Financial document",
    destination: "review",
    confidence: "low",
    summary: "FICONTER extracted readable text, but this document type is not safe to auto-map in V1.",
    warnings: ["Keep this document in the private vault and enter any financial effect manually. More document types can be added to the extraction engine later."],
  };
}
