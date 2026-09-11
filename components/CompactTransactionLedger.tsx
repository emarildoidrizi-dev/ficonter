"use client";

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  BriefcaseBusiness,
  Car,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileText,
  HeartPulse,
  Home,
  Landmark,
  LockKeyhole,
  PiggyBank,
  ReceiptText,
  Search,
  ShoppingBag,
  Train,
  Trash2,
  TrendingDown,
  TrendingUp,
  Utensils,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyFiconterDataChange } from "@/lib/ficonterRealtime";
import { useCurrencyDisplay, useHistoricalReportingRates } from "@/components/CurrencyDisplayProvider";
import { originalAmountInBaseCurrency } from "@/lib/finance/baseCurrencyActuals";
import { finiteNumber, sumMoney } from "@/lib/finance/money";
import {
  CURRENCY_CODES,
  TYPE_BY_VALUE,
  currencyName,
  currencySymbol,
  formatCurrency,
  type FlowDirection,
} from "@/lib/financialOptions";
import { createTransactionsPdf, triggerDownload } from "@/lib/accountExport";
import type { DecryptedTransaction } from "@/lib/e2ee/transactionPayload";
import styles from "./CompactTransactionLedger.module.css";

type Props = {
  transactions: DecryptedTransaction[];
  allowMultiCurrency?: boolean;
  allowPdfExport?: boolean;
};

type DirectionFilter = "all" | FlowDirection;
type SortMode = "newest" | "oldest" | "highest" | "lowest" | "description";

const rowDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const directionOf = (type: string): FlowDirection =>
  TYPE_BY_VALUE[type]?.direction ?? (type === "income" ? "inflow" : "outflow");

const typeLabel = (type: string) =>
  TYPE_BY_VALUE[type]?.label ?? type.replaceAll("_", " ");

const csvCell = (value: string | number) =>
  `"${String(value).replaceAll('"', '""')}"`;

function transactionDate(transaction: DecryptedTransaction) {
  const value = transaction.occurred_at
    ? new Date(transaction.occurred_at)
    : new Date(`${transaction.transaction_date}T12:00:00`);
  return rowDateFormatter.format(value);
}

function categoryIcon(transaction: DecryptedTransaction): LucideIcon {
  const category = transaction.category.toLowerCase();
  const type = transaction.type.toLowerCase();

  if (category.includes("housing") || category.includes("rent") || category.includes("home")) return Home;
  if (category.includes("transport") || category.includes("train") || category.includes("public transportation")) return Train;
  if (category.includes("car") || category.includes("vehicle")) return Car;
  if (category.includes("food") || category.includes("restaurant") || category.includes("grocer")) return Utensils;
  if (category.includes("shopping") || category.includes("clothing")) return ShoppingBag;
  if (category.includes("health") || category.includes("medical")) return HeartPulse;
  if (category.includes("subscription") || category.includes("utilities") || category.includes("bill")) return ReceiptText;
  if (category.includes("saving") || type.includes("saving")) return PiggyBank;
  if (category.includes("salary") || category.includes("income") || directionOf(transaction.type) === "inflow") return BriefcaseBusiness;
  if (type.includes("debt") || category.includes("debt") || category.includes("loan")) return Landmark;
  if (type.includes("transfer") || directionOf(transaction.type) === "neutral") return WalletCards;
  return CircleDollarSign;
}

export function CompactTransactionLedger({
  transactions,
  allowMultiCurrency = true,
  allowPdfExport = true,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { baseCurrency } = useCurrencyDisplay();
  const { rateForDate } = useHistoricalReportingRates(
    transactions.map((transaction) => transaction.transaction_date),
  );

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const displayedAmountFor = useCallback(
    (transaction: DecryptedTransaction) =>
      originalAmountInBaseCurrency({
        originalAmount: transaction.amount,
        originalCurrency: transaction.currency,
        amountEur: transaction.amount_eur,
        baseCurrency,
        euroToBaseRate: rateForDate(transaction.transaction_date),
      }),
    [baseCurrency, rateForDate],
  );

  const categories = useMemo(
    () => [...new Set(transactions.map((item) => item.category).filter(Boolean))].sort(),
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
        return matchesSearch && matchesDirection && matchesCategory && matchesCurrency && matchesMonth;
      })
      .sort((a, b) => {
        if (sortMode === "oldest") return (a.occurred_at ?? a.transaction_date).localeCompare(b.occurred_at ?? b.transaction_date);
        if (sortMode === "highest") return finiteNumber(b.amount_eur ?? b.amount) - finiteNumber(a.amount_eur ?? a.amount);
        if (sortMode === "lowest") return finiteNumber(a.amount_eur ?? a.amount) - finiteNumber(b.amount_eur ?? b.amount);
        if (sortMode === "description") return a.description.localeCompare(b.description);
        return (b.occurred_at ?? b.transaction_date).localeCompare(a.occurred_at ?? a.transaction_date);
      });
  }, [transactions, deferredSearch, directionFilter, categoryFilter, currencyFilter, monthFilter, sortMode]);

  const visibleIds = useMemo(() => new Set(visible.map((item) => item.id)), [visible]);
  const selectedTransactions = useMemo(
    () => visible.filter((item) => selectedIds.has(item.id)),
    [visible, selectedIds],
  );
  const allVisibleSelected = visible.length > 0 && visible.every((item) => selectedIds.has(item.id));

  const totals = useMemo(() => {
    const inflowValues: number[] = [];
    const outflowValues: number[] = [];
    const netValues: number[] = [];

    visible.forEach((item) => {
      const amount = displayedAmountFor(item);
      if (amount === null) return;
      const direction = directionOf(item.type);
      if (direction === "inflow") inflowValues.push(amount);
      if (direction === "outflow") outflowValues.push(amount);
      netValues.push(amount * (direction === "inflow" ? 1 : direction === "outflow" ? -1 : 0));
    });

    return {
      inflow: sumMoney(inflowValues),
      outflow: sumMoney(outflowValues),
      net: sumMoney(netValues),
    };
  }, [displayedAmountFor, visible]);

  function resetFilters() {
    setSearch("");
    setDirectionFilter("all");
    setCategoryFilter("all");
    setCurrencyFilter("all");
    setMonthFilter("all");
    setSortMode("newest");
    setSelectedIds(new Set());
    setError("");
  }

  function toggleSelectionMode() {
    setSelectionMode((current) => {
      if (current) setSelectedIds(new Set());
      return !current;
    });
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

  function exportCsv(items: DecryptedTransaction[], scope: "view" | "selected") {
    if (!items.length) return;
    const header = [
      "Description",
      "Category",
      "Occurred at",
      "Transaction type",
      "Direction",
      "Original currency",
      "Original amount",
      "Display currency",
      "Display amount",
    ];
    const rows = items.map((item) => {
      const displayed = displayedAmountFor(item);
      return [
        item.description,
        item.category,
        item.occurred_at ?? item.transaction_date,
        typeLabel(item.type),
        directionOf(item.type),
        item.currency,
        finiteNumber(item.amount).toFixed(2),
        baseCurrency,
        displayed === null ? "" : displayed.toFixed(2),
      ];
    });
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ficonter-transactions-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(scope === "selected" ? "Selected transactions exported to CSV." : "Transaction view exported to CSV.");
    window.setTimeout(() => setNotice(""), 2400);
  }

  async function exportPdf(items: DecryptedTransaction[], scope: "view" | "selected") {
    if (!items.length || exportingPdf) return;
    setExportingPdf(true);
    setError("");
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Your account could not be verified for this export.");
      const metadata = user.user_metadata as Record<string, unknown> | undefined;
      const ownerName = String(metadata?.display_name ?? metadata?.full_name ?? user.email ?? "FICONTER account holder");
      const pdfRecords = items.map((transaction) => {
        const displayed = displayedAmountFor(transaction);
        if (displayed === null) throw new Error("Currency conversion is still loading. Try again in a moment.");
        return {
          description: transaction.description,
          category: transaction.category,
          type: typeLabel(transaction.type),
          direction: directionOf(transaction.type),
          currency: transaction.currency || "EUR",
          amount: finiteNumber(transaction.amount),
          amount_eur: finiteNumber(transaction.amount_eur ?? transaction.amount),
          display_amount: displayed,
          display_currency: baseCurrency,
          occurred_at: transaction.occurred_at ?? `${transaction.transaction_date}T00:00:00`,
        };
      });
      const pdf = await createTransactionsPdf(pdfRecords, {
        ownerName,
        email: user.email ?? "",
        locale: "en-US",
        exportedAt: new Date().toISOString(),
        baseCurrency,
      });
      triggerDownload(`ficonter-transactions-${scope}-${new Date().toISOString().slice(0, 10)}.pdf`, pdf);
      setNotice(scope === "selected" ? "Selected transactions exported to PDF." : "Transaction view exported to PDF.");
      window.setTimeout(() => setNotice(""), 2400);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "The PDF export could not be created.");
    } finally {
      setExportingPdf(false);
    }
  }

  async function deleteSelectedTransactions() {
    const ids = selectedTransactions.map((item) => item.id);
    if (!ids.length || loading) return;
    setLoading(true);
    setError("");
    const { error: deleteError } = await supabase.rpc("delete_transactions_with_linked_bills", {
      p_transaction_ids: ids,
    });
    if (deleteError) {
      setError(deleteError.message);
      setLoading(false);
      return;
    }
    setBulkDeleteOpen(false);
    setSelectedIds(new Set());
    setSelectionMode(false);
    notifyFiconterDataChange("all");
    window.dispatchEvent(new CustomEvent("ficonter:transaction-deleted"));
    setNotice(`${ids.length} ${ids.length === 1 ? "transaction" : "transactions"} deleted.`);
    window.setTimeout(() => setNotice(""), 2600);
    setLoading(false);
  }

  if (!transactions.length) {
    return <div className={styles.empty}>No transactions yet.</div>;
  }

  return (
    <>
      <div className={styles.commandBar}>
        <label className={styles.searchBox}>
          <Search size={17} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search transactions"
            aria-label="Search transactions"
          />
        </label>
        <button type="button" className={styles.secondaryButton} onClick={resetFilters}>Reset</button>
        <button type="button" className={styles.secondaryButton} onClick={() => exportCsv(visible, "view")} disabled={!visible.length}>
          <Download size={16} /> CSV
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={!visible.length || exportingPdf}
          onClick={() => {
            if (!allowPdfExport) {
              router.push("/dashboard/settings?section=subscription&required=private_pdf_export");
              return;
            }
            void exportPdf(visible, "view");
          }}
        >
          {allowPdfExport ? <FileText size={16} /> : <LockKeyhole size={16} />}
          {exportingPdf ? "Preparing…" : "PDF"}
        </button>
      </div>

      <div className={styles.filters}>
        <select value={directionFilter} onChange={(event) => setDirectionFilter(event.target.value as DirectionFilter)}>
          <option value="all">All movements</option>
          <option value="inflow">Cash inflows</option>
          <option value="outflow">Cash outflows</option>
          <option value="neutral">Transfers / adjustments</option>
        </select>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="all">All categories</option>
          {categories.map((category) => <option key={category}>{category}</option>)}
        </select>
        {allowMultiCurrency ? (
          <select value={currencyFilter} onChange={(event) => setCurrencyFilter(event.target.value)}>
            <option value="all">All currencies</option>
            {currencies.filter((code) => CURRENCY_CODES.includes(code)).map((code) => (
              <option key={code} value={code}>{currencySymbol(code)} {code} — {currencyName(code)}</option>
            ))}
          </select>
        ) : null}
        <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}>
          <option value="all">All months</option>
          {months.map((month) => (
            <option key={month} value={month}>
              {new Date(`${month}-01T12:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
            </option>
          ))}
        </select>
        <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="highest">Highest amount</option>
          <option value="lowest">Lowest amount</option>
          <option value="description">Description A–Z</option>
        </select>
      </div>

      <div className={styles.summary} aria-label="Transaction cash flow summary">
        <article data-summary-card="inflow">
          <TrendingUp size={17} aria-hidden="true" />
          <span>Total Cash Inflows</span>
          <strong className={styles.positive}>{formatCurrency(totals.inflow, baseCurrency)}</strong>
        </article>
        <article data-summary-card="outflow">
          <TrendingDown size={17} aria-hidden="true" />
          <span>Total Cash Outflows</span>
          <strong className={styles.negative}>{formatCurrency(totals.outflow, baseCurrency)}</strong>
        </article>
        <article data-summary-card="net">
          <WalletCards size={17} aria-hidden="true" />
          <span>Net Cash Flow</span>
          <strong>{formatCurrency(totals.net, baseCurrency)}</strong>
        </article>
      </div>

      {notice ? <div className={styles.notice}>{notice}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.listHeader}>
        <div>
          <strong>Transaction Ledger</strong>
          <span>{visible.length} {visible.length === 1 ? "record" : "records"}</span>
        </div>
        <button type="button" className={styles.selectModeButton} onClick={toggleSelectionMode}>
          {selectionMode ? "Done" : "Select"}
        </button>
      </div>

      {selectionMode ? (
        <div className={styles.selectionBar}>
          <label>
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} disabled={!visible.length} />
            <span>Select all visible</span>
          </label>
          <span>{selectedTransactions.length} selected</span>
          {selectedTransactions.length > 0 ? (
            <div className={styles.selectionActions}>
              <button type="button" onClick={() => exportCsv(selectedTransactions, "selected")}><Download size={15} /> CSV</button>
              <button
                type="button"
                onClick={() => {
                  if (!allowPdfExport) {
                    router.push("/dashboard/settings?section=subscription&required=private_pdf_export");
                    return;
                  }
                  void exportPdf(selectedTransactions, "selected");
                }}
              >
                {allowPdfExport ? <FileText size={15} /> : <LockKeyhole size={15} />} PDF
              </button>
              <button type="button" className={styles.dangerInline} onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 size={15} /> Delete
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <ul className={styles.list} aria-label="Transaction ledger">
        {visible.map((transaction) => {
          const direction = directionOf(transaction.type);
          const displayedAmount = displayedAmountFor(transaction);
          const Icon = categoryIcon(transaction);
          const selected = selectedIds.has(transaction.id);
          return (
            <li key={transaction.id} className={`${styles.row} ${selected ? styles.selectedRow : ""}`}>
              {selectionMode ? (
                <label className={styles.rowCheckbox}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleTransaction(transaction.id)}
                    aria-label={`Select ${transaction.description}`}
                  />
                </label>
              ) : null}
              <button
                type="button"
                className={styles.rowButton}
                onClick={() => router.push(`/dashboard/transactions/${transaction.id}`)}
                aria-label={`Open ${transaction.description} transaction details`}
              >
                <span className={`${styles.iconChip} ${direction === "inflow" ? styles.inflowIcon : direction === "outflow" ? styles.outflowIcon : styles.neutralIcon}`}>
                  <Icon size={19} aria-hidden="true" />
                </span>
                <span className={styles.rowCopy}>
                  <strong>{transaction.description}</strong>
                  <span>{transaction.category} · {transactionDate(transaction)}</span>
                </span>
                <span className={styles.rowAmount}>
                  <strong className={direction === "inflow" ? styles.positive : direction === "outflow" ? styles.negative : ""}>
                    {direction === "inflow" ? "+" : direction === "outflow" ? "-" : ""}
                    {displayedAmount === null ? `— ${baseCurrency}` : formatCurrency(displayedAmount, baseCurrency)}
                  </strong>
                  <span>{typeLabel(transaction.type)}</span>
                </span>
                <ChevronRight size={18} className={styles.chevron} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>

      {!visible.length ? <div className={styles.empty}>No transactions match your filters.</div> : null}

      {bulkDeleteOpen ? (
        <div className={styles.backdrop} onMouseDown={() => !loading && setBulkDeleteOpen(false)}>
          <div className={styles.confirmSheet} onMouseDown={(event) => event.stopPropagation()} role="alertdialog" aria-modal="true" aria-labelledby="compact-bulk-delete-title">
            <button type="button" className={styles.closeButton} onClick={() => setBulkDeleteOpen(false)} aria-label="Close"><X size={18} /></button>
            <small>PERMANENT BULK ACTION</small>
            <h3 id="compact-bulk-delete-title">Delete {selectedTransactions.length} transactions?</h3>
            <p>Selected transactions will be permanently removed. Linked Bills are removed and linked debt payments are reversed automatically where applicable.</p>
            <div className={styles.confirmActions}>
              <button type="button" onClick={() => setBulkDeleteOpen(false)} disabled={loading}>Cancel</button>
              <button type="button" className={styles.dangerButton} data-enter-confirm="true" onClick={() => void deleteSelectedTransactions()} disabled={loading}>
                {loading ? "Deleting…" : "Delete selected"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
