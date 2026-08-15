import type { FinancialHealthInputs } from "@/lib/wealth/financialHealth";
import { financialDataReadiness } from "@/lib/wealth/dataReadiness";

export type SetupAcknowledgementKey =
  | "noBills"
  | "debtFree"
  | "noSavingsYet"
  | "noGoalsYet";

export type SetupAcknowledgements = Record<SetupAcknowledgementKey, boolean> & {
  updatedAt: string;
};

export type FinancialSetupStepId =
  | "income"
  | "expenses"
  | "bills"
  | "debt"
  | "savings"
  | "goals"
  | "planner";

export type FinancialSetupStep = {
  id: FinancialSetupStepId;
  title: string;
  description: string;
  href: string;
  completed: boolean;
  recorded: boolean;
  confirmedEmpty: boolean;
  acknowledgementKey?: SetupAcknowledgementKey;
  confirmationLabel?: string;
};

export type FinancialSetupResult = {
  steps: FinancialSetupStep[];
  completedCount: number;
  totalCount: number;
  completionPercentage: number;
  profileComplete: boolean;
  scoreReady: boolean;
  scoreReadinessLabel: "Pending" | "Preliminary" | "Ready";
  nextStep: FinancialSetupStep | null;
  confirmedEmptyCount: number;
};

export const EMPTY_SETUP_ACKNOWLEDGEMENTS: SetupAcknowledgements = {
  noBills: false,
  debtFree: false,
  noSavingsYet: false,
  noGoalsYet: false,
  updatedAt: "",
};

function readBoolean(value: unknown): boolean {
  return value === true;
}

export function readSetupAcknowledgements(
  metadata: unknown,
): SetupAcknowledgements {
  if (!metadata || typeof metadata !== "object") {
    return EMPTY_SETUP_ACKNOWLEDGEMENTS;
  }

  const root = metadata as Record<string, unknown>;
  const stored = root.ficonter_setup;
  if (!stored || typeof stored !== "object") {
    return EMPTY_SETUP_ACKNOWLEDGEMENTS;
  }

  const value = stored as Record<string, unknown>;
  return {
    noBills: readBoolean(value.no_bills),
    debtFree: readBoolean(value.debt_free),
    noSavingsYet: readBoolean(value.no_savings_yet),
    noGoalsYet: readBoolean(value.no_goals_yet),
    updatedAt: typeof value.updated_at === "string" ? value.updated_at : "",
  };
}

export function serializeSetupAcknowledgements(
  acknowledgements: SetupAcknowledgements,
): Record<string, unknown> {
  return {
    no_bills: acknowledgements.noBills,
    debt_free: acknowledgements.debtFree,
    no_savings_yet: acknowledgements.noSavingsYet,
    no_goals_yet: acknowledgements.noGoalsYet,
    updated_at: acknowledgements.updatedAt,
  };
}

export function calculateFinancialSetup(
  input: FinancialHealthInputs,
  acknowledgements: SetupAcknowledgements,
): FinancialSetupResult {
  const readiness = financialDataReadiness(input);
  const hasSavings =
    input.transactions.totalSavings > 0.005 ||
    input.transactions.emergencyFundSavings > 0.005;

  const steps: FinancialSetupStep[] = [
    {
      id: "income",
      title: "Add your income",
      description:
        "Record the income FICONTER should use as the base of your monthly financial picture.",
      href: "/dashboard/transactions?setup=income",
      completed: readiness.hasIncome,
      recorded: readiness.hasIncome,
      confirmedEmpty: false,
    },
    {
      id: "expenses",
      title: "Add your essential expenses",
      description:
        "Record at least one real expense so cash flow, savings rate and affordability can be assessed.",
      href: "/dashboard/transactions?setup=expense",
      completed: readiness.hasOutflow,
      recorded: readiness.hasOutflow,
      confirmedEmpty: false,
    },
    {
      id: "bills",
      title: "Confirm recurring bills",
      description:
        "Add your recurring commitments or confirm that you currently have none to manage.",
      href: "/dashboard/bills",
      completed: readiness.hasBills || acknowledgements.noBills,
      recorded: readiness.hasBills,
      confirmedEmpty: !readiness.hasBills && acknowledgements.noBills,
      acknowledgementKey: "noBills",
      confirmationLabel: "I currently have no recurring bills",
    },
    {
      id: "debt",
      title: "Confirm your debt position",
      description:
        "Add active liabilities or confirm that you are currently debt-free.",
      href: "/dashboard/debt",
      completed: readiness.hasDebts || acknowledgements.debtFree,
      recorded: readiness.hasDebts,
      confirmedEmpty: !readiness.hasDebts && acknowledgements.debtFree,
      acknowledgementKey: "debtFree",
      confirmationLabel: "I am currently debt-free",
    },
    {
      id: "savings",
      title: "Confirm current savings",
      description:
        "Record a savings transfer or confirm that your current savings amount is zero.",
      href: "/dashboard/transactions?setup=saving",
      completed: hasSavings || acknowledgements.noSavingsYet,
      recorded: hasSavings,
      confirmedEmpty: !hasSavings && acknowledgements.noSavingsYet,
      acknowledgementKey: "noSavingsYet",
      confirmationLabel: "I do not have savings recorded yet",
    },
    {
      id: "goals",
      title: "Define your financial goals",
      description:
        "Add at least one goal or confirm that you are not actively funding a goal yet.",
      href: "/dashboard/goals",
      completed: readiness.hasGoals || acknowledgements.noGoalsYet,
      recorded: readiness.hasGoals,
      confirmedEmpty: !readiness.hasGoals && acknowledgements.noGoalsYet,
      acknowledgementKey: "noGoalsYet",
      confirmationLabel: "I do not have an active goal yet",
    },
    {
      id: "planner",
      title: "Create your monthly plan",
      description:
        "Use the Monthly Planner to allocate income across expenses, savings, debt and goals.",
      href: "/dashboard/budget",
      completed: readiness.hasPlannerData,
      recorded: readiness.hasPlannerData,
      confirmedEmpty: false,
    },
  ];

  const completedCount = steps.filter((step) => step.completed).length;
  const confirmedEmptyCount = steps.filter((step) => step.confirmedEmpty).length;
  const completionPercentage = Math.round((completedCount / steps.length) * 100);
  const scoreReady = readiness.hasIncome && readiness.hasOutflow;
  const profileComplete = completedCount === steps.length;
  const scoreReadinessLabel = !scoreReady
    ? "Pending"
    : profileComplete
      ? "Ready"
      : "Preliminary";

  return {
    steps,
    completedCount,
    totalCount: steps.length,
    completionPercentage,
    profileComplete,
    scoreReady,
    scoreReadinessLabel,
    nextStep: steps.find((step) => !step.completed) ?? null,
    confirmedEmptyCount,
  };
}
