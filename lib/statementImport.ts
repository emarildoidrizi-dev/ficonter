import { CATEGORY_ITEMS } from "@/lib/financialOptions";
import { foldFinancialText, normalizeFinancialDigits } from "@/lib/financialDocumentLanguage";

export type StatementDateFormat =
  | "auto"
  | "yyyy-mm-dd"
  | "dd.mm.yyyy"
  | "dd/mm/yyyy"
  | "mm/dd/yyyy"
  | "dd-mm-yyyy";

export type StatementNumberFormat = "auto" | "1,234.56" | "1.234,56";

export type StatementMapping = {
  dateColumn: number | null;
  descriptionColumn: number | null;
  extraDescriptionColumn: number | null;
  amountColumn: number | null;
  debitColumn: number | null;
  creditColumn: number | null;
  currencyColumn: number | null;
  dateFormat: StatementDateFormat;
  numberFormat: StatementNumberFormat;
  defaultCurrency: string;
};

export type StatementRule = {
  id?: string;
  match_text: string;
  category: string;
  transaction_type: "income" | "expense" | "saving" | null;
  priority?: number;
};

export type ExistingTransactionForImport = {
  description: string;
  amount: number | string;
  currency: string;
  type: string;
  transaction_date: string;
};

export type PreparedStatementRow = {
  sourceRowNumber: number;
  raw: string[];
  date: string;
  description: string;
  amount: number;
  signedAmount: number;
  currency: string;
  type: "income" | "expense" | "saving";
  category: string;
  merchantKey: string;
  rememberRule: boolean;
  included: boolean;
  possibleDuplicate: boolean;
  duplicateReason: string | null;
  parseError: string | null;
  occurrence: number;
  rate: number;
  rateDate: string;
  rateSource: string;
};

const DATE_HEADER_HINTS = [
  "date", "transaction date", "booking date", "value date", "buchungstag", "buchungsdatum", "valutadatum", "datum",
  "fecha", "fecha de operación", "fecha de operacion", "fecha valor",
  "data", "data e transaksionit", "data e veprimit",
  "التاريخ", "تاريخ العملية", "تاريخ المعاملة",
  "data da transação", "data da transacao", "data de lançamento", "data de lancamento",
  "data operazione", "data valuta",
  "дата", "дата операции", "дата проводки",
];
const DESCRIPTION_HEADER_HINTS = [
  "description", "merchant", "payee", "purpose", "memo", "details", "buchungstext", "verwendungszweck", "empfaenger", "empfänger", "auftraggeber", "name",
  "descripción", "descripcion", "concepto", "beneficiario", "comercio",
  "përshkrimi", "pershkrimi", "qëllimi", "qellimi", "përfituesi", "perfituesi",
  "الوصف", "البيان", "التفاصيل", "المستفيد", "الغرض",
  "descrição", "descricao", "detalhes", "beneficiário", "beneficiario",
  "descrizione", "causale", "beneficiario",
  "описание", "назначение", "получатель", "детали",
];
const EXTRA_DESCRIPTION_HEADER_HINTS = [
  "reference", "note", "additional information", "zusatzinformation", "kundenreferenz",
  "referencia", "nota", "información adicional", "informacion adicional",
  "referenca", "shënim", "shenim", "informacion shtesë", "informacion shtese",
  "المرجع", "ملاحظة", "معلومات إضافية", "معلومات اضافية",
  "referência", "referencia", "nota", "informação adicional", "informacao adicional",
  "riferimento", "nota", "informazioni aggiuntive",
  "ссылка", "примечание", "дополнительная информация",
];
const AMOUNT_HEADER_HINTS = [
  "amount", "transaction amount", "value", "betrag", "umsatz",
  "importe", "monto", "valor",
  "shuma", "vlera",
  "المبلغ", "القيمة",
  "valor", "montante",
  "importo", "valore",
  "сумма", "значение",
];
const DEBIT_HEADER_HINTS = [
  "debit", "money out", "withdrawal", "paid out", "soll", "belastung", "ausgang",
  "débito", "debito", "cargo", "salida", "retirada",
  "debit", "dalje", "tërheqje", "terheqje",
  "مدين", "خصم", "سحب", "مبلغ خارج",
  "débito", "debito", "saída", "saida", "levantamento",
  "addebito", "uscita", "prelievo",
  "дебет", "списание", "расход", "снятие",
];
const CREDIT_HEADER_HINTS = [
  "credit", "money in", "deposit", "paid in", "haben", "gutschrift", "eingang",
  "crédito", "credito", "abono", "ingreso",
  "kredit", "hyrje", "depozitë", "depozite",
  "دائن", "إيداع", "ايداع", "مبلغ داخل",
  "crédito", "credito", "entrada", "depósito", "deposito",
  "accredito", "entrata", "deposito",
  "кредит", "зачисление", "поступление",
];
const CURRENCY_HEADER_HINTS = [
  "currency", "ccy", "währung", "waehrung", "moneda", "valuta", "monedha", "العملة", "moeda", "valuta", "валюта",
];

const STOP_WORDS = new Set([
  "sepa",
  "lastschrift",
  "ueberweisung",
  "überweisung",
  "kartenzahlung",
  "karte",
  "visa",
  "mastercard",
  "debit",
  "credit",
  "payment",
  "transaction",
  "buchung",
  "gutschrift",
  "online",
  "pos",
  "ec",
  "ref",
  "referenz",
]);

const BUILT_IN_CATEGORY_RULES: Array<{
  terms: string[];
  category: string;
  type?: "income" | "expense";
}> = [
  { terms: ["gehalt", "salary", "lohn", "payroll", "wages", "nómina", "nomina", "salario", "sueldo", "paga", "rroga", "راتب", "salário", "ordenado", "stipendio", "зарплата", "заработная плата"], category: "Salary", type: "income" },
  { terms: ["bonus", "bonificación", "bonificacion", "shpërblim", "shperblim", "مكافأة", "مكافاه", "bónus", "premio", "бонус", "премия"], category: "Bonus", type: "income" },
  { terms: ["refund", "rückerstattung", "erstattung", "reembolso", "rimbursim", "استرداد", "rimborso", "возврат"], category: "Refund", type: "income" },
  { terms: ["miete", "rent", "alquiler", "qira", "إيجار", "ايجار", "aluguel", "affitto", "аренда"], category: "Rent", type: "expense" },
  { terms: ["rewe", "aldi", "lidl", "edeka", "kaufland", "netto", "penny", "supermercado", "ushqimore", "سوبرماركت", "supermercato", "продукты", "супермаркет"], category: "Groceries", type: "expense" },
  { terms: ["dm drogerie", "rossmann", "mueller drogerie", "müller drogerie", "droguería", "drogueria", "kozmetikë", "kozmetike", "صيدلية تجميل", "drogaria", "profumeria", "косметика"], category: "Toiletries", type: "expense" },
  { terms: ["netflix", "prime video", "disney plus", "disney+"], category: "Streaming", type: "expense" },
  { terms: ["spotify", "apple music", "deezer"], category: "Music", type: "expense" },
  { terms: ["vodafone", "telekom", "telefonica", "o2 germany", "telefonía móvil", "telefonia movil", "telefon celular", "هاتف محمول", "telefonia móvel", "telefonia movel", "telefonia mobile", "мобильная связь"], category: "Mobile phone", type: "expense" },
  { terms: ["stadtwerke", "eon", "e.on", "vattenfall", "enbw", "electricidad", "energji elektrike", "كهرباء", "eletricidade", "energia elettrica", "электроэнергия"], category: "Electricity", type: "expense" },
  { terms: ["shell", "aral", "esso", "totalenergies", "tankstelle", "gasolina", "combustible", "karburant", "وقود", "combustível", "combustivel", "carburante", "топливо", "азс"], category: "Fuel", type: "expense" },
  { terms: ["deutsche bahn", "db vertrieb", "bahn.de", "tren", "hekurudhë", "hekurudhe", "قطار", "comboio", "trem", "treno", "поезд", "железная дорога"], category: "Rail travel", type: "expense" },
  { terms: ["uber", "bolt", "free now", "taxi", "taksi", "تاكسي", "такси"], category: "Taxi / rideshare", type: "expense" },
  { terms: ["friseur", "haircut", "barber", "peluquería", "peluqueria", "berber", "parukeri", "حلاق", "cabeleireiro", "barbiere", "парикмахер"], category: "Haircut", type: "expense" },
  { terms: ["apotheke", "pharmacy", "farmacia", "farmaci", "صيدلية", "farmácia", "аптека"], category: "Pharmacy", type: "expense" },
  { terms: ["amazon", "mediamarkt", "saturn", "electrónica", "electronica", "elektronikë", "elektronike", "إلكترونيات", "الكترونيات", "eletrónica", "eletronica", "elettronica", "электроника"], category: "Electronics", type: "expense" },
  { terms: ["paypal"], category: "Other / custom", type: "expense" },
];

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeDescription(value: string) {
  return normalizeWhitespace(
    foldFinancialText(value)
      .replace(/[^\p{L}\p{N}\s]/gu, " "),
  );
}
export function deriveMerchantKey(description: string) {
  const tokens = normalizeDescription(description)
    .split(" ")
    .filter(Boolean)
    .filter((token) => !STOP_WORDS.has(token))
    .filter((token) => !/^\d+$/.test(token))
    .filter((token) => token.length > 1)
    .slice(0, 3);
  return tokens.join(" ").slice(0, 80) || normalizeDescription(description).slice(0, 80);
}

function headerScore(header: string, hints: string[]) {
  const normalized = normalizeDescription(header);
  let best = -1;
  hints.forEach((hint, index) => {
    const normalizedHint = normalizeDescription(hint);
    if (normalized === normalizedHint) best = Math.max(best, 100 - index);
    else if (normalized.includes(normalizedHint)) best = Math.max(best, 60 - index);
  });
  return best;
}

function bestHeaderIndex(headers: string[], hints: string[], excluded = new Set<number>()) {
  let bestIndex: number | null = null;
  let bestScore = -1;
  headers.forEach((header, index) => {
    if (excluded.has(index)) return;
    const score = headerScore(header, hints);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = score >= 0 ? index : null;
    }
  });
  return bestIndex;
}

export function autoMapHeaders(headers: string[], defaultCurrency = "EUR"): StatementMapping {
  const dateColumn = bestHeaderIndex(headers, DATE_HEADER_HINTS);
  const descriptionColumn = bestHeaderIndex(headers, DESCRIPTION_HEADER_HINTS);
  const extraDescriptionColumn = bestHeaderIndex(
    headers,
    EXTRA_DESCRIPTION_HEADER_HINTS,
    new Set(descriptionColumn === null ? [] : [descriptionColumn]),
  );
  const amountColumn = bestHeaderIndex(headers, AMOUNT_HEADER_HINTS);
  const debitColumn = bestHeaderIndex(headers, DEBIT_HEADER_HINTS);
  const creditColumn = bestHeaderIndex(headers, CREDIT_HEADER_HINTS);
  const currencyColumn = bestHeaderIndex(headers, CURRENCY_HEADER_HINTS);

  return {
    dateColumn,
    descriptionColumn,
    extraDescriptionColumn,
    amountColumn,
    debitColumn,
    creditColumn,
    currencyColumn,
    dateFormat: "auto",
    numberFormat: "auto",
    defaultCurrency,
  };
}

export function parseDelimitedText(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const value = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const next = value[index + 1];

    if (character === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && character === delimiter) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      cell = "";
      if (row.some((entry) => entry !== "")) rows.push(row);
      row = [];
      continue;
    }

    cell += character;
  }

  row.push(cell.trim());
  if (row.some((entry) => entry !== "")) rows.push(row);
  return rows;
}

export function detectDelimiter(text: string) {
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestScore = -1;

  candidates.forEach((candidate) => {
    const rows = parseDelimitedText(text.slice(0, 50_000), candidate).slice(0, 12);
    const widths = rows.map((row) => row.length).filter((width) => width > 1);
    if (!widths.length) return;
    const commonWidth = widths.sort((a, b) =>
      widths.filter((width) => width === b).length - widths.filter((width) => width === a).length,
    )[0];
    const consistency = widths.filter((width) => width === commonWidth).length;
    const score = commonWidth * 10 + consistency;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  });

  return best;
}

export function parseMoney(value: string, format: StatementNumberFormat) {
  let cleaned = normalizeFinancialDigits(value).trim().replace(/\u00a0/g, "");
  if (!cleaned) return null;
  let negative = false;
  if (/^\(.*\)$/.test(cleaned)) {
    negative = true;
    cleaned = cleaned.slice(1, -1);
  }
  if (cleaned.endsWith("-")) {
    negative = true;
    cleaned = cleaned.slice(0, -1);
  }
  cleaned = cleaned.replace(/[^0-9,.-]/g, "");
  if (!cleaned) return null;

  if (format === "1.234,56") {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (format === "1,234.56") {
    cleaned = cleaned.replace(/,/g, "");
  } else {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastComma >= 0 && lastDot >= 0) {
      if (lastComma > lastDot) cleaned = cleaned.replace(/\./g, "").replace(",", ".");
      else cleaned = cleaned.replace(/,/g, "");
    } else if (lastComma >= 0) {
      const decimals = cleaned.length - lastComma - 1;
      if (decimals === 1 || decimals === 2) cleaned = cleaned.replace(/\./g, "").replace(",", ".");
      else cleaned = cleaned.replace(/,/g, "");
    } else if (lastDot >= 0) {
      const decimals = cleaned.length - lastDot - 1;
      if (!(decimals === 1 || decimals === 2)) cleaned = cleaned.replace(/\./g, "");
    }
  }

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -Math.abs(parsed) : parsed;
}

function validDateParts(year: number, month: number, day: number) {
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseStatementDate(value: string, format: StatementDateFormat) {
  const clean = normalizeFinancialDigits(value).trim();
  if (!clean) return null;

  const isoMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch && (format === "auto" || format === "yyyy-mm-dd")) {
    return validDateParts(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const parts = clean.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (!parts) return null;
  const first = Number(parts[1]);
  const second = Number(parts[2]);
  let year = Number(parts[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;

  if (format === "mm/dd/yyyy") return validDateParts(year, first, second);
  if (format === "dd.mm.yyyy" || format === "dd/mm/yyyy" || format === "dd-mm-yyyy") {
    return validDateParts(year, second, first);
  }

  if (first > 12) return validDateParts(year, second, first);
  if (second > 12) return validDateParts(year, first, second);
  return validDateParts(year, second, first);
}

export function suggestCategory(
  description: string,
  type: "income" | "expense" | "saving",
  rules: StatementRule[],
) {
  const normalized = normalizeDescription(description);
  const matchingRule = [...rules]
    .sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0))
    .find((rule) => {
      const ruleText = normalizeDescription(rule.match_text);
      return (
        ruleText.length >= 2 &&
        normalized.includes(ruleText) &&
        (!rule.transaction_type || rule.transaction_type === type)
      );
    });
  if (matchingRule && CATEGORY_ITEMS.includes(matchingRule.category)) return matchingRule.category;

  const builtIn = BUILT_IN_CATEGORY_RULES.find(
    (rule) =>
      (!rule.type || rule.type === type) &&
      rule.terms.some((term) => normalized.includes(normalizeDescription(term))),
  );
  if (builtIn) return builtIn.category;
  if (type === "income") return "Other income";
  if (type === "saving") return "General savings";
  return "Other / custom";
}

export function transactionSignature({
  date,
  description,
  amount,
  currency,
  type,
}: {
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: string;
}) {
  return [
    date,
    normalizeDescription(description),
    Math.abs(amount).toFixed(2),
    currency.toUpperCase(),
    type,
  ].join("|");
}

export function prepareStatementRows({
  rows,
  mapping,
  rules,
  existingTransactions,
  sourceRowOffset = 2,
}: {
  rows: string[][];
  mapping: StatementMapping;
  rules: StatementRule[];
  existingTransactions: ExistingTransactionForImport[];
  sourceRowOffset?: number;
}) {
  const existingSignatures = new Set(
    existingTransactions.map((transaction) =>
      transactionSignature({
        date: transaction.transaction_date,
        description: transaction.description,
        amount: Number(transaction.amount),
        currency: transaction.currency || "EUR",
        type: transaction.type,
      }),
    ),
  );
  const occurrenceMap = new Map<string, number>();

  return rows.map((raw, index): PreparedStatementRow => {
    const sourceRowNumber = index + sourceRowOffset;
    const rawDate = mapping.dateColumn === null ? "" : raw[mapping.dateColumn] ?? "";
    const date = parseStatementDate(rawDate, mapping.dateFormat) ?? "";
    const primaryDescription = mapping.descriptionColumn === null ? "" : raw[mapping.descriptionColumn] ?? "";
    const extraDescription = mapping.extraDescriptionColumn === null ? "" : raw[mapping.extraDescriptionColumn] ?? "";
    const description = normalizeWhitespace([primaryDescription, extraDescription].filter(Boolean).join(" — ")).slice(0, 120);

    let signedAmount: number | null = null;
    if (mapping.amountColumn !== null) {
      signedAmount = parseMoney(raw[mapping.amountColumn] ?? "", mapping.numberFormat);
    } else {
      const debit = mapping.debitColumn === null ? null : parseMoney(raw[mapping.debitColumn] ?? "", mapping.numberFormat);
      const credit = mapping.creditColumn === null ? null : parseMoney(raw[mapping.creditColumn] ?? "", mapping.numberFormat);
      if (credit !== null && Math.abs(credit) > 0) signedAmount = Math.abs(credit);
      else if (debit !== null && Math.abs(debit) > 0) signedAmount = -Math.abs(debit);
    }

    const rawCurrency = mapping.currencyColumn === null ? mapping.defaultCurrency : raw[mapping.currencyColumn] ?? mapping.defaultCurrency;
    const currency = rawCurrency.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || mapping.defaultCurrency;
    const type: "income" | "expense" = (signedAmount ?? 0) >= 0 ? "income" : "expense";
    const amount = Math.abs(signedAmount ?? 0);
    const category = suggestCategory(description, type, rules);
    const merchantKey = deriveMerchantKey(description);

    let parseError: string | null = null;
    if (!date) parseError = "Date could not be read.";
    else if (!description) parseError = "Description is missing.";
    else if (signedAmount === null || amount <= 0) parseError = "Amount could not be read.";
    else if (!/^[A-Z]{3}$/.test(currency)) parseError = "Currency is invalid.";

    const signature = transactionSignature({ date, description, amount, currency, type });
    const occurrence = (occurrenceMap.get(signature) ?? 0) + 1;
    occurrenceMap.set(signature, occurrence);
    const possibleDuplicate = existingSignatures.has(signature);

    return {
      sourceRowNumber,
      raw,
      date,
      description,
      amount,
      signedAmount: signedAmount ?? 0,
      currency,
      type,
      category,
      merchantKey,
      rememberRule: false,
      included: !parseError && !possibleDuplicate,
      possibleDuplicate,
      duplicateReason: possibleDuplicate ? "A matching transaction already exists." : null,
      parseError,
      occurrence,
      rate: currency === "EUR" ? 1 : 0,
      rateDate: currency === "EUR" ? new Date().toISOString().slice(0, 10) : "",
      rateSource: currency === "EUR" ? "identity" : "",
    };
  });
}

export function delimiterLabel(delimiter: string) {
  if (delimiter === ";") return "Semicolon";
  if (delimiter === "\t") return "Tab";
  if (delimiter === "|") return "Pipe";
  return "Comma";
}
