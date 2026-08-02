"use client";

import {
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  Download,
  FileText,
  PackageOpen,
  Printer,
  ReceiptText,
  RefreshCw,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { finiteNumber } from "@/lib/finance/money";
import { formatCurrency } from "@/lib/financialOptions";
import type {
  Business,
  BusinessProfitabilityReport,
  BusinessReportSummary,
} from "@/lib/business/types";
import styles from "./BusinessReports.module.css";

type Preset =
  | "current-month"
  | "previous-month"
  | "current-quarter"
  | "current-year"
  | "last-12-months"
  | "custom";

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rangeForPreset(preset: Exclude<Preset, "custom">) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (preset === "previous-month") {
    return {
      startDate: localDateKey(new Date(year, month - 1, 1)),
      endDate: localDateKey(new Date(year, month, 0)),
    };
  }

  if (preset === "current-quarter") {
    const quarterStart = Math.floor(month / 3) * 3;
    return {
      startDate: localDateKey(new Date(year, quarterStart, 1)),
      endDate: localDateKey(now),
    };
  }

  if (preset === "current-year") {
    return {
      startDate: localDateKey(new Date(year, 0, 1)),
      endDate: localDateKey(now),
    };
  }

  if (preset === "last-12-months") {
    return {
      startDate: localDateKey(new Date(year, month - 11, 1)),
      endDate: localDateKey(now),
    };
  }

  return {
    startDate: localDateKey(new Date(year, month, 1)),
    endDate: localDateKey(now),
  };
}

function dateLabel(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function percentageChange(
  current: unknown,
  prior: unknown,
  positiveWhenHigher = true,
) {
  const currentValue = finiteNumber(current);
  const priorValue = finiteNumber(prior);
  if (priorValue === 0) {
    if (currentValue === 0) return { label: "No change", tone: "neutral" as const };
    return {
      label: "New activity",
      tone: currentValue > 0
        ? positiveWhenHigher ? "positive" as const : "negative" as const
        : positiveWhenHigher ? "negative" as const : "positive" as const,
    };
  }
  const change = ((currentValue - priorValue) / Math.abs(priorValue)) * 100;
  return {
    label: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
    tone: change > 0
      ? positiveWhenHigher ? "positive" as const : "negative" as const
      : change < 0
        ? positiveWhenHigher ? "negative" as const : "positive" as const
        : "neutral" as const,
  };
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function summaryRows(summary: BusinessReportSummary) {
  return [
    ["Net sales", finiteNumber(summary.netSales)],
    ["Other income", finiteNumber(summary.otherIncome)],
    ["Operating income", finiteNumber(summary.operatingIncome)],
    ["Cost of goods sold", finiteNumber(summary.cogs)],
    ["Gross profit", finiteNumber(summary.grossProfit)],
    ["Operating expenses", finiteNumber(summary.operatingExpenses)],
    ["Operating profit", finiteNumber(summary.operatingProfit)],
    ["Inventory purchases", finiteNumber(summary.inventoryPurchases)],
    ["Sales tax collected", finiteNumber(summary.salesTax)],
    ["Cash movement", finiteNumber(summary.cashMovement)],
  ] as const;
}

export function BusinessReports({
  business,
  initialStartDate,
  initialEndDate,
  initialReport,
  initialError,
}: {
  business: Business;
  initialStartDate: string;
  initialEndDate: string;
  initialReport: BusinessProfitabilityReport | null;
  initialError: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [report, setReport] = useState(initialReport);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [preset, setPreset] = useState<Preset>("current-month");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(initialError);

  async function loadReport(nextStart: string, nextEnd: string, quiet = false) {
    if (!nextStart || !nextEnd || nextEnd < nextStart) {
      setError("Choose a valid reporting period.");
      return;
    }

    quiet ? setRefreshing(true) : setBusy(true);
    setError("");

    const { data, error: reportError } = await supabase.rpc(
      "get_business_profitability_report",
      {
        p_business_id: business.id,
        p_start_date: nextStart,
        p_end_date: nextEnd,
      },
    );

    if (reportError) setError(reportError.message);
    else setReport(data as BusinessProfitabilityReport);

    setBusy(false);
    setRefreshing(false);
  }

  function choosePreset(nextPreset: Exclude<Preset, "custom">) {
    const range = rangeForPreset(nextPreset);
    setPreset(nextPreset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    void loadReport(range.startDate, range.endDate);
  }

  useEffect(() => {
    let timer: number | undefined;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void loadReport(startDate, endDate, true);
      }, 700);
    };

    const channel = supabase
      .channel(`business-reporting-${business.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "business_transactions", filter: `business_id=eq.${business.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "business_sales", filter: `business_id=eq.${business.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "business_sale_lines", filter: `business_id=eq.${business.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "business_cost_budgets", filter: `business_id=eq.${business.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "business_inventory_items", filter: `business_id=eq.${business.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "business_inventory_movements", filter: `business_id=eq.${business.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "business_supplier_invoices", filter: `business_id=eq.${business.id}` }, refresh)
      .subscribe();

    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [business.id, endDate, startDate, supabase]);

  const money = (value: unknown) =>
    formatCurrency(finiteNumber(value), business.base_currency);

  const current = report?.summary;
  const prior = report?.priorSummary;
  const trendMaximum = Math.max(
    1,
    ...(report?.trend.flatMap((row) => [
      Math.abs(finiteNumber(row.netSales) + finiteNumber(row.otherIncome)),
      Math.abs(finiteNumber(row.grossProfit)),
      Math.abs(finiteNumber(row.operatingProfit)),
    ]) ?? [1]),
  );

  function exportCsv() {
    if (!report) return;
    const rows: (string | number)[][] = [
      ["FICONTER Business Profitability Report"],
      ["Business", business.name],
      ["Period", report.range.startDate, report.range.endDate],
      ["Base currency", business.base_currency],
      ["Generated", report.generatedAt],
      [],
      ["PROFIT AND LOSS"],
      ["Metric", "Current period", "Prior period"],
      ...summaryRows(report.summary).map(([label, amount], index) => [
        label,
        amount,
        summaryRows(report.priorSummary)[index][1],
      ]),
      [],
      ["MONTHLY TREND"],
      ["Month", "Operating income", "COGS", "Gross profit", "Operating expenses", "Operating profit", "Inventory purchases", "Cash movement"],
      ...report.trend.map((row) => [
        row.month,
        finiteNumber(row.netSales) + finiteNumber(row.otherIncome),
        finiteNumber(row.cogs),
        finiteNumber(row.grossProfit),
        finiteNumber(row.operatingExpenses),
        finiteNumber(row.operatingProfit),
        finiteNumber(row.inventoryPurchases),
        finiteNumber(row.cashMovement),
      ]),
      [],
      ["OPERATING COSTS BY CATEGORY"],
      ["Category", "Amount", "Share %", "Transactions"],
      ...report.costCategories.map((row) => [row.name, finiteNumber(row.amount), finiteNumber(row.percentage), row.transactionCount ?? 0]),
      [],
      ["TOP PRODUCTS AND SERVICES"],
      ["Product", "SKU", "Quantity", "Net sales", "COGS", "Gross profit", "Margin %", "Sales"],
      ...report.products.map((row) => [row.name, row.sku ?? "", finiteNumber(row.quantity), finiteNumber(row.netSales), finiteNumber(row.cogs), finiteNumber(row.grossProfit), finiteNumber(row.grossMargin), row.saleCount]),
      [],
      ["SUPPLIER SPEND"],
      ["Supplier", "Operating spend", "Inventory purchases", "Total spend", "Transactions"],
      ...report.suppliers.map((row) => [row.name, finiteNumber(row.operatingSpend), finiteNumber(row.inventoryPurchases), finiteNumber(row.totalSpend), row.transactionCount]),
    ];

    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `FICONTER_${business.name.replace(/[^a-z0-9]+/gi, "_")}_${report.range.startDate}_${report.range.endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const operatingProfitChange = current && prior
    ? percentageChange(current.operatingProfit, prior.operatingProfit)
    : null;
  const revenueChange = current && prior
    ? percentageChange(current.operatingIncome, prior.operatingIncome)
    : null;
  const grossProfitChange = current && prior
    ? percentageChange(current.grossProfit, prior.grossProfit)
    : null;
  const costChange = current && prior
    ? percentageChange(current.operatingExpenses, prior.operatingExpenses, false)
    : null;

  return (
    <section className={styles.shell}>
      <header className={styles.hero}>
        <div>
          <span>FICONTER BUSINESS · B7</span>
          <h1>Profitability &amp; Reports</h1>
          <p>
            Convert sales, COGS, operating costs, inventory purchases and cash
            activity into one management report for {business.name}.
          </p>
        </div>
        <div className={styles.heroActions}>
          <button onClick={exportCsv} disabled={!report}><Download size={17} /> Export CSV</button>
          <button onClick={() => window.print()} disabled={!report}><Printer size={17} /> Print / Save PDF</button>
        </div>
      </header>

      <section className={styles.periodPanel}>
        <div className={styles.presetButtons}>
          <button className={preset === "current-month" ? styles.selectedPreset : ""} onClick={() => choosePreset("current-month")}>This month</button>
          <button className={preset === "previous-month" ? styles.selectedPreset : ""} onClick={() => choosePreset("previous-month")}>Previous month</button>
          <button className={preset === "current-quarter" ? styles.selectedPreset : ""} onClick={() => choosePreset("current-quarter")}>This quarter</button>
          <button className={preset === "current-year" ? styles.selectedPreset : ""} onClick={() => choosePreset("current-year")}>This year</button>
          <button className={preset === "last-12-months" ? styles.selectedPreset : ""} onClick={() => choosePreset("last-12-months")}>Last 12 months</button>
        </div>
        <div className={styles.customRange}>
          <label><CalendarDays size={16} /> From<input type="date" value={startDate} onChange={(event) => { setPreset("custom"); setStartDate(event.target.value); }} /></label>
          <label><CalendarDays size={16} /> To<input type="date" value={endDate} onChange={(event) => { setPreset("custom"); setEndDate(event.target.value); }} /></label>
          <button onClick={() => void loadReport(startDate, endDate)} disabled={busy}>{busy ? <RefreshCw className={styles.spin} size={17} /> : <BarChart3 size={17} />} Apply</button>
        </div>
      </section>

      {error ? <div className={styles.error}>{error}</div> : null}
      {refreshing ? <div className={styles.refreshing}><RefreshCw className={styles.spin} size={15} /> Synchronizing report…</div> : null}

      {report && current && prior ? (
        <>
          <div className={styles.reportMeta}>
            <strong>{dateLabel(report.range.startDate)} — {dateLabel(report.range.endDate)}</strong>
            <span>Compared with {dateLabel(report.range.priorStartDate)} — {dateLabel(report.range.priorEndDate)}</span>
            <small>Generated {new Date(report.generatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</small>
          </div>

          <div className={styles.kpiGrid}>
            <article>
              <TrendingUp />
              <span>Operating income</span>
              <strong>{money(current.operatingIncome)}</strong>
              {revenueChange ? <small className={styles[revenueChange.tone]}>{revenueChange.label} vs prior period</small> : null}
            </article>
            <article>
              <CircleDollarSign />
              <span>Gross profit</span>
              <strong>{money(current.grossProfit)}</strong>
              {grossProfitChange ? <small className={styles[grossProfitChange.tone]}>{grossProfitChange.label} vs prior period</small> : null}
            </article>
            <article className={finiteNumber(current.operatingProfit) >= 0 ? styles.profitCard : styles.lossCard}>
              <WalletCards />
              <span>Operating profit</span>
              <strong>{money(current.operatingProfit)}</strong>
              {operatingProfitChange ? <small className={styles[operatingProfitChange.tone]}>{operatingProfitChange.label} vs prior period</small> : null}
            </article>
            <article>
              <ReceiptText />
              <span>Cash movement</span>
              <strong>{money(current.cashMovement)}</strong>
              <small>All recorded cash inflows less outflows</small>
            </article>
          </div>

          <section className={styles.statementPanel}>
            <div className={styles.panelHeading}>
              <div><span>MANAGEMENT P&amp;L</span><h2>Profit and loss statement</h2></div>
              <div className={styles.marginBadges}>
                <span>Gross margin <strong>{finiteNumber(current.grossMargin).toFixed(1)}%</strong></span>
                <span>Operating margin <strong>{finiteNumber(current.operatingMargin).toFixed(1)}%</strong></span>
              </div>
            </div>
            <div className={styles.statementRows}>
              <div><span>Net sales</span><strong>{money(current.netSales)}</strong></div>
              <div><span>Other business income</span><strong>{money(current.otherIncome)}</strong></div>
              <div className={styles.totalRow}><span>Total operating income</span><strong>{money(current.operatingIncome)}</strong></div>
              <div className={styles.deduction}><span>Cost of goods sold</span><strong>− {money(current.cogs)}</strong></div>
              <div className={styles.totalRow}><span>Gross profit</span><strong>{money(current.grossProfit)}</strong></div>
              <div className={styles.deduction}><span>Operating expenses</span><strong>− {money(current.operatingExpenses)}</strong></div>
              <div className={`${styles.grandTotal} ${finiteNumber(current.operatingProfit) >= 0 ? styles.positiveResult : styles.negativeResult}`}><span>Operating profit</span><strong>{money(current.operatingProfit)}</strong></div>
            </div>
            <p className={styles.accountingNote}>
              Inventory purchases are excluded from operating expenses because
              their cost enters profit through COGS when products are sold.
              This is a management report, not a statutory tax filing.
            </p>
          </section>

          <div className={styles.twoColumn}>
            <section className={styles.panel}>
              <div className={styles.panelHeading}><div><span>PLAN VS ACTUAL</span><h2>Operating-cost budget</h2></div></div>
              <div className={styles.budgetGrid}>
                <div><span>Planned</span><strong>{report.budget.hasBudget ? money(report.budget.plannedOperatingCosts) : "Not set"}</strong></div>
                <div><span>Actual</span><strong>{money(report.budget.actualOperatingCosts)}</strong></div>
                <div className={finiteNumber(report.budget.remaining) >= 0 ? styles.positiveResult : styles.negativeResult}><span>{finiteNumber(report.budget.remaining) >= 0 ? "Remaining" : "Over budget"}</span><strong>{report.budget.hasBudget ? money(Math.abs(finiteNumber(report.budget.remaining))) : "—"}</strong></div>
                <div><span>Budget used</span><strong>{report.budget.hasBudget ? `${finiteNumber(report.budget.usagePercentage).toFixed(1)}%` : "—"}</strong></div>
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeading}><div><span>PROFIT VS CASH</span><h2>Cash reconciliation</h2></div></div>
              <div className={styles.reconciliation}>
                <div><span>Operating profit</span><strong>{money(current.operatingProfit)}</strong></div>
                <div><span>COGS recognized from inventory</span><strong>+ {money(current.cogs)}</strong></div>
                <div><span>Inventory purchases paid</span><strong>− {money(current.inventoryPurchases)}</strong></div>
                <div><span>Sales tax collected</span><strong>+ {money(current.salesTax)}</strong></div>
                <div className={styles.totalRow}><span>Recorded cash movement</span><strong>{money(current.cashMovement)}</strong></div>
              </div>
              <p className={styles.panelNote}>Cash movement may also differ because of timing, non-sales income and other recorded transactions.</p>
            </section>
          </div>

          <section className={styles.panel}>
            <div className={styles.panelHeading}><div><span>PERFORMANCE TREND</span><h2>Monthly profitability</h2></div></div>
            {report.trend.length ? (
              <div className={styles.trendRows}>
                {report.trend.map((row) => {
                  const income = finiteNumber(row.netSales) + finiteNumber(row.otherIncome);
                  const gross = finiteNumber(row.grossProfit);
                  const operating = finiteNumber(row.operatingProfit);
                  return (
                    <div className={styles.trendRow} key={row.month}>
                      <strong>{new Date(`${row.month}-01T12:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</strong>
                      <div className={styles.trendBars}>
                        <span className={styles.incomeBar} style={{ width: `${Math.max(2, Math.abs(income) / trendMaximum * 100)}%` }} title={`Operating income ${money(income)}`} />
                        <span className={styles.grossBar} style={{ width: `${Math.max(2, Math.abs(gross) / trendMaximum * 100)}%` }} title={`Gross profit ${money(gross)}`} />
                        <span className={operating >= 0 ? styles.profitBar : styles.lossBar} style={{ width: `${Math.max(2, Math.abs(operating) / trendMaximum * 100)}%` }} title={`Operating profit ${money(operating)}`} />
                      </div>
                      <div className={styles.trendValues}><span>{money(income)} income</span><span>{money(gross)} gross</span><strong>{money(operating)} operating</strong></div>
                    </div>
                  );
                })}
                <div className={styles.legend}><span><i className={styles.incomeKey} /> Operating income</span><span><i className={styles.grossKey} /> Gross profit</span><span><i className={styles.profitKey} /> Operating profit</span></div>
              </div>
            ) : <div className={styles.empty}>No monthly activity in this period.</div>}
          </section>

          <div className={styles.twoColumn}>
            <section className={styles.panel}>
              <div className={styles.panelHeading}><div><span>COST ANALYSIS</span><h2>Operating costs by category</h2></div>{costChange ? <small className={styles[costChange.tone]}>{costChange.label} vs prior period</small> : null}</div>
              {report.costCategories.length ? <div className={styles.table}>
                <div className={styles.tableHead}><span>Category</span><span>Share</span><span>Amount</span></div>
                {report.costCategories.map((row) => <div className={styles.tableRow} key={row.id ?? row.name}><span><strong>{row.name}</strong><small>{row.transactionCount ?? 0} transactions</small></span><span>{finiteNumber(row.percentage).toFixed(1)}%</span><strong>{money(row.amount)}</strong></div>)}
              </div> : <div className={styles.empty}>No operating costs in this period.</div>}
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeading}><div><span>RESPONSIBILITY</span><h2>Costs by cost centre</h2></div></div>
              {report.costCentres.length ? <div className={styles.table}>
                <div className={styles.tableHead}><span>Cost centre</span><span>Share</span><span>Amount</span></div>
                {report.costCentres.map((row) => <div className={styles.tableRow} key={row.id ?? row.name}><span><strong>{row.name}</strong><small>{row.transactionCount ?? 0} transactions</small></span><span>{finiteNumber(row.percentage).toFixed(1)}%</span><strong>{money(row.amount)}</strong></div>)}
              </div> : <div className={styles.empty}>No cost-centre activity in this period.</div>}
            </section>
          </div>

          <div className={styles.twoColumn}>
            <section className={styles.panel}>
              <div className={styles.panelHeading}><div><span>SALES PROFITABILITY</span><h2>Top products and services</h2></div></div>
              {report.products.length ? <div className={styles.table}>
                <div className={`${styles.tableHead} ${styles.productColumns}`}><span>Item</span><span>Qty</span><span>Net sales</span><span>Gross profit</span></div>
                {report.products.map((row) => <div className={`${styles.tableRow} ${styles.productColumns}`} key={row.id}><span><strong>{row.name}</strong><small>{row.sku || "Service / custom item"} · {finiteNumber(row.grossMargin).toFixed(1)}% margin</small></span><span>{finiteNumber(row.quantity).toLocaleString("en-GB")}</span><span>{money(row.netSales)}</span><strong>{money(row.grossProfit)}</strong></div>)}
              </div> : <div className={styles.empty}>No completed product sales in this period.</div>}
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeading}><div><span>CUSTOMER VALUE</span><h2>Top customers</h2></div></div>
              {report.customers.length ? <div className={styles.table}>
                <div className={styles.tableHead}><span>Customer</span><span>Sales</span><span>Net sales</span></div>
                {report.customers.map((row) => <div className={styles.tableRow} key={row.name}><span><strong>{row.name}</strong><small>{money(row.grossProfit)} gross profit</small></span><span>{row.salesCount}</span><strong>{money(row.netSales)}</strong></div>)}
              </div> : <div className={styles.empty}>No customer sales in this period.</div>}
            </section>
          </div>

          <div className={styles.twoColumn}>
            <section className={styles.panel}>
              <div className={styles.panelHeading}><div><span>SUPPLIER SPEND</span><h2>Largest suppliers</h2></div></div>
              {report.suppliers.length ? <div className={styles.table}>
                <div className={styles.tableHead}><span>Supplier</span><span>Purchases</span><span>Total spend</span></div>
                {report.suppliers.map((row) => <div className={styles.tableRow} key={row.id}><span><strong>{row.name}</strong><small>{money(row.operatingSpend)} operating · {row.transactionCount} transactions</small></span><span>{money(row.inventoryPurchases)}</span><strong>{money(row.totalSpend)}</strong></div>)}
              </div> : <div className={styles.empty}>No registered supplier spending in this period.</div>}
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeading}><div><span>CURRENT POSITION</span><h2>Inventory and payables</h2></div></div>
              <div className={styles.positionGrid}>
                <div><PackageOpen /><span>Inventory value</span><strong>{money(report.inventory.inventoryValue)}</strong><small>{report.inventory.activeItems} active items · {report.inventory.lowStockItems} low stock</small></div>
                <div><FileText /><span>Open supplier invoices</span><strong>{money(report.supplierInvoices.openAmount)}</strong><small>{report.supplierInvoices.openCount} open · {report.supplierInvoices.overdueCount} overdue</small></div>
              </div>
              <p className={styles.panelNote}>These are current balance-sheet and payable snapshots, not historical period-end balances.</p>
            </section>
          </div>
        </>
      ) : !error ? (
        <div className={styles.loading}><RefreshCw className={styles.spin} /><h2>Preparing profitability report…</h2></div>
      ) : null}
    </section>
  );
}
