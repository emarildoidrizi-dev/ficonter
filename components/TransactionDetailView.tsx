"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CircleDollarSign,
  FileText,
  Pencil,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEncryptedTransactions } from "@/components/EncryptedTransactionProvider";
import { TransactionLinkedRecords } from "@/components/TransactionLinkedRecords";
import { useVault } from "@/components/VaultProvider";
import { useCurrencyDisplay, useHistoricalReportingRates } from "@/components/CurrencyDisplayProvider";
import { encryptTransactionPayload } from "@/lib/e2ee/transactionPayload";
import { notifyFiconterDataChange } from "@/lib/ficonterRealtime";
import { getExchangeRate } from "@/lib/performance/exchangeRateCache";
import {
  convertToReportingCurrency,
  finiteNumber,
  roundMoney,
  roundRate,
} from "@/lib/finance/money";
import { originalAmountInBaseCurrency } from "@/lib/finance/baseCurrencyActuals";
import {
  CATEGORY_GROUPS,
  CURRENCY_CODES,
  TRANSACTION_TYPES,
  TYPE_BY_VALUE,
  currencySymbol,
  formatCurrency,
  formatReportingCurrency,
  type FlowDirection,
} from "@/lib/financialOptions";
import styles from "./TransactionDetailView.module.css";

type Props = {
  transactionId: string;
  userId: string;
  allowMultiCurrency: boolean;
};

const detailDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZoneName: "short",
});

const directionOf = (type: string): FlowDirection =>
  TYPE_BY_VALUE[type]?.direction ?? (type === "income" ? "inflow" : "outflow");

const typeLabel = (type: string) =>
  TYPE_BY_VALUE[type]?.label ?? type.replaceAll("_", " ");

const groupedTypes = TRANSACTION_TYPES.reduce<Record<string, typeof TRANSACTION_TYPES>>(
  (groups, option) => {
    groups[option.group] ??= [];
    groups[option.group].push(option);
    return groups;
  },
  {},
);

function toLocalDateTimeInput(value: string | null, fallbackDate: string) {
  const date = value ? new Date(value) : new Date(`${fallbackDate}T12:00:00`);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function directionLabel(direction: FlowDirection) {
  if (direction === "inflow") return "Cash inflow";
  if (direction === "outflow") return "Cash outflow";
  return "Transfer / adjustment";
}

export function TransactionDetailView({ transactionId, userId, allowMultiCurrency }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { transactions, loading, error: providerError, refresh } = useEncryptedTransactions();
  const { status: vaultStatus, vaultKey } = useVault();
  const { baseCurrency } = useCurrencyDisplay();

  const transaction = useMemo(
    () => transactions.find((item) => item.id === transactionId) ?? null,
    [transactions, transactionId],
  );

  const { rateForDate } = useHistoricalReportingRates(
    transaction ? [transaction.transaction_date] : [],
  );

  const [editMode, setEditMode] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [customEditCategory, setCustomEditCategory] = useState("");
  const [editCurrency, setEditCurrency] = useState("EUR");
  const [editAmount, setEditAmount] = useState("");
  const [editOccurredAt, setEditOccurredAt] = useState("");
  const [editRate, setEditRate] = useState({
    rate: 1,
    date: new Date().toISOString().slice(0, 10),
    source: "identity",
  });
  const [editRateLoading, setEditRateLoading] = useState(false);
  const [editRateError, setEditRateError] = useState("");

  useEffect(() => {
    if (!transaction) return;
    const knownCategory = CATEGORY_GROUPS.some((group) => group.items.includes(transaction.category));
    setEditCategory(knownCategory ? transaction.category : "Other / custom");
    setCustomEditCategory(knownCategory ? "" : transaction.category);
    setEditCurrency(transaction.currency || "EUR");
    setEditAmount(String(transaction.amount));
    setEditOccurredAt(toLocalDateTimeInput(transaction.occurred_at, transaction.transaction_date));
    setEditRate({
      rate: roundRate(transaction.exchange_rate_to_eur ?? 1),
      date: transaction.exchange_rate_date ?? new Date().toISOString().slice(0, 10),
      source: transaction.exchange_rate_source ?? (transaction.currency === "EUR" ? "identity" : "Frankfurter"),
    });
    setEditRateError("");
  }, [transaction]);

  useEffect(() => {
    if (!editMode || !transaction) return;
    const controller = new AbortController();
    if (editCurrency === "EUR") {
      setEditRate({ rate: 1, date: new Date().toISOString().slice(0, 10), source: "identity" });
      setEditRateError("");
      setEditRateLoading(false);
      return () => controller.abort();
    }

    async function loadRate() {
      setEditRateLoading(true);
      setEditRateError("");
      try {
        const data = await getExchangeRate(editCurrency, "EUR", { signal: controller.signal });
        setEditRate({ rate: data.rate, date: data.date, source: data.source });
      } catch (caughtError) {
        if ((caughtError as Error).name !== "AbortError") {
          setEditRateError((caughtError as Error).message);
        }
      } finally {
        if (!controller.signal.aborted) setEditRateLoading(false);
      }
    }

    void loadRate();
    return () => controller.abort();
  }, [editCurrency, editMode, transaction]);

  if (loading) {
    return <div className={styles.stateCard}>Opening encrypted transaction…</div>;
  }

  if (providerError) {
    return <div className={styles.stateCardError}>{providerError}</div>;
  }

  if (!transaction) {
    return (
      <div className={styles.stateCard}>
        <h2>Transaction not found</h2>
        <p>This transaction may have been deleted or is no longer available in the active Financial Vault.</p>
        <Link href="/dashboard/transactions">Return to Transaction Ledger</Link>
      </div>
    );
  }

  const direction = directionOf(transaction.type);
  const displayAmount = originalAmountInBaseCurrency({
    originalAmount: transaction.amount,
    originalCurrency: transaction.currency,
    amountEur: transaction.amount_eur,
    baseCurrency,
    euroToBaseRate: rateForDate(transaction.transaction_date),
  });
  const displayDate = detailDateFormatter.format(
    transaction.occurred_at
      ? new Date(transaction.occurred_at)
      : new Date(`${transaction.transaction_date}T12:00:00`),
  );
  const originalCurrency = transaction.currency || "EUR";
  const editCurrencyOptions = allowMultiCurrency
    ? CURRENCY_CODES
    : [originalCurrency];

  async function saveChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transaction || saving) return;
    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (vaultStatus !== "unlocked" || !vaultKey) {
        throw new Error("Unlock your Financial Vault before editing this transaction.");
      }

      const form = new FormData(event.currentTarget);
      const description = String(form.get("description") ?? "").trim();
      const amount = roundMoney(form.get("amount"));
      const finalCategory = editCategory === "Other / custom"
        ? customEditCategory.trim()
        : editCategory;
      const occurred = new Date(editOccurredAt);

      if (!description) throw new Error("Please enter a description.");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Please enter an amount greater than zero.");
      if (!finalCategory) throw new Error("Please enter a category.");
      if (Number.isNaN(occurred.getTime())) throw new Error("Please choose a valid transaction date and time.");
      if (editCurrency !== "EUR" && (editRateLoading || editRateError || !editRate.rate)) {
        throw new Error("A valid EUR exchange rate is required before saving changes.");
      }

      const update = {
        description,
        amount: roundMoney(amount),
        currency: editCurrency,
        amount_eur: convertToReportingCurrency(amount, editRate.rate),
        exchange_rate_to_eur: roundRate(editRate.rate),
        exchange_rate_date: editRate.date,
        exchange_rate_source: editRate.source,
        type: String(form.get("type")),
        category: finalCategory,
        transaction_date: editOccurredAt.slice(0, 10),
        occurred_at: occurred.toISOString(),
      };

      const encryptedPayload = await encryptTransactionPayload(vaultKey, userId, update);
      const { error: updateError } = await supabase
        .from("transactions")
        .update({
          encrypted_payload: encryptedPayload,
          encryption_version: 1,
          description: null,
          amount: null,
          currency: null,
          amount_eur: null,
          exchange_rate_to_eur: null,
          exchange_rate_date: null,
          exchange_rate_source: null,
          type: null,
          category: null,
          transaction_date: null,
          occurred_at: null,
        })
        .eq("id", transaction.id)
        .eq("user_id", userId);

      if (updateError) throw updateError;
      notifyFiconterDataChange("all");
      window.dispatchEvent(new CustomEvent("ficonter:transaction-upserted", { detail: { id: transaction.id, encryption_version: 1 } }));
      await refresh();
      setEditMode(false);
      setNotice("Transaction updated successfully.");
      window.setTimeout(() => setNotice(""), 2600);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "The transaction could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTransaction() {
    if (!transaction || deleting) return;
    const targetId = transaction.id;
    setDeleting(true);
    setError("");
    try {
      const { error: deleteError } = await supabase.rpc("delete_transactions_with_linked_bills", {
        p_transaction_ids: [targetId],
      });
      if (deleteError) throw deleteError;
      notifyFiconterDataChange("all");
      window.dispatchEvent(new CustomEvent("ficonter:transaction-deleted", { detail: { id: targetId } }));
      await refresh();
      router.replace("/dashboard/transactions");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "The transaction could not be deleted.");
      setDeleteOpen(false);
      setDeleting(false);
    }
  }

  return (
    <div className={styles.workspace}>
      <div className={styles.detailHeader}>
        <Link href="/dashboard/transactions" className={styles.backLink}>
          <ArrowLeft size={18} /> Transaction Ledger
        </Link>
        <div className={styles.headerActions}>
          <button type="button" onClick={() => { setEditMode((current) => !current); setError(""); }}>
            <Pencil size={17} /> {editMode ? "Close editor" : "Edit"}
          </button>
          <button type="button" className={styles.deleteAction} onClick={() => setDeleteOpen(true)}>
            <Trash2 size={17} /> Delete
          </button>
        </div>
      </div>

      <section className={styles.heroCard}>
        <div className={styles.heroIcon}><CircleDollarSign size={24} /></div>
        <div className={styles.heroCopy}>
          <span>{directionLabel(direction)}</span>
          <h1>{transaction.description}</h1>
          <p>{transaction.category} · {displayDate}</p>
        </div>
        <div className={styles.heroAmount}>
          <strong className={direction === "inflow" ? styles.positive : direction === "outflow" ? styles.negative : ""}>
            {direction === "inflow" ? "+" : direction === "outflow" ? "-" : ""}
            {displayAmount === null ? `— ${baseCurrency}` : formatCurrency(displayAmount, baseCurrency)}
          </strong>
          <span>Display currency: {baseCurrency}</span>
        </div>
      </section>

      {notice ? <div className={styles.notice}>{notice}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.detailGrid}>
        <section className={styles.infoCard}>
          <div className={styles.cardTitle}><FileText size={18} /><h2>Transaction information</h2></div>
          <dl>
            <div><dt>Description</dt><dd>{transaction.description}</dd></div>
            <div><dt>Transaction type</dt><dd>{typeLabel(transaction.type)}</dd></div>
            <div><dt>Direction</dt><dd>{directionLabel(direction)}</dd></div>
            <div><dt>Category</dt><dd>{transaction.category}</dd></div>
            <div><dt>Exact date & time</dt><dd>{displayDate}</dd></div>
            <div><dt>Transaction ID</dt><dd className={styles.mono}>{transaction.id}</dd></div>
          </dl>
        </section>

        <section className={styles.infoCard}>
          <div className={styles.cardTitle}><WalletCards size={18} /><h2>Financial values</h2></div>
          <dl>
            <div><dt>Original amount</dt><dd>{formatCurrency(finiteNumber(transaction.amount), originalCurrency)}</dd></div>
            <div><dt>Original currency</dt><dd>{originalCurrency}</dd></div>
            <div><dt>Display amount</dt><dd>{displayAmount === null ? `— ${baseCurrency}` : formatCurrency(displayAmount, baseCurrency)}</dd></div>
            <div><dt>Canonical EUR amount</dt><dd>{formatCurrency(finiteNumber(transaction.amount_eur), "EUR")}</dd></div>
            <div><dt>Rate to EUR</dt><dd>{finiteNumber(transaction.exchange_rate_to_eur || 1).toFixed(8)}</dd></div>
            <div><dt>Rate date</dt><dd>{transaction.exchange_rate_date ?? "Not applicable"}</dd></div>
            <div><dt>Rate source</dt><dd>{transaction.exchange_rate_source ?? "Identity / not applicable"}</dd></div>
          </dl>
        </section>

        <section className={styles.infoCard}>
          <div className={styles.cardTitle}><ReceiptText size={18} /><h2>Linked records</h2></div>
          <TransactionLinkedRecords transactionId={transaction.id} userId={userId} />
        </section>

        <section className={styles.infoCard}>
          <div className={styles.cardTitle}><ShieldCheck size={18} /><h2>Record integrity</h2></div>
          <dl>
            <div><dt>Vault protection</dt><dd>Encrypted transaction payload</dd></div>
            <div><dt>Created</dt><dd>{transaction.created_at ? detailDateFormatter.format(new Date(transaction.created_at)) : "Not available"}</dd></div>
            <div><dt>Deletion behavior</dt><dd>Linked Bills and debt-payment reversals are handled atomically where applicable.</dd></div>
          </dl>
        </section>
      </div>

      {editMode ? (
        <section className={styles.editorCard}>
          <div className={styles.editorHeading}>
            <div><Pencil size={19} /><div><h2>Edit transaction</h2><p>Changes are re-encrypted before being stored.</p></div></div>
            <button type="button" onClick={() => setEditMode(false)} aria-label="Close editor"><X size={18} /></button>
          </div>
          <form onSubmit={saveChanges}>
            <label>
              <span>Description</span>
              <input name="description" defaultValue={transaction.description} required />
            </label>
            <div className={styles.formGrid}>
              <label>
                <span>Amount</span>
                <input name="amount" type="number" min="0.01" step="0.01" value={editAmount} onChange={(event) => setEditAmount(event.target.value)} required />
              </label>
              <label>
                <span>Currency</span>
                <select value={editCurrency} onChange={(event) => setEditCurrency(event.target.value)}>
                  {editCurrencyOptions.map((code) => <option key={code} value={code}>{currencySymbol(code)} {code}</option>)}
                </select>
              </label>
            </div>
            <label>
              <span>Transaction type</span>
              <select name="type" defaultValue={transaction.type}>
                {Object.entries(groupedTypes).map(([group, options]) => (
                  <optgroup key={group} label={group}>
                    {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className={styles.formGrid}>
              <label>
                <span>Category</span>
                <select value={editCategory} onChange={(event) => setEditCategory(event.target.value)}>
                  {CATEGORY_GROUPS.map((group) => (
                    <optgroup key={group.group} label={group.group}>
                      {group.items.map((item) => <option key={item} value={item}>{item}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label>
                <span>Exact date and time</span>
                <input type="datetime-local" value={editOccurredAt} onChange={(event) => setEditOccurredAt(event.target.value)} required />
              </label>
            </div>
            {editCategory === "Other / custom" ? (
              <label>
                <span>Custom category</span>
                <input value={customEditCategory} onChange={(event) => setCustomEditCategory(event.target.value)} required />
              </label>
            ) : null}
            <div className={styles.fxPreview}>
              <RefreshCcw size={16} />
              {editRateLoading
                ? "Retrieving reference exchange rate…"
                : editRateError
                  ? editRateError
                  : editCurrency === baseCurrency
                    ? `Base currency equivalent: ${formatCurrency(finiteNumber(editAmount), baseCurrency)}`
                    : `EUR reference value: ${formatReportingCurrency(convertToReportingCurrency(editAmount, editRate.rate))}`}
            </div>
            <div className={styles.editorActions}>
              <button type="button" onClick={() => setEditMode(false)} disabled={saving}>Cancel</button>
              <button type="submit" className={styles.primaryButton} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
        </section>
      ) : null}

      {deleteOpen ? (
        <div className={styles.backdrop} data-ficonter-transaction-detail-backdrop="true" onMouseDown={() => !deleting && setDeleteOpen(false)}>
          <div
            className={styles.deleteSheet}
            role="alertdialog"
            aria-modal="true"
            data-ficonter-transaction-detail-delete="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className={styles.sheetClose} onClick={() => setDeleteOpen(false)} aria-label="Close"><X size={18} /></button>
            <small>PERMANENT ACTION</small>
            <h2>Delete transaction?</h2>
            <p>“{transaction.description}” will be permanently removed. A linked Bill will also be removed. If this is a debt-payment transaction, the payment will be reversed and the outstanding debt balance restored.</p>
            <div className={styles.deleteActions}>
              <button type="button" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</button>
              <button type="button" className={styles.deleteConfirm} data-enter-confirm="true" onClick={() => void deleteTransaction()} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete transaction"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
