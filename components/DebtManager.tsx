"use client";

import Link from "next/link";
import {
  ArrowRight,
  Banknote,
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
import { finiteNumber, roundMoney, roundRate, sumMoney } from "@/lib/finance/money";
import { CURRENCY_CODES, currencyName, currencySymbol, formatCurrency, formatReportingCurrency } from "@/lib/financialOptions";
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
  autopay: boolean;
  autopay_record_time: string;
  autopay_timezone: string;
  autopay_enabled_at: string | null;
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

function localDateTimeValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function sameLocalMonth(value: string, reference = new Date()) {
  const date = new Date(value);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth()
  );
}

function currentMonthDueDate(dueDay: number, reference = new Date()) {
  const lastDay = new Date(
    reference.getFullYear(),
    reference.getMonth() + 1,
    0,
  ).getDate();

  return new Date(
    reference.getFullYear(),
    reference.getMonth(),
    Math.min(Math.max(1, dueDay), lastDay),
    23,
    59,
    59,
  );
}

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
const EMPTY_DEBT = {
  name: "",
  lender: "",
  description: "",
  category: "Personal loan" as DebtCategory,
  original_balance: "",
  current_balance: "",
  currency: "EUR",
  annual_interest_rate: "0",
  minimum_payment: "",
  payment_due_day: "",
  autopay: false,
  autopay_record_time: "09:00",
  autopay_timezone: "UTC",
  autopay_enabled_at: null as string | null,
  start_date: localDateKey(),
  maturity_date: "",
  status: "active" as DebtStatus,
};

const EMPTY_PAYMENT = {
  amount: "",
  paid_at: localDateTimeValue(),
  notes: "",
};

function money(value: number | string, currency = "EUR") {
  return formatCurrency(finiteNumber(value), currency);
}

function reportingMoney(value: number | string) {
  return formatReportingCurrency(finiteNumber(value));
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
  const [form, setForm] = useState(() => ({
    ...EMPTY_DEBT,
    autopay_timezone: browserTimezone(),
  }));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deletingDebt, setDeletingDebt] = useState<Debt | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<DebtPayment | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<Debt | null>(null);
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState(initialError);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const timezone = browserTimezone();
    setForm((current) =>
      current.autopay_timezone === timezone
        ? current
        : { ...current, autopay_timezone: timezone },
    );
  }, []);

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
          notifyFiconterDataChange("all");
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
          notifyFiconterDataChange("all");
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const activeDebts = debts.filter((debt) => debt.status !== "paid_off");
  const creditCardDebts = debts.filter(
    (debt) => debt.category === "Credit card" && debt.status !== "paid_off",
  );
  const standardDebts = debts.filter((debt) => debt.category !== "Credit card");
  const totals = useMemo(() => {
    const outstanding = sumMoney(
      activeDebts.map((debt) => debt.current_balance_eur),
    );
    const minimum = sumMoney(
      activeDebts.map((debt) => debt.minimum_payment_eur),
    );
    const paid = sumMoney(payments.map((payment) => payment.amount_eur));
    const creditCardOutstanding = sumMoney(
      creditCardDebts.map((debt) => debt.current_balance_eur),
    );
    const creditCardMinimum = sumMoney(
      creditCardDebts.map((debt) => debt.minimum_payment_eur),
    );
    return {
      outstanding,
      minimum,
      paid,
      creditCardOutstanding,
      creditCardMinimum,
    };
  }, [activeDebts, creditCardDebts, payments]);

  const filteredDebts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return standardDebts
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
  }, [standardDebts, search, categoryFilter, statusFilter]);

  function resetDebtForm() {
    setForm({
      ...EMPTY_DEBT,
      start_date: localDateKey(),
      autopay_timezone: browserTimezone(),
    });
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
      autopay: false,
      autopay_record_time: "09:00",
      autopay_timezone: browserTimezone(),
      autopay_enabled_at: null,
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
      const activeSchedule =
        form.status === "active" && currentBalance > 0;
      const dueDay = Number(form.payment_due_day);

      if (
        activeSchedule &&
        (
          minimumPayment <= 0 ||
          !Number.isInteger(dueDay) ||
          dueDay < 1 ||
          dueDay > 31
        )
      ) {
        throw new Error(
          "An active debt requires a minimum payment and a due day from 1 to 31.",
        );
      }

      const detectedTimezone = browserTimezone();

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
        payment_due_day: activeSchedule ? dueDay : null,
        autopay: false,
        autopay_record_time: "09:00",
        autopay_timezone: detectedTimezone,
        autopay_enabled_at: null,
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
        notifyFiconterDataChange("all");
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
        notifyFiconterDataChange("all");
      }

      resetDebtForm();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Debt could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  function openPayment(debt: Debt) {
    const suggestedAmount = Math.min(
      finiteNumber(debt.current_balance),
      finiteNumber(debt.minimum_payment),
    );

    setPaymentForm({
      amount: suggestedAmount > 0 ? suggestedAmount.toFixed(2) : "",
      paid_at: localDateTimeValue(),
      notes: "Monthly debt payment",
    });
    setPaymentTarget(debt);
  }

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const debt = paymentTarget;
    if (!debt || busy) return;

    setBusy(`save-payment-${debt.id}`);
    setNotice("");

    try {
      const amount = roundMoney(paymentForm.amount);
      const currentBalance = finiteNumber(debt.current_balance);

      if (amount <= 0 || amount > currentBalance) {
        throw new Error(
          "Payment must be positive and cannot exceed the outstanding balance.",
        );
      }

      const paidAt = new Date(paymentForm.paid_at);
      if (Number.isNaN(paidAt.getTime())) {
        throw new Error("Choose a valid payment date and time.");
      }

      const conversion = await convertToEur(amount, debt.currency);
      const { data, error } = await supabase.rpc(
        "record_debt_payment_atomic",
        {
          p_debt_id: debt.id,
          p_amount: amount,
          p_amount_eur: roundMoney(conversion.eur),
          p_exchange_rate: roundRate(conversion.rate),
          p_paid_at: paidAt.toISOString(),
          p_notes: paymentForm.notes.trim(),
          p_exchange_rate_date: localDateKey(paidAt),
        },
      );

      if (error) throw error;

      const result = data as {
        debt?: Debt;
        payment?: DebtPayment;
      } | null;

      if (result?.debt) {
        setDebts((current) =>
          current.map((item) =>
            item.id === result.debt?.id ? (result.debt as Debt) : item,
          ),
        );
      }

      if (result?.payment) {
        setPayments((current) =>
          [
            result.payment as DebtPayment,
            ...current.filter((item) => item.id !== result.payment?.id),
          ].sort(
            (a, b) =>
              new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime(),
          ),
        );
      }

      setPaymentTarget(null);
      setPaymentForm(EMPTY_PAYMENT);
      setNotice(
        "Payment confirmed. Debt, Transactions, Cash Flow and Monthly Planner updated.",
      );
      notifyFiconterDataChange("all");
    } catch (error) {
      setNotice(readableError(error, "Debt payment could not be recorded."));
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
      notifyFiconterDataChange("all");
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
      notifyFiconterDataChange("all");
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
          <h1>Debts</h1>
          <p>
            Manage loans, instalments and fixed repayment liabilities. Credit
            cards remain included in Total Debt but are managed in their own
            synchronized section.
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
          <strong>{reportingMoney(totals.outstanding)}</strong>
        </article>
        <article>
          <CheckCircle2 />
          <span>Total repaid</span>
          <strong>{reportingMoney(totals.paid)}</strong>
        </article>
        <article>
          <Banknote />
          <span>Monthly minimums</span>
          <strong>{reportingMoney(totals.minimum)}</strong>
        </article>
        <article>
          <CreditCard />
          <span>Active debts</span>
          <strong>{activeDebts.length}</strong>
        </article>
      </div>

      <Link className={styles.creditCardBridge} href="/dashboard/credit-cards">
        <span className={styles.bridgeIcon}>
          <CreditCard size={22} />
        </span>
        <span className={styles.bridgeCopy}>
          <small>CREDIT-CARD DEBT</small>
          <strong>{reportingMoney(totals.creditCardOutstanding)}</strong>
          <span>
            {creditCardDebts.length} active {creditCardDebts.length === 1 ? "card" : "cards"}
            {totals.creditCardMinimum > 0
              ? ` · ${reportingMoney(totals.creditCardMinimum)} minimum due`
              : ""}
          </span>
        </span>
        <span className={styles.bridgeAction}>
          Manage credit cards <ArrowRight size={17} />
        </span>
      </Link>

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
                placeholder="e.g. Personal loan or sofa financing"
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
                min="0.01"
                step="0.01"
                value={form.minimum_payment}
                onChange={(event) =>
                  setForm({ ...form, minimum_payment: event.target.value })
                }
                required
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
                required
              />
            </label>
            <div className={`${styles.automationPanel} ${styles.fullWidth}`}>
              <strong className={styles.manualPolicyTitle}>
                Manual payment confirmation
              </strong>
              <p>
                FICONTER tracks the monthly due day but does not mark the
                instalment as paid automatically. Use Record payment after the
                lender has actually received the money.
              </p>
            </div>
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
                : "Save debt schedule"}
          </button>
        </form>
      )}

      <div className={styles.filters}>
        <label className={styles.search}>
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search loan, lender, category or description"
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
                    <small className={styles.automationStatus}>
                      {debt.status === "paid_off"
                        ? "Debt paid off"
                        : debt.status === "paused"
                          ? "Payment schedule paused"
                          : (() => {
                              const monthPayments = payments.filter(
                                (payment) =>
                                  payment.debt_id === debt.id &&
                                  sameLocalMonth(payment.paid_at),
                              );
                              const paidThisMonth = sumMoney(
                                monthPayments.map((payment) => payment.amount_eur),
                              );
                              const monthlyMinimum = Math.min(
                                finiteNumber(debt.current_balance_eur),
                                finiteNumber(debt.minimum_payment_eur),
                              );
                              const remaining = Math.max(
                                0,
                                roundMoney(monthlyMinimum - paidThisMonth),
                              );

                              if (monthlyMinimum <= 0) {
                                return "No payment is currently due";
                              }
                              if (remaining === 0) {
                                return `${reportingMoney(paidThisMonth)} confirmed this month`;
                              }
                              if (paidThisMonth > 0) {
                                return `${reportingMoney(remaining)} still due this month · ${reportingMoney(
                                  paidThisMonth,
                                )} confirmed`;
                              }

                              const dueDate = currentMonthDueDate(
                                debt.payment_due_day ?? 1,
                              );
                              const readableDue = dueDate.toLocaleDateString(
                                "en-GB",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                },
                              );

                              return dueDate.getTime() < Date.now()
                                ? `Payment overdue since ${readableDue} · confirmation required`
                                : `Payment due ${readableDue} · confirmation required`;
                            })()}
                    </small>
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
                    <strong>{reportingMoney(debt.current_balance_eur)}</strong>
                    {debt.currency !== "EUR" ? (
                      <small>
                        {money(debt.current_balance, debt.currency)} original
                      </small>
                    ) : null}
                  </div>
                  <div>
                    <span>Minimum payment</span>
                    <strong>{reportingMoney(debt.minimum_payment_eur)}</strong>
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
                    {reportingMoney(Math.max(0, original - current))} paid
                  </span>
                </div>
                <div className={styles.progressTrack}>
                  <span style={{ width: `${repaidPercentage}%` }} />
                </div>

                <button
                  className={styles.paymentButton}
                  type="button"
                  onClick={() => openPayment(debt)}
                  disabled={
                    debt.status !== "active" ||
                    finiteNumber(debt.current_balance) <= 0 ||
                    busy === `save-payment-${debt.id}`
                  }
                >
                  <Banknote size={18} />
                  Record payment
                </button>

                <div className={styles.history}>
                  <h4>Payment history</h4>
                  {debtPayments.length ? (
                    debtPayments.map((payment) => (
                      <div className={styles.paymentRow} key={payment.id}>
                        <div>
                          <strong>{reportingMoney(payment.amount_eur)}</strong>
                          <span>
                            {new Date(payment.paid_at).toLocaleString("en-GB", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
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
            <h3>No loan or instalment debts found</h3>
            <p>Add a fixed debt or change the current filters. Credit cards are managed separately.</p>
          </div>
        )}
      </div>

      {paymentTarget ? (
        <div className={styles.modalBackdrop}>
          <form className={styles.modal} onSubmit={savePayment}>
            <button
              className={styles.modalClose}
              type="button"
              onClick={() => setPaymentTarget(null)}
              aria-label="Close payment form"
            >
              <X size={19} />
            </button>
            <Banknote className={styles.modalIcon} />
            <span>CONFIRM PAYMENT</span>
            <h2>Record payment</h2>
            <p>
              Confirm money that was actually paid to {paymentTarget.name}.
              This creates one linked transaction and reduces the outstanding
              balance once.
            </p>
            <label>
              Amount ({paymentTarget.currency})
              <input
                type="number"
                min="0.01"
                max={finiteNumber(paymentTarget.current_balance)}
                step="0.01"
                value={paymentForm.amount}
                onChange={(event) =>
                  setPaymentForm({
                    ...paymentForm,
                    amount: event.target.value,
                  })
                }
                required
              />
            </label>
            <label>
              Payment date and time
              <input
                type="datetime-local"
                value={paymentForm.paid_at}
                onChange={(event) =>
                  setPaymentForm({
                    ...paymentForm,
                    paid_at: event.target.value,
                  })
                }
                required
              />
            </label>
            <label>
              Note
              <textarea
                rows={3}
                value={paymentForm.notes}
                onChange={(event) =>
                  setPaymentForm({
                    ...paymentForm,
                    notes: event.target.value,
                  })
                }
                placeholder="Optional payment reference"
              />
            </label>
            <button
              className={styles.modalPrimary}
              data-enter-confirm="true"
              disabled={busy === `save-payment-${paymentTarget.id}`}
            >
              {busy === `save-payment-${paymentTarget.id}`
                ? "Recording…"
                : "Confirm payment"}
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
                type="button"
                data-enter-confirm="true"
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
                type="button"
                data-enter-confirm="true"
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
