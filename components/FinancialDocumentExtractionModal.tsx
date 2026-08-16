"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  FileSearch,
  LoaderCircle,
  ScanLine,
  ShieldCheck,
  X,
} from "lucide-react";
import { CATEGORY_ITEMS, CURRENCY_CODES, formatCurrency } from "@/lib/financialOptions";
import {
  BILL_IMPORT_CATEGORIES,
  type ExtractedBillDraft,
  type ExtractedDebtDraft,
  type ExtractedTransactionDraft,
  type FinancialDocumentExtraction,
} from "@/lib/financialDocumentExtraction";
import type { FinancialDocument } from "@/lib/documentVault";
import { notifyFiconterDataChange } from "@/lib/ficonterRealtime";
import styles from "./FinancialDocumentExtractionModal.module.css";

type Props = {
  document: FinancialDocument;
  onClose: () => void;
  onImported: (message: string) => void;
};

type ExchangeRateResult = {
  rate?: number;
  convertedAmount?: number | null;
  date?: string;
  source?: string;
  error?: string;
};

type ConvertedMoney = {
  amount: number;
  amountEur: number;
  exchangeRateToEur: number;
  exchangeRateDate: string;
  exchangeRateSource: string;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function finiteMoney(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
}

async function convertToEur(amount: number, currency: string, date: string): Promise<ConvertedMoney> {
  const normalizedCurrency = currency.trim().toUpperCase();
  const rateDate = date || todayKey();
  if (normalizedCurrency === "EUR") {
    return {
      amount,
      amountEur: amount,
      exchangeRateToEur: 1,
      exchangeRateDate: rateDate,
      exchangeRateSource: "identity",
    };
  }

  const params = new URLSearchParams({
    from: normalizedCurrency,
    to: "EUR",
    date: rateDate,
  });
  if (amount > 0) params.set("amount", String(amount));

  const response = await fetch(`/api/exchange-rate?${params.toString()}`, {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const data = (await response.json().catch(() => null)) as ExchangeRateResult | null;
  if (!response.ok || !data?.rate || !Number.isFinite(Number(data.rate))) {
    throw new Error(data?.error || `The ${normalizedCurrency}/EUR exchange rate could not be loaded.`);
  }
  const rate = Number(data.rate);
  const amountEur = amount === 0
    ? 0
    : Number.isFinite(Number(data.convertedAmount))
      ? Number(data.convertedAmount)
      : Math.round(amount * rate * 100) / 100;
  return {
    amount,
    amountEur,
    exchangeRateToEur: rate,
    exchangeRateDate: data.date || rateDate,
    exchangeRateSource: data.source || "FICONTER exchange-rate service",
  };
}

function moduleHref(destination: FinancialDocumentExtraction["destination"]) {
  if (destination === "bills") return "/dashboard/bills";
  if (destination === "debt") return "/dashboard/debt";
  if (destination === "credit_card") return "/dashboard/credit-cards";
  return "/dashboard/transactions";
}

function moduleLabel(destination: FinancialDocumentExtraction["destination"]) {
  if (destination === "bills") return "Bills";
  if (destination === "debt") return "Debt";
  if (destination === "credit_card") return "Credit Cards";
  if (destination === "transactions") return "Transactions";
  return "Manual review";
}

function confidenceLabel(confidence: FinancialDocumentExtraction["confidence"]) {
  if (confidence === "high") return "High confidence";
  if (confidence === "medium") return "Review carefully";
  return "Manual review needed";
}

export function FinancialDocumentExtractionModal({ document, onClose, onImported }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [extraction, setExtraction] = useState<FinancialDocumentExtraction | null>(null);
  const [transactions, setTransactions] = useState<ExtractedTransactionDraft[]>([]);
  const [bill, setBill] = useState<ExtractedBillDraft | null>(null);
  const [debt, setDebt] = useState<ExtractedDebtDraft | null>(null);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    void (async () => {
      try {
        const response = await fetch(`/api/documents/${document.id}/extract`, {
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const data = (await response.json().catch(() => null)) as {
          extraction?: FinancialDocumentExtraction;
          error?: string;
        } | null;
        if (!response.ok || !data?.extraction) {
          throw new Error(data?.error || "FICONTER could not extract this document.");
        }
        if (cancelled) return;
        setExtraction(data.extraction);
        setTransactions(data.extraction.transactions ?? []);
        setBill(data.extraction.bill ?? null);
        setDebt(data.extraction.debt ?? null);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "FICONTER could not extract this document.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [document.id]);

  const selectedTransactions = useMemo(
    () => transactions.filter((row) => row.included),
    [transactions],
  );

  function updateTransaction(index: number, patch: Partial<ExtractedTransactionDraft>) {
    setTransactions((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  async function importTransactions() {
    if (!selectedTransactions.length) throw new Error("Select at least one transaction to import.");
    const convertedRows = await Promise.all(selectedTransactions.map(async (row) => {
      if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) throw new Error(`Review the date for “${row.description || "transaction"}”.`);
      if (!row.description.trim()) throw new Error("Every selected transaction needs a description.");
      const amount = finiteMoney(row.amount);
      if (amount === null || amount <= 0) throw new Error(`Review the amount for “${row.description}”.`);
      const conversion = await convertToEur(amount, row.currency, row.date);
      return {
        sourceRowNumber: row.sourceRowNumber,
        description: row.description.trim(),
        type: row.type,
        category: row.category,
        currency: row.currency,
        transactionDate: row.date,
        occurredAt: `${row.date}T12:00:00.000Z`,
        ...conversion,
        fingerprintSeed: `${document.id}|${row.sourceRowNumber}|${row.date}|${row.description}|${amount}|${row.currency}|${row.type}`,
        forceImport: false,
      };
    }));

    return fetch(`/api/documents/${document.id}/import`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ destination: "transactions", transactions: convertedRows }),
    });
  }

  async function importBill() {
    if (!bill) throw new Error("No bill data is available to import.");
    const amount = finiteMoney(bill.amount);
    if (amount === null || amount <= 0) throw new Error("Enter the bill amount before importing.");
    if (!bill.dueDate) throw new Error("Choose the bill due date before importing.");
    if (!bill.name.trim()) throw new Error("Enter a bill name before importing.");
    const conversion = await convertToEur(amount, bill.currency, bill.dueDate);
    return fetch(`/api/documents/${document.id}/import`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        destination: "bills",
        bill: {
          ...bill,
          ...conversion,
          forceImport: false,
        },
      }),
    });
  }

  async function importDebt(destination: "debt" | "credit_card") {
    if (!debt) throw new Error("No debt data is available to import.");
    const current = finiteMoney(debt.currentBalance);
    const original = finiteMoney(debt.originalBalance ?? debt.currentBalance);
    const minimum = finiteMoney(debt.minimumPayment ?? 0);
    if (current === null || current < 0) throw new Error("Enter the current balance before importing.");
    if (original === null || original <= 0) throw new Error("Enter the original/opening balance before importing.");
    if (minimum === null) throw new Error("Review the minimum or monthly payment.");
    if (!debt.name.trim()) throw new Error("Enter a name for this debt or card.");

    const rateDate = debt.statementDate || debt.paymentDueDate || debt.startDate || todayKey();
    const [currentBalance, originalBalance, minimumPayment] = await Promise.all([
      convertToEur(current, debt.currency, rateDate),
      convertToEur(original, debt.currency, rateDate),
      convertToEur(minimum, debt.currency, rateDate),
    ]);
    const creditLimitAmount = finiteMoney(debt.creditLimit ?? 0) ?? 0;
    const statementAmount = finiteMoney(debt.statementBalance ?? current) ?? current;
    const interestAmount = finiteMoney(debt.interestCharged ?? 0) ?? 0;
    const [creditLimit, statementBalance, interestCharged] = destination === "credit_card"
      ? await Promise.all([
          convertToEur(creditLimitAmount, debt.currency, rateDate),
          convertToEur(statementAmount, debt.currency, rateDate),
          convertToEur(interestAmount, debt.currency, rateDate),
        ])
      : [undefined, undefined, undefined];

    return fetch(`/api/documents/${document.id}/import`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        destination,
        debt: {
          ...debt,
          originalBalance,
          currentBalance,
          minimumPayment,
          creditLimit,
          statementBalance,
          interestCharged,
          forceImport: false,
        },
      }),
    });
  }

  async function confirmImport() {
    if (!extraction || importing || extraction.destination === "review") return;
    setImporting(true);
    setError("");
    try {
      const response = extraction.destination === "transactions"
        ? await importTransactions()
        : extraction.destination === "bills"
          ? await importBill()
          : await importDebt(extraction.destination);
      const data = (await response.json().catch(() => null)) as { message?: string; error?: string; result?: unknown } | null;
      if (!response.ok) throw new Error(data?.error || "The approved data could not be imported.");
      const message = data?.message || `Approved data imported into ${moduleLabel(extraction.destination)}.`;
      notifyFiconterDataChange("all");
      setSuccess(message);
      onImported(message);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "The approved data could not be imported.");
    } finally {
      setImporting(false);
    }
  }

  const canImport = extraction && extraction.destination !== "review" && !success;

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !importing) onClose();
    }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="financial-extraction-title">
        <header className={styles.header}>
          <div className={styles.headerIdentity}>
            <span className={styles.headerIcon}><ScanLine size={21} /></span>
            <div>
              <small>FICONTER DOCUMENT INTELLIGENCE · V1.1</small>
              <h2 id="financial-extraction-title">Extract financial data</h2>
              <p>{document.displayName}</p>
            </div>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} disabled={importing} aria-label="Close extraction review"><X size={19} /></button>
        </header>

        {loading ? (
          <div className={styles.loadingState}>
            <LoaderCircle className={styles.spinning} size={30} />
            <strong>Reading your private document…</strong>
            <p>FICONTER is extracting financial fields. Nothing is being added to your records yet.</p>
          </div>
        ) : error && !extraction ? (
          <div className={styles.loadingState}>
            <AlertTriangle size={30} />
            <strong>Extraction could not continue</strong>
            <p>{error}</p>
            <button type="button" onClick={onClose}>Close</button>
          </div>
        ) : extraction ? (
          <div className={styles.body}>
            <div className={styles.reviewBanner}>
              <ShieldCheck size={19} />
              <div>
                <strong>Review required</strong>
                <span>Extraction is draft-only. FICONTER will not change any financial module until you press Import approved data.</span>
              </div>
            </div>

            <div className={styles.summaryGrid}>
              <article><span>Detected document</span><strong>{extraction.documentType}</strong></article>
              <article><span>Suggested destination</span><strong>{moduleLabel(extraction.destination)}</strong></article>
              <article><span>Document language</span><strong>{extraction.documentLanguage.label}</strong></article>
              <article><span>Extraction confidence</span><strong data-confidence={extraction.confidence}>{confidenceLabel(extraction.confidence)}</strong></article>
            </div>

            <div className={styles.summaryCopy}>
              <FileSearch size={18} />
              <p>{extraction.summary}</p>
            </div>

            {extraction.warnings.length ? (
              <div className={styles.warnings}>
                {extraction.warnings.map((warning) => <p key={warning}><AlertTriangle size={15} />{warning}</p>)}
              </div>
            ) : null}

            {error ? <div className={styles.error} role="alert">{error}</div> : null}
            {success ? (
              <div className={styles.success} role="status">
                <CheckCircle2 size={19} />
                <div><strong>Import complete</strong><span>{success}</span></div>
              </div>
            ) : null}

            {extraction.destination === "transactions" ? (
              <TransactionReview rows={transactions} onChange={updateTransaction} />
            ) : null}

            {extraction.destination === "bills" && bill ? (
              <BillReview bill={bill} onChange={setBill} />
            ) : null}

            {(extraction.destination === "debt" || extraction.destination === "credit_card") && debt ? (
              <DebtReview debt={debt} destination={extraction.destination} onChange={setDebt} />
            ) : null}

            {extraction.destination === "review" ? (
              <div className={styles.manualReview}>
                <AlertTriangle size={21} />
                <div>
                  <strong>No automatic import for this document type yet</strong>
                  <p>The readable text is shown below, but FICONTER will not guess where sensitive financial values belong.</p>
                </div>
              </div>
            ) : null}

            <details className={styles.textPreview}>
              <summary>Show extracted text preview</summary>
              <pre>{extraction.textPreview.join("\n") || "No preview available."}</pre>
            </details>
          </div>
        ) : null}

        {!loading && extraction ? (
          <footer className={styles.footer}>
            <div className={styles.footerCopy}>
              {extraction.destination === "transactions" ? `${selectedTransactions.length} of ${transactions.length} rows selected` : "Nothing imports without confirmation"}
            </div>
            <div className={styles.footerActions}>
              <button type="button" onClick={onClose} disabled={importing}>Close</button>
              {success ? (
                <button type="button" className={styles.primaryButton} onClick={() => {
                  const href = moduleHref(extraction.destination);
                  router.prefetch(href);
                  router.push(href, { scroll: false });
                  onClose();
                }}>
                  Open {moduleLabel(extraction.destination)} <ArrowRight size={16} />
                </button>
              ) : canImport ? (
                <button type="button" className={styles.primaryButton} onClick={() => void confirmImport()} disabled={importing}>
                  {importing ? <LoaderCircle className={styles.spinning} size={16} /> : <Check size={16} />}
                  Import approved data
                </button>
              ) : null}
            </div>
          </footer>
        ) : null}
      </section>
    </div>
  );
}

function TransactionReview({
  rows,
  onChange,
}: {
  rows: ExtractedTransactionDraft[];
  onChange: (index: number, patch: Partial<ExtractedTransactionDraft>) => void;
}) {
  return (
    <section className={styles.reviewSection}>
      <div className={styles.sectionHead}>
        <div><span>TRANSACTION REVIEW</span><h3>Approve the rows that belong in your ledger</h3></div>
        <small>Possible duplicates start excluded.</small>
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.transactionTable}>
          <thead>
            <tr><th>Import</th><th>Date</th><th>Description</th><th>Type</th><th>Category</th><th>Amount</th><th>Currency</th></tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.sourceRowNumber}-${index}`} data-duplicate={row.possibleDuplicate || undefined}>
                <td>
                  <label className={styles.checkCell} title={row.duplicateReason ?? "Include this row"}>
                    <input type="checkbox" checked={row.included} onChange={(event) => onChange(index, { included: event.target.checked })} />
                    {row.possibleDuplicate ? <small>Duplicate?</small> : null}
                  </label>
                </td>
                <td><input type="date" value={row.date} onChange={(event) => onChange(index, { date: event.target.value })} /></td>
                <td><input value={row.description} maxLength={120} onChange={(event) => onChange(index, { description: event.target.value })} /></td>
                <td>
                  <select value={row.type} onChange={(event) => onChange(index, { type: event.target.value as ExtractedTransactionDraft["type"] })}>
                    <option value="expense">Expense</option><option value="income">Income</option><option value="saving">Saving</option>
                  </select>
                </td>
                <td>
                  <select value={row.category} onChange={(event) => onChange(index, { category: event.target.value })}>
                    {CATEGORY_ITEMS.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </td>
                <td><input type="number" min="0.01" step="0.01" value={row.amount || ""} onChange={(event) => onChange(index, { amount: Number(event.target.value) })} /></td>
                <td>
                  <select value={row.currency} onChange={(event) => onChange(index, { currency: event.target.value })}>
                    {CURRENCY_CODES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BillReview({ bill, onChange }: { bill: ExtractedBillDraft; onChange: (bill: ExtractedBillDraft) => void }) {
  return (
    <section className={styles.reviewSection}>
      <div className={styles.sectionHead}><div><span>BILL REVIEW</span><h3>Confirm the obligation before it enters Bills</h3></div></div>
      <div className={styles.formGrid}>
        <label><span>Bill name</span><input value={bill.name} maxLength={120} onChange={(event) => onChange({ ...bill, name: event.target.value })} /></label>
        <label><span>Company</span><input value={bill.company} maxLength={120} onChange={(event) => onChange({ ...bill, company: event.target.value })} /></label>
        <label><span>Amount</span><input type="number" min="0.01" step="0.01" value={bill.amount ?? ""} onChange={(event) => onChange({ ...bill, amount: event.target.value ? Number(event.target.value) : null })} /></label>
        <label><span>Currency</span><select value={bill.currency} onChange={(event) => onChange({ ...bill, currency: event.target.value })}>{CURRENCY_CODES.map((currency) => <option key={currency}>{currency}</option>)}</select></label>
        <label><span>Due date</span><input type="date" value={bill.dueDate} onChange={(event) => onChange({ ...bill, dueDate: event.target.value })} /></label>
        <label><span>Recurrence</span><select value={bill.recurrence} onChange={(event) => onChange({ ...bill, recurrence: event.target.value as ExtractedBillDraft["recurrence"] })}><option value="none">One time</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>
        <label className={styles.fullField}><span>Category</span><select value={bill.category} onChange={(event) => onChange({ ...bill, category: event.target.value })}>{BILL_IMPORT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
      </div>
      {bill.amount ? <p className={styles.detectedValue}>Detected amount: <strong>{formatCurrency(bill.amount, bill.currency)}</strong></p> : null}
    </section>
  );
}

function DebtReview({
  debt,
  destination,
  onChange,
}: {
  debt: ExtractedDebtDraft;
  destination: "debt" | "credit_card";
  onChange: (debt: ExtractedDebtDraft) => void;
}) {
  const isCard = destination === "credit_card";
  const debtCategories = ["Personal loan", "Mortgage", "Student loan", "Car loan", "Buy now, pay later", "Tax debt", "Medical debt", "Business loan", "Family loan", "Overdraft", "Other"];
  return (
    <section className={styles.reviewSection}>
      <div className={styles.sectionHead}><div><span>{isCard ? "CREDIT-CARD REVIEW" : "DEBT REVIEW"}</span><h3>{isCard ? "Confirm the card statement values" : "Confirm the liability before it enters Debt"}</h3></div></div>
      <div className={styles.formGrid}>
        <label><span>Name</span><input value={debt.name} maxLength={120} onChange={(event) => onChange({ ...debt, name: event.target.value })} /></label>
        <label><span>Lender / issuer</span><input value={debt.lender} maxLength={120} onChange={(event) => onChange({ ...debt, lender: event.target.value })} /></label>
        {!isCard ? <label><span>Debt type</span><select value={debt.category} onChange={(event) => onChange({ ...debt, category: event.target.value })}>{debtCategories.map((category) => <option key={category}>{category}</option>)}</select></label> : null}
        <label><span>Currency</span><select value={debt.currency} onChange={(event) => onChange({ ...debt, currency: event.target.value })}>{CURRENCY_CODES.map((currency) => <option key={currency}>{currency}</option>)}</select></label>
        <label><span>{isCard ? "Opening / original balance" : "Original balance"}</span><input type="number" min="0.01" step="0.01" value={debt.originalBalance ?? ""} onChange={(event) => onChange({ ...debt, originalBalance: event.target.value ? Number(event.target.value) : null })} /></label>
        <label><span>Current balance</span><input type="number" min="0.01" step="0.01" value={debt.currentBalance ?? ""} onChange={(event) => onChange({ ...debt, currentBalance: event.target.value ? Number(event.target.value) : null })} /></label>
        <label><span>{isCard ? "Minimum payment" : "Monthly/minimum payment"}</span><input type="number" min="0" step="0.01" value={debt.minimumPayment ?? ""} onChange={(event) => onChange({ ...debt, minimumPayment: event.target.value ? Number(event.target.value) : 0 })} /></label>
        <label><span>APR / annual interest %</span><input type="number" min="0" max="100" step="0.01" value={debt.annualInterestRate ?? ""} onChange={(event) => onChange({ ...debt, annualInterestRate: event.target.value ? Number(event.target.value) : 0 })} /></label>
        {isCard ? <label><span>Credit limit</span><input type="number" min="0" step="0.01" value={debt.creditLimit ?? ""} onChange={(event) => onChange({ ...debt, creditLimit: event.target.value ? Number(event.target.value) : 0 })} /></label> : null}
        {isCard ? <label><span>Last four digits</span><input inputMode="numeric" maxLength={4} value={debt.cardLastFour} onChange={(event) => onChange({ ...debt, cardLastFour: event.target.value.replace(/\D/g, "").slice(0, 4) })} /></label> : null}
        {isCard ? <label><span>Statement date</span><input type="date" value={debt.statementDate} onChange={(event) => onChange({ ...debt, statementDate: event.target.value })} /></label> : null}
        <label><span>Payment due date</span><input type="date" value={debt.paymentDueDate} onChange={(event) => onChange({ ...debt, paymentDueDate: event.target.value })} /></label>
        {!isCard ? <label><span>Start date</span><input type="date" value={debt.startDate} onChange={(event) => onChange({ ...debt, startDate: event.target.value })} /></label> : null}
        {!isCard ? <label><span>Maturity date</span><input type="date" value={debt.maturityDate} onChange={(event) => onChange({ ...debt, maturityDate: event.target.value })} /></label> : null}
        {isCard ? <label><span>Interest charged</span><input type="number" min="0" step="0.01" value={debt.interestCharged ?? ""} onChange={(event) => onChange({ ...debt, interestCharged: event.target.value ? Number(event.target.value) : 0 })} /></label> : null}
      </div>
    </section>
  );
}
