"use client";

import {
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  Edit3,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { notifyFiconterDataChange } from "@/lib/ficonterRealtime";
import { convertWithCachedRate } from "@/lib/performance/exchangeRateCache";
import { finiteNumber, roundMoney, roundRate, sumMoney } from "@/lib/finance/money";
import { localDateKey, oneCalendarMonthEndKey } from "@/lib/finance/commitmentWindow";
import { formatCurrency } from "@/lib/financialOptions";
import styles from "./BillsManager.module.css";

type BillStatus = "pending" | "paid" | "cancelled";
type Recurrence =
  | "none"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "yearly";

type Bill = {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  category: string;
  amount: number | string;
  currency: string;
  amount_eur: number | string;
  exchange_rate_to_eur: number | string;
  due_date: string;
  recurrence: Recurrence;
  payment_method: string | null;
  autopay: boolean;
  autopay_record_time: string;
  autopay_timezone: string;
  autopay_enabled_at: string | null;
  recurrence_anchor_day: number | null;
  recurrence_anchor_month_end: boolean;
  reminder_days: number;
  status: BillStatus;
  notes: string | null;
  paid_at: string | null;
  transaction_id: string | null;
  created_at: string;
  updated_at: string;
};

const CURRENCIES = [
  "EUR","USD","GBP","CHF","AUD","CAD","JPY","CNY","HKD","SGD","NZD","SEK","NOK",
  "DKK","PLN","CZK","HUF","RON","BGN","TRY","AED","SAR","QAR","ILS","INR","PKR",
  "BDT","LKR","THB","MYR","IDR","PHP","KRW","VND","ZAR","EGP","MAD","NGN","KES",
  "GHS","BRL","MXN","ARS","CLP","COP","PEN","UYU","ISK","RSD","ALL","MKD","BAM"
];

const CATEGORIES = [
  "Housing","Electricity","Gas","Water","Internet","Mobile phone","Insurance",
  "Loan payment","Credit card","Taxes","Subscriptions","Streaming","Transport",
  "Childcare","Education","Healthcare","Membership","Business","Other"
];

const PAYMENT_METHODS = [
  "Bank transfer","Direct debit","Debit card","Credit card","Cash","PayPal",
  "Apple Pay","Google Pay","Crypto","Other"
];

const EMPTY_FORM = {
  name: "",
  company: "",
  category: "Housing",
  amount: "",
  currency: "EUR",
  due_date: localDateKey(),
  recurrence: "monthly" as Recurrence,
  payment_method: "Direct debit",
  autopay: false,
  autopay_record_time: "09:00",
  autopay_timezone: "UTC",
  autopay_enabled_at: null as string | null,
  reminder_days: "3",
  notes: "",
};

function money(value: number | string, currency = "EUR") {
  return formatCurrency(finiteNumber(value), currency);
}

function effectiveStatus(
  bill: Bill,
  today = localDateKey(),
): "pending" | "paid" | "cancelled" | "overdue" {
  if (bill.status === "paid" || bill.status === "cancelled") return bill.status;
  return bill.due_date < today ? "overdue" : "pending";
}

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
function isMonthEnd(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next.getMonth() !== date.getMonth();
}
function automaticScheduleIsFuture(dateValue: string, timeValue: string) {
  const timestamp = new Date(`${dateValue}T${timeValue}:00`);
  return Number.isFinite(timestamp.getTime()) && timestamp.getTime() > Date.now();
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;

  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim();
    if (message) return message;
  }

  return fallback;
}

function isMissingMarkPaidRpc(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message =
    "message" in error
      ? String((error as { message?: unknown }).message ?? "").toLowerCase()
      : "";

  return (
    code === "PGRST202" ||
    code === "42883" ||
    message.includes("mark_bill_paid") ||
    message.includes("schema cache") ||
    message.includes("could not find the function")
  );
}

function isMissingMarkUnpaidRpc(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message =
    "message" in error
      ? String((error as { message?: unknown }).message ?? "").toLowerCase()
      : "";

  return (
    code === "PGRST202" ||
    code === "42883" ||
    message.includes("mark_bill_unpaid") ||
    message.includes("schema cache") ||
    message.includes("could not find the function")
  );
}


async function convertToEur(amount: number, currency: string) {
  const result = await convertWithCachedRate(amount, currency, "EUR");
  if (result.convertedAmount === null) {
    throw new Error("The exchange rate could not be calculated.");
  }
  return { rate: result.rate, eur: result.convertedAmount };
}

export function BillsManager({
  userId,
  initialBills,
  initialError,
}: {
  userId: string;
  initialBills: Bill[];
  initialError: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [bills, setBills] = useState<Bill[]>(initialBills);
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    autopay_timezone: browserTimezone(),
  }));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState(initialError);
  const [billPendingDeletion, setBillPendingDeletion] = useState<Bill | null>(null);

  useEffect(() => {
    if (!message) return;

    const timer = window.setTimeout(() => {
      setMessage("");
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!billPendingDeletion) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        setBillPendingDeletion(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [billPendingDeletion, busy]);

  useEffect(() => {
    const channel = supabase
      .channel(`bills-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bills", filter: `user_id=eq.${userId}` },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === "INSERT") {
            const record = payload.new as Bill;
            setBills((current) =>
              current.some((bill) => bill.id === record.id)
                ? current
                : [...current, record],
            );
          }
          if (payload.eventType === "UPDATE") {
            const record = payload.new as Bill;
            setBills((current) =>
              current.map((bill) => (bill.id === record.id ? record : bill)),
            );
          }
          if (payload.eventType === "DELETE") {
            const record = payload.old as Bill;
            setBills((current) => current.filter((bill) => bill.id !== record.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const todayKey = localDateKey();

  const filteredBills = useMemo(() => {
    const query = search.trim().toLowerCase();
    return bills
      .filter((bill) => {
        const status = effectiveStatus(bill, todayKey);
        const matchesText =
          !query ||
          bill.name.toLowerCase().includes(query) ||
          (bill.company ?? "").toLowerCase().includes(query) ||
          bill.category.toLowerCase().includes(query);
        const matchesStatus = statusFilter === "all" || status === statusFilter;
        const matchesCategory =
          categoryFilter === "all" || bill.category === categoryFilter;
        return matchesText && matchesStatus && matchesCategory;
      })
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [bills, search, statusFilter, categoryFilter, todayKey]);

  const summary = useMemo(() => {
    const active = bills.filter((bill) => bill.status !== "cancelled");
    const pending = active.filter(
      (bill) => effectiveStatus(bill, todayKey) === "pending",
    );
    const overdue = active.filter(
      (bill) => effectiveStatus(bill, todayKey) === "overdue",
    );
    const nextSeven = new Date();
    nextSeven.setDate(nextSeven.getDate() + 7);
    const nextSevenKey = localDateKey(nextSeven);
    const dueThisWeek = pending.filter(
      (bill) => bill.due_date <= nextSevenKey,
    );
    const oneMonthEndKey = oneCalendarMonthEndKey();
    const oneMonthBills = pending.filter(
      (bill) => bill.due_date >= todayKey && bill.due_date <= oneMonthEndKey,
    );
    const oneMonthTotal = sumMoney(oneMonthBills.map((bill) => bill.amount_eur));
    return {
      upcoming: oneMonthBills.length,
      overdue: overdue.length,
      dueThisWeek: dueThisWeek.length,
      oneMonthTotal,
    };
  }, [bills, todayKey]);

  function resetForm() {
    setForm({
      ...EMPTY_FORM,
      due_date: localDateKey(),
      autopay_timezone: browserTimezone(),
    });
    setEditingId(null);
    setShowForm(false);
  }

  function editBill(bill: Bill) {
    setForm({
      name: bill.name,
      company: bill.company ?? "",
      category: bill.category,
      amount: String(bill.amount),
      currency: bill.currency,
      due_date: bill.due_date,
      recurrence: bill.recurrence,
      payment_method: bill.payment_method ?? "Other",
      autopay: bill.autopay,
      autopay_record_time: bill.autopay_record_time?.slice(0, 5) || "09:00",
      autopay_timezone: bill.autopay_timezone || browserTimezone(),
      autopay_enabled_at: bill.autopay_enabled_at,
      reminder_days: String(bill.reminder_days),
      notes: bill.notes ?? "",
    });
    setEditingId(bill.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveBill(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy("save");
    setMessage("");
    const existingBill = editingId
      ? bills.find((bill) => bill.id === editingId) ?? null
      : null;

    try {
      const amount = roundMoney(form.amount);
      if (!form.name.trim() || !Number.isFinite(amount) || amount <= 0) {
        throw new Error("Enter a bill name and a valid amount.");
      }

      const automationChanged =


        !existingBill ||


        !existingBill.autopay ||


        existingBill.due_date !== form.due_date ||


        existingBill.autopay_record_time?.slice(0, 5) !==


          form.autopay_record_time ||


        existingBill.autopay_timezone !== form.autopay_timezone;


      if (


        form.autopay &&


        automationChanged &&


        !automaticScheduleIsFuture(


          form.due_date,


          form.autopay_record_time,


        )


      ) {


        throw new Error(


          "Choose a future due date and time before activating automatic recording.",


        );


      }


      const conversion = await convertToEur(amount, form.currency);
      const payload = {
        user_id: userId,
        name: form.name.trim(),
        company: form.company.trim() || null,
        category: form.category,
        amount,
        currency: form.currency,
        amount_eur: roundMoney(conversion.eur),
        exchange_rate_to_eur: roundRate(conversion.rate),
        due_date: form.due_date,
        recurrence: form.recurrence,
        payment_method: form.payment_method,
        autopay: form.autopay,
        autopay_record_time: form.autopay_record_time,
        autopay_timezone: form.autopay_timezone || browserTimezone(),
        autopay_enabled_at: form.autopay
          ? existingBill?.autopay_enabled_at ?? new Date().toISOString()
          : null,
        recurrence_anchor_day: Number(form.due_date.slice(8, 10)),
        recurrence_anchor_month_end: isMonthEnd(form.due_date),
        reminder_days: Math.min(365, Math.max(0, Math.round(finiteNumber(form.reminder_days)))),
        notes: form.notes.trim() || null,
        status: existingBill?.status ?? ("pending" as BillStatus),
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        if (!existingBill) {
          throw new Error("The bill being edited could not be found.");
        }

        let linkedTransactionBefore: {
          description: string;
          amount: number | string;
          currency: string;
          amount_eur: number | string;
          exchange_rate_to_eur: number | string;
          exchange_rate_date: string | null;
          exchange_rate_source: string | null;
          type: string;
          category: string;
          transaction_date: string;
          occurred_at: string | null;
        } | null = null;

        if (existingBill.status === "paid" && existingBill.transaction_id) {
          const { data: linkedTransaction, error: linkedReadError } =
            await supabase
              .from("transactions")
              .select(
                "description,amount,currency,amount_eur,exchange_rate_to_eur,exchange_rate_date,exchange_rate_source,type,category,transaction_date,occurred_at",
              )
              .eq("id", existingBill.transaction_id)
              .eq("user_id", userId)
              .maybeSingle();
          if (linkedReadError) throw linkedReadError;

          if (linkedTransaction) {
            linkedTransactionBefore = linkedTransaction;
            const { error: linkedUpdateError } = await supabase
              .from("transactions")
              .update({
                description: form.company.trim()
                  ? `${form.name.trim()} · ${form.company.trim()}`
                  : form.name.trim(),
                amount,
                currency: form.currency,
                amount_eur: roundMoney(conversion.eur),
                exchange_rate_to_eur: roundRate(conversion.rate),
                exchange_rate_source: "Bill conversion",
                type: "expense",
                category: form.category,
              })
              .eq("id", existingBill.transaction_id)
              .eq("user_id", userId);
            if (linkedUpdateError) throw linkedUpdateError;
          }
        }

        const { data, error } = await supabase
          .from("bills")
          .update(payload)
          .eq("id", editingId)
          .eq("user_id", userId)
          .select()
          .single();

        if (error) {
          if (linkedTransactionBefore && existingBill.transaction_id) {
            await supabase
              .from("transactions")
              .update(linkedTransactionBefore)
              .eq("id", existingBill.transaction_id)
              .eq("user_id", userId);
          }
          throw error;
        }

        setBills((current) =>
          current.map((bill) => (bill.id === editingId ? (data as Bill) : bill)),
        );
      } else {
        const { data, error } = await supabase
          .from("bills")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setBills((current) =>
          current.some((bill) => bill.id === data.id)
            ? current
            : [...current, data as Bill],
        );
      }

      setMessage(editingId ? "Bill updated." : "Bill added.");
      notifyFiconterDataChange("all");
      resetForm();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The bill could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  async function markPaid(bill: Bill) {
    if (busy || bill.status === "paid") return;

    setBusy(bill.id);
    setMessage("");
    try {
      const paidAt = new Date().toISOString();
      const { data, error } = await supabase.rpc(
        "record_bill_payment_and_advance",
        {
          p_bill_id: bill.id,
          p_paid_at: paidAt,
        },
      );
      if (error) throw error;

      const result = data as {
        bill?: Bill;
        recurring?: boolean;
        next_due_date?: string | null;
        already_recorded?: boolean;
      } | null;
      const updatedBill = result?.bill;

      if (!updatedBill?.id) {
        throw new Error("The recorded bill was not returned by the database.");
      }

      setBills((current) =>
        current.map((item) => (item.id === updatedBill.id ? updatedBill : item)),
      );
      notifyFiconterDataChange("all");

      if (result?.already_recorded) {
        setMessage("This scheduled payment was already recorded.");
      } else if (result?.recurring && result.next_due_date) {
        setMessage(
          `Payment recorded. Next due: ${new Date(
            `${result.next_due_date}T12:00:00`,
          ).toLocaleDateString("en-GB")}.`,
        );
      } else {
        setMessage("Bill marked paid and added to Transactions.");
      }
    } catch (error) {
      setMessage(errorMessage(error, "The bill could not be recorded."));
    } finally {
      setBusy(null);
    }
  }

  async function markUnpaid(bill: Bill) {
    if (busy || bill.status !== "paid") return;

    const busyKey = `unpaid-${bill.id}`;
    setBusy(busyKey);
    setMessage("");

    try {
      const { data, error: rpcError } = await supabase.rpc("mark_bill_unpaid", {
        p_bill_id: bill.id,
      });

      if (!rpcError) {
        const result = data as {
          bill?: Bill;
          deleted_transaction_count?: number;
        } | null;
        const updatedBill = result?.bill;

        if (!updatedBill?.id) {
          throw new Error("The bill was updated, but its new state could not be loaded.");
        }

        setBills((current) =>
          current.map((item) => (item.id === bill.id ? updatedBill : item)),
        );

        notifyFiconterDataChange("all");
        setMessage(
          Number(result?.deleted_transaction_count ?? 0) > 0
            ? "Bill marked unpaid and its linked transaction removed everywhere."
            : "Bill marked unpaid everywhere.",
        );
        return;
      }

      // Some deployments may not have the paid-to-unpaid RPC installed yet.
      // Fall back to the customer's existing RLS-protected update/delete rights
      // so the button still works, then preserve the RPC as the preferred atomic path.
      if (!isMissingMarkUnpaidRpc(rpcError)) {
        console.warn("mark_bill_unpaid RPC failed; using protected fallback", rpcError);
      }

      const now = new Date().toISOString();
      const { data: updated, error: updateError } = await supabase
        .from("bills")
        .update({
          status: "pending",
          paid_at: null,
          transaction_id: null,
          updated_at: now,
        })
        .eq("id", bill.id)
        .eq("user_id", userId)
        .eq("status", "paid")
        .select()
        .single();

      if (updateError) throw updateError;
      if (!updated?.id) throw new Error("The paid bill could not be reopened.");

      if (bill.transaction_id) {
        const { error: transactionError } = await supabase
          .from("transactions")
          .delete()
          .eq("id", bill.transaction_id)
          .eq("user_id", userId);

        if (transactionError) {
          // Restore the original paid state if the linked transaction cannot be
          // removed, preventing Bills and Transactions from disagreeing.
          await supabase
            .from("bills")
            .update({
              status: "paid",
              paid_at: bill.paid_at,
              transaction_id: bill.transaction_id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", bill.id)
            .eq("user_id", userId);

          throw transactionError;
        }
      }

      setBills((current) =>
        current.map((item) => (item.id === bill.id ? (updated as Bill) : item)),
      );
      notifyFiconterDataChange("all");
      setMessage(
        bill.transaction_id
          ? "Bill marked unpaid and its linked transaction removed everywhere."
          : "Bill marked unpaid everywhere.",
      );
    } catch (error) {
      const details = errorMessage(error, "The bill could not be marked unpaid.");
      setMessage(
        details.toLowerCase().includes("row-level security")
          ? "The bill could not be changed because your session is no longer authorized. Please sign in again."
          : details,
      );
    } finally {
      setBusy(null);
    }
  }

  function requestBillDeletion(bill: Bill) {
    if (busy) return;
    setBillPendingDeletion(bill);
  }

  async function confirmBillDeletion() {
    const bill = billPendingDeletion;
    if (!bill || busy) return;

    setBusy(`delete-${bill.id}`);
    setMessage("");

    try {
      const { data: result, error } = await supabase.rpc(
        "delete_bill_with_transaction",
        { p_bill_id: bill.id },
      );
      if (error) throw error;

      const deletedBill = (result as { bill?: Bill } | null)?.bill;
      if (!deletedBill || deletedBill.id !== bill.id) {
        throw new Error("The deleted bill was not returned by the database.");
      }

      setBills((current) => current.filter((item) => item.id !== bill.id));
      setBillPendingDeletion(null);
      notifyFiconterDataChange("all");
      setMessage(
        bill.transaction_id
          ? "Bill and linked transaction deleted."
          : "Bill deleted.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The bill could not be deleted.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.summaryGrid}>
        <article><Clock3 /><span>Upcoming</span><strong>{summary.upcoming}</strong></article>
        <article><CalendarDays /><span>Due this week</span><strong>{summary.dueThisWeek}</strong></article>
        <article className={summary.overdue ? styles.warningCard : ""}><CircleAlert /><span>Overdue</span><strong>{summary.overdue}</strong></article>
        <article><span className={styles.euro}>€</span><span>One-month commitments</span><strong>{money(summary.oneMonthTotal)}</strong></article>
      </div>

      <div className={styles.actionRow}>
        <div>
          <h2>All bills</h2>
          <p>Paid and unpaid status changes stay synchronized with Transactions and all live financial totals.</p>
        </div>
        <button className={styles.primaryButton} onClick={() => setShowForm((value) => !value)}>
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? "Close form" : "Add bill"}
        </button>
      </div>

      {showForm && (
        <form className={styles.formCard} onSubmit={saveBill}>
          <div className={styles.formHeading}>
            <div>
              <span>{editingId ? "EDIT BILL" : "NEW BILL"}</span>
              <h3>{editingId ? "Update obligation" : "Add an obligation"}</h3>
            </div>
            {editingId && <button type="button" className={styles.textButton} onClick={resetForm}>Cancel edit</button>}
          </div>

          <div className={styles.formGrid}>
            <label>Bill name<input value={form.name} onChange={(e) => setForm({...form, name:e.target.value})} placeholder="e.g. Electricity" required /></label>
            <label>Company<input value={form.company} onChange={(e) => setForm({...form, company:e.target.value})} placeholder="Optional" /></label>
            <label>Category<select value={form.category} onChange={(e) => setForm({...form, category:e.target.value})}>{CATEGORIES.map((item)=><option key={item}>{item}</option>)}</select></label>
            <label>Amount<div className={styles.amountField}><input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e)=>setForm({...form, amount:e.target.value})} required /><select value={form.currency} onChange={(e)=>setForm({...form, currency:e.target.value})}>{CURRENCIES.map((item)=><option key={item}>{item}</option>)}</select></div></label>
            <label>Due date<input type="date" value={form.due_date} onChange={(e)=>setForm({...form, due_date:e.target.value})} required /></label>
            <label>Repeats<select value={form.recurrence} onChange={(e)=>setForm({...form, recurrence:e.target.value as Recurrence})}><option value="none">One time</option><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="semiannual">Every 6 months</option><option value="yearly">Yearly</option></select></label>
            <label>Payment method<select value={form.payment_method} onChange={(e)=>setForm({...form, payment_method:e.target.value})}>{PAYMENT_METHODS.map((item)=><option key={item}>{item}</option>)}</select></label>
            <label>Reminder<select value={form.reminder_days} onChange={(e)=>setForm({...form, reminder_days:e.target.value})}><option value="0">On due date</option><option value="1">1 day before</option><option value="3">3 days before</option><option value="7">1 week before</option><option value="14">2 weeks before</option><option value="30">1 month before</option></select></label>
            <label className={styles.fullWidth}>Notes<textarea value={form.notes} onChange={(e)=>setForm({...form, notes:e.target.value})} rows={3} placeholder="Optional details" /></label>
            <label className={`${styles.checkLabel} ${styles.fullWidth}`}>
              <input
                type="checkbox"
                checked={form.autopay}
                onChange={(e) =>
                  setForm({
                    ...form,
                    autopay: e.target.checked,
                    autopay_timezone: form.autopay_timezone || browserTimezone(),
                  })
                }
              />
              Automatically record this payment on its due date
            </label>
            {form.autopay ? (
              <div className={`${styles.automationPanel} ${styles.fullWidth}`}>
                <div className={styles.automationGrid}>
                  <label>
                    Automatic record time
                    <input
                      type="time"
                      step="60"
                      value={form.autopay_record_time}
                      onChange={(e) =>
                        setForm({ ...form, autopay_record_time: e.target.value })
                      }
                      required
                    />
                  </label>
                  <div className={styles.automationTimezone}>
                    <span>Time zone</span>
                    <strong>{form.autopay_timezone}</strong>
                  </div>
                </div>
                <p>
                  FICONTER creates the expected transaction automatically. It
                  does not send money or contact your bank.
                </p>
              </div>
            ) : null}
          </div>

          <button className={styles.saveButton} disabled={busy === "save"}>
            {busy === "save" ? "Saving…" : editingId ? "Save changes" : "Save bill"}
          </button>
        </form>
      )}

      {message && <div className={styles.message}>{message}</div>}

      <div className={styles.filters}>
        <label className={styles.search}><Search size={17}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search bills, companies or categories" /></label>
        <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="overdue">Overdue</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option></select>
        <select value={categoryFilter} onChange={(e)=>setCategoryFilter(e.target.value)}><option value="all">All categories</option>{CATEGORIES.map((item)=><option key={item}>{item}</option>)}</select>
      </div>

      <div className={`${styles.billList} ficonter-scroll-region`}>
        {filteredBills.length === 0 ? (
          <div className={styles.emptyState}>
            <CalendarDays size={32}/>
            <h3>No bills found</h3>
            <p>Add your first bill or reset the current filters.</p>
          </div>
        ) : filteredBills.map((bill) => {
          const status = effectiveStatus(bill, todayKey);
          return (
            <article className={styles.billCard} key={bill.id}>
              <div className={styles.dateBox}>
                <strong>{new Date(`${bill.due_date}T12:00:00`).toLocaleDateString("en-GB",{day:"2-digit"})}</strong>
                <span>{new Date(`${bill.due_date}T12:00:00`).toLocaleDateString("en-GB",{month:"short"})}</span>
              </div>
              <div className={styles.billIdentity}>
                <div className={styles.titleLine}>
                  <h3>{bill.name}</h3>
                  <span className={`${styles.status} ${styles[status]}`}>{status}</span>
                </div>
                <p>{bill.company || "No company"} · {bill.category}</p>
                <small>
                  {bill.recurrence === "none" ? "One-time bill" : bill.recurrence}
                  {" · "}
                  {bill.autopay
                    ? bill.autopay_enabled_at
                      ? `Automatic recording at ${
                          bill.autopay_record_time?.slice(0, 5) || "09:00"
                        }`
                      : "Automatic recording needs one save to activate"
                    : "Manual recording"}
                </small>
              </div>
              <div className={styles.amount}>
                <strong>{money(bill.amount_eur, "EUR")}</strong>
                {bill.currency !== "EUR" && <span>{money(bill.amount, bill.currency)}</span>}
              </div>
              <div className={styles.cardActions}>
                {status !== "paid" && status !== "cancelled" && (
                  <button
                    type="button"
                    className={styles.paidButton}
                    onClick={() => void markPaid(bill)}
                    disabled={Boolean(busy)}
                    aria-busy={busy === bill.id}
                  >
                    <Check size={16} />
                    {busy === bill.id ? "Updating…" : "Mark paid"}
                  </button>
                )}
                {status === "paid" && (
                  <button
                    type="button"
                    className={`${styles.paidButton} ${styles.unpaidButton}`}
                    onClick={() => void markUnpaid(bill)}
                    disabled={Boolean(busy)}
                    aria-busy={busy === `unpaid-${bill.id}`}
                  >
                    <RotateCcw size={16} />
                    {busy === `unpaid-${bill.id}` ? "Updating…" : "Mark unpaid"}
                  </button>
                )}
                <button type="button" className={styles.iconButton} onClick={()=>editBill(bill)} aria-label="Edit bill"><Edit3 size={17}/></button>
                <button type="button" className={`${styles.iconButton} ${styles.deleteButton}`} onClick={()=>requestBillDeletion(bill)} aria-label="Delete bill"><Trash2 size={17}/></button>
              </div>
            </article>
          );
        })}
      </div>

      {billPendingDeletion && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setBillPendingDeletion(null);
            }
          }}
        >
          <section
            className={styles.confirmModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-bill-title"
            aria-describedby="delete-bill-description"
          >
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setBillPendingDeletion(null)}
              disabled={Boolean(busy)}
              aria-label="Close confirmation"
            >
              <X size={19} />
            </button>

            <div className={styles.modalIcon}>
              <Trash2 size={24} />
            </div>

            <span className={styles.modalEyebrow}>CONFIRM DELETION</span>
            <h3 id="delete-bill-title">Delete this bill?</h3>
            <p id="delete-bill-description">
              <strong>{billPendingDeletion.name}</strong> will be permanently
              removed.
              {billPendingDeletion.transaction_id
                ? " Its linked transaction will also be removed from Transactions and all live totals."
                : ""}
            </p>

            <div className={styles.modalBillSummary}>
              <div>
                <span>Bill</span>
                <strong>{billPendingDeletion.name}</strong>
              </div>
              <div>
                <span>EUR value</span>
                <strong>{money(billPendingDeletion.amount_eur, "EUR")}</strong>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                onClick={() => setBillPendingDeletion(null)}
                disabled={Boolean(busy)}
              >
                Keep bill
              </button>
              <button
                type="button"
                data-enter-confirm="true"
                className={styles.modalDelete}
                onClick={confirmBillDeletion}
                disabled={Boolean(busy)}
              >
                <Trash2 size={17} />
                {busy === `delete-${billPendingDeletion.id}`
                  ? "Deleting…"
                  : "Delete bill"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
