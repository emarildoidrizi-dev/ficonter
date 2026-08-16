import { NextRequest, NextResponse } from "next/server";
import { CATEGORY_ITEMS } from "@/lib/financialOptions";
import { BILL_IMPORT_CATEGORIES } from "@/lib/financialDocumentExtraction";
import type { BillRecurrence, DebtCategory } from "@/lib/supabase/database.contract";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { subscriptionApiAccessError } from "@/lib/subscriptionApiAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

type ImportDestination = "transactions" | "bills" | "debt" | "credit_card";

type TransactionImportRow = {
  sourceRowNumber?: unknown;
  description?: unknown;
  type?: unknown;
  category?: unknown;
  currency?: unknown;
  transactionDate?: unknown;
  occurredAt?: unknown;
  amount?: unknown;
  amountEur?: unknown;
  exchangeRateToEur?: unknown;
  exchangeRateDate?: unknown;
  exchangeRateSource?: unknown;
  fingerprintSeed?: unknown;
  forceImport?: unknown;
};

type ConvertedMoney = {
  amount?: unknown;
  amountEur?: unknown;
  exchangeRateToEur?: unknown;
  exchangeRateDate?: unknown;
  exchangeRateSource?: unknown;
};

type BillImportPayload = ConvertedMoney & {
  name?: unknown;
  company?: unknown;
  currency?: unknown;
  dueDate?: unknown;
  category?: unknown;
  recurrence?: unknown;
  notes?: unknown;
  forceImport?: unknown;
};

type DebtImportPayload = {
  name?: unknown;
  lender?: unknown;
  category?: unknown;
  currency?: unknown;
  originalBalance?: ConvertedMoney;
  currentBalance?: ConvertedMoney;
  minimumPayment?: ConvertedMoney;
  creditLimit?: ConvertedMoney;
  statementBalance?: ConvertedMoney;
  interestCharged?: ConvertedMoney;
  annualInterestRate?: unknown;
  paymentDueDate?: unknown;
  startDate?: unknown;
  maturityDate?: unknown;
  statementDate?: unknown;
  cardLastFour?: unknown;
  description?: unknown;
  forceImport?: unknown;
};

type ImportPayload = {
  destination?: unknown;
  transactions?: unknown;
  bill?: unknown;
  debt?: unknown;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const DEBT_CATEGORIES = new Set<DebtCategory>([
  "Credit card",
  "Personal loan",
  "Mortgage",
  "Student loan",
  "Car loan",
  "Buy now, pay later",
  "Tax debt",
  "Medical debt",
  "Business loan",
  "Family loan",
  "Overdraft",
  "Other",
]);
const BILL_CATEGORIES = new Set<string>(BILL_IMPORT_CATEGORIES);
const BILL_RECURRENCES = new Set<BillRecurrence>([
  "none",
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "semiannual",
  "yearly",
]);

function isDebtCategory(value: string): value is DebtCategory {
  return DEBT_CATEGORIES.has(value as DebtCategory);
}

function isBillRecurrence(value: string): value is BillRecurrence {
  return BILL_RECURRENCES.has(value as BillRecurrence);
}

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: noStoreHeaders() });
}

function asString(value: unknown, max = 255) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function asPositiveMoney(value: unknown, allowZero = false) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (allowZero ? number < 0 : number <= 0) return null;
  return Math.round(number * 100) / 100;
}

function asRate(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.round(number * 100_000_000) / 100_000_000;
}

function validIsoDate(value: unknown, optional = false) {
  const string = asString(value, 10);
  if (!string && optional) return "";
  return DATE_PATTERN.test(string) ? string : null;
}

function parseConvertedMoney(value: unknown, allowZero = false) {
  const input = (value ?? {}) as ConvertedMoney;
  const amount = asPositiveMoney(input.amount, allowZero);
  const amountEur = asPositiveMoney(input.amountEur, allowZero);
  const exchangeRateToEur = asRate(input.exchangeRateToEur);
  const exchangeRateDate = validIsoDate(input.exchangeRateDate);
  const exchangeRateSource = asString(input.exchangeRateSource, 120);
  if (
    amount === null ||
    amountEur === null ||
    exchangeRateToEur === null ||
    !exchangeRateDate ||
    !exchangeRateSource
  ) {
    return null;
  }
  return { amount, amountEur, exchangeRateToEur, exchangeRateDate, exchangeRateSource };
}

function localTimeForDate(date: string) {
  return `${date}T12:00:00.000Z`;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const subscriptionAccessError = await subscriptionApiAccessError("financial_documents");
  if (subscriptionAccessError) return subscriptionAccessError;
  if (!isSameOriginRequest(request)) return errorResponse("This request could not be verified.", 403);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errorResponse("Sign in again before importing financial data.", 401);

    const { id } = await context.params;
    const { data: document, error: documentError } = await supabase
      .from("financial_documents")
      .select("id,original_name,display_name,category")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (documentError || !document) return errorResponse("The source document was not found.", 404);

    const payload = (await request.json().catch(() => null)) as ImportPayload | null;
    const destination = asString(payload?.destination, 32) as ImportDestination;
    if (!["transactions", "bills", "debt", "credit_card"].includes(destination)) {
      return errorResponse("Choose a valid FICONTER destination.");
    }

    if (destination === "transactions") {
      if (!Array.isArray(payload?.transactions) || payload.transactions.length < 1 || payload.transactions.length > 2000) {
        return errorResponse("Choose between 1 and 2,000 approved transaction rows.");
      }

      const rows = (payload.transactions as TransactionImportRow[]).map((row, index) => {
        const description = asString(row.description, 120);
        const type = asString(row.type, 16);
        const category = asString(row.category, 120);
        const currency = asString(row.currency, 3).toUpperCase();
        const transactionDate = validIsoDate(row.transactionDate);
        const occurredAt = asString(row.occurredAt, 40) || (transactionDate ? localTimeForDate(transactionDate) : "");
        const amount = asPositiveMoney(row.amount);
        const amountEur = asPositiveMoney(row.amountEur);
        const exchangeRateToEur = asRate(row.exchangeRateToEur);
        const exchangeRateDate = validIsoDate(row.exchangeRateDate);
        const exchangeRateSource = asString(row.exchangeRateSource, 120);
        const sourceRowNumber = Math.max(1, Number(row.sourceRowNumber) || index + 1);
        const forceImport = row.forceImport === true;

        if (
          !description ||
          !["income", "expense", "saving"].includes(type) ||
          !CATEGORY_ITEMS.includes(category) ||
          !CURRENCY_PATTERN.test(currency) ||
          !transactionDate ||
          !occurredAt ||
          amount === null ||
          amountEur === null ||
          exchangeRateToEur === null ||
          !exchangeRateDate ||
          !exchangeRateSource
        ) {
          throw new Error(`Row ${sourceRowNumber} is incomplete. Review its date, description, amount, currency, category and exchange rate.`);
        }

        return {
          sourceRowNumber,
          description,
          type,
          category,
          currency,
          transactionDate,
          occurredAt,
          amount,
          amountEur,
          exchangeRateToEur,
          exchangeRateDate,
          exchangeRateSource,
          fingerprintSeed:
            asString(row.fingerprintSeed, 500) ||
            `${document.id}|${sourceRowNumber}|${transactionDate}|${description}|${amount}|${currency}|${type}`,
          forceImport,
          sourceDocumentId: document.id,
        };
      });

      const { data, error } = await supabase.rpc("import_statement_transactions", {
        p_file_name: document.original_name,
        p_rows: rows,
        p_mapping: {
          source: "document_vault_extraction_v1",
          sourceDocumentId: document.id,
          sourceDocumentName: document.display_name,
        },
      });
      if (error) throw error;

      return NextResponse.json(
        { destination, result: data, message: "Approved financial rows were imported into Transactions." },
        { headers: noStoreHeaders() },
      );
    }

    if (destination === "bills") {
      const bill = (payload?.bill ?? {}) as BillImportPayload;
      const name = asString(bill.name, 120);
      const company = asString(bill.company, 120);
      const category = asString(bill.category, 120);
      const currency = asString(bill.currency, 3).toUpperCase();
      const dueDate = validIsoDate(bill.dueDate);
      const recurrence = asString(bill.recurrence, 16) || "none";
      const notes = asString(bill.notes, 1000);
      const converted = parseConvertedMoney(bill);
      const forceImport = bill.forceImport === true;

      if (!name || !BILL_CATEGORIES.has(category) || !CURRENCY_PATTERN.test(currency) || !dueDate || !isBillRecurrence(recurrence) || !converted) {
        return errorResponse("Review the bill name, amount, currency, due date, category and exchange rate.");
      }

      if (!forceImport) {
        const { data: duplicate } = await supabase
          .from("bills")
          .select("id")
          .eq("user_id", user.id)
          .eq("name", name)
          .eq("due_date", dueDate)
          .eq("currency", currency)
          .eq("amount", converted.amount)
          .limit(1)
          .maybeSingle();
        if (duplicate) return errorResponse("A matching bill already exists. Review it before importing another copy.", 409);
      }

      const sourceNote = `Imported from Document Vault · ${document.display_name}`;
      const { data, error } = await supabase
        .from("bills")
        .insert({
          user_id: user.id,
          name,
          company: company || null,
          category,
          amount: converted.amount,
          currency,
          amount_eur: converted.amountEur,
          exchange_rate_to_eur: converted.exchangeRateToEur,
          due_date: dueDate,
          recurrence,
          reminder_days: 3,
          status: "pending",
          autopay: false,
          notes: [notes, sourceNote].filter(Boolean).join("\n").slice(0, 1000),
        })
        .select("id,name,due_date")
        .single();
      if (error) throw error;

      return NextResponse.json(
        { destination, result: data, message: "The approved document was imported into Bills." },
        { status: 201, headers: noStoreHeaders() },
      );
    }

    const debt = (payload?.debt ?? {}) as DebtImportPayload;
    const name = asString(debt.name, 120);
    const lender = asString(debt.lender, 120);
    const currency = asString(debt.currency, 3).toUpperCase();
    const category = destination === "credit_card" ? "Credit card" : asString(debt.category, 40);
    const originalBalance = parseConvertedMoney(debt.originalBalance);
    const currentBalance = parseConvertedMoney(debt.currentBalance, true);
    const minimumPayment = parseConvertedMoney(debt.minimumPayment, true);
    const creditLimit = debt.creditLimit ? parseConvertedMoney(debt.creditLimit, true) : null;
    const statementBalance = debt.statementBalance ? parseConvertedMoney(debt.statementBalance, true) : null;
    const interestCharged = debt.interestCharged ? parseConvertedMoney(debt.interestCharged, true) : null;
    const annualInterestRate = Number(debt.annualInterestRate ?? 0);
    const paymentDueDate = validIsoDate(debt.paymentDueDate, true);
    const startDate = validIsoDate(debt.startDate, true);
    const maturityDate = validIsoDate(debt.maturityDate, true);
    const statementDate = validIsoDate(debt.statementDate, true);
    const cardLastFour = asString(debt.cardLastFour, 4);
    const description = asString(debt.description, 1000);
    const forceImport = debt.forceImport === true;

    if (
      !name ||
      !isDebtCategory(category) ||
      !CURRENCY_PATTERN.test(currency) ||
      !originalBalance ||
      !currentBalance ||
      !minimumPayment ||
      !Number.isFinite(annualInterestRate) ||
      annualInterestRate < 0 ||
      annualInterestRate > 100 ||
      paymentDueDate === null ||
      startDate === null ||
      maturityDate === null ||
      statementDate === null ||
      (destination === "credit_card" && cardLastFour && !/^\d{4}$/.test(cardLastFour))
    ) {
      return errorResponse("Review the debt/card balances, currency, rate, dates and required details before importing.");
    }

    if (!forceImport) {
      let duplicateQuery = supabase
        .from("debts")
        .select("id")
        .eq("user_id", user.id)
        .eq("category", category)
        .eq("currency", currency);
      duplicateQuery = destination === "credit_card" && cardLastFour
        ? duplicateQuery.eq("card_last_four", cardLastFour)
        : duplicateQuery.eq("name", name);
      const { data: duplicate } = await duplicateQuery.limit(1).maybeSingle();
      if (duplicate) {
        return errorResponse(
          destination === "credit_card"
            ? "A matching credit card already exists. Open Credit Cards to update the existing card instead of creating a duplicate."
            : "A matching debt already exists. Review it before importing another copy.",
          409,
        );
      }
    }

    const dueDay = paymentDueDate ? Number(paymentDueDate.slice(-2)) : null;
    const sourceDescription = [description, `Imported from Document Vault · ${document.display_name}`]
      .filter(Boolean)
      .join("\n")
      .slice(0, 1000);

    const { data, error } = await supabase
      .from("debts")
      .insert({
        user_id: user.id,
        name,
        lender: lender || null,
        description: sourceDescription || null,
        category,
        original_balance: originalBalance.amount,
        current_balance: currentBalance.amount,
        currency,
        original_balance_eur: originalBalance.amountEur,
        current_balance_eur: currentBalance.amountEur,
        exchange_rate_to_eur: currentBalance.exchangeRateToEur,
        annual_interest_rate: annualInterestRate,
        minimum_payment: minimumPayment.amount,
        minimum_payment_eur: minimumPayment.amountEur,
        payment_due_day: dueDay,
        payment_due_date: paymentDueDate || null,
        autopay: false,
        autopay_enabled_at: null,
        start_date: startDate || null,
        maturity_date: maturityDate || null,
        status: currentBalance.amount === 0 ? "paid_off" : "active",
        card_last_four: destination === "credit_card" ? cardLastFour || null : null,
        credit_limit: destination === "credit_card" ? creditLimit?.amount ?? 0 : null,
        credit_limit_eur: destination === "credit_card" ? creditLimit?.amountEur ?? 0 : null,
        statement_balance: destination === "credit_card" ? statementBalance?.amount ?? currentBalance.amount : null,
        statement_balance_eur: destination === "credit_card" ? statementBalance?.amountEur ?? currentBalance.amountEur : null,
        statement_date: destination === "credit_card" ? statementDate || null : null,
        interest_charged: destination === "credit_card" ? interestCharged?.amount ?? 0 : 0,
        interest_charged_eur: destination === "credit_card" ? interestCharged?.amountEur ?? 0 : 0,
        updated_at: new Date().toISOString(),
      })
      .select("id,name,category")
      .single();
    if (error) throw error;

    return NextResponse.json(
      {
        destination,
        result: data,
        message: destination === "credit_card"
          ? "The approved document was imported into Credit Cards."
          : "The approved document was imported into Debt.",
      },
      { status: 201, headers: noStoreHeaders() },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The approved financial data could not be imported.";
    console.error("Financial document import failed", { message });
    return errorResponse(message, 500);
  }
}
