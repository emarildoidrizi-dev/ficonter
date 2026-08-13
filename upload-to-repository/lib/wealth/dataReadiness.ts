import type { FinancialHealthInputs } from "@/lib/wealth/financialHealth";

export type DataConfidence = "High" | "Moderate" | "Developing" | "No data";

export type FinancialDataReadiness = {
  hasAnyData: boolean;
  hasTransactions: boolean;
  hasIncome: boolean;
  hasOutflow: boolean;
  hasBills: boolean;
  hasDebts: boolean;
  hasGoals: boolean;
  hasPlannerData: boolean;
  meaningfulModuleCount: number;
};

const EPSILON = 0.005;

function nonZero(value: number): boolean {
  return Math.abs(value) >= EPSILON;
}

export function financialDataReadiness(
  input: FinancialHealthInputs,
): FinancialDataReadiness {
  const hasTransactions =
    input.transactions.count > 0 ||
    nonZero(input.transactions.totalIncome) ||
    nonZero(input.transactions.totalExpenses) ||
    nonZero(input.transactions.totalSavings) ||
    nonZero(input.transactions.debtPayments);
  const hasIncome = nonZero(input.transactions.totalIncome);
  const hasOutflow = nonZero(input.transactions.totalExpenses);
  const hasBills = input.bills.count > 0;
  const hasDebts = input.debts.count > 0;
  const hasGoals = input.goals.count > 0;
  const hasPlannerData =
    input.planner.itemCount > 0 ||
    nonZero(input.planner.plannedIncome) ||
    nonZero(input.planner.plannedOutflow);

  const meaningfulModuleCount = [
    hasTransactions,
    hasBills,
    hasDebts,
    hasGoals,
    hasPlannerData,
  ].filter(Boolean).length;

  return {
    hasAnyData: meaningfulModuleCount > 0,
    hasTransactions,
    hasIncome,
    hasOutflow,
    hasBills,
    hasDebts,
    hasGoals,
    hasPlannerData,
    meaningfulModuleCount,
  };
}

export function confidenceFromCoverage(coverage: number): DataConfidence {
  if (coverage <= 0) return "No data";
  if (coverage >= 75) return "High";
  if (coverage >= 45) return "Moderate";
  return "Developing";
}
