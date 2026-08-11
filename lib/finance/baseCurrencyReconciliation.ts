import type { CurrencyCode } from "@/lib/financialOptions";
import {
  addMoney,
  finiteNumber,
  roundConvertedAmount,
  roundMoney,
  subtractMoney,
  sumMoney,
} from "@/lib/finance/money";
import {
  originalAmountInBaseCurrency,
  type BaseCurrencyBill,
  type BaseCurrencyTransaction,
} from "@/lib/finance/baseCurrencyActuals";
import {
  calculatePlatformCashActuals,
  reconcileCashFlowMonthlyInputs,
  reconcileFinancialHealthInputs,
} from "@/lib/finance/monthlyCashActuals";
import type { FinancialHealthInputs } from "@/lib/wealth/financialHealth";
import type {
  CashFlowIntelligenceInputs,
  CashFlowDebtPaymentInput,
} from "@/lib/wealth/cashFlowIntelligence";
import type { SavingsIntelligenceInputs } from "@/lib/wealth/savingsIntelligence";
import type { EmergencyFundInputs } from "@/lib/wealth/emergencyFund";
import type { NetWorthGrowthInputs } from "@/lib/wealth/netWorthGrowth";
import type { AiInsightsInputs } from "@/lib/wealth/aiInsights";

export type CurrencySourceTransaction = BaseCurrencyTransaction & {
  description?: string | null;
  occurred_at?: string | null;
  exchange_rate_to_eur?: number | string | null;
};

export type CurrencySourceBill = BaseCurrencyBill & {
  name?: string | null;
  category?: string | null;
};

export type CurrencySourceDebt = {
  id: string;
  name?: string | null;
  category?: string | null;
  currency: string | null;
  original_balance: number | string;
  current_balance: number | string;
  minimum_payment: number | string;
  original_balance_eur: number | string;
  current_balance_eur: number | string;
  minimum_payment_eur: number | string;
  annual_interest_rate?: number | string | null;
  status?: string | null;
  updated_at?: string | null;
};

export type CurrencySourceDebtPayment = {
  id?: string;
  debt_id: string;
  amount: number | string;
  currency: string | null;
  amount_eur: number | string;
  paid_at: string;
};

export type CurrencySourceGoal = {
  id: string;
  target_amount: number | string;
  current_amount: number | string;
  status?: string | null;
};

export type CurrencySourcePlan = {
  month: string;
  start_balance: number | string;
};

export type CurrencySourceItem = {
  month: string;
  section: string;
  planned_amount: number | string;
};

export type CurrencySourceData = {
  transactions: CurrencySourceTransaction[];
  bills: CurrencySourceBill[];
  debts: CurrencySourceDebt[];
  debtPayments: CurrencySourceDebtPayment[];
  goals: CurrencySourceGoal[];
  plans: CurrencySourcePlan[];
  items: CurrencySourceItem[];
};

export type BaseCurrencyReconciliationContext = {
  baseCurrency: CurrencyCode;
  latestRate: number | null;
  rateForDate: (date?: string | null) => number | null;
};

const SAVING_WORDS = [
  "saving",
  "savings",
  "emergency fund",
  "retirement",
  "stocks",
  "etfs",
  "bonds",
  "crypto",
  "investment",
  "house deposit",
  "education fund",
];

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function inMonth(value: string | null | undefined, month: string): boolean {
  return Boolean(value?.slice(0, 7) === month);
}

function isIncome(transaction: CurrencySourceTransaction): boolean {
  return transaction.type === "income";
}

function isSaving(transaction: CurrencySourceTransaction): boolean {
  if (transaction.type === "saving" || transaction.type === "savings") return true;
  const category = text(transaction.category).toLowerCase();
  return SAVING_WORDS.some((word) => category.includes(word));
}

function isEmergencyFund(transaction: CurrencySourceTransaction): boolean {
  return text(transaction.category).trim().toLowerCase() === "emergency fund";
}

function isGoalInvestment(transaction: CurrencySourceTransaction): boolean {
  const description = text(transaction.description).toLowerCase();
  return description.startsWith("goal investment");
}

export function canonicalAmountInBaseCurrency(
  value: unknown,
  context: BaseCurrencyReconciliationContext,
): number {
  const amount = finiteNumber(value);
  if (context.baseCurrency === "EUR") return roundMoney(amount);
  const rate = context.latestRate;
  if (!rate || !Number.isFinite(rate) || rate <= 0) return roundMoney(amount);
  return roundConvertedAmount(amount * rate);
}

export function baseCurrencyAmountToCanonicalEur(
  value: unknown,
  context: BaseCurrencyReconciliationContext,
): number | null {
  const amount = finiteNumber(value);

  if (context.baseCurrency === "EUR") {
    return roundMoney(amount);
  }

  const rate = context.latestRate;
  if (!rate || !Number.isFinite(rate) || rate <= 0) {
    return null;
  }

  return roundConvertedAmount(amount / rate);
}

export function currentRecordAmountInBaseCurrency({
  originalAmount,
  originalCurrency,
  amountEur,
  context,
}: {
  originalAmount: unknown;
  originalCurrency: unknown;
  amountEur: unknown;
  context: BaseCurrencyReconciliationContext;
}): number {
  const currency = String(originalCurrency || "EUR").toUpperCase();
  if (currency === context.baseCurrency) return roundMoney(originalAmount);
  return canonicalAmountInBaseCurrency(amountEur, context);
}

export function historicalRecordAmountInBaseCurrency({
  originalAmount,
  originalCurrency,
  amountEur,
  date,
  context,
}: {
  originalAmount: unknown;
  originalCurrency: unknown;
  amountEur: unknown;
  date?: string | null;
  context: BaseCurrencyReconciliationContext;
}): number {
  const exact = originalAmountInBaseCurrency({
    originalAmount,
    originalCurrency,
    amountEur,
    baseCurrency: context.baseCurrency,
    euroToBaseRate: context.rateForDate(date),
  });
  if (exact !== null) return exact;
  return canonicalAmountInBaseCurrency(amountEur, context);
}

export function mapTransactionsToBaseCurrency(
  transactions: CurrencySourceTransaction[],
  context: BaseCurrencyReconciliationContext,
): CurrencySourceTransaction[] {
  return transactions.map((transaction) => ({
    ...transaction,
    amount_eur: historicalRecordAmountInBaseCurrency({
      originalAmount: transaction.amount,
      originalCurrency: transaction.currency,
      amountEur: transaction.amount_eur,
      date: transaction.transaction_date,
      context,
    }),
  }));
}

export function mapBillsToBaseCurrency(
  bills: CurrencySourceBill[],
  context: BaseCurrencyReconciliationContext,
): CurrencySourceBill[] {
  return bills.map((bill) => ({
    ...bill,
    amount_eur: historicalRecordAmountInBaseCurrency({
      originalAmount: bill.amount,
      originalCurrency: bill.currency,
      amountEur: bill.amount_eur,
      date: bill.paid_at?.slice(0, 10) ?? bill.due_date,
      context,
    }),
  }));
}

export function mapDebtPaymentsToBaseCurrency(
  payments: CurrencySourceDebtPayment[],
  context: BaseCurrencyReconciliationContext,
): CashFlowDebtPaymentInput[] {
  return payments.map((payment) => ({
    debtId: payment.debt_id,
    amountEur: historicalRecordAmountInBaseCurrency({
      originalAmount: payment.amount,
      originalCurrency: payment.currency,
      amountEur: payment.amount_eur,
      date: payment.paid_at?.slice(0, 10),
      context,
    }),
    paidAt: payment.paid_at,
  }));
}

export function debtCurrentAmount(
  debt: CurrencySourceDebt,
  context: BaseCurrencyReconciliationContext,
): number {
  return currentRecordAmountInBaseCurrency({
    originalAmount: debt.current_balance,
    originalCurrency: debt.currency,
    amountEur: debt.current_balance_eur,
    context,
  });
}

export function debtOriginalAmount(
  debt: CurrencySourceDebt,
  context: BaseCurrencyReconciliationContext,
): number {
  return currentRecordAmountInBaseCurrency({
    originalAmount: debt.original_balance,
    originalCurrency: debt.currency,
    amountEur: debt.original_balance_eur,
    context,
  });
}

export function debtMinimumAmount(
  debt: CurrencySourceDebt,
  context: BaseCurrencyReconciliationContext,
): number {
  return currentRecordAmountInBaseCurrency({
    originalAmount: debt.minimum_payment,
    originalCurrency: debt.currency,
    amountEur: debt.minimum_payment_eur,
    context,
  });
}

function billActivityDate(bill: CurrencySourceBill): string {
  return bill.status === "paid"
    ? bill.paid_at?.slice(0, 10) ?? bill.due_date
    : bill.due_date;
}

export function reconcileFinancialHealthToBaseCurrency(
  input: FinancialHealthInputs,
  source: CurrencySourceData,
  context: BaseCurrencyReconciliationContext,
): FinancialHealthInputs {
  const transactions = mapTransactionsToBaseCurrency(source.transactions, context);
  const bills = mapBillsToBaseCurrency(source.bills, context);
  const reconciled = reconcileFinancialHealthInputs(input, transactions, bills);

  const today = new Date().toISOString().slice(0, 10);
  const nextMonth = new Date();
  nextMonth.setDate(nextMonth.getDate() + 31);
  const oneMonthEnd = nextMonth.toISOString().slice(0, 10);

  const pendingBills = bills.filter((bill) => bill.status === "pending");
  const pendingAmount = sumMoney(pendingBills.map((bill) => bill.amount_eur));
  const oneMonthAmount = sumMoney(
    pendingBills
      .filter((bill) => bill.due_date >= today && bill.due_date <= oneMonthEnd)
      .map((bill) => bill.amount_eur),
  );

  const activeDebts = source.debts.filter((debt) => debt.status !== "paid_off");
  const originalDebt = sumMoney(
    activeDebts.map((debt) => debtOriginalAmount(debt, context)),
  );
  const currentDebt = sumMoney(
    activeDebts.map((debt) => debtCurrentAmount(debt, context)),
  );
  const minimumDebt = sumMoney(
    activeDebts.map((debt) => debtMinimumAmount(debt, context)),
  );

  const mappedTransactions = transactions;
  const emergencyFundSavings = sumMoney(
    mappedTransactions
      .filter(isEmergencyFund)
      .map((transaction) => transaction.amount_eur),
  );
  const goalInvestments = sumMoney(
    mappedTransactions
      .filter(isGoalInvestment)
      .map((transaction) => transaction.amount_eur),
  );
  const debtPayments = sumMoney(
    mapDebtPaymentsToBaseCurrency(source.debtPayments, context).map(
      (payment) => payment.amountEur,
    ),
  );

  return {
    ...reconciled,
    transactions: {
      ...reconciled.transactions,
      emergencyFundSavings,
      goalInvestments,
      debtPayments,
    },
    bills: {
      ...reconciled.bills,
      pendingAmount,
      oneMonthAmount,
    },
    debts: {
      ...reconciled.debts,
      originalBalance: originalDebt,
      currentBalance: currentDebt,
      minimumMonthlyPayment: minimumDebt,
    },
    goals: {
      ...reconciled.goals,
      // Goals were historically stored in FICONTER's canonical EUR layer.
      // They remain converted through the selected base-currency lens until
      // Phase 4 migrates goal-native currency metadata.
      totalTarget: canonicalAmountInBaseCurrency(reconciled.goals.totalTarget, context),
      totalCurrent: canonicalAmountInBaseCurrency(reconciled.goals.totalCurrent, context),
    },
    planner: {
      ...reconciled.planner,
      plannedIncome: canonicalAmountInBaseCurrency(reconciled.planner.plannedIncome, context),
      plannedOutflow: canonicalAmountInBaseCurrency(reconciled.planner.plannedOutflow, context),
    },
  };
}

export function reconcileCashFlowToBaseCurrency(
  input: CashFlowIntelligenceInputs,
  source: CurrencySourceData,
  context: BaseCurrencyReconciliationContext,
): CashFlowIntelligenceInputs {
  const transactions = mapTransactionsToBaseCurrency(source.transactions, context);
  const bills = mapBillsToBaseCurrency(source.bills, context);

  const reconciled = reconcileCashFlowMonthlyInputs(
    {
      ...input,
      financialHealth: reconcileFinancialHealthToBaseCurrency(
        input.financialHealth,
        source,
        context,
      ),
      categories: input.categories.map((category) => ({
        ...category,
        recentAmount: canonicalAmountInBaseCurrency(category.recentAmount, context),
        priorAmount: canonicalAmountInBaseCurrency(category.priorAmount, context),
      })),
      planner: {
        ...input.planner,
        plannedIncome: canonicalAmountInBaseCurrency(input.planner.plannedIncome, context),
        plannedOutflow: canonicalAmountInBaseCurrency(input.planner.plannedOutflow, context),
      },
    },
    transactions,
    bills,
  );

  const paymentMap = new Map<string, number>();
  for (const payment of mapDebtPaymentsToBaseCurrency(source.debtPayments, context)) {
    paymentMap.set(
      payment.debtId,
      addMoney(paymentMap.get(payment.debtId) ?? 0, payment.amountEur),
    );
  }

  const commitmentItems = reconciled.commitments.items.map((item) => {
    if (item.kind === "bill") {
      const bill = bills.find((candidate) => candidate.id === item.id);
      return bill
        ? {
            ...item,
            amount: finiteNumber(bill.amount_eur),
            originalAmount: finiteNumber(bill.amount_eur),
          }
        : {
            ...item,
            amount: canonicalAmountInBaseCurrency(item.amount, context),
            originalAmount:
              item.originalAmount === undefined
                ? undefined
                : canonicalAmountInBaseCurrency(item.originalAmount, context),
          };
    }

    const debt = source.debts.find((candidate) => candidate.id === item.id);
    return debt
      ? {
          ...item,
          amount: debtMinimumAmount(debt, context),
          originalAmount: debtMinimumAmount(debt, context),
          paidThisMonth: paymentMap.get(debt.id) ?? 0,
        }
      : {
          ...item,
          amount: canonicalAmountInBaseCurrency(item.amount, context),
          originalAmount:
            item.originalAmount === undefined
              ? undefined
              : canonicalAmountInBaseCurrency(item.originalAmount, context),
          paidThisMonth:
            item.paidThisMonth === undefined
              ? undefined
              : canonicalAmountInBaseCurrency(item.paidThisMonth, context),
        };
  });

  const billsTotal = sumMoney(
    commitmentItems
      .filter((item) => item.kind === "bill")
      .map((item) => item.amount),
  );
  const debtMinimums = sumMoney(
    commitmentItems
      .filter((item) => item.kind === "debt")
      .map((item) => item.amount),
  );

  return {
    ...reconciled,
    commitments: {
      ...reconciled.commitments,
      items: commitmentItems,
      billsTotal,
      debtMinimums,
      total: addMoney(billsTotal, debtMinimums),
    },
  };
}

export function reconcileSavingsToBaseCurrency(
  input: SavingsIntelligenceInputs,
  source: CurrencySourceData,
  context: BaseCurrencyReconciliationContext,
): SavingsIntelligenceInputs {
  const mapped = mapTransactionsToBaseCurrency(source.transactions, context)
    .filter((transaction) => isSaving(transaction) && !isEmergencyFund(transaction));

  const monthlyMap = new Map<string, { amount: number; count: number }>();
  const categoryMap = new Map<string, { amount: number; count: number; latestAt: string | null }>();

  for (const transaction of mapped) {
    const month = transaction.transaction_date.slice(0, 7);
    const monthly = monthlyMap.get(month) ?? { amount: 0, count: 0 };
    monthly.amount = addMoney(monthly.amount, transaction.amount_eur);
    monthly.count += 1;
    monthlyMap.set(month, monthly);

    const category = text(transaction.category) || "General savings";
    const row = categoryMap.get(category) ?? {
      amount: 0,
      count: 0,
      latestAt: null,
    };
    row.amount = addMoney(row.amount, transaction.amount_eur);
    row.count += 1;
    const occurredAt =
      transaction.occurred_at ??
      `${transaction.transaction_date}T00:00:00.000Z`;
    if (!row.latestAt || occurredAt > row.latestAt) row.latestAt = occurredAt;
    categoryMap.set(category, row);
  }

  const recentSavings = [...mapped]
    .sort((a, b) =>
      (b.occurred_at ?? b.transaction_date).localeCompare(
        a.occurred_at ?? a.transaction_date,
      ),
    )
    .slice(0, 20)
    .map((transaction) => ({
      id: transaction.id,
      description: text(transaction.description) || "Saving contribution",
      category: text(transaction.category) || "General savings",
      amount: finiteNumber(transaction.amount_eur),
      occurredAt:
        transaction.occurred_at ??
        `${transaction.transaction_date}T00:00:00.000Z`,
    }));

  const first = [...mapped].sort((a, b) =>
    (a.occurred_at ?? a.transaction_date).localeCompare(
      b.occurred_at ?? b.transaction_date,
    ),
  )[0];
  const last = recentSavings[0];

  return {
    ...input,
    cashFlow: reconcileCashFlowToBaseCurrency(input.cashFlow, source, context),
    monthlySavings: [...monthlyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, row]) => ({
        month,
        contributionCount: row.count,
        savings: row.amount,
      })),
    categories: [...categoryMap.entries()]
      .map(([category, row]) => ({
        category,
        amount: row.amount,
        contributionCount: row.count,
        latestAt: row.latestAt,
      }))
      .sort((a, b) => b.amount - a.amount),
    recentSavings,
    stats: {
      totalAmount: sumMoney(mapped.map((transaction) => transaction.amount_eur)),
      contributionCount: mapped.length,
      firstContributionAt:
        first?.occurred_at ??
        (first ? `${first.transaction_date}T00:00:00.000Z` : null),
      lastContributionAt: last?.occurredAt ?? null,
    },
  };
}

export function reconcileEmergencyFundToBaseCurrency(
  input: EmergencyFundInputs,
  source: CurrencySourceData,
  context: BaseCurrencyReconciliationContext,
): EmergencyFundInputs {
  const mapped = mapTransactionsToBaseCurrency(source.transactions, context)
    .filter(isEmergencyFund);

  const monthlyMap = new Map<string, { amount: number; count: number }>();
  for (const transaction of mapped) {
    const month = transaction.transaction_date.slice(0, 7);
    const row = monthlyMap.get(month) ?? { amount: 0, count: 0 };
    row.amount = addMoney(row.amount, transaction.amount_eur);
    row.count += 1;
    monthlyMap.set(month, row);
  }

  const recentContributions = [...mapped]
    .sort((a, b) =>
      (b.occurred_at ?? b.transaction_date).localeCompare(
        a.occurred_at ?? a.transaction_date,
      ),
    )
    .slice(0, 20)
    .map((transaction) => ({
      id: transaction.id,
      description: text(transaction.description) || "Emergency fund saving",
      amount: finiteNumber(transaction.amount_eur),
      occurredAt:
        transaction.occurred_at ??
        `${transaction.transaction_date}T00:00:00.000Z`,
    }));

  return {
    ...input,
    financialHealth: reconcileFinancialHealthToBaseCurrency(
      input.financialHealth,
      source,
      context,
    ),
    oneMonthCommitments: reconcileFinancialHealthToBaseCurrency(
      input.financialHealth,
      source,
      context,
    ).bills.oneMonthAmount,
    monthly: [...monthlyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, row]) => ({
        month,
        contributionCount: row.count,
        contribution: row.amount,
      })),
    recentContributions,
    stats: {
      contributionCount: mapped.length,
      lastContributionAt: recentContributions[0]?.occurredAt ?? null,
    },
  };
}

export function reconcileNetWorthGrowthToBaseCurrency(
  input: NetWorthGrowthInputs,
  source: CurrencySourceData,
  context: BaseCurrencyReconciliationContext,
): NetWorthGrowthInputs {
  const health = reconcileFinancialHealthToBaseCurrency(
    input.wealthScore.financialHealth,
    source,
    context,
  );
  const actuals = calculatePlatformCashActuals(
    mapTransactionsToBaseCurrency(source.transactions, context),
    mapBillsToBaseCurrency(source.bills, context),
  );
  const currentDebt = sumMoney(
    source.debts
      .filter((debt) => debt.status !== "paid_off")
      .map((debt) => debtCurrentAmount(debt, context)),
  );
  const availableCash = actuals.netCashFlow;
  const recordedSavings = actuals.totalSavings;
  const recordedCapital = addMoney(availableCash, recordedSavings);
  const netWorth = subtractMoney(recordedCapital, currentDebt);

  return {
    ...input,
    wealthScore: {
      ...input.wealthScore,
      financialHealth: health,
      wealth: {
        ...input.wealthScore.wealth,
        availableCash,
        recordedSavings,
        recordedCapital,
        currentDebt,
        netWorth,
        recent3MonthIncome: canonicalAmountInBaseCurrency(
          input.wealthScore.wealth.recent3MonthIncome,
          context,
        ),
        recent3MonthRetainedCapital: canonicalAmountInBaseCurrency(
          input.wealthScore.wealth.recent3MonthRetainedCapital,
          context,
        ),
        prior3MonthIncome: canonicalAmountInBaseCurrency(
          input.wealthScore.wealth.prior3MonthIncome,
          context,
        ),
        prior3MonthRetainedCapital: canonicalAmountInBaseCurrency(
          input.wealthScore.wealth.prior3MonthRetainedCapital,
          context,
        ),
      },
      liabilities: input.wealthScore.liabilities.map((liability) => {
        const sourceDebt = source.debts.find((debt) => debt.id === liability.id);
        return sourceDebt
          ? {
              ...liability,
              originalBalance: debtOriginalAmount(sourceDebt, context),
              currentBalance: debtCurrentAmount(sourceDebt, context),
            }
          : {
              ...liability,
              originalBalance: canonicalAmountInBaseCurrency(liability.originalBalance, context),
              currentBalance: canonicalAmountInBaseCurrency(liability.currentBalance, context),
            };
      }),
      monthly: input.wealthScore.monthly.map((month) => ({
        ...month,
        income: canonicalAmountInBaseCurrency(month.income, context),
        expenses: canonicalAmountInBaseCurrency(month.expenses, context),
        savings: canonicalAmountInBaseCurrency(month.savings, context),
        retainedCapital: canonicalAmountInBaseCurrency(month.retainedCapital, context),
        availableCashChange: canonicalAmountInBaseCurrency(month.availableCashChange, context),
      })),
    },
    growth: {
      ...input.growth,
      monthly: input.growth.monthly.map((month) => ({
        ...month,
        income: canonicalAmountInBaseCurrency(month.income, context),
        expenses: canonicalAmountInBaseCurrency(month.expenses, context),
        savings: canonicalAmountInBaseCurrency(month.savings, context),
        retainedCapital: canonicalAmountInBaseCurrency(month.retainedCapital, context),
        availableCashChange: canonicalAmountInBaseCurrency(month.availableCashChange, context),
        cumulativeCapital: canonicalAmountInBaseCurrency(month.cumulativeCapital, context),
        debtOutstanding: canonicalAmountInBaseCurrency(month.debtOutstanding, context),
        debtChange: canonicalAmountInBaseCurrency(month.debtChange, context),
        debtPayments: canonicalAmountInBaseCurrency(month.debtPayments, context),
        netWorth: canonicalAmountInBaseCurrency(month.netWorth, context),
      })),
    },
  };
}

export function reconcileAiInsightsToBaseCurrency(
  input: AiInsightsInputs,
  source: CurrencySourceData,
  context: BaseCurrencyReconciliationContext,
): AiInsightsInputs {
  return {
    ...input,
    cashFlow: reconcileCashFlowToBaseCurrency(input.cashFlow, source, context),
    financialIndependence: {
      ...input.financialIndependence,
      netWorthGrowth: reconcileNetWorthGrowthToBaseCurrency(
        input.financialIndependence.netWorthGrowth,
        source,
        context,
      ),
      savingsIntelligence: reconcileSavingsToBaseCurrency(
        input.financialIndependence.savingsIntelligence,
        source,
        context,
      ),
      emergencyFund: reconcileEmergencyFundToBaseCurrency(
        input.financialIndependence.emergencyFund,
        source,
        context,
      ),
      settings: {
        ...input.financialIndependence.settings,
        targetMonthlySpending:
          input.financialIndependence.settings.targetMonthlySpending == null
            ? null
            : canonicalAmountInBaseCurrency(
                input.financialIndependence.settings.targetMonthlySpending,
                context,
              ),
      },
    },
  };
}
