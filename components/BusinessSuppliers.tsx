"use client";

import {
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Edit3,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Trash2,
  Truck,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getExchangeRate } from "@/lib/performance/exchangeRateCache";
import { finiteNumber, roundMoney, roundRate, sumMoney } from "@/lib/finance/money";
import {
  CURRENCY_CODES,
  currencyName,
  currencySymbol,
  formatCurrency,
} from "@/lib/financialOptions";
import type {
  Business,
  BusinessCostCategory,
  BusinessCostCentre,
  BusinessSupplier,
  BusinessSupplierInvoice,
  BusinessSupplierStatus,
  BusinessTransaction,
} from "@/lib/business/types";
import styles from "./BusinessSuppliers.module.css";

const SUPPLIER_CATEGORIES = [
  "Materials",
  "Wholesale",
  "Utilities",
  "Technology",
  "Professional services",
  "Logistics",
  "Property",
  "Marketing",
  "Maintenance",
  "Other",
];

const PAYMENT_METHODS = [
  "Bank transfer",
  "Direct debit",
  "Card",
  "Cash",
  "Online payment",
  "Invoice",
  "Other",
];

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
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

const EMPTY_SUPPLIER = {
  name: "",
  legal_name: "",
  supplier_code: "",
  category: "Materials",
  contact_name: "",
  email: "",
  phone: "",
  website: "",
  tax_id: "",
  payment_terms_days: "30",
  default_currency: "EUR",
  status: "active" as BusinessSupplierStatus,
  address_line1: "",
  address_line2: "",
  city: "",
  postal_code: "",
  country_code: "DE",
  notes: "",
};

const EMPTY_INVOICE = {
  invoice_number: "",
  description: "",
  category_id: "",
  cost_centre_id: "",
  cost_nature: "variable" as "fixed" | "variable",
  amount: "",
  currency: "EUR",
  issue_date: localDateKey(),
  due_date: addDays(localDateKey(), 30),
  payment_method: "Bank transfer",
  notes: "",
};

export function BusinessSuppliers({
  userId,
  business,
  initialSuppliers,
  initialInvoices,
  initialTransactions,
  initialCategories,
  initialCentres,
}: {
  userId: string;
  business: Business;
  initialSuppliers: BusinessSupplier[];
  initialInvoices: BusinessSupplierInvoice[];
  initialTransactions: BusinessTransaction[];
  initialCategories: BusinessCostCategory[];
  initialCentres: BusinessCostCentre[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [invoices, setInvoices] = useState(initialInvoices);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<BusinessSupplier | null>(null);
  const [supplierForm, setSupplierForm] = useState(() => ({
    ...EMPTY_SUPPLIER,
    default_currency: business.base_currency,
  }));
  const [invoiceSupplier, setInvoiceSupplier] = useState<BusinessSupplier | null>(null);
  const firstCategory = initialCategories.find((item) => item.is_active) ?? initialCategories[0];
  const [invoiceForm, setInvoiceForm] = useState(() => ({
    ...EMPTY_INVOICE,
    currency: business.base_currency,
    category_id: firstCategory?.id ?? "",
    cost_nature: firstCategory?.default_nature ?? "variable",
  }));
  const [deleteSupplier, setDeleteSupplier] = useState<BusinessSupplier | null>(null);
  const [deleteInvoice, setDeleteInvoice] = useState<BusinessSupplierInvoice | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const channel = supabase
      .channel(`business-suppliers-${business.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_suppliers", filter: `business_id=eq.${business.id}` },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          setSuppliers((current) =>
            mergeRealtime<BusinessSupplier>(current, payload).sort((a, b) => a.name.localeCompare(b.name)),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_supplier_invoices", filter: `business_id=eq.${business.id}` },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          setInvoices((current) =>
            mergeRealtime<BusinessSupplierInvoice>(current, payload).sort((a, b) => b.due_date.localeCompare(a.due_date)),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_transactions", filter: `business_id=eq.${business.id}` },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          setTransactions((current) =>
            mergeRealtime<BusinessTransaction>(current, payload).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [business.id, supabase]);

  const today = localDateKey();
  const activeCount = suppliers.filter((supplier) => supplier.status === "active").length;
  const totalSpend = sumMoney(
    transactions
      .filter((transaction) => transaction.type === "expense" && transaction.supplier_id)
      .map((transaction) => transaction.amount_base),
  );
  const outstanding = sumMoney(
    invoices.filter((invoice) => invoice.status === "open").map((invoice) => invoice.amount_base),
  );
  const overdueCount = invoices.filter(
    (invoice) => invoice.status === "open" && invoice.due_date < today,
  ).length;

  const categories = useMemo(
    () => [...new Set(suppliers.map((supplier) => supplier.category))].sort(),
    [suppliers],
  );

  const visibleSuppliers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return suppliers.filter((supplier) => {
      const searchable = [
        supplier.name,
        supplier.legal_name,
        supplier.supplier_code,
        supplier.category,
        supplier.contact_name,
        supplier.email,
        supplier.phone,
        supplier.city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        (!query || searchable.includes(query)) &&
        (statusFilter === "all" || supplier.status === statusFilter) &&
        (categoryFilter === "all" || supplier.category === categoryFilter)
      );
    });
  }, [suppliers, search, statusFilter, categoryFilter]);

  const money = (value: unknown) =>
    formatCurrency(finiteNumber(value), business.base_currency);

  function resetSupplierForm() {
    setSupplierForm({
      ...EMPTY_SUPPLIER,
      default_currency: business.base_currency,
    });
    setEditingSupplier(null);
    setShowSupplierForm(false);
    setError("");
  }

  function openSupplierEdit(supplier: BusinessSupplier) {
    setSupplierForm({
      name: supplier.name,
      legal_name: supplier.legal_name ?? "",
      supplier_code: supplier.supplier_code ?? "",
      category: supplier.category,
      contact_name: supplier.contact_name ?? "",
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
      website: supplier.website ?? "",
      tax_id: supplier.tax_id ?? "",
      payment_terms_days: String(supplier.payment_terms_days),
      default_currency: supplier.default_currency,
      status: supplier.status,
      address_line1: supplier.address_line1 ?? "",
      address_line2: supplier.address_line2 ?? "",
      city: supplier.city ?? "",
      postal_code: supplier.postal_code ?? "",
      country_code: supplier.country_code ?? "DE",
      notes: supplier.notes ?? "",
    });
    setEditingSupplier(supplier);
    setShowSupplierForm(true);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("supplier");
    setError("");

    try {
      const name = supplierForm.name.trim();
      const paymentTerms = Number(supplierForm.payment_terms_days);
      if (!name) throw new Error("Enter a supplier name.");
      if (!Number.isInteger(paymentTerms) || paymentTerms < 0 || paymentTerms > 365) {
        throw new Error("Payment terms must be between 0 and 365 days.");
      }

      const payload = {
        business_id: business.id,
        name,
        legal_name: supplierForm.legal_name.trim() || null,
        supplier_code: supplierForm.supplier_code.trim() || null,
        category: supplierForm.category,
        contact_name: supplierForm.contact_name.trim() || null,
        email: supplierForm.email.trim() || null,
        phone: supplierForm.phone.trim() || null,
        website: supplierForm.website.trim() || null,
        tax_id: supplierForm.tax_id.trim() || null,
        payment_terms_days: paymentTerms,
        default_currency: supplierForm.default_currency,
        status: supplierForm.status,
        address_line1: supplierForm.address_line1.trim() || null,
        address_line2: supplierForm.address_line2.trim() || null,
        city: supplierForm.city.trim() || null,
        postal_code: supplierForm.postal_code.trim() || null,
        country_code: supplierForm.country_code.trim().toUpperCase() || null,
        notes: supplierForm.notes.trim() || null,
      };

      const query = editingSupplier
        ? supabase
            .from("business_suppliers")
            .update(payload)
            .eq("id", editingSupplier.id)
            .eq("business_id", business.id)
        : supabase
            .from("business_suppliers")
            .insert({ ...payload, created_by: userId });

      const { data, error: saveError } = await query.select().single();
      if (saveError) throw saveError;

      setSuppliers((current) =>
        [data as BusinessSupplier, ...current.filter((item) => item.id !== data.id)].sort(
          (a, b) => a.name.localeCompare(b.name),
        ),
      );
      setNotice(editingSupplier ? "Supplier updated." : "Supplier added.");
      resetSupplierForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Supplier could not be saved.");
    } finally {
      setBusy("");
    }
  }

  function openInvoiceForm(supplier: BusinessSupplier) {
    const category = initialCategories.find((item) => item.is_active) ?? initialCategories[0];
    const issueDate = localDateKey();
    setInvoiceSupplier(supplier);
    setInvoiceForm({
      ...EMPTY_INVOICE,
      currency: supplier.default_currency || business.base_currency,
      category_id: category?.id ?? "",
      cost_nature: category?.default_nature ?? "variable",
      issue_date: issueDate,
      due_date: addDays(issueDate, supplier.payment_terms_days),
    });
    setError("");
  }

  async function saveInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invoiceSupplier || busy) return;
    setBusy("invoice");
    setError("");

    try {
      const category = initialCategories.find((item) => item.id === invoiceForm.category_id);
      const amount = roundMoney(invoiceForm.amount);
      if (!invoiceForm.invoice_number.trim()) throw new Error("Enter the invoice number.");
      if (!invoiceForm.description.trim()) throw new Error("Enter an invoice description.");
      if (!category) throw new Error("Choose a cost category.");
      if (amount <= 0) throw new Error("Enter an amount greater than zero.");
      if (invoiceForm.due_date < invoiceForm.issue_date) {
        throw new Error("The due date cannot be earlier than the issue date.");
      }

      const rate = await getExchangeRate(invoiceForm.currency, business.base_currency);
      const payload = {
        business_id: business.id,
        supplier_id: invoiceSupplier.id,
        invoice_number: invoiceForm.invoice_number.trim(),
        description: invoiceForm.description.trim(),
        category_id: category.id,
        category_name: category.name,
        cost_centre_id: invoiceForm.cost_centre_id || null,
        cost_nature: invoiceForm.cost_nature,
        amount,
        currency: invoiceForm.currency,
        amount_base: roundMoney(amount * rate.rate),
        exchange_rate_to_base: roundRate(rate.rate),
        exchange_rate_date: rate.date,
        exchange_rate_source: rate.source,
        issue_date: invoiceForm.issue_date,
        due_date: invoiceForm.due_date,
        status: "open",
        payment_method: invoiceForm.payment_method || null,
        notes: invoiceForm.notes.trim() || null,
      };

      const { data, error: insertError } = await supabase
        .from("business_supplier_invoices")
        .insert({ ...payload, created_by: userId })
        .select()
        .single();
      if (insertError) throw insertError;

      setInvoices((current) => [
        data as BusinessSupplierInvoice,
        ...current.filter((item) => item.id !== data.id),
      ]);
      setInvoiceSupplier(null);
      setNotice("Supplier invoice added.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Invoice could not be saved.");
    } finally {
      setBusy("");
    }
  }

  async function markInvoicePaid(invoice: BusinessSupplierInvoice) {
    if (busy) return;
    setBusy(`pay-${invoice.id}`);
    setError("");

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "record_business_supplier_invoice_payment",
        {
          p_invoice_id: invoice.id,
          p_paid_at: new Date().toISOString(),
          p_payment_method: invoice.payment_method || "Bank transfer",
        },
      );
      if (rpcError) throw rpcError;

      const result = data as {
        invoice?: BusinessSupplierInvoice;
        transaction?: BusinessTransaction;
      } | null;

      if (!result?.invoice || !result.transaction) {
        throw new Error("The paid invoice result was not returned.");
      }

      setInvoices((current) =>
        current.map((item) => (item.id === invoice.id ? result.invoice! : item)),
      );
      setTransactions((current) => [
        result.transaction!,
        ...current.filter((item) => item.id !== result.transaction!.id),
      ]);
      setNotice("Invoice marked paid and added to Business Transactions.");
    } catch (payError) {
      setError(payError instanceof Error ? payError.message : "Invoice could not be paid.");
    } finally {
      setBusy("");
    }
  }

  async function reverseInvoice(invoice: BusinessSupplierInvoice) {
    if (busy) return;
    setBusy(`reverse-${invoice.id}`);
    setError("");

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "reverse_business_supplier_invoice_payment",
        { p_invoice_id: invoice.id },
      );
      if (rpcError) throw rpcError;

      const result = data as {
        invoice?: BusinessSupplierInvoice;
        deleted_transaction_id?: string | null;
      } | null;

      if (!result?.invoice) throw new Error("The reopened invoice was not returned.");

      setInvoices((current) =>
        current.map((item) => (item.id === invoice.id ? result.invoice! : item)),
      );
      if (result.deleted_transaction_id) {
        setTransactions((current) =>
          current.filter((item) => item.id !== result.deleted_transaction_id),
        );
      }
      setNotice("Invoice payment reversed and linked transaction removed.");
    } catch (reverseError) {
      setError(reverseError instanceof Error ? reverseError.message : "Payment could not be reversed.");
    } finally {
      setBusy("");
    }
  }

  async function confirmDeleteSupplier() {
    if (!deleteSupplier || busy) return;
    setBusy("delete-supplier");
    setError("");

    const { error: deleteError } = await supabase
      .from("business_suppliers")
      .delete()
      .eq("id", deleteSupplier.id)
      .eq("business_id", business.id);

    if (deleteError) setError(deleteError.message);
    else {
      setSuppliers((current) => current.filter((item) => item.id !== deleteSupplier.id));
      setInvoices((current) => current.filter((item) => item.supplier_id !== deleteSupplier.id));
      setDeleteSupplier(null);
      setNotice("Supplier deleted. Existing expense transactions remain intact.");
    }
    setBusy("");
  }

  async function confirmDeleteInvoice() {
    if (!deleteInvoice || busy) return;
    setBusy("delete-invoice");
    setError("");

    const { error: deleteError } = await supabase
      .from("business_supplier_invoices")
      .delete()
      .eq("id", deleteInvoice.id)
      .eq("business_id", business.id)
      .neq("status", "paid");

    if (deleteError) setError(deleteError.message);
    else {
      setInvoices((current) => current.filter((item) => item.id !== deleteInvoice.id));
      setDeleteInvoice(null);
      setNotice("Supplier invoice deleted.");
    }
    setBusy("");
  }

  return (
    <section className={styles.shell}>
      <header className={styles.hero}>
        <div>
          <span>FICONTER BUSINESS</span>
          <h1>Suppliers</h1>
          <p>
            Manage supplier relationships, invoices, payment obligations and
            verified supplier spending for {business.name}.
          </p>
        </div>
        <button onClick={() => (showSupplierForm ? resetSupplierForm() : setShowSupplierForm(true))}>
          {showSupplierForm ? <X size={18} /> : <Plus size={18} />}
          {showSupplierForm ? "Close form" : "Add supplier"}
        </button>
      </header>

      {notice ? <div className={styles.notice}>{notice}</div> : null}
      {error && !showSupplierForm && !invoiceSupplier ? (
        <div className={styles.error}>{error}</div>
      ) : null}

      {showSupplierForm ? (
        <form className={styles.formCard} onSubmit={saveSupplier}>
          <div className={styles.formHead}>
            <div>
              <span>{editingSupplier ? "EDIT SUPPLIER" : "NEW SUPPLIER"}</span>
              <h2>{editingSupplier ? "Update supplier" : "Create supplier profile"}</h2>
            </div>
            {editingSupplier ? <button type="button" onClick={resetSupplierForm}>Cancel edit</button> : null}
          </div>
          <div className={styles.formGrid}>
            <label>Supplier name<input value={supplierForm.name} onChange={(event) => setSupplierForm({ ...supplierForm, name: event.target.value })} required /></label>
            <label>Legal name<input value={supplierForm.legal_name} onChange={(event) => setSupplierForm({ ...supplierForm, legal_name: event.target.value })} /></label>
            <label>Supplier code<input value={supplierForm.supplier_code} onChange={(event) => setSupplierForm({ ...supplierForm, supplier_code: event.target.value })} placeholder="Optional internal code" /></label>
            <label>Category<select value={supplierForm.category} onChange={(event) => setSupplierForm({ ...supplierForm, category: event.target.value })}>{SUPPLIER_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
            <label>Contact person<input value={supplierForm.contact_name} onChange={(event) => setSupplierForm({ ...supplierForm, contact_name: event.target.value })} /></label>
            <label>Email<input type="email" value={supplierForm.email} onChange={(event) => setSupplierForm({ ...supplierForm, email: event.target.value })} /></label>
            <label>Phone<input value={supplierForm.phone} onChange={(event) => setSupplierForm({ ...supplierForm, phone: event.target.value })} /></label>
            <label>Website<input value={supplierForm.website} onChange={(event) => setSupplierForm({ ...supplierForm, website: event.target.value })} placeholder="https://" /></label>
            <label>Tax / VAT ID<input value={supplierForm.tax_id} onChange={(event) => setSupplierForm({ ...supplierForm, tax_id: event.target.value })} /></label>
            <label>Payment terms<input type="number" min="0" max="365" value={supplierForm.payment_terms_days} onChange={(event) => setSupplierForm({ ...supplierForm, payment_terms_days: event.target.value })} required /></label>
            <label>Default currency<select value={supplierForm.default_currency} onChange={(event) => setSupplierForm({ ...supplierForm, default_currency: event.target.value })}>{CURRENCY_CODES.map((code) => <option value={code} key={code}>{currencySymbol(code)} {code} — {currencyName(code)}</option>)}</select></label>
            <label>Status<select value={supplierForm.status} onChange={(event) => setSupplierForm({ ...supplierForm, status: event.target.value as BusinessSupplierStatus })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            <label>Address line 1<input value={supplierForm.address_line1} onChange={(event) => setSupplierForm({ ...supplierForm, address_line1: event.target.value })} /></label>
            <label>Address line 2<input value={supplierForm.address_line2} onChange={(event) => setSupplierForm({ ...supplierForm, address_line2: event.target.value })} /></label>
            <label>City<input value={supplierForm.city} onChange={(event) => setSupplierForm({ ...supplierForm, city: event.target.value })} /></label>
            <label>Postal code<input value={supplierForm.postal_code} onChange={(event) => setSupplierForm({ ...supplierForm, postal_code: event.target.value })} /></label>
            <label>Country code<input maxLength={2} value={supplierForm.country_code} onChange={(event) => setSupplierForm({ ...supplierForm, country_code: event.target.value.toUpperCase() })} /></label>
            <label className={styles.fullWidth}>Notes<textarea rows={3} value={supplierForm.notes} onChange={(event) => setSupplierForm({ ...supplierForm, notes: event.target.value })} /></label>
          </div>
          {error ? <div className={styles.error}>{error}</div> : null}
          <button className={styles.primaryButton} disabled={busy === "supplier"}>{busy === "supplier" ? "Saving…" : editingSupplier ? "Save changes" : "Save supplier"}</button>
        </form>
      ) : null}

      <div className={styles.summaryGrid}>
        <article><Truck /><span>Active suppliers</span><strong>{activeCount}</strong></article>
        <article><CircleDollarSign /><span>Linked supplier spend</span><strong>{money(totalSpend)}</strong></article>
        <article><WalletCards /><span>Outstanding invoices</span><strong>{money(outstanding)}</strong></article>
        <article className={overdueCount ? styles.warningCard : ""}><CalendarDays /><span>Overdue invoices</span><strong>{overdueCount}</strong></article>
      </div>

      <div className={styles.filters}>
        <label><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search supplier, contact, code or city" /></label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select>
      </div>

      <div className={`${styles.supplierGrid} ficonter-scroll-region`}>
        {visibleSuppliers.length ? visibleSuppliers.map((supplier) => {
          const supplierTransactions = transactions.filter(
            (transaction) => transaction.supplier_id === supplier.id && transaction.type === "expense",
          );
          const supplierInvoices = invoices
            .filter((invoice) => invoice.supplier_id === supplier.id)
            .sort((a, b) => b.due_date.localeCompare(a.due_date));
          const spend = sumMoney(supplierTransactions.map((transaction) => transaction.amount_base));
          const averageOrder = supplierTransactions.length ? spend / supplierTransactions.length : 0;
          const lastPurchase = supplierTransactions[0]?.transaction_date ?? null;
          const supplierOutstanding = sumMoney(
            supplierInvoices.filter((invoice) => invoice.status === "open").map((invoice) => invoice.amount_base),
          );

          return (
            <article className={styles.supplierCard} key={supplier.id}>
              <div className={styles.cardTop}>
                <div className={styles.supplierIcon}><Building2 size={21} /></div>
                <div className={styles.identity}>
                  <div><h2>{supplier.name}</h2><span className={`${styles.status} ${styles[supplier.status]}`}>{supplier.status}</span></div>
                  <p>{supplier.legal_name || supplier.category}{supplier.supplier_code ? ` · ${supplier.supplier_code}` : ""}</p>
                </div>
                <div className={styles.cardActions}>
                  <button onClick={() => openSupplierEdit(supplier)} aria-label={`Edit ${supplier.name}`}><Edit3 size={16} /></button>
                  <button onClick={() => setDeleteSupplier(supplier)} aria-label={`Delete ${supplier.name}`}><Trash2 size={16} /></button>
                </div>
              </div>

              <div className={styles.contactGrid}>
                <span><Mail size={15} />{supplier.email || "No email"}</span>
                <span><Phone size={15} />{supplier.phone || "No phone"}</span>
                <span><MapPin size={15} />{[supplier.city, supplier.country_code].filter(Boolean).join(", ") || "No location"}</span>
              </div>

              <div className={styles.metrics}>
                <div><span>Total spend</span><strong>{money(spend)}</strong></div>
                <div><span>Average purchase</span><strong>{money(averageOrder)}</strong></div>
                <div><span>Outstanding</span><strong>{money(supplierOutstanding)}</strong></div>
                <div><span>Last purchase</span><strong>{lastPurchase ? new Date(`${lastPurchase}T12:00:00`).toLocaleDateString("en-GB") : "—"}</strong></div>
              </div>

              <div className={styles.invoiceHeader}>
                <div><ReceiptText size={17} /><strong>Supplier invoices</strong></div>
                <button onClick={() => openInvoiceForm(supplier)}><Plus size={15} /> Add invoice</button>
              </div>

              <div className={styles.invoiceList}>
                {supplierInvoices.length ? supplierInvoices.slice(0, 6).map((invoice) => {
                  const overdue = invoice.status === "open" && invoice.due_date < today;
                  const displayStatus = overdue ? "overdue" : invoice.status;
                  return (
                    <div className={styles.invoiceRow} key={invoice.id}>
                      <div>
                        <strong>{invoice.invoice_number}</strong>
                        <span>{invoice.description} · Due {new Date(`${invoice.due_date}T12:00:00`).toLocaleDateString("en-GB")}</span>
                      </div>
                      <strong>{money(invoice.amount_base)}</strong>
                      <span className={`${styles.invoiceStatus} ${styles[displayStatus]}`}>{displayStatus}</span>
                      <div className={styles.invoiceActions}>
                        {invoice.status === "open" ? (
                          <button onClick={() => markInvoicePaid(invoice)} disabled={busy === `pay-${invoice.id}`} title="Mark paid"><CheckCircle2 size={16} /></button>
                        ) : null}
                        {invoice.status === "paid" ? (
                          <button onClick={() => reverseInvoice(invoice)} disabled={busy === `reverse-${invoice.id}`} title="Reverse payment"><RotateCcw size={16} /></button>
                        ) : null}
                        {invoice.status !== "paid" ? (
                          <button onClick={() => setDeleteInvoice(invoice)} title="Delete invoice"><Trash2 size={16} /></button>
                        ) : null}
                      </div>
                    </div>
                  );
                }) : <p className={styles.emptyInvoices}>No supplier invoices yet.</p>}
              </div>
            </article>
          );
        }) : (
          <div className={styles.emptyState}>
            <Truck size={35} />
            <h2>No suppliers found</h2>
            <p>Add a supplier or change the current filters.</p>
          </div>
        )}
      </div>

      {invoiceSupplier ? (
        <div className={styles.backdrop}>
          <form className={styles.modal} onSubmit={saveInvoice}>
            <button className={styles.modalClose} type="button" onClick={() => { setInvoiceSupplier(null); setError(""); }}><X size={18} /></button>
            <FileText className={styles.modalIcon} />
            <span>NEW SUPPLIER INVOICE</span>
            <h2>{invoiceSupplier.name}</h2>
            <div className={styles.modalGrid}>
              <label>Invoice number<input value={invoiceForm.invoice_number} onChange={(event) => setInvoiceForm({ ...invoiceForm, invoice_number: event.target.value })} required /></label>
              <label>Description<input value={invoiceForm.description} onChange={(event) => setInvoiceForm({ ...invoiceForm, description: event.target.value })} required /></label>
              <label>Cost category<select value={invoiceForm.category_id} onChange={(event) => { const category = initialCategories.find((item) => item.id === event.target.value); setInvoiceForm({ ...invoiceForm, category_id: event.target.value, cost_nature: category?.default_nature ?? invoiceForm.cost_nature }); }}>{initialCategories.filter((category) => category.is_active).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
              <label>Cost centre<select value={invoiceForm.cost_centre_id} onChange={(event) => setInvoiceForm({ ...invoiceForm, cost_centre_id: event.target.value })}><option value="">No cost centre</option>{initialCentres.filter((centre) => centre.is_active).map((centre) => <option value={centre.id} key={centre.id}>{centre.name}</option>)}</select></label>
              <label>Cost type<select value={invoiceForm.cost_nature} onChange={(event) => setInvoiceForm({ ...invoiceForm, cost_nature: event.target.value as "fixed" | "variable" })}><option value="fixed">Fixed cost</option><option value="variable">Variable cost</option></select></label>
              <label>Amount<input type="number" min="0.01" step="0.01" value={invoiceForm.amount} onChange={(event) => setInvoiceForm({ ...invoiceForm, amount: event.target.value })} required /></label>
              <label>Currency<select value={invoiceForm.currency} onChange={(event) => setInvoiceForm({ ...invoiceForm, currency: event.target.value })}>{CURRENCY_CODES.map((code) => <option value={code} key={code}>{currencySymbol(code)} {code} — {currencyName(code)}</option>)}</select></label>
              <label>Issue date<input type="date" value={invoiceForm.issue_date} onChange={(event) => setInvoiceForm({ ...invoiceForm, issue_date: event.target.value })} required /></label>
              <label>Due date<input type="date" value={invoiceForm.due_date} onChange={(event) => setInvoiceForm({ ...invoiceForm, due_date: event.target.value })} required /></label>
              <label>Payment method<select value={invoiceForm.payment_method} onChange={(event) => setInvoiceForm({ ...invoiceForm, payment_method: event.target.value })}>{PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}</select></label>
              <label className={styles.fullWidth}>Notes<textarea rows={3} value={invoiceForm.notes} onChange={(event) => setInvoiceForm({ ...invoiceForm, notes: event.target.value })} /></label>
            </div>
            {error ? <div className={styles.error}>{error}</div> : null}
            <button className={styles.primaryButton} disabled={busy === "invoice"}>{busy === "invoice" ? "Saving…" : "Save invoice"}</button>
          </form>
        </div>
      ) : null}

      {deleteSupplier ? (
        <div className={styles.backdrop}>
          <section className={styles.modal}>
            <button className={styles.modalClose} onClick={() => setDeleteSupplier(null)}><X size={18} /></button>
            <Trash2 className={styles.modalIcon} />
            <span>DELETE SUPPLIER</span>
            <h2>Delete {deleteSupplier.name}?</h2>
            <p>Supplier invoices will be deleted. Existing Business Transactions remain financially intact and retain their counterparty text.</p>
            <div className={styles.modalActions}><button onClick={() => setDeleteSupplier(null)}>Keep supplier</button><button className={styles.dangerButton} disabled={busy === "delete-supplier"} onClick={confirmDeleteSupplier}>{busy === "delete-supplier" ? "Deleting…" : "Delete supplier"}</button></div>
          </section>
        </div>
      ) : null}

      {deleteInvoice ? (
        <div className={styles.backdrop}>
          <section className={styles.modal}>
            <button className={styles.modalClose} onClick={() => setDeleteInvoice(null)}><X size={18} /></button>
            <Trash2 className={styles.modalIcon} />
            <span>DELETE INVOICE</span>
            <h2>Delete invoice {deleteInvoice.invoice_number}?</h2>
            <p>This invoice has not been paid, so no Business Transaction will be affected.</p>
            <div className={styles.modalActions}><button onClick={() => setDeleteInvoice(null)}>Keep invoice</button><button className={styles.dangerButton} disabled={busy === "delete-invoice"} onClick={confirmDeleteInvoice}>{busy === "delete-invoice" ? "Deleting…" : "Delete invoice"}</button></div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
