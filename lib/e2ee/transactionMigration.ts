import type { createClient } from "@/lib/supabase/client";
import { encryptTransactionPayload } from "@/lib/e2ee/transactionPayload";

type BrowserClient = ReturnType<typeof createClient>;

type FinancialPayload = {
  description: string;
  amount: number;
  currency: string;
  amount_eur: number;
  exchange_rate_to_eur: number;
  exchange_rate_date: string | null;
  exchange_rate_source: string | null;
  type: string;
  category: string;
  transaction_date: string;
  occurred_at: string | null;
};

type PendingRow = {
  id: string;
  created_at: string | null;
};

type BillSource = {
  id: string; name: string; company: string | null; category: string;
  amount: number | string; currency: string | null; amount_eur: number | string;
  exchange_rate_to_eur: number | string; due_date: string; paid_at: string | null;
  transaction_id: string | null;
};
type DebtPaymentSource = {
  id: string; debt_id: string; amount: number | string; currency: string | null;
  amount_eur: number | string; exchange_rate_to_eur: number | string;
  paid_at: string; transaction_id: string | null;
};
type GoalInvestmentSource = {
  id: string; goal_id: string; amount: number | string;
  original_amount: number | string | null; currency: string | null;
  exchange_rate_to_eur: number | string | null; exchange_rate_date: string | null;
  invested_at: string; transaction_id: string;
};
type StatementImportSource = {
  id: string; transaction_id: string | null; source_data: unknown;
};
type TemplatePostingSource = {
  id: string; template_id: string; period_key: string; transaction_id: string | null;
};
type AutoRunSource = {
  id: string; source_type: string; source_id: string; scheduled_for: string;
  amount: number | string; currency: string; amount_eur: number | string;
  transaction_id: string | null; debt_payment_id: string | null; trigger_mode: string;
};
type DebtSource = {
  id: string; name: string; category: string; currency: string | null;
  exchange_rate_to_eur: number | string;
};
type GoalSource = { id: string; name: string };
type TemplateSource = {
  id: string; description: string; amount: number | string; currency: string;
  amount_eur: number | string | null; exchange_rate_to_eur: number | string | null;
  exchange_rate_date: string | null; exchange_rate_source: string | null;
  type: string; category: string; day_of_month: number | null;
};

const PLAINTEXT_CLEAR = {
  description: null,
  amount: null,
  currency: null,
  amount_eur: null,
  exchange_rate_to_eur: null,
  exchange_rate_date: null,
  exchange_rate_source: null,
  type: null,
  category: null,
  transaction_date: null,
  occurred_at: null,
} as const;

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function isoDate(value: unknown): string {
  const text = textValue(value);
  return text ? text.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function isoInstant(value: unknown, fallbackDate?: string): string {
  const text = textValue(value);
  if (text) return text;
  const date = fallbackDate || new Date().toISOString().slice(0, 10);
  return `${date}T12:00:00.000Z`;
}

async function encryptAndStore(
  supabase: BrowserClient,
  vaultKey: CryptoKey,
  userId: string,
  transactionId: string,
  payload: FinancialPayload,
): Promise<void> {
  const encryptedPayload = await encryptTransactionPayload(
    vaultKey,
    userId,
    payload,
  );

  const { error } = await supabase
    .from("transactions")
    .update({
      encrypted_payload: encryptedPayload,
      encryption_version: 1,
      ...PLAINTEXT_CLEAR,
    })
    .eq("id", transactionId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function migrateLegacyPlaintextTransactions(
  supabase: BrowserClient,
  vaultKey: CryptoKey,
  userId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id,description,amount,currency,amount_eur,exchange_rate_to_eur,exchange_rate_date,exchange_rate_source,type,category,transaction_date,occurred_at",
    )
    .eq("user_id", userId)
    .is("encrypted_payload", null)
    .is("encryption_version", null)
    .limit(1000);

  if (error) throw error;

  let migrated = 0;
  for (const row of data ?? []) {
    if (
      !row.description ||
      row.amount == null ||
      !row.currency ||
      row.amount_eur == null ||
      row.exchange_rate_to_eur == null ||
      !row.type ||
      !row.category ||
      !row.transaction_date
    ) {
      continue;
    }

    await encryptAndStore(supabase, vaultKey, userId, row.id, {
      description: row.description,
      amount: numberValue(row.amount),
      currency: row.currency,
      amount_eur: numberValue(row.amount_eur),
      exchange_rate_to_eur: numberValue(row.exchange_rate_to_eur, 1),
      exchange_rate_date: row.exchange_rate_date,
      exchange_rate_source: row.exchange_rate_source,
      type: row.type,
      category: row.category,
      transaction_date: row.transaction_date,
      occurred_at: row.occurred_at,
    });
    migrated += 1;
  }

  return migrated;
}

export async function finalizePendingServerTransactions(
  supabase: BrowserClient,
  vaultKey: CryptoKey,
  userId: string,
): Promise<number> {
  const { data: pendingData, error: pendingError } = await supabase
    .from("transactions")
    .select("id,created_at")
    .eq("user_id", userId)
    .eq("encryption_version", 0)
    .is("encrypted_payload", null)
    .limit(1000);

  if (pendingError) throw pendingError;
  const pending = (pendingData ?? []) as PendingRow[];
  if (!pending.length) return 0;

  const ids = pending.map((row) => row.id);

  const [
    billsResult,
    paymentsResult,
    investmentsResult,
    importsResult,
    postingsResult,
    runsResult,
  ] = await Promise.all([
    supabase
      .from("bills")
      .select(
        "id,name,company,category,amount,currency,amount_eur,exchange_rate_to_eur,due_date,paid_at,transaction_id",
      )
      .eq("user_id", userId)
      .in("transaction_id", ids),
    supabase
      .from("debt_payments")
      .select(
        "id,debt_id,amount,currency,amount_eur,exchange_rate_to_eur,paid_at,transaction_id",
      )
      .eq("user_id", userId)
      .in("transaction_id", ids),
    supabase
      .from("goal_investments")
      .select("id,goal_id,amount,original_amount,currency,exchange_rate_to_eur,exchange_rate_date,invested_at,transaction_id")
      .eq("user_id", userId)
      .in("transaction_id", ids),
    supabase
      .from("statement_import_items")
      .select("id,transaction_id,source_data")
      .eq("user_id", userId)
      .in("transaction_id", ids),
    supabase
      .from("transaction_template_postings")
      .select("id,template_id,period_key,transaction_id")
      .eq("user_id", userId)
      .in("transaction_id", ids),
    supabase
      .from("automatic_payment_runs")
      .select(
        "id,source_type,source_id,scheduled_for,amount,currency,amount_eur,transaction_id,debt_payment_id,trigger_mode",
      )
      .eq("user_id", userId)
      .in("transaction_id", ids),
  ]);

  const sourceError =
    billsResult.error ??
    paymentsResult.error ??
    investmentsResult.error ??
    importsResult.error ??
    postingsResult.error ??
    runsResult.error;
  if (sourceError) throw sourceError;

  const bills = (billsResult.data ?? []) as BillSource[];
  const payments = (paymentsResult.data ?? []) as DebtPaymentSource[];
  const investments = (investmentsResult.data ?? []) as GoalInvestmentSource[];
  const imports = (importsResult.data ?? []) as StatementImportSource[];
  const postings = (postingsResult.data ?? []) as TemplatePostingSource[];
  const runs = (runsResult.data ?? []) as AutoRunSource[];

  const debtIds = [...new Set(payments.map((row) => row.debt_id))];
  const goalIds = [...new Set(investments.map((row) => row.goal_id))];
  const templateIds = [...new Set(postings.map((row) => row.template_id))];
  const recurringBillIds = [
    ...new Set(
      runs
        .filter((row) => row.source_type === "bill")
        .map((row) => row.source_id),
    ),
  ];
  const recurringDebtIds = [
    ...new Set(
      runs
        .filter((row) => row.source_type === "debt")
        .map((row) => row.source_id),
    ),
  ];

  const [debtsResult, goalsResult, templatesResult, recurringBillsResult] =
    await Promise.all([
      debtIds.length || recurringDebtIds.length
        ? supabase
            .from("debts")
            .select("id,name,category,currency,exchange_rate_to_eur")
            .eq("user_id", userId)
            .in("id", [...new Set([...debtIds, ...recurringDebtIds])])
        : Promise.resolve({ data: [], error: null }),
      goalIds.length
        ? supabase
            .from("goals")
            .select("id,name")
            .eq("user_id", userId)
            .in("id", goalIds)
        : Promise.resolve({ data: [], error: null }),
      templateIds.length
        ? supabase
            .from("transaction_templates")
            .select(
              "id,description,amount,currency,amount_eur,exchange_rate_to_eur,exchange_rate_date,exchange_rate_source,type,category,day_of_month",
            )
            .eq("user_id", userId)
            .in("id", templateIds)
        : Promise.resolve({ data: [], error: null }),
      recurringBillIds.length
        ? supabase
            .from("bills")
            .select(
              "id,name,company,category,amount,currency,amount_eur,exchange_rate_to_eur,due_date,paid_at,transaction_id",
            )
            .eq("user_id", userId)
            .in("id", recurringBillIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  const secondaryError =
    debtsResult.error ??
    goalsResult.error ??
    templatesResult.error ??
    recurringBillsResult.error;
  if (secondaryError) throw secondaryError;

  const debts = (debtsResult.data ?? []) as DebtSource[];
  const goals = (goalsResult.data ?? []) as GoalSource[];
  const templates = (templatesResult.data ?? []) as TemplateSource[];
  const recurringBills = (recurringBillsResult.data ?? []) as BillSource[];

  const billsByTransaction = new Map(
    bills
      .filter((row) => row.transaction_id)
      .map((row) => [row.transaction_id as string, row]),
  );
  const paymentsByTransaction = new Map(
    payments
      .filter((row) => row.transaction_id)
      .map((row) => [row.transaction_id as string, row]),
  );
  const investmentsByTransaction = new Map(
    investments.map((row) => [row.transaction_id, row]),
  );
  const importsByTransaction = new Map(
    imports
      .filter((row) => row.transaction_id)
      .map((row) => [row.transaction_id as string, row]),
  );
  const postingsByTransaction = new Map(
    postings
      .filter((row) => row.transaction_id)
      .map((row) => [row.transaction_id as string, row]),
  );
  const runsByTransaction = new Map(
    runs
      .filter((row) => row.transaction_id)
      .map((row) => [row.transaction_id as string, row]),
  );
  const debtsById = new Map(debts.map((row) => [row.id, row]));
  const goalsById = new Map(goals.map((row) => [row.id, row]));
  const templatesById = new Map(
    templates.map((row) => [row.id, row]),
  );
  const recurringBillsById = new Map(
    recurringBills.map((row) => [row.id, row]),
  );

  let finalized = 0;

  for (const pendingRow of pending) {
    let payload: FinancialPayload | null = null;

    const imported = importsByTransaction.get(pendingRow.id);
    if (imported && imported.source_data && typeof imported.source_data === "object") {
      const source = imported.source_data as Record<string, unknown>;
      const transactionDate = isoDate(source.transactionDate);
      payload = {
        description: textValue(source.description, "Imported transaction"),
        amount: numberValue(source.amount),
        currency: textValue(source.currency, "EUR").toUpperCase(),
        amount_eur: numberValue(source.amountEur),
        exchange_rate_to_eur: numberValue(source.exchangeRateToEur, 1),
        exchange_rate_date: textValue(source.exchangeRateDate) || transactionDate,
        exchange_rate_source: textValue(source.exchangeRateSource, "statement import"),
        type: textValue(source.type, "expense"),
        category: textValue(source.category, "Other"),
        transaction_date: transactionDate,
        occurred_at: isoInstant(source.occurredAt, transactionDate),
      };
    }

    if (!payload) {
      const posting = postingsByTransaction.get(pendingRow.id);
      const template = posting ? templatesById.get(posting.template_id) : undefined;
      if (posting && template) {
        const period = isoDate(posting.period_key);
        const [year, month] = period.split("-").map(Number);
        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const day = Math.min(numberValue(template.day_of_month, 1), lastDay);
        const transactionDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        payload = {
          description: template.description,
          amount: numberValue(template.amount),
          currency: template.currency,
          amount_eur: numberValue(template.amount_eur ?? template.amount),
          exchange_rate_to_eur: numberValue(template.exchange_rate_to_eur, 1),
          exchange_rate_date: template.exchange_rate_date ?? transactionDate,
          exchange_rate_source: template.exchange_rate_source ?? "recurring EUR template",
          type: template.type,
          category: template.category,
          transaction_date: transactionDate,
          occurred_at: `${transactionDate}T12:00:00.000Z`,
        };
      }
    }

    if (!payload) {
      const investment = investmentsByTransaction.get(pendingRow.id);
      const goal = investment ? goalsById.get(investment.goal_id) : undefined;
      if (investment && goal) {
        const transactionDate = isoDate(investment.invested_at);
        const amountEur = numberValue(investment.amount);
        const originalAmount = numberValue(
          investment.original_amount ?? investment.amount,
        );
        payload = {
          description: `Goal investment · ${goal.name}`,
          amount: originalAmount,
          currency: investment.currency || "EUR",
          amount_eur: amountEur,
          exchange_rate_to_eur: numberValue(investment.exchange_rate_to_eur, 1),
          exchange_rate_date: investment.exchange_rate_date ?? transactionDate,
          exchange_rate_source: "Goal investment",
          type: "saving",
          category: "General savings",
          transaction_date: transactionDate,
          occurred_at: isoInstant(investment.invested_at, transactionDate),
        };
      }
    }

    if (!payload) {
      const payment = paymentsByTransaction.get(pendingRow.id);
      const debt = payment ? debtsById.get(payment.debt_id) : undefined;
      const run = runsByTransaction.get(pendingRow.id);
      if (payment && debt) {
        const transactionDate = isoDate(payment.paid_at);
        const isCreditCard = textValue(debt.category).toLowerCase() === "credit card";
        payload = {
          description: `${isCreditCard ? "Credit card payment" : "Debt payment"} · ${debt.name}`,
          amount: numberValue(payment.amount),
          currency: payment.currency || debt.currency || "EUR",
          amount_eur: numberValue(payment.amount_eur),
          exchange_rate_to_eur: numberValue(payment.exchange_rate_to_eur, 1),
          exchange_rate_date: transactionDate,
          exchange_rate_source: isCreditCard
            ? "Credit card payment conversion"
            : run?.trigger_mode === "automatic"
              ? "Automatic debt schedule"
              : "Debt payment conversion",
          type: "expense",
          category: isCreditCard ? "Credit-card payment" : "Debt repayment",
          transaction_date: transactionDate,
          occurred_at: isoInstant(payment.paid_at, transactionDate),
        };
      }
    }

    if (!payload) {
      const directBill = billsByTransaction.get(pendingRow.id);
      const run = runsByTransaction.get(pendingRow.id);
      const recurringBill =
        run?.source_type === "bill" ? recurringBillsById.get(run.source_id) : undefined;
      const bill = directBill ?? recurringBill;
      if (bill) {
        const transactionDate = run
          ? isoDate(run.scheduled_for)
          : isoDate(bill.paid_at ?? bill.due_date);
        const amount = run ? numberValue(run.amount) : numberValue(bill.amount);
        const amountEur = run ? numberValue(run.amount_eur) : numberValue(bill.amount_eur);
        const description = run
          ? bill.company
            ? `${bill.name} · ${bill.company}`
            : bill.name
          : `Bill payment · ${bill.name}`;
        payload = {
          description,
          amount,
          currency: run?.currency || bill.currency || "EUR",
          amount_eur: amountEur,
          exchange_rate_to_eur: numberValue(bill.exchange_rate_to_eur, amount > 0 ? amountEur / amount : 1),
          exchange_rate_date: transactionDate,
          exchange_rate_source: run
            ? run.trigger_mode === "automatic"
              ? "Automatic bill schedule"
              : "Bill conversion"
            : "Bill payment conversion",
          type: "expense",
          category: bill.category,
          transaction_date: transactionDate,
          occurred_at: run
            ? isoInstant(run.scheduled_for, transactionDate)
            : isoInstant(bill.paid_at, transactionDate),
        };
      }
    }

    if (!payload) {
      const run = runsByTransaction.get(pendingRow.id);
      const debt =
        run?.source_type === "debt" ? debtsById.get(run.source_id) : undefined;
      if (run && debt) {
        const transactionDate = isoDate(run.scheduled_for);
        payload = {
          description: `Debt payment · ${debt.name}`,
          amount: numberValue(run.amount),
          currency: run.currency || debt.currency || "EUR",
          amount_eur: numberValue(run.amount_eur),
          exchange_rate_to_eur: numberValue(debt.exchange_rate_to_eur, 1),
          exchange_rate_date: transactionDate,
          exchange_rate_source:
            run.trigger_mode === "automatic"
              ? "Automatic debt schedule"
              : "Debt payment conversion",
          type: "expense",
          category: "Debt repayment",
          transaction_date: transactionDate,
          occurred_at: isoInstant(run.scheduled_for, transactionDate),
        };
      }
    }

    if (!payload) continue;

    await encryptAndStore(
      supabase,
      vaultKey,
      userId,
      pendingRow.id,
      payload,
    );
    finalized += 1;
  }

  return finalized;
}
