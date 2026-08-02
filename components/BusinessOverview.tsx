"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  ReceiptText,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { finiteNumber, subtractMoney, sumMoney } from "@/lib/finance/money";
import { formatCurrency } from "@/lib/financialOptions";
import {
  businessMonthKey,
  calculateBusinessCostControl,
} from "@/lib/business/costControl";
import type {
  Business,
  BusinessCostBudget,
  BusinessCostCategory,
  BusinessCostCentre,
  BusinessTransaction,
} from "@/lib/business/types";
import styles from "./BusinessOverview.module.css";

function mergeRealtime<T extends { id: string }>(
  current: T[],
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
) {
  if (payload.eventType === "DELETE") {
    const id = (payload.old as { id?: string }).id;
    return current.filter((item) => item.id !== id);
  }
  const changed = payload.new as unknown as T;
  return [changed, ...current.filter((item) => item.id !== changed.id)];
}

export function BusinessOverview({
  business,
  initialTransactions,
  initialBudgets,
  initialCategories,
  initialCentres,
}: {
  business: Business;
  initialTransactions: BusinessTransaction[];
  initialBudgets: BusinessCostBudget[];
  initialCategories: BusinessCostCategory[];
  initialCentres: BusinessCostCentre[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [budgets, setBudgets] = useState(initialBudgets);
  const month = businessMonthKey();

  useEffect(() => {
    const channel = supabase
      .channel(`business-overview-${business.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_transactions", filter: `business_id=eq.${business.id}` },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          setTransactions((current) =>
            mergeRealtime<BusinessTransaction>(current, payload).sort((a, b) =>
              b.occurred_at.localeCompare(a.occurred_at),
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_cost_budgets", filter: `business_id=eq.${business.id}` },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          setBudgets((current) => mergeRealtime<BusinessCostBudget>(current, payload));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [business.id, supabase]);

  const monthly = transactions.filter((item) => item.transaction_date.startsWith(month));
  const revenue = sumMoney(monthly.filter((item) => item.type === "income").map((item) => item.amount_base));
  const expenses = sumMoney(monthly.filter((item) => item.type === "expense").map((item) => item.amount_base));
  const result = subtractMoney(revenue, expenses);
  const lifetime = sumMoney(
    transactions.map((item) =>
      item.type === "income" ? finiteNumber(item.amount_base) : -finiteNumber(item.amount_base),
    ),
  );
  const recent = transactions.slice(0, 8);
  const costMetrics = calculateBusinessCostControl({
    transactions,
    budgets,
    categories: initialCategories,
    centres: initialCentres,
    monthKey: month,
  });
  const money = (value: number) => formatCurrency(value, business.base_currency);

  return (
    <section className={styles.shell}>
      <header className={styles.hero}>
        <div><span>FICONTER BUSINESS · OVERVIEW</span><h1>{business.name}</h1><p>{business.business_type} · Base currency {business.base_currency}</p></div>
        <div className={styles.heroActions}>
          <Link href="/business/cost-control"><BarChart3 size={18} /> Cost Control <ArrowRight size={17} /></Link>
          <Link href="/business/transactions"><ReceiptText size={18} /> Transactions <ArrowRight size={17} /></Link>
        </div>
      </header>

      <div className={styles.kpis}>
        <article><TrendingUp /><span>Revenue this month</span><strong>{money(revenue)}</strong></article>
        <article><TrendingDown /><span>Expenses this month</span><strong>{money(expenses)}</strong></article>
        <article className={result >= 0 ? styles.positive : styles.negative}><BriefcaseBusiness /><span>Operating result</span><strong>{money(result)}</strong></article>
        <article><ReceiptText /><span>Business position</span><strong>{money(lifetime)}</strong></article>
      </div>

      <article className={styles.costPanel}>
        <div className={styles.panelHead}>
          <div><span>B3 COST CONTROL</span><h2>Monthly cost position</h2></div>
          <Link href="/business/cost-control">Open Cost Control</Link>
        </div>
        <div className={styles.costSnapshot}>
          <div><span>Actual costs</span><strong>{money(costMetrics.actualCosts)}</strong><small>{money(costMetrics.fixedCosts)} fixed · {money(costMetrics.variableCosts)} variable</small></div>
          <div><span>Cost budget</span><strong>{money(costMetrics.budgetTotal)}</strong><small>{costMetrics.budgetUsage.toFixed(1)}% used</small></div>
          <div className={!costMetrics.hasBudget ? "" : costMetrics.budgetRemaining >= 0 ? styles.positive : styles.negative}><span>{!costMetrics.hasBudget ? "Budget status" : costMetrics.budgetRemaining >= 0 ? "Budget remaining" : "Over budget"}</span><strong>{costMetrics.hasBudget ? money(Math.abs(costMetrics.budgetRemaining)) : "Not set"}</strong><small>{costMetrics.hasBudget ? "Actual versus planned" : "Set budgets in Cost Control"}</small></div>
          <div><span>Break-even revenue</span><strong>{costMetrics.breakEvenRevenue === null ? "Not available" : money(costMetrics.breakEvenRevenue)}</strong><small>{costMetrics.revenue > 0 ? `${(costMetrics.contributionMarginRatio * 100).toFixed(1)}% contribution margin` : "Add revenue to calculate"}</small></div>
        </div>
      </article>

      <article className={styles.panel}>
        <div className={styles.panelHead}><div><span>LIVE BUSINESS LEDGER</span><h2>Recent activity</h2></div><Link href="/business/transactions">View all</Link></div>
        {recent.length ? <div className={styles.rows}>{recent.map((item) => <div className={styles.row} key={item.id}>
          <i className={item.type === "income" ? styles.income : styles.expense} />
          <div><strong>{item.description}</strong><span>{item.counterparty || item.category} · {new Date(item.occurred_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}{item.source_recurring_cost_id ? " · automatic recurring" : ""}</span></div>
          <b className={item.type === "income" ? styles.incomeAmount : styles.expenseAmount}>{item.type === "income" ? "+" : "−"}{money(finiteNumber(item.amount_base))}</b>
        </div>)}</div> : <div className={styles.empty}>No business transactions yet. Add the first record in Business Transactions.</div>}
      </article>
    </section>
  );
}
