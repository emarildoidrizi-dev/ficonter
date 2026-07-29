export type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
};

export type PdfExtractionSummary = {
  rows: string[][];
  transactionCount: number;
  assumedDirectionCount: number;
  extractedLineCount: number;
};

type PositionedText = {
  text: string;
  x: number;
  y: number;
  width: number;
};

type ParsedPdfTransaction = {
  date: string;
  description: string;
  signedAmount: number;
  currency: string;
  directionWasAssumed: boolean;
};

const DATE_PATTERN = /(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/;
const DATE_PATTERN_GLOBAL = /(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/g;
const MONEY_PATTERN = /(?<![\d.,])([+-]?\s*(?:\d{1,3}(?:[.\s]\d{3})+|\d+)(?:[.,]\d{2})\s*-?)(?:\s*(EUR|USD|GBP|CHF|CAD|AUD|JPY|CNY|PLN|SEK|NOK|DKK|CZK|HUF|RON|BGN|TRY|ALL|MKD|RSD|BAM|€|\$|£|CHF))?(?![\d.,])/gi;

const INCOME_TERMS = [
  "gutschrift",
  "gehalt",
  "salary",
  "payroll",
  "lohn",
  "wages",
  "refund",
  "rückerstattung",
  "erstattung",
  "credit",
  "incoming",
  "eingang",
  "deposit",
  "überweisung von",
  "ueberweisung von",
  "interest credit",
  "zinsen",
];

const EXPENSE_TERMS = [
  "lastschrift",
  "direct debit",
  "debit",
  "kartenzahlung",
  "card payment",
  "payment",
  "ausgang",
  "überweisung an",
  "ueberweisung an",
  "withdrawal",
  "abhebung",
  "fee",
  "gebühr",
  "gebuehr",
  "rent",
  "miete",
];

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeDate(value: string) {
  const clean = value.trim();
  const iso = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  const european = clean.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!european) return "";
  let year = Number(european[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  const day = Number(european[1]);
  const month = Number(european[2]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseAmount(value: string) {
  let clean = value.replace(/\s/g, "").trim();
  if (!clean) return null;
  let negative = clean.startsWith("-") || clean.endsWith("-");
  const positive = clean.startsWith("+");
  clean = clean.replace(/^[+-]/, "").replace(/-$/, "");
  clean = clean.replace(/[^0-9.,]/g, "");
  if (!clean) return null;

  const comma = clean.lastIndexOf(",");
  const dot = clean.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    clean = comma > dot
      ? clean.replace(/\./g, "").replace(",", ".")
      : clean.replace(/,/g, "");
  } else if (comma >= 0) {
    const decimals = clean.length - comma - 1;
    clean = decimals === 2 ? clean.replace(/\./g, "").replace(",", ".") : clean.replace(/,/g, "");
  } else if (dot >= 0) {
    const decimals = clean.length - dot - 1;
    if (decimals !== 2) clean = clean.replace(/\./g, "");
  }

  const amount = Number(clean);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (positive) negative = false;
  return { amount, explicitSign: negative ? -1 : positive ? 1 : 0 };
}

function currencyCode(value: string | undefined, fullLine: string) {
  const token = (value ?? "").toUpperCase();
  if (token === "€" || /\bEUR\b/i.test(token)) return "EUR";
  if (token === "$" || /\bUSD\b/i.test(token)) return "USD";
  if (token === "£" || /\bGBP\b/i.test(token)) return "GBP";
  if (/\bCHF\b/i.test(token)) return "CHF";
  const code = token.match(/[A-Z]{3}/)?.[0];
  if (code) return code;

  if (/€|\bEUR\b/i.test(fullLine)) return "EUR";
  if (/£|\bGBP\b/i.test(fullLine)) return "GBP";
  if (/\bCHF\b/i.test(fullLine)) return "CHF";
  if (/\bUSD\b/i.test(fullLine)) return "USD";
  return "EUR";
}

function inferDirection(line: string, explicitSign: number) {
  if (explicitSign !== 0) {
    return { sign: explicitSign, assumed: false };
  }
  const normalized = line.toLowerCase();
  if (INCOME_TERMS.some((term) => normalized.includes(term))) {
    return { sign: 1, assumed: false };
  }
  if (EXPENSE_TERMS.some((term) => normalized.includes(term))) {
    return { sign: -1, assumed: false };
  }
  return { sign: -1, assumed: true };
}

function descriptionFromLine(line: string, dateText: string, amountText: string) {
  return normalizeSpaces(
    line
      .replace(dateText, " ")
      .replace(DATE_PATTERN_GLOBAL, " ")
      .replace(amountText, " ")
      .replace(/\b(EUR|USD|GBP|CHF|CAD|AUD|JPY|CNY|PLN|SEK|NOK|DKK|CZK|HUF|RON|BGN|TRY|ALL|MKD|RSD|BAM)\b/gi, " ")
      .replace(/[€$£]/g, " ")
      .replace(/\t/g, " ")
      .replace(/[|]+/g, " ")
      .replace(/^[-–—:;,.\s]+|[-–—:;,.\s]+$/g, " "),
  ).slice(0, 120);
}

function parseTransactionCandidate(candidate: string): ParsedPdfTransaction | null {
  const dateMatch = candidate.match(DATE_PATTERN);
  if (!dateMatch) return null;
  const date = normalizeDate(dateMatch[0]);
  if (!date) return null;

  const afterDate = candidate.slice((dateMatch.index ?? 0) + dateMatch[0].length);
  const moneyMatches = [...afterDate.matchAll(MONEY_PATTERN)];
  if (!moneyMatches.length) return null;
  const moneyMatch = moneyMatches[moneyMatches.length - 1];
  const parsedAmount = parseAmount(moneyMatch[1]);
  if (!parsedAmount) return null;

  const direction = inferDirection(candidate, parsedAmount.explicitSign);
  const description = descriptionFromLine(candidate, dateMatch[0], moneyMatch[0]);
  if (description.length < 2) return null;

  return {
    date,
    description,
    signedAmount: parsedAmount.amount * direction.sign,
    currency: currencyCode(moneyMatch[2], candidate),
    directionWasAssumed: direction.assumed,
  };
}

export function groupPdfTextItemsIntoLines(items: PdfTextItem[]) {
  const positioned: PositionedText[] = items
    .map((item) => ({
      text: normalizeSpaces(item.str ?? ""),
      x: Number(item.transform?.[4] ?? 0),
      y: Number(item.transform?.[5] ?? 0),
      width: Number(item.width ?? 0),
    }))
    .filter((item) => item.text.length > 0);

  const groups: Array<{ y: number; items: PositionedText[] }> = [];
  const tolerance = 2.8;
  positioned
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .forEach((item) => {
      const group = groups.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
      if (group) {
        group.items.push(item);
        group.y = (group.y * (group.items.length - 1) + item.y) / group.items.length;
      } else {
        groups.push({ y: item.y, items: [item] });
      }
    });

  return groups
    .sort((a, b) => b.y - a.y)
    .map((group) => {
      const sorted = group.items.sort((a, b) => a.x - b.x);
      let output = "";
      let previousRight = 0;
      sorted.forEach((item, index) => {
        const gap = index === 0 ? 0 : item.x - previousRight;
        if (index > 0) output += gap > 16 ? "\t" : " ";
        output += item.text;
        previousRight = item.x + item.width;
      });
      return normalizeSpaces(output.replace(/\t+/g, "\t"));
    })
    .filter(Boolean);
}

export function extractTransactionsFromPdfLines(lines: string[], maxRows = 2000): PdfExtractionSummary {
  const transactions: ParsedPdfTransaction[] = [];

  for (let index = 0; index < lines.length && transactions.length < maxRows; index += 1) {
    const line = lines[index];
    if (!DATE_PATTERN.test(line)) continue;

    let candidate = line;
    let parsed = parseTransactionCandidate(candidate);
    if (!parsed) {
      for (let lookAhead = 1; lookAhead <= 2 && index + lookAhead < lines.length; lookAhead += 1) {
        const nextLine = lines[index + lookAhead];
        if (DATE_PATTERN.test(nextLine)) break;
        candidate = `${candidate} ${nextLine}`;
        parsed = parseTransactionCandidate(candidate);
        if (parsed) break;
      }
    }
    if (parsed) transactions.push(parsed);
  }

  return {
    rows: [
      ["Date", "Description", "Amount", "Currency"],
      ...transactions.map((transaction) => [
        transaction.date,
        transaction.description,
        transaction.signedAmount.toFixed(2),
        transaction.currency,
      ]),
    ],
    transactionCount: transactions.length,
    assumedDirectionCount: transactions.filter((transaction) => transaction.directionWasAssumed).length,
    extractedLineCount: lines.length,
  };
}
