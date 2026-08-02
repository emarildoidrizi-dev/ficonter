"use client";

import {
  BarChart3,
  CalendarClock,
  Edit3,
  Gauge,
  Landmark,
  Pause,
  Play,
  Plus,
  Repeat2,
  Settings2,
  Tag,
  Trash2,
  TrendingDown,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getExchangeRate } from "@/lib/performance/exchangeRateCache";
import { finiteNumber, roundMoney, roundRate } from "@/lib/finance/money";
import {
  CURRENCY_CODES,
  currencyName,
  currencySymbol,
  formatCurrency,
} from "@/lib/financialOptions";
import {
  businessMonthKey,
  businessMonthStart,
  calculateBusinessCostControl,
} from "@/lib/business/costControl";
import type {
  Business,
  BusinessCostBudget,
  BusinessCostCategory,
  BusinessCostCentre,
  BusinessRecurringCost,
  BusinessRecurringCostStatus,
  BusinessTransaction,
} from "@/lib/business/types";
import styles from "./BusinessCostControl.module.css";

type View = "overview" | "recurring" | "structure";
type DeleteTarget = {
  kind: "category" | "centre" | "recurring";
  id: string;
  label: string;
};

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

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

const PAYMENT_METHODS = [
  "Bank transfer",
  "Direct debit",
  "Card",
  "Cash",
  "Online payment",
  "Invoice",
  "Other",
];

const EMPTY_RECURRING = {
  name: "",
  supplier: "",
  category_id: "",
  cost_centre_id: "",
  cost_nature: "fixed" as "fixed" | "variable",
  amount: "",
  currency: "EUR",
  due_day: "1",
  record_time: "09:00",
  timezone: "UTC",
  start_date: localDateKey(),
  end_date: "",
  payment_method: "Direct debit",
  reference: "",
  notes: "",
  status: "active" as BusinessRecurringCostStatus,
};

export function BusinessCostControl({
  business,
  initialTransactions,
  initialCategories,
  initialCentres,
  initialBudgets,
  initialRecurringCosts,
}: {
  business: Business;
  initialTransactions: BusinessTransaction[];
  initialCategories: BusinessCostCategory[];
  initialCentres: BusinessCostCentre[];
  initialBudgets: BusinessCostBudget[];
  initialRecurringCosts: BusinessRecurringCost[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [categories, setCategories] = useState(initialCategories);
  const [centres, setCentres] = useState(initialCentres);
  const [budgets, setBudgets] = useState(initialBudgets);
  const [recurringCosts, setRecurringCosts] = useState(initialRecurringCosts);
  const [selectedMonth, setSelectedMonth] = useState(businessMonthKey());
  const [view, setView] = useState<View>("overview");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({});

  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryNature, setCategoryNature] = useState<"fixed" | "variable">("variable");
  const [editingCategory, setEditingCategory] = useState<BusinessCostCategory | null>(null);

  const [centreName, setCentreName] = useState("");
  const [centreDescription, setCentreDescription] = useState("");
  const [editingCentre, setEditingCentre] = useState<BusinessCostCentre | null>(null);

  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<BusinessRecurringCost | null>(null);
  const [recurringForm, setRecurringForm] = useState(() => ({
    ...EMPTY_RECURRING,
    currency: business.base_currency,
    timezone: browserTimezone(),
    category_id: initialCategories[0]?.id ?? "",
    cost_centre_id: initialCentres[0]?.id ?? "",
    cost_nature: initialCategories[0]?.default_nature ?? "fixed",
  }));
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const channel = supabase
      .channel(`business-cost-control-${business.id}`)
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
        { event: "*", schema: "public", table: "business_cost_categories", filter: `business_id=eq.${business.id}` },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          setCategories((current) =>
            mergeRealtime<BusinessCostCategory>(current, payload).sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_cost_centres", filter: `business_id=eq.${business.id}` },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          setCentres((current) =>
            mergeRealtime<BusinessCostCentre>(current, payload).sort((a, b) =>
              a.name.localeCompare(b.name),
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
        { event: "*", schema: "public", table: "business_recurring_costs", filter: `business_id=eq.${business.id}` },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          setRecurringCosts((current) =>
            mergeRealtime<BusinessRecurringCost>(current, payload).sort((a, b) =>
              (a.next_run_at ?? "9999").localeCompare(b.next_run_at ?? "9999"),
            ),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [business.id, supabase]);

  const metrics = useMemo(
    () =>
      calculateBusinessCostControl({
        transactions,
        budgets,
        categories,
        centres,
        monthKey: selectedMonth,
      }),
    [transactions, budgets, categories, centres, selectedMonth],
  );

  useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    categories.forEach((category) => {
      const budget = budgets.find(
        (item) =>
          item.category_id === category.id &&
          item.budget_month.startsWith(selectedMonth),
      );
      nextDrafts[category.id] = budget ? String(budget.amount_base) : "";
    });
    setBudgetDrafts(nextDrafts);
  }, [budgets, categories, selectedMonth]);

  const money = (value: unknown) =>
    formatCurrency(finiteNumber(value), business.base_currency);
  const maxTrend = Math.max(1, ...metrics.trend.map((item) => Math.max(item.actual, item.budget)));

  function resetCategoryForm() {
    setCategoryName("");
    setCategoryDescription("");
    setCategoryNature("variable");
    setEditingCategory(null);
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const name = categoryName.trim();
    if (!name) return setError("Enter a cost category name.");
    setBusy("category");
    setError("");
    const payload = {
      business_id: business.id,
      name,
      description: categoryDescription.trim() || null,
      default_nature: categoryNature,
      is_active: true,
    };
    const query = editingCategory
      ? supabase
          .from("business_cost_categories")
          .update(payload)
          .eq("id", editingCategory.id)
          .eq("business_id", business.id)
      : supabase.from("business_cost_categories").insert(payload);
    const { data, error: saveError } = await query.select().single();
    if (saveError) setError(saveError.message);
    else {
      setCategories((current) =>
        [data as BusinessCostCategory, ...current.filter((item) => item.id !== data.id)].sort(
          (a, b) => a.name.localeCompare(b.name),
        ),
      );
      setNotice(editingCategory ? "Cost category updated." : "Cost category added.");
      resetCategoryForm();
    }
    setBusy("");
  }

  function openCategoryEdit(category: BusinessCostCategory) {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryDescription(category.description ?? "");
    setCategoryNature(category.default_nature);
  }

  function resetCentreForm() {
    setCentreName("");
    setCentreDescription("");
    setEditingCentre(null);
  }

  async function saveCentre(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const name = centreName.trim();
    if (!name) return setError("Enter a cost centre name.");
    setBusy("centre");
    setError("");
    const payload = {
      business_id: business.id,
      name,
      description: centreDescription.trim() || null,
      is_active: true,
    };
    const query = editingCentre
      ? supabase
          .from("business_cost_centres")
          .update(payload)
          .eq("id", editingCentre.id)
          .eq("business_id", business.id)
      : supabase.from("business_cost_centres").insert(payload);
    const { data, error: saveError } = await query.select().single();
    if (saveError) setError(saveError.message);
    else {
      setCentres((current) =>
        [data as BusinessCostCentre, ...current.filter((item) => item.id !== data.id)].sort(
          (a, b) => a.name.localeCompare(b.name),
        ),
      );
      setNotice(editingCentre ? "Cost centre updated." : "Cost centre added.");
      resetCentreForm();
    }
    setBusy("");
  }

  function openCentreEdit(centre: BusinessCostCentre) {
    setEditingCentre(centre);
    setCentreName(centre.name);
    setCentreDescription(centre.description ?? "");
  }

  async function saveBudget(categoryId: string) {
    if (busy) return;
    const amount = roundMoney(budgetDrafts[categoryId] || 0);
    if (amount < 0) return setError("A budget cannot be negative.");
    setBusy(`budget-${categoryId}`);
    setError("");
    const existing = budgets.find(
      (item) =>
        item.category_id === categoryId &&
        item.budget_month.startsWith(selectedMonth),
    );

    if (amount === 0) {
      if (existing) {
        const { error: deleteError } = await supabase
          .from("business_cost_budgets")
          .delete()
          .eq("id", existing.id)
          .eq("business_id", business.id);
        if (deleteError) setError(deleteError.message);
        else {
          setBudgets((current) => current.filter((item) => item.id !== existing.id));
          setNotice("Monthly category budget removed.");
        }
      }
      setBusy("");
      return;
    }

    const { data, error: saveError } = await supabase
      .from("business_cost_budgets")
      .upsert(
        {
          business_id: business.id,
          category_id: categoryId,
          budget_month: businessMonthStart(selectedMonth),
          amount_base: amount,
        },
        { onConflict: "business_id,category_id,budget_month" },
      )
      .select()
      .single();

    if (saveError) setError(saveError.message);
    else {
      setBudgets((current) => [
        data as BusinessCostBudget,
        ...current.filter((item) => item.id !== data.id),
      ]);
      setNotice(`Budget saved for ${monthLabel(selectedMonth)}.`);
    }
    setBusy("");
  }

  function resetRecurringForm() {
    const firstCategory = categories.find((item) => item.is_active) ?? categories[0];
    setRecurringForm({
      ...EMPTY_RECURRING,
      currency: business.base_currency,
      timezone: browserTimezone(),
      category_id: firstCategory?.id ?? "",
      cost_centre_id: centres.find((item) => item.is_active)?.id ?? centres[0]?.id ?? "",
      cost_nature: firstCategory?.default_nature ?? "fixed",
      start_date: localDateKey(),
    });
    setEditingRecurring(null);
    setShowRecurringForm(false);
  }

  function openRecurringEdit(item: BusinessRecurringCost) {
    setEditingRecurring(item);
    setRecurringForm({
      name: item.name,
      supplier: item.supplier ?? "",
      category_id: item.category_id ?? "",
      cost_centre_id: item.cost_centre_id ?? "",
      cost_nature: item.cost_nature,
      amount: String(item.amount),
      currency: item.currency,
      due_day: String(item.due_day),
      record_time: item.record_time.slice(0, 5),
      timezone: item.timezone,
      start_date: item.start_date,
      end_date: item.end_date ?? "",
      payment_method: item.payment_method ?? "Direct debit",
      reference: item.reference ?? "",
      notes: item.notes ?? "",
      status: item.status,
    });
    setShowRecurringForm(true);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveRecurring(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("recurring");
    setError("");
    try {
      const category = categories.find((item) => item.id === recurringForm.category_id);
      const amount = roundMoney(recurringForm.amount);
      const dueDay = Number(recurringForm.due_day);
      if (!recurringForm.name.trim()) throw new Error("Enter a recurring cost name.");
      if (!category) throw new Error("Choose a managed cost category.");
      if (amount <= 0) throw new Error("Enter an amount greater than zero.");
      if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
        throw new Error("Due day must be between 1 and 31.");
      }
      const rate = await getExchangeRate(recurringForm.currency, business.base_currency);
      const payload = {
        business_id: business.id,
        name: recurringForm.name.trim(),
        supplier: recurringForm.supplier.trim() || null,
        category_id: category.id,
        category_name: category.name,
        cost_centre_id: recurringForm.cost_centre_id || null,
        cost_nature: recurringForm.cost_nature,
        amount,
        currency: recurringForm.currency,
        amount_base: roundMoney(amount * rate.rate),
        exchange_rate_to_base: roundRate(rate.rate),
        exchange_rate_date: rate.date,
        exchange_rate_source: rate.source,
        due_day: dueDay,
        record_time: recurringForm.record_time,
        timezone: recurringForm.timezone || browserTimezone(),
        start_date: recurringForm.start_date,
        end_date: recurringForm.end_date || null,
        payment_method: recurringForm.payment_method || null,
        reference: recurringForm.reference.trim() || null,
        notes: recurringForm.notes.trim() || null,
        status: recurringForm.status,
      };

      const query = editingRecurring
        ? supabase
            .from("business_recurring_costs")
            .update(payload)
            .eq("id", editingRecurring.id)
            .eq("business_id", business.id)
        : supabase.from("business_recurring_costs").insert(payload);
      const { data, error: saveError } = await query.select().single();
      if (saveError) throw saveError;
      setRecurringCosts((current) => [
        data as BusinessRecurringCost,
        ...current.filter((item) => item.id !== data.id),
      ]);
      setNotice(editingRecurring ? "Recurring cost updated." : "Recurring cost activated.");
      resetRecurringForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Recurring cost could not be saved.");
    } finally {
      setBusy("");
    }
  }

  async function toggleRecurring(item: BusinessRecurringCost) {
    if (busy) return;
    const nextStatus: BusinessRecurringCostStatus = item.status === "active" ? "paused" : "active";
    setBusy(`toggle-${item.id}`);
    const { data, error: updateError } = await supabase
      .from("business_recurring_costs")
      .update({ status: nextStatus })
      .eq("id", item.id)
      .eq("business_id", business.id)
      .select()
      .single();
    if (updateError) setError(updateError.message);
    else {
      setRecurringCosts((current) =>
        current.map((record) => (record.id === item.id ? (data as BusinessRecurringCost) : record)),
      );
      setNotice(nextStatus === "active" ? "Recurring cost activated." : "Recurring cost paused.");
    }
    setBusy("");
  }

  async function confirmDelete() {
    if (!deleteTarget || busy) return;
    setBusy("delete");
    setError("");
    const table =
      deleteTarget.kind === "category"
        ? "business_cost_categories"
        : deleteTarget.kind === "centre"
          ? "business_cost_centres"
          : "business_recurring_costs";
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq("id", deleteTarget.id)
      .eq("business_id", business.id);
    if (deleteError) setError(deleteError.message);
    else {
      if (deleteTarget.kind === "category") {
        setCategories((current) => current.filter((item) => item.id !== deleteTarget.id));
      } else if (deleteTarget.kind === "centre") {
        setCentres((current) => current.filter((item) => item.id !== deleteTarget.id));
      } else {
        setRecurringCosts((current) => current.filter((item) => item.id !== deleteTarget.id));
      }
      setNotice(`${deleteTarget.label} deleted.`);
      setDeleteTarget(null);
    }
    setBusy("");
  }

  function scheduleLabel(item: BusinessRecurringCost) {
    if (!item.next_run_at) return item.status === "ended" ? "Schedule completed" : "No run while paused";
    try {
      return new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: item.timezone,
      }).format(new Date(item.next_run_at));
    } catch {
      return new Date(item.next_run_at).toLocaleString("en-GB");
    }
  }

  return (
    <section className={styles.shell}>
      <header className={styles.hero}>
        <div>
          <span>FICONTER BUSINESS · B3</span>
          <h1>Cost Control</h1>
          <p>
            Control budgets, recurring operating costs, suppliers and break-even performance for {business.name}.
          </p>
        </div>
        <label className={styles.monthPicker}>
          Analysis month
          <input
            type="month"
            value={selectedMonth}
            onChange={(event) => { if (event.target.value) setSelectedMonth(event.target.value); }}
          />
        </label>
      </header>

      <nav className={styles.viewTabs} aria-label="Cost Control sections">
        <button className={view === "overview" ? styles.activeTab : ""} onClick={() => setView("overview")}>
          <BarChart3 size={17} /> Overview
        </button>
        <button className={view === "recurring" ? styles.activeTab : ""} onClick={() => setView("recurring")}>
          <Repeat2 size={17} /> Recurring costs
        </button>
        <button className={view === "structure" ? styles.activeTab : ""} onClick={() => setView("structure")}>
          <Settings2 size={17} /> Categories & centres
        </button>
      </nav>

      {notice ? <div className={styles.notice}>{notice}</div> : null}
      {error ? <div className={styles.error} role="alert">{error}</div> : null}

      {view === "overview" ? (
        <>
          <div className={styles.kpis}>
            <article>
              <TrendingDown />
              <span>Actual costs · {monthLabel(selectedMonth)}</span>
              <strong>{money(metrics.actualCosts)}</strong>
              <small>{money(metrics.fixedCosts)} fixed · {money(metrics.variableCosts)} variable</small>
            </article>
            <article>
              <WalletCards />
              <span>Cost budget</span>
              <strong>{money(metrics.budgetTotal)}</strong>
              <small>{metrics.budgetUsage.toFixed(1)}% used</small>
            </article>
            <article className={!metrics.hasBudget ? "" : metrics.budgetRemaining >= 0 ? styles.goodCard : styles.badCard}>
              <Gauge />
              <span>{!metrics.hasBudget ? "Budget status" : metrics.budgetRemaining >= 0 ? "Budget remaining" : "Over budget"}</span>
              <strong>{metrics.hasBudget ? money(Math.abs(metrics.budgetRemaining)) : "Not set"}</strong>
              <small>{metrics.hasBudget ? "Actual versus planned costs" : "Set category budgets below"}</small>
            </article>
            <article>
              <Landmark />
              <span>Break-even revenue</span>
              <strong>{metrics.breakEvenRevenue === null ? "Not available" : money(metrics.breakEvenRevenue)}</strong>
              <small>
                {metrics.revenue > 0
                  ? `${(metrics.contributionMarginRatio * 100).toFixed(1)}% contribution margin`
                  : "Add revenue to calculate"}
              </small>
            </article>
          </div>

          <div className={styles.twoColumn}>
            <article className={styles.panel}>
              <div className={styles.panelHead}>
                <div><span>MONTHLY CONTROL</span><h2>Category budgets</h2></div>
                <small>Enter 0 to remove a budget</small>
              </div>
              <div className={`${styles.budgetRows} ficonter-scroll-region`}>
                {metrics.categoryRows.map((row) => (
                  <div className={styles.budgetRow} key={row.id}>
                    <div>
                      <strong>{row.name}</strong>
                      <span>{row.nature} cost · Actual {money(row.actual)}</span>
                    </div>
                    <div className={styles.progress}>
                      <span style={{ width: `${Math.min(100, row.usage)}%` }} />
                    </div>
                    {row.id === "unassigned" ? (
                      <em>Assign these costs in Business Transactions</em>
                    ) : (
                      <div className={styles.budgetInput}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={budgetDrafts[row.id] ?? ""}
                          onChange={(event) =>
                            setBudgetDrafts((current) => ({ ...current, [row.id]: event.target.value }))
                          }
                          placeholder="0.00"
                        />
                        <button disabled={busy === `budget-${row.id}`} onClick={() => saveBudget(row.id)}>
                          {busy === `budget-${row.id}` ? "Saving…" : "Save"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHead}>
                <div><span>SIX-MONTH VIEW</span><h2>Cost trend</h2></div>
              </div>
              <div className={styles.trend}>
                {metrics.trend.map((item) => (
                  <div key={item.month}>
                    <div className={styles.trendBars}>
                      <span style={{ height: `${Math.max(3, (item.budget / maxTrend) * 100)}%` }} />
                      <b style={{ height: `${Math.max(3, (item.actual / maxTrend) * 100)}%` }} />
                    </div>
                    <small>{item.month.slice(5)}</small>
                    <em>{money(item.actual)}</em>
                  </div>
                ))}
              </div>
              <div className={styles.legend}><span>Budget</span><b>Actual</b></div>
            </article>
          </div>

          <div className={styles.threeColumn}>
            <article className={styles.panel}>
              <div className={styles.panelHead}><div><span>SUPPLIERS</span><h2>Top spending</h2></div></div>
              <div className={styles.rankList}>
                {metrics.supplierRows.length ? metrics.supplierRows.map((item, index) => (
                  <div key={item.name}><span>{index + 1}</span><strong>{item.name}</strong><b>{money(item.actual)}</b></div>
                )) : <p>No supplier spending in this month.</p>}
              </div>
            </article>
            <article className={styles.panel}>
              <div className={styles.panelHead}><div><span>COST CENTRES</span><h2>Where money went</h2></div></div>
              <div className={styles.rankList}>
                {metrics.centreRows.length ? metrics.centreRows.map((item, index) => (
                  <div key={item.id}><span>{index + 1}</span><strong>{item.name}</strong><b>{money(item.actual)}</b></div>
                )) : <p>No cost-centre activity in this month.</p>}
              </div>
            </article>
            <article className={styles.panel}>
              <div className={styles.panelHead}><div><span>PROFITABILITY</span><h2>Operating picture</h2></div></div>
              <dl className={styles.operatingList}>
                <div><dt>Revenue</dt><dd>{money(metrics.revenue)}</dd></div>
                <div><dt>Variable costs</dt><dd>−{money(metrics.variableCosts)}</dd></div>
                <div><dt>Contribution margin</dt><dd>{money(metrics.contributionMargin)}</dd></div>
                <div><dt>Fixed costs</dt><dd>−{money(metrics.fixedCosts)}</dd></div>
                <div className={metrics.operatingResult >= 0 ? styles.goodText : styles.badText}>
                  <dt>Operating result</dt><dd>{money(metrics.operatingResult)}</dd>
                </div>
              </dl>
            </article>
          </div>
        </>
      ) : null}

      {view === "recurring" ? (
        <>
          <div className={styles.sectionAction}>
            <div><span>AUTOMATIC MONTHLY RECORDING</span><h2>Recurring operating costs</h2><p>Schedules create Business expense transactions automatically. FICONTER does not move money.</p></div>
            <button onClick={() => showRecurringForm ? resetRecurringForm() : setShowRecurringForm(true)}>
              {showRecurringForm ? <X size={18} /> : <Plus size={18} />}
              {showRecurringForm ? "Close form" : "Add recurring cost"}
            </button>
          </div>

          {showRecurringForm ? (
            <form className={styles.formCard} onSubmit={saveRecurring}>
              <div className={styles.formHead}>
                <div><span>{editingRecurring ? "EDIT SCHEDULE" : "NEW SCHEDULE"}</span><h2>{editingRecurring ? "Update recurring cost" : "Create recurring cost"}</h2></div>
                {editingRecurring ? <button type="button" onClick={resetRecurringForm}>Cancel edit</button> : null}
              </div>
              <div className={styles.formGrid}>
                <label>Cost name<input value={recurringForm.name} onChange={(event) => setRecurringForm({ ...recurringForm, name: event.target.value })} required placeholder="e.g. Office rent" /></label>
                <label>Supplier<input value={recurringForm.supplier} onChange={(event) => setRecurringForm({ ...recurringForm, supplier: event.target.value })} placeholder="Optional supplier" /></label>
                <label>Category<select value={recurringForm.category_id} onChange={(event) => { const category = categories.find((item) => item.id === event.target.value); setRecurringForm({ ...recurringForm, category_id: event.target.value, cost_nature: category?.default_nature ?? recurringForm.cost_nature }); }}>{categories.filter((item) => item.is_active).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
                <label>Cost centre<select value={recurringForm.cost_centre_id} onChange={(event) => setRecurringForm({ ...recurringForm, cost_centre_id: event.target.value })}><option value="">No cost centre</option>{centres.filter((item) => item.is_active).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
                <label>Cost type<select value={recurringForm.cost_nature} onChange={(event) => setRecurringForm({ ...recurringForm, cost_nature: event.target.value as "fixed" | "variable" })}><option value="fixed">Fixed cost</option><option value="variable">Variable cost</option></select></label>
                <label>Amount<input type="number" min="0.01" step="0.01" value={recurringForm.amount} onChange={(event) => setRecurringForm({ ...recurringForm, amount: event.target.value })} required /></label>
                <label>Currency<select value={recurringForm.currency} onChange={(event) => setRecurringForm({ ...recurringForm, currency: event.target.value })}>{CURRENCY_CODES.map((code) => <option value={code} key={code}>{currencySymbol(code)} {code} — {currencyName(code)}</option>)}</select></label>
                <label>Due day<input type="number" min="1" max="31" value={recurringForm.due_day} onChange={(event) => setRecurringForm({ ...recurringForm, due_day: event.target.value })} required /></label>
                <label>Exact record time<input type="time" step="60" value={recurringForm.record_time} onChange={(event) => setRecurringForm({ ...recurringForm, record_time: event.target.value })} required /></label>
                <label>Time zone<input value={recurringForm.timezone} onChange={(event) => setRecurringForm({ ...recurringForm, timezone: event.target.value })} required /></label>
                <label>Start date<input type="date" value={recurringForm.start_date} onChange={(event) => setRecurringForm({ ...recurringForm, start_date: event.target.value })} required /></label>
                <label>Optional end date<input type="date" value={recurringForm.end_date} onChange={(event) => setRecurringForm({ ...recurringForm, end_date: event.target.value })} /></label>
                <label>Payment method<select value={recurringForm.payment_method} onChange={(event) => setRecurringForm({ ...recurringForm, payment_method: event.target.value })}>{PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}</select></label>
                <label>Reference<input value={recurringForm.reference} onChange={(event) => setRecurringForm({ ...recurringForm, reference: event.target.value })} placeholder="Contract or invoice reference" /></label>
                <label>Status<select value={recurringForm.status} onChange={(event) => setRecurringForm({ ...recurringForm, status: event.target.value as BusinessRecurringCostStatus })}><option value="active">Active</option><option value="paused">Paused</option><option value="ended">Ended</option></select></label>
                <label className={styles.fullWidth}>Notes<textarea rows={3} value={recurringForm.notes} onChange={(event) => setRecurringForm({ ...recurringForm, notes: event.target.value })} placeholder="Optional internal notes" /></label>
              </div>
              <button className={styles.primaryButton} disabled={busy === "recurring"}>{busy === "recurring" ? "Saving…" : editingRecurring ? "Save changes" : "Activate recurring cost"}</button>
            </form>
          ) : null}

          <div className={`${styles.recurringGrid} ficonter-scroll-region`}>
            {recurringCosts.length ? recurringCosts.map((item) => (
              <article className={styles.recurringCard} key={item.id}>
                <div className={styles.recurringTop}>
                  <div className={styles.recurringIcon}><Repeat2 size={20} /></div>
                  <div><h3>{item.name}</h3><p>{item.supplier || item.category_name} · {item.cost_nature} cost</p></div>
                  <span className={`${styles.scheduleStatus} ${styles[item.status]}`}>{item.status}</span>
                </div>
                <strong className={styles.recurringAmount}>{money(item.amount_base)}</strong>
                {item.currency !== business.base_currency ? <small>{formatCurrency(finiteNumber(item.amount), item.currency)} converted</small> : null}
                <div className={styles.scheduleLine}><CalendarClock size={16} /><div><span>{item.status === "active" ? "Next automatic record" : "Schedule"}</span><strong>{scheduleLabel(item)}</strong><small>{item.timezone} · due day {item.due_day}</small></div></div>
                {item.last_error ? <div className={styles.scheduleError}>Needs attention: {item.last_error}</div> : null}
                <div className={styles.cardActions}>
                  {item.status !== "ended" ? <button onClick={() => toggleRecurring(item)} disabled={busy === `toggle-${item.id}`}>{item.status === "active" ? <Pause size={16} /> : <Play size={16} />}{item.status === "active" ? "Pause" : "Activate"}</button> : null}
                  <button onClick={() => openRecurringEdit(item)}><Edit3 size={16} /> Edit</button>
                  <button className={styles.dangerButton} onClick={() => setDeleteTarget({ kind: "recurring", id: item.id, label: item.name })}><Trash2 size={16} /> Delete</button>
                </div>
              </article>
            )) : <div className={styles.emptyState}><Repeat2 size={32} /><h3>No recurring costs yet</h3><p>Create rent, software, insurance or other monthly operating schedules.</p></div>}
          </div>
        </>
      ) : null}

      {view === "structure" ? (
        <div className={styles.structureGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHead}><div><span>COST STRUCTURE</span><h2>Categories</h2></div><Tag /></div>
            <form className={styles.compactForm} onSubmit={saveCategory}>
              <label>Name<input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required placeholder="Category name" /></label>
              <label>Default type<select value={categoryNature} onChange={(event) => setCategoryNature(event.target.value as "fixed" | "variable")}><option value="fixed">Fixed</option><option value="variable">Variable</option></select></label>
              <label className={styles.fullWidth}>Description<input value={categoryDescription} onChange={(event) => setCategoryDescription(event.target.value)} placeholder="Optional" /></label>
              <div className={styles.compactActions}><button className={styles.primaryButton} disabled={busy === "category"}>{editingCategory ? "Save category" : "Add category"}</button>{editingCategory ? <button type="button" onClick={resetCategoryForm}>Cancel</button> : null}</div>
            </form>
            <div className={`${styles.manageList} ficonter-scroll-region`}>
              {categories.map((category) => <div key={category.id}><div><strong>{category.name}</strong><span>{category.default_nature} cost{category.description ? ` · ${category.description}` : ""}</span></div><div><button onClick={() => openCategoryEdit(category)} aria-label={`Edit ${category.name}`}><Edit3 size={15} /></button><button onClick={() => setDeleteTarget({ kind: "category", id: category.id, label: category.name })} aria-label={`Delete ${category.name}`}><Trash2 size={15} /></button></div></div>)}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHead}><div><span>RESPONSIBILITY</span><h2>Cost centres</h2></div><Landmark /></div>
            <form className={styles.compactForm} onSubmit={saveCentre}>
              <label>Name<input value={centreName} onChange={(event) => setCentreName(event.target.value)} required placeholder="Cost centre name" /></label>
              <label className={styles.fullWidth}>Description<input value={centreDescription} onChange={(event) => setCentreDescription(event.target.value)} placeholder="Optional" /></label>
              <div className={styles.compactActions}><button className={styles.primaryButton} disabled={busy === "centre"}>{editingCentre ? "Save centre" : "Add centre"}</button>{editingCentre ? <button type="button" onClick={resetCentreForm}>Cancel</button> : null}</div>
            </form>
            <div className={`${styles.manageList} ficonter-scroll-region`}>
              {centres.map((centre) => <div key={centre.id}><div><strong>{centre.name}</strong><span>{centre.description || "No description"}</span></div><div><button onClick={() => openCentreEdit(centre)} aria-label={`Edit ${centre.name}`}><Edit3 size={15} /></button><button onClick={() => setDeleteTarget({ kind: "centre", id: centre.id, label: centre.name })} aria-label={`Delete ${centre.name}`}><Trash2 size={15} /></button></div></div>)}
            </div>
          </article>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className={styles.backdrop}>
          <section className={styles.modal}>
            <button className={styles.modalClose} onClick={() => setDeleteTarget(null)}><X size={18} /></button>
            <Trash2 className={styles.modalIcon} />
            <span>CONFIRM DELETION</span>
            <h2>Delete {deleteTarget.label}?</h2>
            <p>
              {deleteTarget.kind === "recurring"
                ? "The automatic schedule will stop. Existing Business Transactions remain financially intact."
                : "Existing Business Transactions remain financially intact. The deleted category or centre assignment becomes unassigned."}
            </p>
            <div><button onClick={() => setDeleteTarget(null)}>Keep it</button><button className={styles.modalDanger} disabled={busy === "delete"} onClick={confirmDelete}>{busy === "delete" ? "Deleting…" : "Delete"}</button></div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
