"use client";

import { FormEvent, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  Download,
  FileText,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { notifyFiconterDataChange } from "@/lib/ficonterRealtime";
import { getExchangeRate } from "@/lib/performance/exchangeRateCache";
import { convertToReportingCurrency, finiteNumber, roundMoney, roundRate, sumMoney } from "@/lib/finance/money";
import { createTransactionsPdf, triggerDownload } from "@/lib/accountExport";
import {
  CATEGORY_GROUPS,
  CURRENCY_CODES,
  TRANSACTION_TYPES,
  TYPE_BY_VALUE,
  currencyName,
  currencySymbol,
  formatCurrency,
  type FlowDirection,
} from "@/lib/financialOptions";
import styles from "./TransactionLedger.module.css";

type Transaction = {
  id: string;
  description: string;
  amount: number | string;
  currency: string;
  type: string;
  category: string;
  transaction_date: string;
  occurred_at: string | null;
  created_at?: string | null;
  amount_eur: number | string;
  exchange_rate_to_eur: number | string;
  exchange_rate_date: string | null;
  exchange_rate_source: string | null;
};

type Props = { transactions: Transaction[] };
type DirectionFilter = "all" | FlowDirection;
type SortMode = "newest" | "oldest" | "highest" | "lowest" | "description";

const ledgerDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZoneName: "short",
});

const readableDateTime = (value: string | null, fallbackDate: string) => {
  const date = value ? new Date(value) : new Date(`${fallbackDate}T00:00:00`);
  return ledgerDateTimeFormatter.format(date);
};

const toLocalDateTimeInput = (value: string | null, fallbackDate: string) => {
  const date = value ? new Date(value) : new Date(`${fallbackDate}T12:00:00`);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
const directionOf = (type: string): FlowDirection => TYPE_BY_VALUE[type]?.direction ?? (type === "income" ? "inflow" : "outflow");
const typeLabel = (type: string) => TYPE_BY_VALUE[type]?.label ?? type.replaceAll("_", " ");

const groupedTypes = TRANSACTION_TYPES.reduce<Record<string, typeof TRANSACTION_TYPES>>(
  (groups, option) => {
    groups[option.group] ??= [];
    groups[option.group].push(option);
    return groups;
  },
  {},
);

function signedEuroValue(item: Transaction) {
  const direction = directionOf(item.type);
  const sign = direction === "inflow" ? 1 : direction === "outflow" ? -1 : 0;
  return finiteNumber(item.amount_eur ?? item.amount) * sign;
}

export function TransactionLedger({ transactions: initialTransactions }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [visibleLimit, setVisibleLimit] = useState(120);
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [dateFromDraft, setDateFromDraft] = useState("");
  const [dateToDraft, setDateToDraft] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [customEditCategory, setCustomEditCategory] = useState("");
  const [editCurrency, setEditCurrency] = useState("EUR");
  const [editAmount, setEditAmount] = useState("");
  const [editOccurredAt, setEditOccurredAt] = useState("");
  const [editRate, setEditRate] = useState({ rate: 1, date: new Date().toISOString().slice(0, 10), source: "identity" });
  const [editRateLoading, setEditRateLoading] = useState(false);
  const [editRateError, setEditRateError] = useState("");
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    function handleCreated(event: Event) {
      const created = (event as CustomEvent<Transaction>).detail;
      if (!created?.id) return;

      setTransactions((current) => {
        const withoutDuplicate = current.filter((item) => item.id !== created.id);
        return [created, ...withoutDuplicate];
      });
      // A newly created record must always be visible immediately, even if
      // the user previously had filters or an older sort order selected.
      setSearch("");
      setDirectionFilter("all");
      setCategoryFilter("all");
      setCurrencyFilter("all");
      setMonthFilter("all");
      setDateFromDraft("");
      setDateToDraft("");
      setDateFrom("");
      setDateTo("");
      setSelectedIds(new Set());
      setSortMode("newest");
      setNotice("Transaction saved and added to your ledger.");
      window.setTimeout(() => setNotice(""), 2600);
    }

    function handleSaveFailed(event: Event) {
      const failedId = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (!failedId) return;
      setTransactions((current) => current.filter((item) => item.id !== failedId));
      setError("The transaction could not be saved. Please try again.");
    }

    window.addEventListener("ficonter:transaction-created", handleCreated);
    window.addEventListener("ficonter:transaction-save-failed", handleSaveFailed);
    return () => {
      window.removeEventListener("ficonter:transaction-created", handleCreated);
      window.removeEventListener("ficonter:transaction-save-failed", handleSaveFailed);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function subscribeToLiveTransactions() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted || !user) return;

      channel = supabase
        .channel(`transaction-ledger-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "transactions",
            filter: `user_id=eq.${user.id}`,
          },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            setTransactions((current) => {
              if (payload.eventType === "DELETE") {
                const deletedId = (payload.old as { id?: string }).id;
                return current.filter((item) => item.id !== deletedId);
              }

              const changed = payload.new as Transaction;
              if (!changed?.id) return current;
              return [changed, ...current.filter((item) => item.id !== changed.id)];
            });
          },
        )
        .subscribe();
    }

    void subscribeToLiveTransactions();
    return () => {
      mounted = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase]);

  const categories = useMemo(
    () => [...new Set(transactions.map((item) => item.category))].sort(),
    [transactions],
  );
  const currencies = useMemo(
    () => [...new Set(transactions.map((item) => item.currency || "EUR"))].sort(),
    [transactions],
  );
  const months = useMemo(() => {
    const values = [...new Set(transactions.map((item) => item.transaction_date.slice(0, 7)))];
    return values.sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const visible = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return transactions
      .filter((item) => {
        const matchesSearch =
          !query ||
          item.description.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          typeLabel(item.type).toLowerCase().includes(query) ||
          (item.currency || "EUR").toLowerCase().includes(query);
        const matchesDirection = directionFilter === "all" || directionOf(item.type) === directionFilter;
        const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
        const matchesCurrency = currencyFilter === "all" || (item.currency || "EUR") === currencyFilter;
        const matchesMonth = monthFilter === "all" || item.transaction_date.startsWith(monthFilter);
        const matchesDateFrom = !dateFrom || item.transaction_date >= dateFrom;
        const matchesDateTo = !dateTo || item.transaction_date <= dateTo;
        return matchesSearch && matchesDirection && matchesCategory && matchesCurrency && matchesMonth && matchesDateFrom && matchesDateTo;
      })
      .sort((a, b) => {
        if (sortMode === "oldest") return (a.occurred_at ?? a.transaction_date).localeCompare(b.occurred_at ?? b.transaction_date);
        if (sortMode === "highest") return finiteNumber(b.amount_eur ?? b.amount) - finiteNumber(a.amount_eur ?? a.amount);
        if (sortMode === "lowest") return finiteNumber(a.amount_eur ?? a.amount) - finiteNumber(b.amount_eur ?? b.amount);
        if (sortMode === "description") return a.description.localeCompare(b.description);
        return (b.occurred_at ?? b.transaction_date).localeCompare(a.occurred_at ?? a.transaction_date);
      });
  }, [transactions, deferredSearch, directionFilter, categoryFilter, currencyFilter, monthFilter, dateFrom, dateTo, sortMode]);

  const renderedVisible = useMemo(
    () => visible.slice(0, visibleLimit),
    [visible, visibleLimit],
  );

  useEffect(() => {
    setVisibleLimit(120);
  }, [
    deferredSearch,
    directionFilter,
    categoryFilter,
    currencyFilter,
    monthFilter,
    dateFrom,
    dateTo,
    sortMode,
  ]);

  const visibleIds = useMemo(() => new Set(visible.map((item) => item.id)), [visible]);
  const selectedTransactions = useMemo(
    () => visible.filter((item) => selectedIds.has(item.id)),
    [visible, selectedIds],
  );
  const allVisibleSelected = visible.length > 0 && visible.every((item) => selectedIds.has(item.id));
  const someVisibleSelected = visible.some((item) => selectedIds.has(item.id));

  useEffect(() => {
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      if (next.size === current.size && [...next].every((id) => current.has(id))) return current;
      return next;
    });
  }, [visibleIds]);

  const totals = useMemo(() => {
    const inflowValues: unknown[] = [];
    const outflowValues: unknown[] = [];
    const netValues: unknown[] = [];
    let neutralCount = 0;
    visible.forEach((item) => {
      const direction = directionOf(item.type);
      const euro = finiteNumber(item.amount_eur ?? item.amount);
      if (direction === "inflow") inflowValues.push(euro);
      else if (direction === "outflow") outflowValues.push(euro);
      else neutralCount += 1;
      netValues.push(signedEuroValue(item));
    });
    return {
      inflow: sumMoney(inflowValues),
      outflow: sumMoney(outflowValues),
      net: sumMoney(netValues),
      neutralCount,
    };
  }, [visible]);


  function clearFilters() {
    setSearch("");
    setDirectionFilter("all");
    setCategoryFilter("all");
    setCurrencyFilter("all");
    setMonthFilter("all");
    setDateFromDraft("");
    setDateToDraft("");
    setDateFrom("");
    setDateTo("");
    setSelectedIds(new Set());
    setSortMode("newest");
    setError("");
  }

  function applyDateRange() {
    setError("");
    if (dateFromDraft && dateToDraft && dateFromDraft > dateToDraft) {
      setError("The From date must be earlier than or equal to the To date.");
      return;
    }
    setDateFrom(dateFromDraft);
    setDateTo(dateToDraft);
    setSelectedIds(new Set());
  }

  function clearDateRange() {
    setDateFromDraft("");
    setDateToDraft("");
    setDateFrom("");
    setDateTo("");
    setSelectedIds(new Set());
    setError("");
  }

  function toggleTransaction(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visible.forEach((item) => next.delete(item.id));
      else visible.forEach((item) => next.add(item.id));
      return next;
    });
  }

  const exportDateSuffix = dateFrom || dateTo
    ? `${dateFrom || "start"}-to-${dateTo || "present"}`
    : new Date().toISOString().slice(0, 10);

  function exportCsv(items: Transaction[], scope: "view" | "selected") {
    if (!items.length) return;
    const header = ["Description", "Category", "Occurred at", "Transaction type", "Direction", "Currency", "Original amount", "EUR amount", "Rate to EUR", "Rate date"];
    const rows = items.map((item) => [
      item.description,
      item.category,
      item.occurred_at ?? item.transaction_date,
      typeLabel(item.type),
      directionOf(item.type),
      item.currency,
      finiteNumber(item.amount).toFixed(2),
      finiteNumber(item.amount_eur ?? item.amount).toFixed(2),
      finiteNumber(item.exchange_rate_to_eur ?? 1).toFixed(8),
      item.exchange_rate_date ?? "",
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ficonter-transactions-${scope}-${exportDateSuffix}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(scope === "selected" ? "Selected transactions exported to CSV." : "Current transaction view exported to CSV.");
    window.setTimeout(() => setNotice(""), 2600);
  }

  async function exportPdf(items: Transaction[], scope: "view" | "selected") {
    if (!items.length || exportingPdf) return;
    setExportingPdf(true);
    setError("");

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Your account could not be verified for this export.");

      const metadata = user.user_metadata as Record<string, unknown> | undefined;
      const ownerName = String(
        metadata?.display_name ?? metadata?.full_name ?? user.email ?? "FICONTER account holder",
      );
      const exportedAt = new Date().toISOString();
      const pdf = await createTransactionsPdf(
        items.map((transaction) => ({
          description: transaction.description,
          category: transaction.category,
          type: typeLabel(transaction.type),
          direction: directionOf(transaction.type),
          currency: transaction.currency || "EUR",
          amount: finiteNumber(transaction.amount),
          amount_eur: finiteNumber(transaction.amount_eur ?? transaction.amount),
          occurred_at: transaction.occurred_at ?? `${transaction.transaction_date}T00:00:00`,
        })),
        { ownerName, email: user.email ?? "", locale: "en-US", exportedAt },
      );

      triggerDownload(`ficonter-transactions-${scope}-${exportDateSuffix}.pdf`, pdf);
      setNotice(scope === "selected" ? "Selected transactions exported to PDF." : "Current transaction view exported to PDF.");
      window.setTimeout(() => setNotice(""), 2600);
    } catch (pdfError) {
      setError(pdfError instanceof Error ? pdfError.message : "The PDF export could not be created.");
    } finally {
      setExportingPdf(false);
    }
  }

  function openEdit(transaction: Transaction) {
    const isKnownCategory = CATEGORY_GROUPS.some((group) => group.items.includes(transaction.category));
    setEditCategory(isKnownCategory ? transaction.category : "Other / custom");
    setCustomEditCategory(isKnownCategory ? "" : transaction.category);
    setEditCurrency(transaction.currency || "EUR");
    setEditAmount(String(transaction.amount));
    setEditOccurredAt(toLocalDateTimeInput(transaction.occurred_at, transaction.transaction_date));
    setEditRate({
      rate: roundRate(transaction.exchange_rate_to_eur ?? 1),
      date: transaction.exchange_rate_date ?? new Date().toISOString().slice(0, 10),
      source: transaction.exchange_rate_source ?? (transaction.currency === "EUR" ? "identity" : "Frankfurter"),
    });
    setEditRateError("");
    setError("");
    setEditTarget(transaction);
  }

  useEffect(() => {
    if (!editTarget) return;
    const controller = new AbortController();
    if (editCurrency === "EUR") {
      setEditRate({ rate: 1, date: new Date().toISOString().slice(0, 10), source: "identity" });
      setEditRateError("");
      setEditRateLoading(false);
      return () => controller.abort();
    }
    async function loadEditRate() {
      setEditRateLoading(true);
      setEditRateError("");
      try {
        const data = await getExchangeRate(editCurrency, "EUR", {
          signal: controller.signal,
        });
        setEditRate({ rate: data.rate, date: data.date, source: data.source });
      } catch (rateFetchError) {
        if ((rateFetchError as Error).name !== "AbortError") setEditRateError((rateFetchError as Error).message);
      } finally {
        if (!controller.signal.aborted) setEditRateLoading(false);
      }
    }
    void loadEditRate();
    return () => controller.abort();
  }, [editCurrency, editTarget]);

  async function deleteTransactions(ids: string[], mode: "single" | "bulk") {
    if (!ids.length || loading) return;
    setLoading(true);
    setError("");

    const { data, error: deleteError } = await supabase.rpc(
      "delete_transactions_with_linked_bills",
      { p_transaction_ids: ids },
    );

    if (deleteError) {
      setError(deleteError.message);
    } else {
      const result = data as {
        deleted_transaction_count?: number;
        deleted_bill_count?: number;
        reversed_debt_payment_count?: number;
      } | null;
      const deletedBillCount = Number(result?.deleted_bill_count ?? 0);
      const reversedDebtPaymentCount = Number(
        result?.reversed_debt_payment_count ?? 0,
      );
      const deletedIdSet = new Set(ids);
      setTransactions((current) => current.filter((item) => !deletedIdSet.has(item.id)));
      setSelectedIds((current) => new Set([...current].filter((id) => !deletedIdSet.has(id))));
      setDeleteTarget(null);
      setBulkDeleteOpen(false);
      notifyFiconterDataChange("transactions");

      if (mode === "bulk") {
        const linkedChanges: string[] = [];
        if (deletedBillCount > 0) {
          linkedChanges.push(
            `${deletedBillCount} linked ${
              deletedBillCount === 1 ? "bill" : "bills"
            } deleted`,
          );
        }
        if (reversedDebtPaymentCount > 0) {
          linkedChanges.push(
            `${reversedDebtPaymentCount} debt ${
              reversedDebtPaymentCount === 1 ? "payment" : "payments"
            } reversed`,
          );
        }
        setNotice(
          linkedChanges.length
            ? `${ids.length} transactions deleted; ${linkedChanges.join(" and ")}.`
            : `${ids.length} transactions deleted.`,
        );
      } else if (deletedBillCount > 0 && reversedDebtPaymentCount > 0) {
        setNotice(
          "Transaction deleted, linked bill removed and debt balance restored.",
        );
      } else if (deletedBillCount > 0) {
        setNotice("Transaction and linked bill deleted.");
      } else if (reversedDebtPaymentCount > 0) {
        setNotice("Transaction deleted and debt balance restored.");
      } else {
        setNotice("Transaction deleted.");
      }
      window.setTimeout(() => setNotice(""), 3000);
    }
    setLoading(false);
  }

  async function deleteTransaction() {
    if (!deleteTarget) return;
    await deleteTransactions([deleteTarget.id], "single");
  }

  async function deleteSelectedTransactions() {
    await deleteTransactions(selectedTransactions.map((item) => item.id), "bulk");
  }

  async function updateTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTarget) return;
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const finalCategory = editCategory === "Other / custom" ? customEditCategory.trim() : editCategory;
    if (!finalCategory) {
      setError("Please enter a custom category.");
      setLoading(false);
      return;
    }
    if (editCurrency !== "EUR" && (editRateLoading || editRateError || !editRate.rate)) {
      setError("A valid EUR exchange rate is required before saving changes.");
      setLoading(false);
      return;
    }
    const occurred = new Date(editOccurredAt);
    if (Number.isNaN(occurred.getTime())) {
      setError("Please choose a valid transaction date and time.");
      setLoading(false);
      return;
    }
    const originalAmount = roundMoney(form.get("amount"));
    const description = String(form.get("description") ?? "").trim();
    if (!description) {
      setError("Please enter a description.");
      setLoading(false);
      return;
    }
    if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
      setError("Please enter an amount greater than zero.");
      setLoading(false);
      return;
    }
    const update = {
      description,
      amount: roundMoney(originalAmount),
      currency: editCurrency,
      amount_eur: convertToReportingCurrency(originalAmount, editRate.rate),
      exchange_rate_to_eur: roundRate(editRate.rate),
      exchange_rate_date: editRate.date,
      exchange_rate_source: editRate.source,
      type: String(form.get("type")),
      category: finalCategory,
      transaction_date: editOccurredAt.slice(0, 10),
      occurred_at: occurred.toISOString(),
    };
    const { data, error: updateError } = await supabase
      .from("transactions")
      .update(update)
      .eq("id", editTarget.id)
      .select("id,description,amount,currency,amount_eur,exchange_rate_to_eur,exchange_rate_date,exchange_rate_source,type,category,transaction_date,occurred_at,created_at")
      .single();
    if (updateError) setError(updateError.message);
    else if (data) {
      setTransactions((current) => current.map((item) => (item.id === data.id ? data : item)));
      setEditTarget(null);
      notifyFiconterDataChange("transactions");
      setNotice("Transaction updated.");
      window.setTimeout(() => setNotice(""), 2600);
    }
    setLoading(false);
  }

  if (!transactions.length) return <div className={styles.empty}>No transactions yet.</div>;

  return (
    <>
      <div className={styles.toolbarTop}>
        <label className={styles.searchBox}>
          <Search size={17} aria-hidden="true" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search description, category, type or currency" aria-label="Search transactions" />
        </label>
        <button className={styles.secondaryAction} type="button" onClick={clearFilters}><RotateCcw size={16} /> Reset</button>
        <button className={styles.exportButton} type="button" onClick={() => exportCsv(visible, "view")} disabled={!visible.length}><Download size={16} /> Export CSV</button>
        <button className={styles.exportButton} type="button" onClick={() => void exportPdf(visible, "view")} disabled={!visible.length || exportingPdf}><FileText size={16} /> {exportingPdf ? "Preparing PDF…" : "Export PDF"}</button>
      </div>

      <section className={styles.dateRangeCard} aria-label="Filter transactions by date range">
        <div className={styles.dateRangeHeading}>
          <CalendarRange size={18} aria-hidden="true" />
          <div><strong>Date range</strong><span>Show and export transactions from a specific period.</span></div>
        </div>
        <label>From<input type="date" value={dateFromDraft} max={dateToDraft || undefined} onChange={(event) => setDateFromDraft(event.target.value)} /></label>
        <label>To<input type="date" value={dateToDraft} min={dateFromDraft || undefined} onChange={(event) => setDateToDraft(event.target.value)} /></label>
        <button className={styles.dateApplyButton} type="button" onClick={applyDateRange}>Apply</button>
        <button className={styles.dateClearButton} type="button" onClick={clearDateRange} disabled={!dateFromDraft && !dateToDraft && !dateFrom && !dateTo}>Clear</button>
      </section>

      <div className={`${styles.toolbar} ${styles.toolbarFive}`}>
        <select value={directionFilter} onChange={(event) => setDirectionFilter(event.target.value as DirectionFilter)}>
          <option value="all">All money movements</option>
          <option value="inflow">Money received</option>
          <option value="outflow">Money spent</option>
          <option value="neutral">Transfers / adjustments</option>
        </select>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select>
        <select value={currencyFilter} onChange={(event) => setCurrencyFilter(event.target.value)}><option value="all">All currencies</option>{currencies.map((currency) => <option key={currency} value={currency}>{currencySymbol(currency)} {currency} — {currencyName(currency)}</option>)}</select>
        <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}><option value="all">All months</option>{months.map((month) => <option key={month} value={month}>{new Date(`${month}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</option>)}</select>
        <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest">Highest amount</option><option value="lowest">Lowest amount</option><option value="description">Description A–Z</option></select>
      </div>

      <div className={styles.summary}>
        <div><TrendingUp size={18} /><span>Money received</span><strong className={styles.positive}>{formatCurrency(totals.inflow, "EUR")}</strong></div>
        <div><TrendingDown size={18} /><span>Money spent</span><strong className={styles.negative}>{formatCurrency(totals.outflow, "EUR")}</strong></div>
        <div><WalletCards size={18} /><span>Net movement by currency</span><strong>{formatCurrency(totals.net, "EUR")}</strong></div>
      </div>

      {notice && <div className={styles.notice}>{notice}</div>}
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.selectionBar}>
        <label className={styles.selectAllControl}>
          <input
            type="checkbox"
            checked={allVisibleSelected}
            aria-checked={someVisibleSelected && !allVisibleSelected ? "mixed" : allVisibleSelected}
            onChange={toggleAllVisible}
            disabled={!visible.length}
          />
          <span>Select all visible</span>
        </label>
        <span className={styles.selectionCount}>{selectedTransactions.length} selected</span>
        {selectedTransactions.length > 0 && (
          <div className={styles.bulkActions}>
            <button type="button" onClick={() => exportCsv(selectedTransactions, "selected")}><Download size={15} /> Export selected CSV</button>
            <button type="button" onClick={() => void exportPdf(selectedTransactions, "selected")} disabled={exportingPdf}><FileText size={15} /> Export selected PDF</button>
            <button className={styles.bulkDeleteButton} type="button" onClick={() => setBulkDeleteOpen(true)}><Trash2 size={15} /> Delete selected</button>
            <button type="button" onClick={() => setSelectedIds(new Set())}>Clear selection</button>
          </div>
        )}
      </div>

      <div
        className={`${styles.listViewport} ficonter-scroll-region`}
        tabIndex={visible.length > 10 ? 0 : undefined}
        aria-label="Transaction history. The newest ten transactions are visible first; scroll for older records."
      >
        <div className={styles.list}>
        {renderedVisible.map((transaction) => {
          const direction = directionOf(transaction.type);
          return (
            <article className={`${styles.row} ${selectedIds.has(transaction.id) ? styles.selectedRow : ""}`} key={transaction.id}>
              <label className={styles.rowCheckbox}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(transaction.id)}
                  onChange={() => toggleTransaction(transaction.id)}
                  aria-label={`Select ${transaction.description}`}
                />
              </label>
              <div className={direction === "inflow" ? styles.incomeMark : direction === "outflow" ? styles.expenseMark : styles.neutralMark} />
              <div className={styles.details}><strong>{transaction.description}</strong><span>{transaction.category} · {typeLabel(transaction.type)} · {readableDateTime(transaction.occurred_at, transaction.transaction_date)}</span></div>
              <div className={styles.amountBlock}>
                <strong className={direction === "inflow" ? styles.positive : direction === "outflow" ? styles.negative : ""}>{direction === "inflow" ? "+" : direction === "outflow" ? "-" : ""}{formatCurrency(finiteNumber(transaction.amount_eur ?? transaction.amount), "EUR")}</strong>
                <span>{transaction.currency === "EUR" ? "Original currency EUR" : `${formatCurrency(finiteNumber(transaction.amount), transaction.currency)} · 1 ${transaction.currency} = ${finiteNumber(transaction.exchange_rate_to_eur).toFixed(6)} EUR`}</span>
              </div>
              <div className={styles.actions}><button type="button" onClick={() => openEdit(transaction)} aria-label="Edit transaction"><Pencil size={17} /><span>Edit</span></button><button className={styles.deleteButton} type="button" onClick={() => { setError(""); setDeleteTarget(transaction); }} aria-label="Delete transaction"><Trash2 size={17} /><span>Delete</span></button></div>
            </article>
          );
        })}
        </div>
      </div>
      {visible.length > 10 ? (
        <div className={styles.scrollHint}>
          Rendering {Math.min(renderedVisible.length, visible.length)} of {visible.length} matching records
          {renderedVisible.length < visible.length ? (
            <button
              type="button"
              className={styles.loadMoreButton}
              onClick={() => setVisibleLimit((current) => current + 120)}
            >
              Load 120 more
            </button>
          ) : null}
        </div>
      ) : null}
      {!visible.length && <div className={styles.empty}>No transactions match your filters.</div>}

      {editTarget && (
        <div className={styles.backdrop} onMouseDown={() => !loading && setEditTarget(null)}>
          <div className={styles.modal} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <button className={styles.close} type="button" onClick={() => setEditTarget(null)}><X size={18} /></button>
            <small>LEDGER ADJUSTMENT</small><h3>Edit transaction</h3>
            <form onSubmit={updateTransaction}>
              <label>Description<input name="description" defaultValue={editTarget.description} required /></label>
              <div className={styles.formGrid}>
                <label>Amount<input name="amount" type="number" min="0.01" step="0.01" value={editAmount} onChange={(event) => setEditAmount(event.target.value)} required /></label>
                <label>Currency<select name="currency" value={editCurrency} onChange={(event) => setEditCurrency(event.target.value)}>{CURRENCY_CODES.map((code) => <option key={code} value={code}>{currencySymbol(code)} {code} — {currencyName(code)}</option>)}</select></label>
              </div>
              <label>Transaction type<select name="type" defaultValue={editTarget.type}>{Object.entries(groupedTypes).map(([group, options]) => <optgroup key={group} label={group}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>)}</select></label>
              <div className={styles.formGrid}>
                <label>Category<select value={editCategory} onChange={(event) => setEditCategory(event.target.value)}>{CATEGORY_GROUPS.map((group) => <optgroup key={group.group} label={group.group}>{group.items.map((item) => <option key={item} value={item}>{item}</option>)}</optgroup>)}</select></label>
                <label>Exact date and time<input name="occurred_at" type="datetime-local" value={editOccurredAt} onChange={(event) => setEditOccurredAt(event.target.value)} required /></label>
              </div>
              {editCategory === "Other / custom" && <label>Custom category<input value={customEditCategory} onChange={(event) => setCustomEditCategory(event.target.value)} required /></label>}
              <div className={styles.fxPreview}>{editRateLoading ? "Retrieving EUR rate…" : editRateError ? editRateError : `EUR equivalent: ${formatCurrency(convertToReportingCurrency(editAmount, editRate.rate), "EUR")} · 1 ${editCurrency} = ${editRate.rate.toFixed(6)} EUR`}</div>
              {error && <div className={styles.error}>{error}</div>}
              <div className={styles.modalActions}><button type="button" onClick={() => setEditTarget(null)} disabled={loading}>Cancel</button><button className={styles.primaryButton} type="submit" disabled={loading}>{loading ? "Saving…" : "Save changes"}</button></div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className={styles.backdrop} onMouseDown={() => !loading && setDeleteTarget(null)}>
          <div className={`${styles.modal} ${styles.smallModal}`} onMouseDown={(event) => event.stopPropagation()} role="alertdialog" aria-modal="true">
            <button className={styles.close} type="button" onClick={() => setDeleteTarget(null)}><X size={18} /></button>
            <small>PERMANENT ACTION</small><h3>Delete transaction?</h3><p>“{deleteTarget.description}” will be permanently removed. A linked Bill will also be removed. If this is a debt-payment transaction, the payment will be reversed and the outstanding debt balance restored.</p>
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.modalActions}><button type="button" onClick={() => setDeleteTarget(null)} disabled={loading}>Cancel</button><button className={styles.dangerButton} type="button" data-enter-confirm="true" onClick={deleteTransaction} disabled={loading}>{loading ? "Deleting…" : "Delete transaction"}</button></div>
          </div>
        </div>
      )}

      {bulkDeleteOpen && (
        <div className={styles.backdrop} onMouseDown={() => !loading && setBulkDeleteOpen(false)}>
          <div className={`${styles.modal} ${styles.smallModal}`} onMouseDown={(event) => event.stopPropagation()} role="alertdialog" aria-modal="true" aria-labelledby="bulk-delete-title">
            <button className={styles.close} type="button" onClick={() => setBulkDeleteOpen(false)}><X size={18} /></button>
            <small>PERMANENT BULK ACTION</small>
            <h3 id="bulk-delete-title">Delete {selectedTransactions.length} transactions?</h3>
            <p>The selected transactions will be permanently removed. Linked Bills will be deleted, while linked debt payments will be reversed and their outstanding balances restored in the same atomic action.</p>
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setBulkDeleteOpen(false)} disabled={loading}>Cancel</button>
              <button className={styles.dangerButton} type="button" data-enter-confirm="true" onClick={() => void deleteSelectedTransactions()} disabled={loading || !selectedTransactions.length}>{loading ? "Deleting…" : "Delete selected"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
