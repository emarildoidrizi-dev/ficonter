"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { CalendarRange, Edit3, Plus, Search, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getExchangeRate } from "@/lib/performance/exchangeRateCache";
import { finiteNumber, roundMoney, roundRate, subtractMoney, sumMoney } from "@/lib/finance/money";
import { CURRENCY_CODES, currencyName, currencySymbol, formatCurrency } from "@/lib/financialOptions";
import type {
  Business,
  BusinessCostCategory,
  BusinessCostCentre,
  BusinessCostNature,
  BusinessSupplier,
  BusinessTransaction,
  BusinessTransactionType,
} from "@/lib/business/types";
import styles from "./BusinessTransactionLedger.module.css";

const INCOME_CATEGORIES = [
  "Sales revenue",
  "Service revenue",
  "Project revenue",
  "Subscription revenue",
  "Rental income",
  "Interest",
  "Refund",
  "Other income",
];
const PAYMENT_METHODS = ["Bank transfer", "Direct debit", "Card", "Cash", "Online payment", "Invoice", "Other"];

function localDateTimeInput(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}
function toLocalInput(value: string) {
  return localDateTimeInput(new Date(value));
}

const EMPTY = {
  description: "",
  counterparty: "",
  supplier_id: "",
  type: "expense" as BusinessTransactionType,
  category_id: "",
  income_category: INCOME_CATEGORIES[0],
  customCategory: "",
  cost_centre_id: "",
  cost_nature: "variable" as Exclude<BusinessCostNature, null>,
  amount: "",
  currency: "EUR",
  occurred_at: localDateTimeInput(),
  payment_method: "Bank transfer",
  reference: "",
  notes: "",
};

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

export function BusinessTransactionLedger({
  userId,
  business,
  initialTransactions,
  initialCategories,
  initialCostCentres,
  initialSuppliers,
  initialAdd = false,
}: {
  userId: string;
  business: Business;
  initialTransactions: BusinessTransaction[];
  initialCategories: BusinessCostCategory[];
  initialCostCentres: BusinessCostCentre[];
  initialSuppliers: BusinessSupplier[];
  initialAdd?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [categories, setCategories] = useState(initialCategories);
  const [costCentres, setCostCentres] = useState(initialCostCentres);
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const firstCategory = initialCategories.find((item) => item.is_active) ?? initialCategories[0];
  const firstCentre = initialCostCentres.find((item) => item.is_active) ?? initialCostCentres[0];
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    currency: business.base_currency,
    category_id: firstCategory?.id ?? "",
    cost_centre_id: firstCentre?.id ?? "",
    cost_nature: firstCategory?.default_nature ?? "variable",
  }));
  const [editing, setEditing] = useState<BusinessTransaction | null>(null);
  const [showForm, setShowForm] = useState(initialAdd);
  const [deleting, setDeleting] = useState<BusinessTransaction | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!initialAdd) return;
    setShowForm(true);
    const frame = window.requestAnimationFrame(() => {
      amountInputRef.current?.focus({ preventScroll: true });
      amountInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialAdd]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const channel = supabase
      .channel(`business-transactions-${business.id}`)
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
            mergeRealtime<BusinessCostCategory>(current, payload).sort((a, b) => a.name.localeCompare(b.name)),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_cost_centres", filter: `business_id=eq.${business.id}` },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          setCostCentres((current) =>
            mergeRealtime<BusinessCostCentre>(current, payload).sort((a, b) => a.name.localeCompare(b.name)),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_suppliers", filter: `business_id=eq.${business.id}` },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          setSuppliers((current) =>
            mergeRealtime<BusinessSupplier>(current, payload).sort((a, b) => a.name.localeCompare(b.name)),
          );
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [business.id, supabase]);

  const months = useMemo(
    () => [...new Set(transactions.map((item) => item.transaction_date.slice(0, 7)))].sort((a, b) => b.localeCompare(a)),
    [transactions],
  );
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions
      .filter(
        (item) =>
          (!query || `${item.description} ${item.counterparty ?? ""} ${item.category} ${item.reference ?? ""}`.toLowerCase().includes(query)) &&
          (typeFilter === "all" || item.type === typeFilter) &&
          (monthFilter === "all" || item.transaction_date.startsWith(monthFilter)),
      )
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  }, [transactions, search, typeFilter, monthFilter]);
  const revenue = sumMoney(visible.filter((item) => item.type === "income").map((item) => item.amount_base));
  const expenses = sumMoney(visible.filter((item) => item.type === "expense").map((item) => item.amount_base));
  const result = subtractMoney(revenue, expenses);
  const money = (value: unknown) => formatCurrency(finiteNumber(value), business.base_currency);

  function resetForm() {
    const nextCategory = categories.find((item) => item.is_active) ?? categories[0];
    const nextCentre = costCentres.find((item) => item.is_active) ?? costCentres[0];
    setForm({
      ...EMPTY,
      currency: business.base_currency,
      occurred_at: localDateTimeInput(),
      category_id: nextCategory?.id ?? "",
      supplier_id: "",
      cost_centre_id: nextCentre?.id ?? "",
      cost_nature: nextCategory?.default_nature ?? "variable",
    });
    setEditing(null);
    setShowForm(false);
    setError("");
  }


  const activateQuickAdd = useCallback(() => {
    const nextCategory = categories.find((item) => item.is_active) ?? categories[0];
    const nextCentre = costCentres.find((item) => item.is_active) ?? costCentres[0];

    setForm({
      ...EMPTY,
      currency: business.base_currency,
      occurred_at: localDateTimeInput(),
      category_id: nextCategory?.id ?? "",
      supplier_id: "",
      cost_centre_id: nextCentre?.id ?? "",
      cost_nature: nextCategory?.default_nature ?? "variable",
    });
    setEditing(null);
    setShowForm(true);
    setError("");

    window.setTimeout(() => {
      const amountInput = amountInputRef.current;
      amountInput?.scrollIntoView({ behavior: "smooth", block: "center" });
      amountInput?.focus({ preventScroll: true });
      amountInput?.select();
    }, 120);
  }, [business.base_currency, categories, costCentres]);

  useEffect(() => {
    function handleBusinessQuickAdd() {
      activateQuickAdd();
    }

    window.addEventListener(
      "ficonter:business-quick-add-transaction",
      handleBusinessQuickAdd,
    );

    const params = new URLSearchParams(window.location.search);
    if (params.get("quickAdd") === "1") {
      activateQuickAdd();
      params.delete("quickAdd");
      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
      );
    }

    return () =>
      window.removeEventListener(
        "ficonter:business-quick-add-transaction",
        handleBusinessQuickAdd,
      );
  }, [activateQuickAdd]);

  function openEdit(item: BusinessTransaction) {
    if (item.source_sale_id) {
      setNotice("Sales-generated transactions are managed from Business → Sales.");
      return;
    }
    const managedCategory = item.cost_category_id
      ? categories.find((category) => category.id === item.cost_category_id)
      : null;
    const knownIncome = INCOME_CATEGORIES.includes(item.category);
    setForm({
      description: item.description,
      counterparty: item.counterparty ?? "",
      supplier_id: item.supplier_id ?? "",
      type: item.type,
      category_id: managedCategory?.id ?? "custom",
      income_category: knownIncome ? item.category : "Other / custom",
      customCategory: item.type === "income" ? (knownIncome ? "" : item.category) : managedCategory ? "" : item.category,
      cost_centre_id: item.cost_centre_id ?? "",
      cost_nature: (item.cost_nature ?? managedCategory?.default_nature ?? "variable") as Exclude<BusinessCostNature, null>,
      amount: String(item.amount),
      currency: item.currency,
      occurred_at: toLocalInput(item.occurred_at),
      payment_method: item.payment_method ?? "Bank transfer",
      reference: item.reference ?? "",
      notes: item.notes ?? "",
    });
    setEditing(item);
    setShowForm(true);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const amount = roundMoney(form.amount);
      const description = form.description.trim();
      const occurred = new Date(form.occurred_at);
      const selectedCategory = categories.find((item) => item.id === form.category_id);
      const selectedSupplier = suppliers.find((item) => item.id === form.supplier_id);
      const finalCategory =
        form.type === "income"
          ? form.income_category === "Other / custom"
            ? form.customCategory.trim()
            : form.income_category
          : selectedCategory?.name ?? form.customCategory.trim();
      if (!description) throw new Error("Enter a transaction description.");
      if (!finalCategory) throw new Error("Choose or enter a category.");
      if (amount <= 0) throw new Error("Enter an amount greater than zero.");
      if (Number.isNaN(occurred.getTime())) throw new Error("Choose a valid date and time.");
      const rateResult = await getExchangeRate(form.currency, business.base_currency);
      const payload = {
        business_id: business.id,
        description,
        counterparty:
          form.type === "expense" && selectedSupplier
            ? selectedSupplier.name
            : form.counterparty.trim() || null,
        supplier_id:
          form.type === "expense" && selectedSupplier ? selectedSupplier.id : null,
        type: form.type,
        category: finalCategory,
        cost_nature: form.type === "expense" ? form.cost_nature : null,
        cost_category_id: form.type === "expense" && selectedCategory ? selectedCategory.id : null,
        cost_centre_id: form.type === "expense" ? form.cost_centre_id || null : null,
        amount,
        currency: form.currency,
        amount_base: roundMoney(amount * rateResult.rate),
        exchange_rate_to_base: roundRate(rateResult.rate),
        exchange_rate_date: rateResult.date,
        exchange_rate_source: rateResult.source,
        transaction_date: form.occurred_at.slice(0, 10),
        occurred_at: occurred.toISOString(),
        payment_method: form.payment_method || null,
        reference: form.reference.trim() || null,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (editing) {
        const { data, error: updateError } = await supabase
          .from("business_transactions")
          .update(payload)
          .eq("id", editing.id)
          .eq("business_id", business.id)
          .select()
          .single();
        if (updateError) throw updateError;
        setTransactions((current) => current.map((item) => (item.id === editing.id ? (data as BusinessTransaction) : item)));
        setNotice("Business transaction updated.");
      } else {
        const { data, error: insertError } = await supabase
          .from("business_transactions")
          .insert({ ...payload, created_by: userId })
          .select()
          .single();
        if (insertError) throw insertError;
        setTransactions((current) => [data as BusinessTransaction, ...current.filter((item) => item.id !== data.id)]);
        setNotice("Business transaction added.");
      }
      resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The transaction could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting || busy) return;
    if (deleting.source_sale_id) {
      setDeleting(null);
      setError("Sales-generated transactions must be refunded from Business → Sales.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: deleteError } = await supabase
      .from("business_transactions")
      .delete()
      .eq("id", deleting.id)
      .eq("business_id", business.id);
    if (deleteError) setError(deleteError.message);
    else {
      setTransactions((current) => current.filter((item) => item.id !== deleting.id));
      setDeleting(null);
      setNotice("Business transaction deleted.");
    }
    setBusy(false);
  }

  return (
    <section className={styles.shell}>
      <header className={styles.hero}>
        <div><span>FICONTER BUSINESS</span><h1>Business Transactions</h1><p>{business.name} · Expenses feed Cost Control automatically.</p></div>
        <button onClick={() => (showForm ? resetForm() : setShowForm(true))}>{showForm ? <X size={18} /> : <Plus size={18} />} {showForm ? "Close form" : "Add transaction"}</button>
      </header>
      {notice ? <div className={styles.notice}>{notice}</div> : null}
      {error && !showForm ? <div className={styles.error}>{error}</div> : null}

      {showForm ? (
        <form className={styles.form} onSubmit={save}>
          <div className={styles.formHead}><div><span>{editing ? "EDIT RECORD" : "NEW RECORD"}</span><h2>{editing ? "Update transaction" : "Record business activity"}</h2></div>{editing ? <button type="button" onClick={resetForm}>Cancel edit</button> : null}</div>
          <div className={styles.formGrid}>
            <label>Type<select value={form.type} onChange={(event) => { const type = event.target.value as BusinessTransactionType; const category = categories.find((item) => item.is_active) ?? categories[0]; setForm({ ...form, type, supplier_id: "", category_id: category?.id ?? "", income_category: INCOME_CATEGORIES[0], customCategory: "", cost_nature: category?.default_nature ?? "variable" }); }}><option value="income">Income</option><option value="expense">Expense</option></select></label>
            <label>Description<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required placeholder="What was this transaction?" /></label>
            {form.type === "expense" ? (
              <label>
                Registered supplier
                <select
                  value={form.supplier_id}
                  onChange={(event) => {
                    const supplier = suppliers.find((item) => item.id === event.target.value);
                    setForm({
                      ...form,
                      supplier_id: event.target.value,
                      counterparty: supplier?.name ?? form.counterparty,
                      currency: supplier?.default_currency ?? form.currency,
                    });
                  }}
                >
                  <option value="">No registered supplier</option>
                  {suppliers.filter((supplier) => supplier.status === "active").map((supplier) => (
                    <option value={supplier.id} key={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              {form.type === "income" ? "Customer / counterparty" : "Supplier / other counterparty"}
              <input
                value={form.counterparty}
                onChange={(event) => setForm({ ...form, counterparty: event.target.value, supplier_id: "" })}
                placeholder="Optional counterparty"
              />
            </label>
            {form.type === "income" ? (
              <label>Category<select value={form.income_category} onChange={(event) => setForm({ ...form, income_category: event.target.value })}>{INCOME_CATEGORIES.map((category) => <option key={category}>{category}</option>)}<option>Other / custom</option></select></label>
            ) : (
              <label>Cost category<select value={form.category_id} onChange={(event) => { const category = categories.find((item) => item.id === event.target.value); setForm({ ...form, category_id: event.target.value, customCategory: "", cost_nature: category?.default_nature ?? form.cost_nature }); }}>{categories.filter((category) => category.is_active).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}<option value="custom">Other / custom</option></select></label>
            )}
            {(form.type === "income" && form.income_category === "Other / custom") || (form.type === "expense" && form.category_id === "custom") ? <label>Custom category<input value={form.customCategory} onChange={(event) => setForm({ ...form, customCategory: event.target.value })} required /></label> : null}
            {form.type === "expense" ? <><label>Cost type<select value={form.cost_nature} onChange={(event) => setForm({ ...form, cost_nature: event.target.value as Exclude<BusinessCostNature, null> })}><option value="fixed">Fixed cost</option><option value="variable">Variable cost</option></select></label><label>Cost centre<select value={form.cost_centre_id} onChange={(event) => setForm({ ...form, cost_centre_id: event.target.value })}><option value="">No cost centre</option>{costCentres.filter((centre) => centre.is_active).map((centre) => <option value={centre.id} key={centre.id}>{centre.name}</option>)}</select></label></> : null}
            <label>Amount<input ref={amountInputRef} type="number" min="0.01" step="0.01" inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></label>
            <label>Currency<select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}>{CURRENCY_CODES.map((code) => <option value={code} key={code}>{currencySymbol(code)} {code} — {currencyName(code)}</option>)}</select></label>
            <label>Date and exact time<input type="datetime-local" value={form.occurred_at} onChange={(event) => setForm({ ...form, occurred_at: event.target.value })} required /></label>
            <label>Payment method<select value={form.payment_method} onChange={(event) => setForm({ ...form, payment_method: event.target.value })}>{PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}</select></label>
            <label>Reference<input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} placeholder="Invoice or order reference" /></label>
            <label className={styles.full}>Notes<textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional details" /></label>
          </div>
          {error ? <div className={styles.error} role="alert">{error}</div> : null}
          <button className={styles.save} disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Save transaction"}</button>
        </form>
      ) : null}

      <div className={styles.summary}><article><span>Revenue</span><strong>{money(revenue)}</strong></article><article><span>Expenses</span><strong>{money(expenses)}</strong></article><article className={result >= 0 ? styles.good : styles.bad}><span>Result</span><strong>{money(result)}</strong></article><article><span>Visible records</span><strong>{visible.length}</strong></article></div>

      <div className={styles.filters}><label><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search business transactions" /></label><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All types</option><option value="income">Income</option><option value="expense">Expense</option></select><select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}><option value="all">All months</option>{months.map((month) => <option key={month} value={month}>{month}</option>)}</select></div>

      <div className={`${styles.list} ficonter-scroll-region`} tabIndex={visible.length > 8 ? 0 : undefined}>
        {visible.length ? visible.map((item) => {
          const centre = item.cost_centre_id ? costCentres.find((record) => record.id === item.cost_centre_id) : null;
          return <article className={styles.row} key={item.id}><i className={item.type === "income" ? styles.income : styles.expense} /><div className={styles.identity}><strong>{item.description}</strong><span>{item.counterparty || item.category} · {item.category}{centre ? ` · ${centre.name}` : ""}</span><small><CalendarRange size={13} />{new Date(item.occurred_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}{item.cost_nature ? ` · ${item.cost_nature} cost` : ""}{item.source_recurring_cost_id ? " · automatic recurring" : ""}{item.source_sale_id ? " · managed sale" : ""}</small></div><div className={styles.amount}><strong className={item.type === "income" ? styles.incomeText : styles.expenseText}>{item.type === "income" ? "+" : "−"}{money(item.amount_base)}</strong>{item.currency !== business.base_currency ? <span>{formatCurrency(finiteNumber(item.amount), item.currency)}</span> : null}</div><div className={styles.actions}><button onClick={() => openEdit(item)} aria-label="Edit transaction" disabled={Boolean(item.source_sale_id)} title={item.source_sale_id ? "Manage this transaction from Sales" : "Edit transaction"}><Edit3 size={16} /></button><button onClick={() => setDeleting(item)} aria-label="Delete transaction" disabled={Boolean(item.source_sale_id)} title={item.source_sale_id ? "Refund this sale from Sales" : "Delete transaction"}><Trash2 size={16} /></button></div></article>;
        }) : <div className={styles.empty}>No matching business transactions.</div>}
      </div>

      {deleting ? <div className={styles.backdrop}><section className={styles.modal}><button className={styles.close} onClick={() => setDeleting(null)}><X size={18} /></button><Trash2 /><span>CONFIRM DELETION</span><h2>Delete this business transaction?</h2><p>{deleting.description} · {money(deleting.amount_base)}</p>{deleting.source_recurring_cost_id ? <p>This removes only this recorded occurrence. The recurring schedule remains active.</p> : null}<div><button onClick={() => setDeleting(null)}>Keep transaction</button><button className={styles.danger} disabled={busy} onClick={confirmDelete}>{busy ? "Deleting…" : "Delete transaction"}</button></div></section></div> : null}
    </section>
  );
}
