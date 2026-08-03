"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  FileText,
  PackageOpen,
  ReceiptText,
  ShoppingCart,
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
  BusinessInventoryItemSnapshot,
  BusinessSale,
  BusinessTransaction,
} from "@/lib/business/types";
import { AutoFitSingleLineText } from "@/components/AutoFitSingleLineText";
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
  initialInventory,
  initialSales,
}: {
  business: Business;
  initialTransactions: BusinessTransaction[];
  initialBudgets: BusinessCostBudget[];
  initialCategories: BusinessCostCategory[];
  initialCentres: BusinessCostCentre[];
  initialInventory: BusinessInventoryItemSnapshot[];
  initialSales: BusinessSale[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [budgets, setBudgets] = useState(initialBudgets);
  const [inventory, setInventory] = useState(initialInventory);
  const [sales, setSales] = useState(initialSales);
  const month = businessMonthKey();

  async function refreshInventory() {
    const { data } = await supabase
      .from("business_inventory_item_balances")
      .select("*")
      .eq("business_id", business.id)
      .order("name", { ascending: true });
    if (data) setInventory(data as BusinessInventoryItemSnapshot[]);
  }

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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_inventory_items", filter: `business_id=eq.${business.id}` },
        () => { void refreshInventory(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_inventory_movements", filter: `business_id=eq.${business.id}` },
        () => { void refreshInventory(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_sales", filter: `business_id=eq.${business.id}` },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          setSales((current) =>
            mergeRealtime<BusinessSale>(current, payload).sort((a, b) =>
              b.occurred_at.localeCompare(a.occurred_at),
            ),
          );
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
  const activeInventory = inventory.filter((item) => item.status === "active");
  const inventoryValue = sumMoney(activeInventory.map((item) => item.inventory_value_base));
  const potentialSales = sumMoney(activeInventory.map((item) => item.potential_sales_value_base));
  const lowStock = activeInventory.filter(
    (item) => finiteNumber(item.quantity_on_hand) <= finiteNumber(item.low_stock_threshold),
  ).length;
  const monthlySales = sales.filter(
    (sale) => sale.status === "completed" && sale.sale_date.startsWith(month),
  );
  const salesNet = sumMoney(monthlySales.map((sale) => sale.net_sales_base));
  const salesCogs = sumMoney(monthlySales.map((sale) => sale.cogs_base));
  const salesGrossProfit = sumMoney(monthlySales.map((sale) => sale.gross_profit_base));
  const salesMargin = salesNet > 0 ? (salesGrossProfit / salesNet) * 100 : 0;
  const money = (value: number) => formatCurrency(value, business.base_currency);

  return (
    <section className={styles.shell}>
      <header className={styles.hero}>
        <div><span>FICONTER BUSINESS · OVERVIEW</span><AutoFitSingleLineText text={business.name} minSize={10} maxSize={62} /><p>{business.business_type} · Base currency {business.base_currency}</p></div>
        <div className={styles.heroActions}>
          <Link href="/business/reports"><FileText size={18} /> Reports <ArrowRight size={17} /></Link>
          <Link href="/business/sales"><ShoppingCart size={18} /> Sales <ArrowRight size={17} /></Link>
          <Link href="/business/inventory"><PackageOpen size={18} /> Inventory <ArrowRight size={17} /></Link>
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

      <article className={styles.costPanel}>
        <div className={styles.panelHead}>
          <div><span>B5 INVENTORY</span><h2>Stock position</h2></div>
          <Link href="/business/inventory">Open Inventory</Link>
        </div>
        <div className={styles.costSnapshot}>
          <div><span>Inventory value</span><strong>{money(inventoryValue)}</strong><small>Weighted stock value</small></div>
          <div><span>Active items</span><strong>{activeInventory.length}</strong><small>Tracked products and materials</small></div>
          <div className={lowStock ? styles.negative : styles.positive}><span>Low stock alerts</span><strong>{lowStock}</strong><small>{lowStock ? "Items need attention" : "Stock levels healthy"}</small></div>
          <div><span>Potential sales value</span><strong>{money(potentialSales)}</strong><small>At current selling prices</small></div>
        </div>
      </article>

      <article className={styles.costPanel}>
        <div className={styles.panelHead}>
          <div><span>B6 SALES &amp; COGS</span><h2>Monthly gross-profit position</h2></div>
          <Link href="/business/sales">Open Sales</Link>
        </div>
        <div className={styles.costSnapshot}>
          <div><span>Net sales</span><strong>{money(salesNet)}</strong><small>{monthlySales.length} completed sales</small></div>
          <div><span>Cost of goods sold</span><strong>{money(salesCogs)}</strong><small>Weighted-average inventory cost</small></div>
          <div className={salesGrossProfit >= 0 ? styles.positive : styles.negative}><span>Gross profit</span><strong>{money(salesGrossProfit)}</strong><small>Net sales less COGS</small></div>
          <div><span>Gross margin</span><strong>{salesMargin.toFixed(1)}%</strong><small>Before operating costs</small></div>
        </div>
      </article>

      <article className={styles.panel}>
        <div className={styles.panelHead}><div><span>LIVE BUSINESS LEDGER</span><h2>Recent activity</h2></div><Link href="/business/transactions">View all</Link></div>
        {recent.length ? <div className={styles.rows}>{recent.map((item) => <div className={styles.row} key={item.id}>
          <i className={item.type === "income" ? styles.income : styles.expense} />
          <div><strong>{item.description}</strong><span>{item.counterparty || item.category} · {new Date(item.occurred_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}{item.source_recurring_cost_id ? " · automatic recurring" : ""}{item.source_sale_id ? " · completed sale" : ""}</span></div>
          <b className={item.type === "income" ? styles.incomeAmount : styles.expenseAmount}>{item.type === "income" ? "+" : "−"}{money(finiteNumber(item.amount_base))}</b>
        </div>)}</div> : <div className={styles.empty}>No business transactions yet. Add the first record in Business Transactions.</div>}
      </article>
    </section>
  );
}
