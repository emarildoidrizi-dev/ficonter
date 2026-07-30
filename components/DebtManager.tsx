"use client";

import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Edit3,
  Landmark,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  WalletCards,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { notifyFiconterDataChange } from "@/lib/ficonterRealtime";
import { convertWithCachedRate, getExchangeRate } from "@/lib/performance/exchangeRateCache";
import { finiteNumber, roundMoney, roundRate, subtractMoney, sumMoney } from "@/lib/finance/money";
import {
  CURRENCY_CODES,
  currencyName,
  currencySymbol,
  formatCurrency,
} from "@/lib/financialOptions";
import styles from "./DebtManager.module.css";

type DebtStatus = "active" | "paid_off" | "paused";
type DebtCategory =
  | "Credit card"
  | "Personal loan"
  | "Mortgage"
  | "Student loan"
  | "Car loan"
  | "Buy now, pay later"
  | "Tax debt"
  | "Medical debt"
  | "Business loan"
  | "Family loan"
  | "Overdraft"
  | "Other";

type Debt = {
  id: string;
  user_id: string;
  name: string;
  lender: string | null;
  description: string | null;
  category: DebtCategory;
  original_balance: number | string;
  current_balance: number | string;
  currency: string;
  original_balance_eur: number | string;
  current_balance_eur: number | string;
  exchange_rate_to_eur: number | string;
  annual_interest_rate: number | string;
  minimum_payment: number | string;
  minimum_payment_eur: number | string;
  payment_due_day: number | null;
  start_date: string | null;
  maturity_date: string | null;
  status: DebtStatus;
  created_at: string;
  updated_at: string;
};

type DebtPayment = {
  id: string;
  debt_id: string;
  user_id: string;
  amount: number | string;
  currency: string;
  amount_eur: number | string;
  exchange_rate_to_eur: number | string;
  paid_at: string;
  notes: string | null;
  transaction_id: string | null;
  created_at: string;
};

const CATEGORIES: DebtCategory[] = [
  "Credit card",
  "Personal loan",
  "Mortgage",
  "Student loan",
  "Car loan",
  "Buy now, pay later",
  "Tax debt",
  "Medical debt",
  "Business loan",
  "Family loan",
  "Overdraft",
  "Other",
];

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const EMPTY_DEBT = {
  name: "",
  lender: "",
  description: "",
  category: "Credit card" as DebtCategory,
  original_balance: "",
  current_balance: "",
  currency: "EUR",
  annual_interest_rate: "0",
  minimum_payment: "",
  payment_due_day: "",
  start_date: localDateKey(),
  maturity_date: "",
  status: "active" as DebtStatus,
};

function money(value: number | string, currency = "EUR") {
  return formatCurrency(finiteNumber(value), currency);
}

async function convertToEur(amount: number, currency: string) {
  if (amount === 0) {
    const rateResult = await getExchangeRate(currency, "EUR");
    return { rate: rateResult.rate, eur: 0 };
  }

  const result = await convertWithCachedRate(amount, currency, "EUR");
  if (result.convertedAmount === null) {
    throw new Error("The exchange rate could not be calculated.");
  }
  return { rate: result.rate, eur: result.convertedAmount };
}

function categoryIcon(category: DebtCategory) {
  if (category === "Credit card" || category === "Buy now, pay later")
    return CreditCard;
  if (category === "Mortgage") return Landmark;
  return WalletCards;
}

function readableError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

export function DebtManager({
  userId,
  initialDebts,
  initialPayments,
  initialError,
}: {
  userId: string;
  initialDebts: Debt[];
  initialPayments: DebtPayment[];
  initialError: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [debts, setDebts] = useState<Debt[]>(initialDebts);
  const [payments, setPayments] = useState<DebtPayment[]>(initialPayments);
  const [form, setForm] = useState(EMPTY_DEBT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null);
  const [deletingDebt, setDeletingDebt] = useState<Debt | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<DebtPayment | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState(initialError);
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const channel = supabase
      .channel(`debt-module-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "debts",
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          setDebts((current) => {
            if (payload.eventType === "DELETE") {
              const id = (payload.old as { id?: string }).id;
              return current.filter((item) => item.id !== id);
            }
            const next = payload.new as Debt;
            return [next, ...current.filter((item) => item.id !== next.id)];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "debt_payments",
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          setPayments((current) => {
            if (payload.eventType === "DELETE") {
              const id = (payload.old as { id?: string }).id;
              return current.filter((item) => item.id !== id);
            }
            const next = payload.new as DebtPayment;
            return [next, ...current.filter((item) => item.id !== next.id)].sort(
              (a, b) =>
                new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime(),
            );
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const activeDebts = debts.filter((debt) => debt.status !== "paid_off");
  const totals = useMemo(() => {
    const outstanding = sumMoney(
      activeDebts.map((debt) => debt.current_balance_eur),
    );
    const original = sumMoney(
      debts.map((debt) => debt.original_balance_eur),
    );
    const minimum = sumMoney(
      activeDebts.map((debt) => debt.minimum_payment_eur),
    );
    const paid = Math.max(0, subtractMoney(original, outstanding));
    return { outstanding, original, minimum, paid };
  }, [debts]);

  const filteredDebts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return debts
      .filter((debt) => {
        const text =
          `${debt.name} ${debt.lender ?? ""} ${debt.description ?? ""} ${
            debt.category
          }`.toLowerCase();
        return (
          (!query || text.includes(query)) &&
          (categoryFilter === "all" || debt.category === categoryFilter) &&
          (statusFilter === "all" || debt.status === statusFilter)
        );
      })
      .sort((a, b) => finiteNumber(b.current_balance_eur) - finiteNumber(a.current_balance_eur));
  }, [debts, search, categoryFilter, statusFilter]);

  function resetDebtForm() {
    setForm(EMPTY_DEBT);
    setEditingId(null);
    setShowForm(false);
  }

  function editDebt(debt: Debt) {
    setForm({
      name: debt.name,
      lender: debt.lender ?? "",
      description: debt.description ?? "",
      category: debt.category,
      original_balance: String(debt.original_balance),
      current_balance: String(debt.current_balance),
      currency: debt.currency,
      annual_interest_rate: String(debt.annual_interest_rate),
      minimum_payment: String(debt.minimum_payment),
      payment_due_day: debt.payment_due_day ? String(debt.payment_due_day) : "",
      start_date: debt.start_date ?? "",
      maturity_date: debt.maturity_date ?? "",
      status: debt.status,
    });
    setEditingId(debt.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveDebt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("save-debt");
    setNotice("");

    try {
      const originalBalance = roundMoney(form.original_balance);
      const currentBalance = roundMoney(form.current_balance || form.original_balance);
      const minimumPayment = roundMoney(form.minimum_payment || 0);
      const annualInterest = finiteNumber(form.annual_interest_rate || 0);

      if (!form.name.trim() || originalBalance <= 0 || currentBalance < 0) {
        throw new Error("Enter a debt name and valid balance.");
      }

      const [originalConversion, currentConversion, minimumConversion] =
        await Promise.all([
          convertToEur(originalBalance, form.currency),
          convertToEur(currentBalance, form.currency),
          convertToEur(minimumPayment, form.currency),
        ]);

      const payload = {
        user_id: userId,
        name: form.name.trim(),
        lender: form.lender.trim() || null,
        description: form.description.trim() || null,
        category: form.category,
        original_balance: roundMoney(originalBalance),
        current_balance: roundMoney(currentBalance),
        currency: form.currency,
        original_balance_eur: roundMoney(originalConversion.eur),
        current_balance_eur: roundMoney(currentConversion.eur),
        exchange_rate_to_eur: roundRate(currentConversion.rate),
        annual_interest_rate: annualInterest,
        minimum_payment: roundMoney(minimumPayment),
        minimum_payment_eur: roundMoney(minimumConversion.eur),
        payment_due_day: form.payment_due_day
          ? Number(form.payment_due_day)
          : null,
        start_date: form.start_date || null,
        maturity_date: form.maturity_date || null,
        status:
          currentBalance === 0 ? ("paid_off" as DebtStatus) : form.status,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { data, error } = await supabase
          .from("debts")
          .update(payload)
          .eq("id", editingId)
          .eq("user_id", userId)
          .select()
          .single();
        if (error) throw error;
        setDebts((current) =>
          current.map((item) => (item.id === editingId ? (data as Debt) : item)),
        );
        setNotice("Debt updated.");
        notifyFiconterDataChange("debts");
      } else {
        const { data, error } = await supabase
          .from("debts")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setDebts((current) =>
          current.some((item) => item.id === data.id)
            ? current
            : [data as Debt, ...current],
        );
        setNotice("Debt added.");
        notifyFiconterDataChange("debts");
      }

      resetDebtForm();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Debt could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  async function addPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const debt = paymentDebt;
    if (!debt || busy) return;

    const data = new FormData(event.currentTarget);
    const amount = roundMoney(data.get("amount"));
    const paidAt = String(
      data.get("paid_at") || localDateKey(),
    );
    const notes = String(data.get("notes") || "").trim();

    setPaymentError("");

    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Enter a valid payment amount.");
      return;
    }

    if (amount > finiteNumber(debt.current_balance)) {
      setPaymentError("Payment cannot exceed the outstanding balance.");
      return;
    }

    setBusy(`payment-${debt.id}`);
    setNotice("");

    try {
      const conversion = await convertToEur(amount, debt.currency);
      const occurredAt = new Date(`${paidAt}T12:00:00`).toISOString();

      const { data: result, error } = await supabase.rpc(
        "record_debt_payment_with_transaction",
        {
          p_debt_id: debt.id,
          p_amount: roundMoney(amount),
          p_amount_eur: roundMoney(conversion.eur),
          p_exchange_rate: roundRate(conversion.rate),
          p_paid_at: occurredAt,
          p_exchange_rate_date: paidAt,
          p_notes: notes || null,
        },
      );

      if (error) throw error;

      const updatedDebt = (result as { debt?: Debt } | null)?.debt;
      const newPayment = (result as { payment?: DebtPayment } | null)?.payment;

      if (!updatedDebt || !newPayment) {
        throw new Error("The payment was not returned by the database.");
      }

      setDebts((current) =>
        current.map((item) =>
          item.id === updatedDebt.id ? updatedDebt : item,
        ),
      );
      setPayments((current) => [
        newPayment,
        ...current.filter((item) => item.id !== newPayment.id),
      ]);

      setPaymentError("");
      setPaymentDebt(null);
      setNotice("Payment recorded and added to Transactions.");
      notifyFiconterDataChange("debts");
    } catch (error) {
      setPaymentError(readableError(error, "Payment could not be recorded."));
    } finally {
      setBusy(null);
    }
  }

  async function confirmDeletePayment() {
    const payment = deletingPayment;
    if (!payment || busy) return;
    setBusy(`delete-payment-${payment.id}`);

    try {
      const { data: result, error } = await supabase.rpc("reverse_debt_payment", {
        p_payment_id: payment.id,
      });
      if (error) throw error;

      const updatedDebt = (result as { debt?: Debt } | null)?.debt;
      if (updatedDebt) {
        setDebts((current) =>
          current.map((item) =>
            item.id === updatedDebt.id ? updatedDebt : item,
          ),
        );
      }

      setPayments((current) => current.filter((item) => item.id !== payment.id));
      setDeletingPayment(null);
      setNotice("Payment deleted, linked transaction removed and debt balance restored.");
      notifyFiconterDataChange("debts");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Payment could not be deleted.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function confirmDeleteDebt() {
    const debt = deletingDebt;
    if (!debt || busy) return;
    setBusy(`delete-debt-${debt.id}`);

    try {
      const { data: result, error } = await supabase.rpc(
        "delete_debt_with_linked_transactions",
        { p_debt_id: debt.id },
      );
      if (error) throw error;

      const deletionResult = result as {
        deleted_debt_count?: number;
        deleted_transaction_count?: number;
      } | null;
      const deletedDebtCount = Number(deletionResult?.deleted_debt_count ?? 0);
      const deletedTransactionCount = Number(
        deletionResult?.deleted_transaction_count ?? 0,
      );

      if (deletedDebtCount !== 1) {
        throw new Error("Debt could not be deleted.");
      }

      setDebts((current) => current.filter((item) => item.id !== debt.id));
      setPayments((current) =>
        current.filter((payment) => payment.debt_id !== debt.id),
      );
      setDeletingDebt(null);
      setNotice(
        deletedTransactionCount > 0
          ? `Debt and ${deletedTransactionCount} linked ${
              deletedTransactionCount === 1 ? "transaction" : "transactions"
            } deleted.`
          : "Debt deleted.",
      );
      notifyFiconterDataChange("debts");
    } catch (error) {
      setNotice(readableError(error, "Debt could not be deleted."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={styles.shell}>
      <header className={styles.hero}>
        <div>
          <h1>Debt</h1>
          <p>
            Track every liability, record repayments and keep FICONTER synchronized
            across Transactions, Monthly Planner and Net Worth.
          </p>
        </div>
        <button
          className={styles.primaryButton}
          onClick={() => {
            if (showForm) resetDebtForm();
            else setShowForm(true);
          }}
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? "Close form" : "Add debt"}
        </button>
      </header>

      {notice && <div className={styles.notice}>{notice}</div>}

      <div className={styles.summaryGrid}>
        <article>
          <TrendingDown />
          <span>Total outstanding</span>
          <strong>{money(totals.outstanding)}</strong>
        </article>
        <article>
          <CheckCircle2 />
          <span>Total repaid</span>
          <strong>{money(totals.paid)}</strong>
        </article>
        <article>
          <Banknote />
          <span>Monthly minimums</span>
          <strong>{money(totals.minimum)}</strong>
        </article>
        <article>
          <CreditCard />
          <span>Active debts</span>
          <strong>{activeDebts.length}</strong>
        </article>
      </div>

      {showForm && (
        <form className={styles.formCard} onSubmit={saveDebt}>
          <div className={styles.formHeading}>
            <div>
              <span>{editingId ? "EDIT DEBT" : "NEW DEBT"}</span>
              <h2>{editingId ? "Update liability" : "Add a liability"}</h2>
            </div>
            {editingId ? (
              <button type="button" onClick={resetDebtForm}>
                Cancel edit
              </button>
            ) : null}
          </div>

          <div className={styles.formGrid}>
            <label>
              Debt name
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="e.g. TF Bank credit card"
                required
              />
            </label>
            <label>
              Lender
              <input
                value={form.lender}
                onChange={(event) =>
                  setForm({ ...form, lender: event.target.value })
                }
                placeholder="Bank or lender"
              />
            </label>
            <label>
              Category
              <select
                value={form.category}
                onChange={(event) =>
                  setForm({
                    ...form,
                    category: event.target.value as DebtCategory,
                  })
                }
              >
                {CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <label>
              Currency
              <select
                value={form.currency}
                onChange={(event) =>
                  setForm({ ...form, currency: event.target.value })
                }
              >
                {CURRENCY_CODES.map((code) => (
                  <option value={code} key={code}>
                    {currencySymbol(code)} {code} — {currencyName(code)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Original balance
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.original_balance}
                onChange={(event) =>
                  setForm({ ...form, original_balance: event.target.value })
                }
                required
              />
            </label>
            <label>
              Current balance
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.current_balance}
                onChange={(event) =>
                  setForm({ ...form, current_balance: event.target.value })
                }
                placeholder="Defaults to original balance"
              />
            </label>
            <label>
              Annual interest rate (%)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.annual_interest_rate}
                onChange={(event) =>
                  setForm({
                    ...form,
                    annual_interest_rate: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Minimum payment
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.minimum_payment}
                onChange={(event) =>
                  setForm({ ...form, minimum_payment: event.target.value })
                }
              />
            </label>
            <label>
              Payment due day
              <input
                type="number"
                min="1"
                max="31"
                value={form.payment_due_day}
                onChange={(event) =>
                  setForm({ ...form, payment_due_day: event.target.value })
                }
                placeholder="1–31"
              />
            </label>
            <label>
              Start date
              <input
                type="date"
                value={form.start_date}
                onChange={(event) =>
                  setForm({ ...form, start_date: event.target.value })
                }
              />
            </label>
            <label>
              Maturity date
              <input
                type="date"
                value={form.maturity_date}
                onChange={(event) =>
                  setForm({ ...form, maturity_date: event.target.value })
                }
              />
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={(event) =>
                  setForm({ ...form, status: event.target.value as DebtStatus })
                }
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="paid_off">Paid off</option>
              </select>
            </label>
            <label className={styles.fullWidth}>
              Description
              <textarea
                rows={3}
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                placeholder="Optional notes about this debt"
              />
            </label>
          </div>

          <button className={styles.saveButton} disabled={busy === "save-debt"}>
            {busy === "save-debt"
              ? "Saving…"
              : editingId
                ? "Save changes"
                : "Save debt"}
          </button>
        </form>
      )}

      <div className={styles.filters}>
        <label className={styles.search}>
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search debt, lender, category or description"
          />
        </label>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="paid_off">Paid off</option>
        </select>
      </div>

      <div className={`${styles.debtGrid} ficonter-scroll-region`}>
        {filteredDebts.length ? (
          filteredDebts.map((debt) => {
            const Icon = categoryIcon(debt.category);
            const original = finiteNumber(debt.original_balance_eur);
            const current = finiteNumber(debt.current_balance_eur);
            const repaidPercentage = original
              ? Math.max(0, Math.min(100, ((original - current) / original) * 100))
              : 0;
            const debtPayments = payments
              .filter((payment) => payment.debt_id === debt.id)
              .slice(0, 5);

            return (
              <article className={styles.debtCard} key={debt.id}>
                <div className={styles.cardTop}>
                  <div className={styles.debtIcon}>
                    <Icon size={22} />
                  </div>
                  <div className={styles.identity}>
                    <div>
                      <h3>{debt.name}</h3>
                      <span className={`${styles.status} ${styles[debt.status]}`}>
                        {debt.status.replace("_", " ")}
                      </span>
                    </div>
                    <p>
                      {debt.lender || "No lender"} · {debt.category}
                    </p>
                  </div>
                  <div className={styles.cardActions}>
                    <button onClick={() => editDebt(debt)} aria-label="Edit debt">
                      <Edit3 size={17} />
                    </button>
                    <button
                      className={styles.dangerButton}
                      onClick={() => setDeletingDebt(debt)}
                      aria-label="Delete debt"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>

                {debt.description ? (
                  <p className={styles.description}>{debt.description}</p>
                ) : null}

                <div className={styles.balanceRow}>
                  <div>
                    <span>Outstanding</span>
                    <strong>{money(debt.current_balance_eur, "EUR")}</strong>
                    {debt.currency !== "EUR" ? (
                      <small>
                        {money(debt.current_balance, debt.currency)} original
                      </small>
                    ) : null}
                  </div>
                  <div>
                    <span>Minimum payment</span>
                    <strong>{money(debt.minimum_payment_eur, "EUR")}</strong>
                    <small>
                      {debt.payment_due_day
                        ? `Due day ${debt.payment_due_day}`
                        : "No due day"}
                    </small>
                  </div>
                  <div>
                    <span>Interest</span>
                    <strong>{finiteNumber(debt.annual_interest_rate).toFixed(2)}%</strong>
                    <small>Annual rate</small>
                  </div>
                </div>

                <div className={styles.progressMeta}>
                  <span>{repaidPercentage.toFixed(1)}% repaid</span>
                  <span>
                    {money(Math.max(0, original - current), "EUR")} paid
                  </span>
                </div>
                <div className={styles.progressTrack}>
                  <span style={{ width: `${repaidPercentage}%` }} />
                </div>

                <button
                  className={styles.paymentButton}
                  onClick={() => {
                    setPaymentError("");
                    setPaymentDebt(debt);
                  }}
                  disabled={debt.status === "paid_off" || finiteNumber(debt.current_balance) <= 0}
                >
                  <Plus size={17} />
                  Record payment
                </button>

                <div className={styles.history}>
                  <h4>Recent payments</h4>
                  {debtPayments.length ? (
                    debtPayments.map((payment) => (
                      <div className={styles.paymentRow} key={payment.id}>
                        <div>
                          <strong>{money(payment.amount_eur, "EUR")}</strong>
                          <span>
                            {new Date(payment.paid_at).toLocaleDateString("en-GB")}
                          </span>
                        </div>
                        <p>{payment.notes || "Debt repayment"}</p>
                        <button
                          onClick={() => setDeletingPayment(payment)}
                          aria-label="Delete payment"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className={styles.emptyHistory}>No payments recorded yet.</p>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <div className={styles.emptyState}>
            <CreditCard size={34} />
            <h3>No debt accounts found</h3>
            <p>Add a debt or change the current filters.</p>
          </div>
        )}
      </div>

      {paymentDebt ? (
        <div className={styles.modalBackdrop}>
          <form className={styles.modal} onSubmit={addPayment}>
            <button
              className={styles.modalClose}
              type="button"
              onClick={() => {
                setPaymentError("");
                setPaymentDebt(null);
              }}
            >
              <X size={19} />
            </button>
            <Banknote className={styles.modalIcon} />
            <span>RECORD PAYMENT</span>
            <h2>{paymentDebt.name}</h2>
            <p>
              Outstanding: {money(paymentDebt.current_balance_eur, "EUR")}
            </p>
            <label>
              Payment amount ({paymentDebt.currency})
              <input
                name="amount"
                type="number"
                min="0.01"
                max={finiteNumber(paymentDebt.current_balance)}
                step="0.01"
                defaultValue={Number(paymentDebt.minimum_payment) || ""}
                required
              />
            </label>
            <label>
              Payment date
              <input
                name="paid_at"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </label>
            <label>
              Notes
              <textarea name="notes" rows={3} placeholder="Optional" />
            </label>
            {paymentError ? (
              <div className={styles.notice} role="alert">
                {paymentError}
              </div>
            ) : null}
            <button
              className={styles.modalPrimary}
              disabled={busy === `payment-${paymentDebt.id}`}
            >
              {busy === `payment-${paymentDebt.id}`
                ? "Recording…"
                : "Record payment"}
            </button>
          </form>
        </div>
      ) : null}

      {deletingDebt ? (
        <div className={styles.modalBackdrop}>
          <section className={styles.modal}>
            <button
              className={styles.modalClose}
              onClick={() => setDeletingDebt(null)}
            >
              <X size={19} />
            </button>
            <Trash2 className={`${styles.modalIcon} ${styles.redIcon}`} />
            <span>CONFIRM DELETION</span>
            <h2>Delete {deletingDebt.name}?</h2>
            <p>
              This also removes its payment history and every linked transaction
              from Overview, Transactions and Monthly Planner.
            </p>
            <div className={styles.modalActions}>
              <button onClick={() => setDeletingDebt(null)}>Keep debt</button>
              <button
                className={styles.modalDanger}
                onClick={confirmDeleteDebt}
                disabled={busy === `delete-debt-${deletingDebt.id}`}
              >
                {busy === `delete-debt-${deletingDebt.id}`
                  ? "Deleting…"
                  : "Delete debt"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {deletingPayment ? (
        <div className={styles.modalBackdrop}>
          <section className={styles.modal}>
            <button
              className={styles.modalClose}
              onClick={() => setDeletingPayment(null)}
            >
              <X size={19} />
            </button>
            <Trash2 className={`${styles.modalIcon} ${styles.redIcon}`} />
            <span>DELETE PAYMENT</span>
            <h2>Reverse this payment?</h2>
            <p>
              The debt balance will increase again and the linked expense will
              disappear from Transactions, Overview and Monthly Planner.
            </p>
            <div className={styles.modalActions}>
              <button onClick={() => setDeletingPayment(null)}>Keep payment</button>
              <button
                className={styles.modalDanger}
                onClick={confirmDeletePayment}
                disabled={busy === `delete-payment-${deletingPayment.id}`}
              >
                {busy === `delete-payment-${deletingPayment.id}`
                  ? "Deleting…"
                  : "Delete payment"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
