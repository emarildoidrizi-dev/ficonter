import type { CurrencySourceData } from "@/lib/finance/baseCurrencyReconciliation";
import { encryptBillPayload } from "@/lib/e2ee/billPayload";
import { encryptCreditCardPayload } from "@/lib/e2ee/creditCardPayload";
import { encryptDebtPayload } from "@/lib/e2ee/debtPayload";
import { encryptTransactionPayload } from "@/lib/e2ee/transactionPayload";

type BoundaryState = {
  client: any;
  vaultKey: CryptoKey;
  userId: string;
  getSource: () => CurrencySourceData;
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function finite(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function date(value: unknown) {
  const normalized = text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function dueDay(value: unknown) {
  const normalized = date(value);
  return normalized ? Number(normalized.slice(-2)) : null;
}

function bodyText(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof init?.body === "string") return Promise.resolve(init.body);
  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.clone().text();
  }
  return Promise.resolve("");
}

async function importTransactions(state: BoundaryState, payload: any) {
  const rows = Array.isArray(payload.transactions) ? payload.transactions : [];
  if (!rows.length || rows.length > 2000) {
    return response({ error: "Choose between 1 and 2,000 approved transaction rows." }, 400);
  }

  const writes = await Promise.all(rows.map(async (row: any) => {
    const id = crypto.randomUUID();
    const transactionDate = date(row.transactionDate);
    if (!transactionDate) throw new Error("An imported transaction has an invalid date.");
    const cipher = await encryptTransactionPayload(state.vaultKey, state.userId, {
      description: text(row.description),
      amount: finite(row.amount),
      currency: text(row.currency).toUpperCase(),
      amount_eur: finite(row.amountEur),
      exchange_rate_to_eur: finite(row.exchangeRateToEur),
      exchange_rate_date: date(row.exchangeRateDate) ?? transactionDate,
      exchange_rate_source: text(row.exchangeRateSource) || "Document Vault import",
      type: text(row.type),
      category: text(row.category),
      transaction_date: transactionDate,
      occurred_at: text(row.occurredAt) || `${transactionDate}T12:00:00.000Z`,
    });
    return { id, user_id: state.userId, encrypted_payload: cipher, encryption_version: 1 };
  }));

  const result = await state.client.from("transactions").insert(writes);
  if (result.error) throw result.error;
  return response({
    destination: "transactions",
    result: { requestedCount: rows.length, importedCount: rows.length, skippedDuplicateCount: 0, skippedInvalidCount: 0 },
    message: "Approved financial rows were imported into Transactions.",
  });
}

async function importBill(state: BoundaryState, payload: any) {
  const bill = payload.bill ?? {};
  const id = crypto.randomUUID();
  const dueDate = date(bill.dueDate);
  if (!dueDate) throw new Error("The imported bill has an invalid due date.");

  const sourceBills = state.getSource().bills as any[];
  const duplicate = sourceBills.some((row) =>
    text(row.name).toLowerCase() === text(bill.name).toLowerCase() &&
    row.due_date === dueDate &&
    text(row.currency).toUpperCase() === text(bill.currency).toUpperCase() &&
    Math.round(finite(row.amount) * 100) === Math.round(finite(bill.amount) * 100),
  );
  if (duplicate && bill.forceImport !== true) {
    return response({ error: "A matching bill already exists. Review it before importing another copy." }, 409);
  }

  const cipher = await encryptBillPayload(state.vaultKey, state.userId, id, {
    name: text(bill.name),
    company: text(bill.company) || null,
    category: text(bill.category),
    amount: finite(bill.amount),
    currency: text(bill.currency).toUpperCase(),
    amount_eur: finite(bill.amountEur),
    exchange_rate_to_eur: finite(bill.exchangeRateToEur),
    payment_method: null,
    notes: text(bill.notes) || null,
  });

  const result = await state.client.from("bills").insert({
    id,
    user_id: state.userId,
    due_date: dueDate,
    recurrence: text(bill.recurrence) || "none",
    reminder_days: 3,
    status: "pending",
    autopay: false,
    encrypted_payload: cipher,
    encryption_version: 1,
  });
  if (result.error) throw result.error;
  return response({ destination: "bills", result: { id }, message: "The approved document was imported into Bills." }, 201);
}

async function importDebt(state: BoundaryState, payload: any, creditCard: boolean) {
  const debt = payload.debt ?? {};
  const id = crypto.randomUUID();
  const original = debt.originalBalance ?? {};
  const current = debt.currentBalance ?? {};
  const minimum = debt.minimumPayment ?? {};
  const sourceDebts = state.getSource().debts as any[];
  const name = text(debt.name);
  const currency = text(debt.currency).toUpperCase();
  const lastFour = text(debt.cardLastFour);

  const duplicate = sourceDebts.some((row) => {
    const sameKind = creditCard
      ? row.debt_kind === "credit_card" || text(row.category).toLowerCase() === "credit card"
      : row.debt_kind !== "credit_card" && text(row.category).toLowerCase() !== "credit card";
    if (!sameKind || text(row.currency).toUpperCase() !== currency) return false;
    return creditCard && lastFour
      ? text(row.card_last_four) === lastFour
      : text(row.name).toLowerCase() === name.toLowerCase();
  });
  if (duplicate && debt.forceImport !== true) {
    return response({ error: creditCard ? "A matching credit card already exists." : "A matching debt already exists." }, 409);
  }

  const status = finite(current.amount) <= 0 ? "paid_off" : "active";
  const paymentDueDate = date(debt.paymentDueDate);
  const statementDate = date(debt.statementDate);

  if (creditCard) {
    const creditLimit = debt.creditLimit ?? {};
    const statement = debt.statementBalance ?? {};
    const interest = debt.interestCharged ?? {};
    const cipher = await encryptCreditCardPayload(state.vaultKey, state.userId, id, {
      name,
      lender: text(debt.lender) || null,
      description: text(debt.description) || null,
      card_last_four: lastFour || null,
      currency,
      original_balance: finite(original.amount),
      current_balance: finite(current.amount),
      original_balance_eur: finite(original.amountEur),
      current_balance_eur: finite(current.amountEur),
      exchange_rate_to_eur: finite(current.exchangeRateToEur, 1),
      annual_interest_rate: finite(debt.annualInterestRate),
      credit_limit: finite(creditLimit.amount),
      credit_limit_eur: finite(creditLimit.amountEur),
      statement_balance: statement.amount == null ? null : finite(statement.amount),
      statement_balance_eur: statement.amountEur == null ? null : finite(statement.amountEur),
      minimum_payment: finite(minimum.amount),
      minimum_payment_eur: finite(minimum.amountEur),
      statement_date: statementDate,
      payment_due_date: paymentDueDate,
      interest_charged: finite(interest.amount),
      interest_charged_eur: finite(interest.amountEur),
    });
    const result = await state.client.from("debts").insert({
      id,
      user_id: state.userId,
      debt_kind: "credit_card",
      payment_due_day: dueDay(paymentDueDate),
      payment_due_date: paymentDueDate,
      statement_date: statementDate,
      start_date: date(debt.startDate),
      maturity_date: date(debt.maturityDate),
      status,
      autopay: false,
      encrypted_payload: cipher,
      encryption_version: 1,
      e2ee_revision: 0,
    });
    if (result.error) throw result.error;
  } else {
    const cipher = await encryptDebtPayload(state.vaultKey, state.userId, id, {
      name,
      lender: text(debt.lender) || null,
      description: text(debt.description) || null,
      category: text(debt.category) || "Other",
      original_balance: finite(original.amount),
      current_balance: finite(current.amount),
      currency,
      original_balance_eur: finite(original.amountEur),
      current_balance_eur: finite(current.amountEur),
      exchange_rate_to_eur: finite(current.exchangeRateToEur, 1),
      annual_interest_rate: finite(debt.annualInterestRate),
      minimum_payment: finite(minimum.amount),
      minimum_payment_eur: finite(minimum.amountEur),
    });
    const result = await state.client.from("debts").insert({
      id,
      user_id: state.userId,
      debt_kind: "standard",
      payment_due_day: dueDay(paymentDueDate),
      start_date: date(debt.startDate),
      maturity_date: date(debt.maturityDate),
      status,
      autopay: false,
      encrypted_payload: cipher,
      encryption_version: 1,
      e2ee_revision: 0,
    });
    if (result.error) throw result.error;
  }

  return response({
    destination: creditCard ? "credit_card" : "debt",
    result: { id },
    message: creditCard ? "The approved document was imported into Credit Cards." : "The approved document was imported into Debt.",
  }, 201);
}

export function installDocumentImportE2eeFetchBoundary(
  client: any,
  vaultKey: CryptoKey,
  userId: string,
  getSource: () => CurrencySourceData,
) {
  if (typeof window === "undefined") return;
  const target = window as typeof window & {
    __ficonterDocumentImportBoundary?: BoundaryState;
    __ficonterDocumentImportOriginalFetch?: typeof window.fetch;
  };
  const existing = target.__ficonterDocumentImportBoundary;
  if (existing) {
    existing.client = client;
    existing.vaultKey = vaultKey;
    existing.userId = userId;
    existing.getSource = getSource;
    return;
  }

  const state: BoundaryState = { client, vaultKey, userId, getSource };
  target.__ficonterDocumentImportBoundary = state;
  const originalFetch = window.fetch.bind(window);
  target.__ficonterDocumentImportOriginalFetch = originalFetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    let pathname = rawUrl;
    try { pathname = new URL(rawUrl, window.location.origin).pathname; } catch {}
    if (!/^\/api\/documents\/[^/]+\/import$/.test(pathname)) {
      return originalFetch(input, init);
    }
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (method !== "POST") return response({ error: "Method not allowed." }, 405);

    try {
      const rawBody = await bodyText(input, init);
      const payload = rawBody ? JSON.parse(rawBody) : null;
      if (!payload || typeof payload !== "object") return response({ error: "Import payload is required." }, 400);
      if (payload.destination === "transactions") return importTransactions(state, payload);
      if (payload.destination === "bills") return importBill(state, payload);
      if (payload.destination === "debt") return importDebt(state, payload, false);
      if (payload.destination === "credit_card") return importDebt(state, payload, true);
      return response({ error: "Choose a valid FICONTER destination." }, 400);
    } catch (error) {
      return response({ error: error instanceof Error ? error.message : "The approved data could not be imported." }, 500);
    }
  };
}
