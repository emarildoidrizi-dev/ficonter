"use client";

import type { ComponentProps } from "react";

import { DashboardLiveOverview } from "@/components/DashboardLiveOverview";
import { useBaseCurrencySourceData } from "@/components/useBaseCurrencySourceData";

type DashboardProps = ComponentProps<typeof DashboardLiveOverview>;
type Props = Omit<DashboardProps, "initialBudgetPlans">;

export function EncryptedDashboardOverview(props: Props) {
  const { source } = useBaseCurrencySourceData(props.userId);
  const budgetPlans = (source.plans as any[]).map((plan) => ({
    month: plan.month,
    spending_budget: Number(plan.spending_budget ?? 0),
  }));

  return <DashboardLiveOverview {...props} initialBudgetPlans={budgetPlans} />;
}
