"use client";

import {
  CalendarDays,
  CircleDollarSign,
  PackageCheck,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  ShoppingCart,
  TrendingUp,
  Trash2,
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
  BusinessInventoryItemSnapshot,
  BusinessSale,
} from "@/lib/business/types";
import styles from "./BusinessSales.module.css";

const PAYMENT_METHODS = [
  "Bank transfer",
  "Card",
  "Cash",
  "Online payment",
  "Invoice",
  "Other",
];

type SaleLineDraft = {
  key: string;
  inventory_item_id: string;
  item_name: string;
  quantity: string;
  unit_price: string;
};

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localTimeKey(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function monthKey(date = new Date()) {
  return localDateKey(date).slice(0, 7);
}

function makeSaleNumber(date = new Date()) {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    "-",
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join("");
  return `SALE-${stamp}`;
}

function newLine(): SaleLineDraft {
  return {
    key: crypto.randomUUID(),
    inventory_item_id: "",
    item_name: "",
    quantity: "1",
    unit_price: "",
  };
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

export function BusinessSales({
  business,
  initialSales,
  initialInventory,
}: {
  business: Business;
  initialSales: BusinessSale[];
  initialInventory: BusinessInventoryItemSnapshot[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [sales, setSales] = useState(initialSales);
  const [inventory, setInventory] = useState(initialInventory);
  const [showForm, setShowForm] = useState(false);
  const [saleNumber, setSaleNumber] = useState(() => makeSaleNumber());
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [currency, setCurrency] = useState(business.base_currency);
  const [saleDate, setSaleDate] = useState(localDateKey());
  const [saleTime, setSaleTime] = useState(localTimeKey());
  const [paymentMethod, setPaymentMethod] = useState("Card");
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<SaleLineDraft[]>(() => [newLine()]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState(monthKey());
  const [refundSale, setRefundSale] = useState<BusinessSale | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function refreshInventory() {
    const { data } = await supabase
      .from("business_inventory_item_balances")
      .select("*")
      .eq("business_id", business.id)
      .order("name", { ascending: true });
    if (data) setInventory(data as BusinessInventoryItemSnapshot[]);
  }

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const channel = supabase
      .channel(`business-sales-${business.id}`)
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_inventory_movements", filter: `business_id=eq.${business.id}` },
        () => { void refreshInventory(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [business.id, supabase]);

  const months = useMemo(
    () => [...new Set(sales.map((sale) => sale.sale_date.slice(0, 7)))].sort((a, b) => b.localeCompare(a)),
    [sales],
  );

  const visibleSales = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sales.filter((sale) =>
      (!query || `${sale.sale_number} ${sale.customer_name ?? ""} ${sale.reference ?? ""}`.toLowerCase().includes(query)) &&
      (statusFilter === "all" || sale.status === statusFilter) &&
      (monthFilter === "all" || sale.sale_date.startsWith(monthFilter)),
    );
  }, [sales, search, statusFilter, monthFilter]);

  const completed = visibleSales.filter((sale) => sale.status === "completed");
  const netSales = sumMoney(completed.map((sale) => sale.net_sales_base));
  const cogs = sumMoney(completed.map((sale) => sale.cogs_base));
  const grossProfit = sumMoney(completed.map((sale) => sale.gross_profit_base));
  const grossMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
  const unitsSold = sumMoney(completed.map((sale) => sale.units_sold));
  const averageSale = completed.length
    ? sumMoney(completed.map((sale) => sale.total_base)) / completed.length
    : 0;

  const lineSubtotal = lines.reduce(
    (sum, line) => sum + finiteNumber(line.quantity) * finiteNumber(line.unit_price),
    0,
  );
  const previewDiscount = Math.max(0, finiteNumber(discount));
  const previewTax = Math.max(0, finiteNumber(tax));
  const previewTotal = Math.max(0, lineSubtotal - previewDiscount + previewTax);
  const money = (value: unknown) => formatCurrency(finiteNumber(value), business.base_currency);
  const saleMoney = (value: unknown) => formatCurrency(finiteNumber(value), currency);

  function resetForm() {
    const now = new Date();
    setSaleNumber(makeSaleNumber(now));
    setCustomerName("");
    setCustomerEmail("");
    setCurrency(business.base_currency);
    setSaleDate(localDateKey(now));
    setSaleTime(localTimeKey(now));
    setPaymentMethod("Card");
    setDiscount("0");
    setTax("0");
    setReference("");
    setNotes("");
    setLines([newLine()]);
    setShowForm(false);
    setError("");
  }

  function updateLine(key: string, patch: Partial<SaleLineDraft>) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));
  }

  function selectInventory(line: SaleLineDraft, itemId: string) {
    const item = inventory.find((record) => record.id === itemId);
    updateLine(line.key, {
      inventory_item_id: itemId,
      item_name: item?.name ?? "",
      unit_price:
        item && currency === business.base_currency
          ? String(finiteNumber(item.selling_price_base) || "")
          : "",
    });
  }

  async function saveSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("save");
    setError("");

    try {
      if (!saleNumber.trim()) throw new Error("Enter a sale number.");
      const validLines = lines.map((line) => ({
        inventory_item_id: line.inventory_item_id || null,
        item_name: line.item_name.trim(),
        quantity: finiteNumber(line.quantity),
        unit_price: roundMoney(line.unit_price),
      }));
      if (!validLines.length) throw new Error("Add at least one sale line.");
      for (const line of validLines) {
        if (!line.item_name) throw new Error("Every sale line needs an item or service name.");
        if (line.quantity <= 0) throw new Error("Every quantity must be greater than zero.");
        if (line.unit_price < 0) throw new Error("Unit prices cannot be negative.");
        if (line.inventory_item_id) {
          const item = inventory.find((record) => record.id === line.inventory_item_id);
          if (!item) throw new Error("One selected inventory item no longer exists.");
          if (line.quantity > finiteNumber(item.quantity_on_hand)) {
            throw new Error(`${item.name} has only ${finiteNumber(item.quantity_on_hand)} ${item.unit} available.`);
          }
        }
      }
      if (previewDiscount > lineSubtotal) throw new Error("Discount cannot exceed the sale subtotal.");
      const occurredAt = new Date(`${saleDate}T${saleTime}:00`);
      if (Number.isNaN(occurredAt.getTime())) throw new Error("Choose a valid sale date and time.");
      const rate = await getExchangeRate(currency, business.base_currency);

      const { data, error: rpcError } = await supabase.rpc("record_business_sale", {
        p_business_id: business.id,
        p_sale_number: saleNumber.trim(),
        p_customer_name: customerName.trim() || null,
        p_customer_email: customerEmail.trim() || null,
        p_currency: currency,
        p_exchange_rate_to_base: roundRate(rate.rate),
        p_exchange_rate_date: rate.date,
        p_exchange_rate_source: rate.source,
        p_sale_date: saleDate,
        p_occurred_at: occurredAt.toISOString(),
        p_payment_method: paymentMethod,
        p_discount: roundMoney(previewDiscount),
        p_tax: roundMoney(previewTax),
        p_reference: reference.trim() || null,
        p_notes: notes.trim() || null,
        p_lines: validLines,
      });
      if (rpcError) throw rpcError;

      const result = data as { sale?: BusinessSale } | null;
      if (!result?.sale) throw new Error("The completed sale was not returned.");
      setSales((current) => [result.sale!, ...current.filter((sale) => sale.id !== result.sale!.id)]);
      await refreshInventory();
      setNotice("Sale completed. Revenue, inventory and COGS were synchronized.");
      resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Sale could not be completed.");
    } finally {
      setBusy("");
    }
  }

  async function confirmRefund() {
    if (!refundSale || busy) return;
    setBusy("refund");
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("refund_business_sale", {
        p_sale_id: refundSale.id,
      });
      if (rpcError) throw rpcError;
      const result = data as { sale?: BusinessSale } | null;
      if (!result?.sale) throw new Error("The refunded sale was not returned.");
      setSales((current) => current.map((sale) => sale.id === result.sale!.id ? result.sale! : sale));
      await refreshInventory();
      setRefundSale(null);
      setNotice("Sale refunded. Stock was restored and the linked revenue transaction was removed.");
    } catch (refundError) {
      setError(refundError instanceof Error ? refundError.message : "Sale could not be refunded.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className={styles.shell}>
      <header className={styles.hero}>
        <div>
          <span>FICONTER BUSINESS · B6</span>
          <h1>Sales &amp; COGS</h1>
          <p>Record sales, reduce inventory and calculate product cost and gross profit from one atomic workflow.</p>
        </div>
        <button onClick={() => (showForm ? resetForm() : setShowForm(true))}>
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? "Close sale" : "New sale"}
        </button>
      </header>

      {notice ? <div className={styles.notice}>{notice}</div> : null}
      {error && !showForm ? <div className={styles.error}>{error}</div> : null}

      {showForm ? (
        <form className={styles.formCard} onSubmit={saveSale}>
          <div className={styles.formHead}>
            <div><span>COMPLETE SALE</span><h2>Create revenue and stock movements</h2></div>
            <small>Inventory quantities and weighted-average COGS are validated by Supabase.</small>
          </div>
          <div className={styles.formGrid}>
            <label>Sale number<input value={saleNumber} onChange={(event) => setSaleNumber(event.target.value)} required /></label>
            <label>Customer name<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Optional" /></label>
            <label>Customer email<input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} placeholder="Optional" /></label>
            <label>Sale date<input type="date" value={saleDate} onChange={(event) => setSaleDate(event.target.value)} required /></label>
            <label>Exact time<input type="time" step="60" value={saleTime} onChange={(event) => setSaleTime(event.target.value)} required /></label>
            <label>Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}</select></label>
            <label>Currency<select value={currency} onChange={(event) => setCurrency(event.target.value)}>{CURRENCY_CODES.map((code) => <option value={code} key={code}>{currencySymbol(code)} {code} — {currencyName(code)}</option>)}</select></label>
            <label>Discount<input type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label>
            <label>Tax<input type="number" min="0" step="0.01" value={tax} onChange={(event) => setTax(event.target.value)} /></label>
            <label>Reference<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Order, receipt or invoice" /></label>
            <label className={styles.full}>Notes<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          </div>

          <div className={styles.lineHead}>
            <div><span>SALE LINES</span><h3>Products and services</h3></div>
            <button type="button" onClick={() => setLines((current) => [...current, newLine()])}><Plus size={16} /> Add line</button>
          </div>
          <div className={styles.lineList}>
            {lines.map((line, index) => {
              const item = inventory.find((record) => record.id === line.inventory_item_id);
              return (
                <article className={styles.saleLine} key={line.key}>
                  <div className={styles.lineNumber}>{index + 1}</div>
                  <label>Inventory item<select value={line.inventory_item_id} onChange={(event) => selectInventory(line, event.target.value)}><option value="">Custom product or service</option>{inventory.filter((record) => record.status === "active" && finiteNumber(record.quantity_on_hand) > 0).map((record) => <option value={record.id} key={record.id}>{record.sku} · {record.name} · {finiteNumber(record.quantity_on_hand)} {record.unit}</option>)}</select></label>
                  <label>Item / service name<input value={line.item_name} onChange={(event) => updateLine(line.key, { item_name: event.target.value, inventory_item_id: line.inventory_item_id })} required /></label>
                  <label>Quantity<input type="number" min="0.001" max={item ? finiteNumber(item.quantity_on_hand) : undefined} step="0.001" value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} required /></label>
                  <label>Unit price ({currency})<input type="number" min="0" step="0.01" value={line.unit_price} onChange={(event) => updateLine(line.key, { unit_price: event.target.value })} required /></label>
                  <div className={styles.lineTotal}><span>Line total</span><strong>{saleMoney(finiteNumber(line.quantity) * finiteNumber(line.unit_price))}</strong>{item ? <small>{finiteNumber(item.quantity_on_hand)} {item.unit} available</small> : <small>No stock movement</small>}</div>
                  <button type="button" className={styles.removeLine} onClick={() => setLines((current) => current.length === 1 ? current : current.filter((record) => record.key !== line.key))} disabled={lines.length === 1} aria-label="Remove line"><Trash2 size={16} /></button>
                </article>
              );
            })}
          </div>

          <div className={styles.preview}>
            <div><span>Subtotal</span><strong>{saleMoney(lineSubtotal)}</strong></div>
            <div><span>Discount</span><strong>−{saleMoney(previewDiscount)}</strong></div>
            <div><span>Tax</span><strong>+{saleMoney(previewTax)}</strong></div>
            <div className={styles.previewTotal}><span>Customer total</span><strong>{saleMoney(previewTotal)}</strong></div>
          </div>
          {currency !== business.base_currency ? <p className={styles.exchangeNote}>Sale prices are entered in {currency}. FICONTER converts the completed sale to {business.base_currency}; inventory COGS remains valued in {business.base_currency}.</p> : null}
          {error ? <div className={styles.error}>{error}</div> : null}
          <button className={styles.primaryButton} disabled={busy === "save"}>{busy === "save" ? "Completing…" : "Complete sale"}</button>
        </form>
      ) : null}

      <div className={styles.summaryGrid}>
        <article><CircleDollarSign /><span>Net sales</span><strong>{money(netSales)}</strong></article>
        <article><PackageCheck /><span>Cost of goods sold</span><strong>{money(cogs)}</strong></article>
        <article className={grossProfit >= 0 ? styles.good : styles.bad}><TrendingUp /><span>Gross profit</span><strong>{money(grossProfit)}</strong></article>
        <article><ReceiptText /><span>Gross margin</span><strong>{grossMargin.toFixed(1)}%</strong></article>
        <article><ShoppingCart /><span>Completed sales</span><strong>{completed.length}</strong></article>
        <article><PackageCheck /><span>Units sold</span><strong>{unitsSold.toFixed(3).replace(/\.000$/, "")}</strong></article>
        <article><CircleDollarSign /><span>Average sale</span><strong>{money(averageSale)}</strong></article>
        <article><CalendarDays /><span>Selected period</span><strong>{monthFilter === "all" ? "All time" : monthFilter}</strong></article>
      </div>

      <div className={styles.filters}>
        <label><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sale, customer or reference" /></label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="completed">Completed</option><option value="refunded">Refunded</option></select>
        <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}><option value="all">All months</option>{[monthKey(), ...months.filter((month) => month !== monthKey())].map((month) => <option key={month} value={month}>{month}</option>)}</select>
      </div>

      <div className={`${styles.salesList} ficonter-scroll-region`}>
        {visibleSales.length ? visibleSales.map((sale) => {
          const margin = finiteNumber(sale.net_sales_base) > 0 ? finiteNumber(sale.gross_profit_base) / finiteNumber(sale.net_sales_base) * 100 : 0;
          return (
            <article className={styles.saleRow} key={sale.id}>
              <div className={styles.saleIcon}><ShoppingCart size={20} /></div>
              <div className={styles.saleIdentity}><div><strong>{sale.sale_number}</strong><span className={`${styles.status} ${styles[sale.status]}`}>{sale.status}</span></div><span>{sale.customer_name || "Walk-in customer"} · {new Date(sale.occurred_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span><small>{sale.line_count} line{sale.line_count === 1 ? "" : "s"} · {finiteNumber(sale.units_sold)} units · {sale.payment_method || "Payment method not set"}</small></div>
              <div className={styles.saleMetrics}><div><span>Total</span><strong>{money(sale.total_base)}</strong></div><div><span>COGS</span><strong>{money(sale.cogs_base)}</strong></div><div><span>Gross profit</span><strong>{money(sale.gross_profit_base)}</strong><small>{margin.toFixed(1)}% margin</small></div></div>
              <div className={styles.saleActions}>{sale.status === "completed" ? <button onClick={() => setRefundSale(sale)} title="Refund sale"><RotateCcw size={17} /> Refund</button> : <span>Stock restored</span>}</div>
            </article>
          );
        }) : <div className={styles.empty}><ShoppingCart size={35} /><h2>No matching sales</h2><p>Complete the first sale or change the current filters.</p></div>}
      </div>

      {refundSale ? (
        <div className={styles.backdrop}>
          <section className={styles.modal}>
            <button className={styles.modalClose} onClick={() => setRefundSale(null)}><X size={18} /></button>
            <RotateCcw className={styles.modalIcon} />
            <span>REFUND SALE</span>
            <h2>Refund {refundSale.sale_number}?</h2>
            <p>The linked revenue transaction will be removed and every inventory item from this sale will be restored at its original weighted-average cost.</p>
            <div className={styles.modalActions}><button onClick={() => setRefundSale(null)}>Keep sale</button><button className={styles.dangerButton} disabled={busy === "refund"} onClick={confirmRefund}>{busy === "refund" ? "Refunding…" : "Refund sale"}</button></div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
