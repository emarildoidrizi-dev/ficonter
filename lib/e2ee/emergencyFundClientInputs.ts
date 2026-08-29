import type { CurrencySourceData } from "@/lib/finance/baseCurrencyReconciliation";
import { finiteNumber, sumMoney } from "@/lib/finance/money";
import { buildNetWorthGrowthInputsFromSource } from "@/lib/wealth/netWorthClientInputs";
import type {
  EmergencyFundInputs,
  EmergencyFundMonth,
} from "@/lib/wealth/emergencyFund";

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, offset: number) {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(year, number - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthSeries(first: string, last: string) {
  const months: string[] = [];
  let cursor = first;
  while (cursor <= last && months.length < 120) {
    months.push(cursor);
    cursor = shiftMonth(cursor, 1);
  }
  return months;
}

function normalizedToken(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\-_]+/g, " ")
    .replace(/\s+/g, " ");
}

function isEmergencyFundSaving(transaction: CurrencySourceData["transactions"][number]) {
  const type = normalizedToken(transaction.type);
  const category = normalizedToken(transaction.category);

  // Support both the canonical stored values and legacy/display labels that
  // existed before the E2EE migration. The Emergency Fund page must mirror the
  // same saving activity visible in Transactions rather than silently dropping
  // older records because of a label/value mismatch.
  const savingType =
    type === "saving" ||
    type === "savings" ||
    type === "general saving" ||
    type === "general savings";

  const emergencyCategory =
    category === "emergency fund" ||
    category === "emergency savings" ||
    category === "emergency fund saving" ||
    category === "emergency fund savings";

  return savingType && emergencyCategory;
}

export function buildEmergencyFundClientInputs(
  source: CurrencySourceData,
): EmergencyFundInputs {
  const today = localDateKey();
  const currentMonth = monthKey();
  const fallbackFirstMonth = shiftMonth(currentMonth, -11);
  const contributions = source.transactions
    .filter(
      (transaction) =>
        isEmergencyFundSaving(transaction) &&
        Boolean(transaction.transaction_date) &&
        transaction.transaction_date <= today,
    )
    .sort((a, b) =>
      (a.occurred_at ?? a.transaction_date).localeCompare(
        b.occurred_at ?? b.transaction_date,
      ),
    );

  const firstContributionMonth = contributions[0]?.transaction_date.slice(0, 7);
  const firstMonth = firstContributionMonth && firstContributionMonth < fallbackFirstMonth
    ? firstContributionMonth
    : fallbackFirstMonth;

  const monthlyMap = new Map<string, { count: number; amount: number }>();
  for (const transaction of contributions) {
    const month = transaction.transaction_date.slice(0, 7);
    const row = monthlyMap.get(month) ?? { count: 0, amount: 0 };
    row.count += 1;
    row.amount += Math.max(0, finiteNumber(transaction.amount_eur));
    monthlyMap.set(month, row);
  }

  const monthly: EmergencyFundMonth[] = monthSeries(firstMonth, currentMonth).map(
    (month) => {
      const row = monthlyMap.get(month);
      return {
        month,
        contributionCount: row?.count ?? 0,
        contribution: row?.amount ?? 0,
      };
    },
  );

  const financialHealth =
    buildNetWorthGrowthInputsFromSource(source).wealthScore.financialHealth;
  const oneMonthCommitments = sumMoney([
    financialHealth.bills.oneMonthAmount,
    financialHealth.debts.minimumMonthlyPayment,
  ]);

  const recentContributions = [...contributions]
    .sort((a, b) =>
      (b.occurred_at ?? b.transaction_date).localeCompare(
        a.occurred_at ?? a.transaction_date,
      ),
    )
    .slice(0, 10)
    .map((transaction) => ({
      id: transaction.id,
      description:
        String(transaction.description ?? "").trim() || "Emergency fund saving",
      amount: Math.max(0, finiteNumber(transaction.amount_eur)),
      occurredAt:
        transaction.occurred_at ??
        `${transaction.transaction_date}T00:00:00.000Z`,
    }));

  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    financialHealth,
    oneMonthCommitments,
    monthly,
    recentContributions,
    stats: {
      contributionCount: contributions.length,
      lastContributionAt: recentContributions[0]?.occurredAt ?? null,
    },
  };
}
