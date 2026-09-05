"use client";

import Link from "next/link";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Edit3,
  Gauge,
  Plus,
  ReceiptText,
  RefreshCw,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { notifyFiconterDataChange } from "@/lib/ficonterRealtime";
import {
  convertWithCachedRate,
  getExchangeRate,
} from "@/lib/performance/exchangeRateCache";
import {
  finiteNumber,
  roundMoney,
  roundRate,
  sumMoney,
} from "@/lib/finance/money";
import { CURRENCY_CODES, currencyName, currencySymbol, formatCurrency } from "@/lib/financialOptions";
import { useCurrencyDisplay, useHistoricalReportingRates } from "@/components/CurrencyDisplayProvider";
import { currentRecordAmountInBaseCurrency, historicalRecordAmountInBaseCurrency } from "@/lib/finance/baseCurrencyReconciliation";
import { creditCardMinimumPayment } from "@/lib/finance/creditCardAccounting";
import styles from "./CreditCardsManager.module.css";

type CreditCardDebt = {
  id: string;
  user_id: string;
  name: string;
  lender: string | null;
  description: string | null;
  category: string;
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
  status: "active" | "paid_off" | "paused";
  card_last_four: string | null;
  credit_limit: number | string | null;
  credit_limit_eur: number | string | null;
  statement_balance: number | string | null;
  statement_balance_eur: number | string | null;
  statement_date: string | null;
  payment_due_date: string | null;
  interest_charged: number | string;
  interest_charged_eur: number | string;
  created_at: string;
  updated_at: string;
};

type CreditCardActivityType =
  | "purchase"
  | "interest"
  | "fee"
  | "refund"
  | "adjustment_increase"
  | "adjustment_decrease"
  | "statement_adjustment";

type CreditCardActivity = {
  id: string;
  debt_id: string;
  user_id: string;
  activity_type: CreditCardActivityType;
  description: string;
  amount: number | string;
  currency: string;
  amount_eur: number | string;
  exchange_rate_to_eur: number | string;
  balance_effect: number | string;
  balance_effect_eur: number | string;
  occurred_at: string;
  notes: string | null;
  created_at: string;
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

type CreditCardMonthlyRecord = {
  id: string;
  debt_id: string;
  user_id: string;
  month_start: string;
  currency: string;
  statement_balance: number | string;
  statement_balance_eur: number | string;
  minimum_payment: number | string;
  minimum_payment_eur: number | string;
  interest_charged: number | string;
  interest_charged_eur: number | string;
  statement_date: string;
  payment_due_date: string;
  created_at: string;
  updated_at: string;
};

type CardForm = {
  name: string;
  lender: string;
  last_four: string;
  currency: string;
  opening_balance: string;
  credit_limit: string;
  apr: string;
  start_date: string;
  description: string;
};

type StatementForm = {
  statement_balance: string;
  statement_date: string;
  payment_due_date: string;
  minimum_payment: string;
  apr: string;
  interest_charged: string;
};

type ActivityForm = {
  activity_type: Exclude<CreditCardActivityType, "statement_adjustment">;
  description: string;
  amount: string;
  occurred_at: string;
  notes: string;
};

type PaymentForm = {
  amount: string;
  paid_at: string;
  notes: string;
};

type TimelineItem =
  | { kind: "activity"; date: string; activity: CreditCardActivity }
  | { kind: "payment"; date: string; payment: DebtPayment };

const ACTIVITY_OPTIONS: Array<{
  value: ActivityForm["activity_type"];
  label: string;
}> = [
  { value: "purchase", label: "Purchase" },
  { value: "interest", label: "Interest charge" },
  { value: "fee", label: "Fee" },
  { value: "refund", label: "Refund or card credit" },
  { value: "adjustment_increase", label: "Balance increase" },
  { value: "adjustment_decrease", label: "Balance decrease" },
];

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDateTimeKey(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${localDateKey(date)}T${hours}:${minutes}`;
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthTitle(month: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${month}-01T12:00:00`));
}

function monthStart(month: string) {
  return `${month}-01`;
}

function dateTimeForMonth(month: string) {
  const currentMonth = monthKey();
  if (month === currentMonth) return localDateTimeKey();
  return `${month}-01T12:00`;
}

function dateForMonth(month: string) {
  const currentMonth = monthKey();
  if (month === currentMonth) return localDateKey();
  return `${month}-01`;
}

function inMonth(value: string | null | undefined, month: string) {
  return Boolean(value?.startsWith(month));
}

const EMPTY_CARD: CardForm = {
  name: "",
  lender: "",
  last_four: "",
  currency: "EUR",
  opening_balance: "0",
  credit_limit: "",
  apr: "0",
  start_date: localDateKey(),
  description: "",
};

const EMPTY_STATEMENT: StatementForm = {
  statement_balance: "",
  statement_date: localDateKey(),
  payment_due_date: "",
  minimum_payment: "",
  apr: "0",
  interest_charged: "0",
};

const EMPTY_ACTIVITY: ActivityForm = {
  activity_type: "purchase",
  description: "",
  amount: "",
  occurred_at: localDateTimeKey(),
  notes: "",
};

const EMPTY_PAYMENT: PaymentForm = {
  amount: "",
  paid_at: localDateTimeKey(),
  notes: "",
};

function automaticMinimumPayment(balanceValue: unknown) {
  return creditCardMinimumPayment(balanceValue);
}

function money(value: unknown, currency = "EUR") {
  return formatCurrency(finiteNumber(value), currency);
}

function readableDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function readableDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
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

function upsertById<T extends { id: string }>(items: T[], next: T) {
  return [next, ...items.filter((item) => item.id !== next.id)];
}

function activityLabel(type: CreditCardActivityType) {
  const labels: Record<CreditCardActivityType, string> = {
    purchase: "Purchase",
    interest: "Interest",
    fee: "Fee",
    refund: "Refund",
    adjustment_increase: "Balance increase",
    adjustment_decrease: "Balance decrease",
    statement_adjustment: "Statement reconciliation",
  };
  return labels[type];
}

export function CreditCardsManager({
  userId,
  initialCards,
  initialActivities,
  initialPayments,
  initialMonthlyRecords,
  initialError,
}: {
  userId: string;
  initialCards: CreditCardDebt[];
  initialActivities: CreditCardActivity[];
  initialPayments: DebtPayment[];
  initialMonthlyRecords: CreditCardMonthlyRecord[];
  initialError: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { baseCurrency, latestRate } = useCurrencyDisplay();
  const [cards, setCards] = useState(initialCards);
  const [activities, setActivities] = useState(initialActivities);
  const [payments, setPayments] = useState(initialPayments);
  const [monthlyRecords, setMonthlyRecords] = useState(initialMonthlyRecords);
  const currencyDates = useMemo(
    () => [
      ...activities.map((activity) => activity.occurred_at.slice(0, 10)),
      ...payments.map((payment) => payment.paid_at.slice(0, 10)),
      ...monthlyRecords.map((record) => record.statement_date),
    ],
    [activities, monthlyRecords, payments],
  );
  const { rateForDate } = useHistoricalReportingRates(currencyDates);
  const currencyContext = useMemo(
    () => ({ baseCurrency, latestRate, rateForDate }),
    [baseCurrency, latestRate, rateForDate],
  );
  const currentField = useCallback(
    (native: unknown, currency: unknown, eur: unknown) =>
      currentRecordAmountInBaseCurrency({ originalAmount: native, originalCurrency: currency, amountEur: eur, context: currencyContext }),
    [currencyContext],
  );
  const historicalField = useCallback(
    (native: unknown, currency: unknown, eur: unknown, date: string | null | undefined) =>
      historicalRecordAmountInBaseCurrency({ originalAmount: native, originalCurrency: currency, amountEur: eur, date: date?.slice(0, 10), context: currencyContext }),
    [currencyContext],
  );
  const displayMoney = useCallback(
    (value: unknown) => formatCurrency(finiteNumber(value), baseCurrency),
    [baseCurrency],
  );
  const cardCurrent = useCallback((card: CreditCardDebt) => currentField(card.current_balance, card.currency, card.current_balance_eur), [currentField]);
  const cardLimit = useCallback((card: CreditCardDebt) => card.credit_limit == null || card.credit_limit_eur == null ? 0 : currentField(card.credit_limit, card.currency, card.credit_limit_eur), [currentField]);
  const paymentBase = useCallback((payment: DebtPayment) => historicalField(payment.amount, payment.currency, payment.amount_eur, payment.paid_at), [historicalField]);
  const activityAmountBase = useCallback((activity: CreditCardActivity) => historicalField(activity.amount, activity.currency, activity.amount_eur, activity.occurred_at), [historicalField]);
  const activityEffectBase = useCallback((activity: CreditCardActivity) => historicalField(activity.balance_effect, activity.currency, activity.balance_effect_eur, activity.occurred_at), [historicalField]);
  const recordFieldBase = useCallback((record: CreditCardMonthlyRecord, native: unknown, eur: unknown) => historicalField(native, record.currency, eur, record.statement_date), [historicalField]);

  const carriedForwardNative = useCallback((card: CreditCardDebt, month: string) => {
    const start = new Date(`${month}-01T00:00:00`).getTime();
    const activityEffectsAfterStart = sumMoney(
      activities
        .filter((activity) =>
          activity.debt_id === card.id &&
          new Date(activity.occurred_at).getTime() >= start,
        )
        .map((activity) => finiteNumber(activity.balance_effect)),
    );
    const paymentsAfterStart = sumMoney(
      payments
        .filter((payment) =>
          payment.debt_id === card.id &&
          new Date(payment.paid_at).getTime() >= start,
        )
        .map((payment) => finiteNumber(payment.amount)),
    );

    return Math.max(
      0,
      roundMoney(
        finiteNumber(card.current_balance) -
          activityEffectsAfterStart +
          paymentsAfterStart,
      ),
    );
  }, [activities, payments]);

  const carriedForwardEur = useCallback((card: CreditCardDebt, month: string) => {
    const start = new Date(`${month}-01T00:00:00`).getTime();
    const activityEffectsAfterStart = sumMoney(
      activities
        .filter((activity) =>
          activity.debt_id === card.id &&
          new Date(activity.occurred_at).getTime() >= start,
        )
        .map((activity) => finiteNumber(activity.balance_effect_eur)),
    );
    const paymentsAfterStart = sumMoney(
      payments
        .filter((payment) =>
          payment.debt_id === card.id &&
          new Date(payment.paid_at).getTime() >= start,
        )
        .map((payment) => finiteNumber(payment.amount_eur)),
    );

    return Math.max(
      0,
      roundMoney(
        finiteNumber(card.current_balance_eur) -
          activityEffectsAfterStart +
          paymentsAfterStart,
      ),
    );
  }, [activities, payments]);

  const carriedForwardBase = useCallback((card: CreditCardDebt, month: string) =>
    currentField(
      carriedForwardNative(card, month),
      card.currency,
      carriedForwardEur(card, month),
    ),
  [carriedForwardEur, carriedForwardNative, currentField]);
  const [selectedMonth, setSelectedMonth] = useState(monthKey());
  const [cardForm, setCardForm] = useState<CardForm>(EMPTY_CARD);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [statementTarget, setStatementTarget] = useState<CreditCardDebt | null>(null);
  const [statementForm, setStatementForm] = useState<StatementForm>(EMPTY_STATEMENT);
  const [activityTarget, setActivityTarget] = useState<CreditCardDebt | null>(null);
  const [activityForm, setActivityForm] = useState<ActivityForm>(EMPTY_ACTIVITY);
  const [paymentTarget, setPaymentTarget] = useState<CreditCardDebt | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(EMPTY_PAYMENT);
  const [deletingCard, setDeletingCard] = useState<CreditCardDebt | null>(null);
  const [deletingActivity, setDeletingActivity] = useState<CreditCardActivity | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<DebtPayment | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState(initialError);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const channel = supabase
      .channel(`credit-cards-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "debts",
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          setCards((current) => {
            if (payload.eventType === "DELETE") {
              const id = (payload.old as { id?: string }).id;
              return current.filter((card) => card.id !== id);
            }

            const next = payload.new as CreditCardDebt;
            if (next.category?.toLowerCase() !== "credit card") {
              return current.filter((card) => card.id !== next.id);
            }
            return upsertById(current, next).sort(
              (a, b) => cardCurrent(b) - cardCurrent(a),
            );
          });
          notifyFiconterDataChange("all");
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "credit_card_activities",
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          setActivities((current) => {
            if (payload.eventType === "DELETE") {
              const id = (payload.old as { id?: string }).id;
              return current.filter((activity) => activity.id !== id);
            }
            const next = payload.new as CreditCardActivity;
            return upsertById(current, next).sort(
              (a, b) =>
                new Date(b.occurred_at).getTime() -
                new Date(a.occurred_at).getTime(),
            );
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
              return current.filter((payment) => payment.id !== id);
            }
            const next = payload.new as DebtPayment;
            return upsertById(current, next).sort(
              (a, b) =>
                new Date(b.paid_at).getTime() -
                new Date(a.paid_at).getTime(),
            );
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "credit_card_monthly_records",
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          setMonthlyRecords((current) => {
            if (payload.eventType === "DELETE") {
              const id = (payload.old as { id?: string }).id;
              return current.filter((record) => record.id !== id);
            }
            const next = payload.new as CreditCardMonthlyRecord;
            return upsertById(current, next).sort(
              (a, b) => b.month_start.localeCompare(a.month_start),
            );
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [cardCurrent, supabase, userId]);

  const totals = useMemo(() => {
    const activeCards = cards.filter((card) => card.status !== "paused");
    const outstanding = sumMoney(activeCards.map(cardCurrent));
    const availableCredit = sumMoney(activeCards.map((card) => Math.max(0, cardLimit(card) - cardCurrent(card))));
    return { outstanding, availableCredit };
  }, [cardCurrent, cardLimit, cards]);

  function shiftMonth(offset: number) {
    const next = new Date(`${selectedMonth}-01T12:00:00`);
    next.setMonth(next.getMonth() + offset);
    setSelectedMonth(monthKey(next));
  }

  function monthlyRecordFor(cardId: string, month = selectedMonth) {
    return (
      monthlyRecords.find(
        (record) =>
          record.debt_id === cardId &&
          record.month_start.startsWith(month),
      ) ?? null
    );
  }

  function nextMonthlyRecord(record: CreditCardMonthlyRecord) {
    return (
      monthlyRecords
        .filter(
          (candidate) =>
            candidate.debt_id === record.debt_id &&
            candidate.statement_date > record.statement_date,
        )
        .sort((a, b) =>
          a.statement_date.localeCompare(b.statement_date),
        )[0] ?? null
    );
  }

  function paymentsTowardStatement(
    card: CreditCardDebt,
    record: CreditCardMonthlyRecord | null,
  ) {
    if (!record?.statement_date) return 0;
    const nextRecord = nextMonthlyRecord(record);
    const start = new Date(
      `${record.statement_date}T00:00:00`,
    ).getTime();
    const end = nextRecord
      ? new Date(`${nextRecord.statement_date}T00:00:00`).getTime()
      : Number.POSITIVE_INFINITY;

    return sumMoney(
      payments
        .filter((payment) => {
          if (payment.debt_id !== card.id) return false;
          const paidAt = new Date(payment.paid_at).getTime();
          return paidAt >= start && paidAt < end;
        })
        .map(paymentBase),
    );
  }

  function monthlyMetrics(card: CreditCardDebt) {
    const record = monthlyRecordFor(card.id);
    const isCurrentMonth = selectedMonth === monthKey();
    const monthActivities = activities.filter(
      (activity) =>
        activity.debt_id === card.id &&
        inMonth(activity.occurred_at, selectedMonth),
    );
    const monthPayments = payments.filter(
      (payment) =>
        payment.debt_id === card.id &&
        inMonth(payment.paid_at, selectedMonth),
    );
    const paidThisMonth = sumMoney(monthPayments.map(paymentBase));
    const paidTowardStatement = paymentsTowardStatement(card, record);
    const liveMinimumPayment = automaticMinimumPayment(cardCurrent(card));
    const recordedMinimumPayment = record
      ? recordFieldBase(record, record.minimum_payment, record.minimum_payment_eur)
      : 0;
    const minimumPayment = isCurrentMonth
      ? liveMinimumPayment
      : recordedMinimumPayment;
    const recordedStatementBalance = record
      ? recordFieldBase(record, record.statement_balance, record.statement_balance_eur)
      : 0;
    const carriedForwardBalance = carriedForwardBase(card, selectedMonth);
    const statementBalance = record
      ? recordedStatementBalance
      : carriedForwardBalance;
    const minimumRemaining = isCurrentMonth
      ? minimumPayment
      : Math.max(
          0,
          roundMoney(minimumPayment - paidTowardStatement),
        );
    const statementRemaining = cardCurrent(card);
    const purchases = sumMoney(
      monthActivities
        .filter((activity) => activity.activity_type === "purchase")
        .map(activityAmountBase),
    );
    const fees = sumMoney(
      monthActivities
        .filter((activity) => activity.activity_type === "fee")
        .map(activityAmountBase),
    );
    const refunds = sumMoney(
      monthActivities
        .filter((activity) => activity.activity_type === "refund")
        .map(activityAmountBase),
    );
    const activityInterest = sumMoney(
      monthActivities
        .filter((activity) => activity.activity_type === "interest")
        .map(activityAmountBase),
    );
    const interest = record
      ? recordFieldBase(record, record.interest_charged, record.interest_charged_eur)
      : activityInterest;

    return {
      record,
      paidThisMonth,
      paidTowardStatement,
      minimumPayment,
      minimumRemaining,
      statementBalance,
      recordedStatementBalance,
      carriedForwardBalance,
      statementRemaining,
      isCurrentMonth,
      interest,
      purchases,
      fees,
      refunds,
      monthActivities,
      monthPayments,
    };
  }

  const monthlyTotals = useMemo(() => {
    const cardIds = new Set(cards.map((card) => card.id));
    const monthRecords = monthlyRecords.filter(
      (record) =>
        cardIds.has(record.debt_id) &&
        record.month_start.startsWith(selectedMonth),
    );
    const paidThisMonth = sumMoney(
      payments
        .filter(
          (payment) =>
            cardIds.has(payment.debt_id) &&
            inMonth(payment.paid_at, selectedMonth),
        )
        .map(paymentBase),
    );
    const interest = sumMoney(
      cards.map((card) => {
        const record = monthRecords.find(
          (item) => item.debt_id === card.id,
        );
        if (record) return recordFieldBase(record, record.interest_charged, record.interest_charged_eur);
        return sumMoney(
          activities
            .filter(
              (activity) =>
                activity.debt_id === card.id &&
                activity.activity_type === "interest" &&
                inMonth(activity.occurred_at, selectedMonth),
            )
            .map(activityAmountBase),
        );
      }),
    );
    const statementBalances = sumMoney(
      cards.map((card) => {
        const record = monthRecords.find((item) => item.debt_id === card.id);
        return record
          ? recordFieldBase(
              record,
              record.statement_balance,
              record.statement_balance_eur,
            )
          : carriedForwardBase(card, selectedMonth);
      }),
    );
    const remainingByCard = cards.map((card) => {
      const record = monthRecords.find(
        (item) => item.debt_id === card.id,
      );
      if (selectedMonth === monthKey()) {
        return {
          minimumRemaining: automaticMinimumPayment(cardCurrent(card)),
          statementRemaining: cardCurrent(card),
        };
      }

      if (!record) {
        return {
          minimumRemaining: 0,
          statementRemaining: cardCurrent(card),
        };
      }

      const nextRecord =
        monthlyRecords
          .filter(
            (candidate) =>
              candidate.debt_id === record.debt_id &&
              candidate.statement_date > record.statement_date,
          )
          .sort((a, b) =>
            a.statement_date.localeCompare(b.statement_date),
          )[0] ?? null;
      const start = new Date(
        `${record.statement_date}T00:00:00`,
      ).getTime();
      const end = nextRecord
        ? new Date(
            `${nextRecord.statement_date}T00:00:00`,
          ).getTime()
        : Number.POSITIVE_INFINITY;
      const paidBase = sumMoney(
        payments
          .filter((payment) => {
            if (payment.debt_id !== card.id) return false;
            const paidAt = new Date(payment.paid_at).getTime();
            return paidAt >= start && paidAt < end;
          })
          .map(paymentBase),
      );

      return {
        minimumRemaining: Math.max(
          0,
          roundMoney(
            recordFieldBase(record, record.minimum_payment, record.minimum_payment_eur) - paidBase,
          ),
        ),
        statementRemaining: cardCurrent(card),
      };
    });
    const minimumRemaining = sumMoney(
      remainingByCard.map((item) => item.minimumRemaining),
    );
    const statementRemaining = sumMoney(
      remainingByCard.map((item) => item.statementRemaining),
    );

    return {
      statementBalances,
      paidThisMonth,
      minimumRemaining,
      statementRemaining,
      interest,
    };
  }, [activities, activityAmountBase, cards, carriedForwardBase, monthlyRecords, paymentBase, payments, recordFieldBase, selectedMonth]);

  function resetCardForm() {
    setCardForm({ ...EMPTY_CARD, start_date: localDateKey() });
    setEditingCardId(null);
    setShowCardForm(false);
  }

  function editCard(card: CreditCardDebt) {
    setCardForm({
      name: card.name,
      lender: card.lender ?? "",
      last_four: card.card_last_four ?? "",
      currency: card.currency,
      opening_balance: String(card.current_balance),
      credit_limit:
        card.credit_limit === null || card.credit_limit === undefined
          ? ""
          : String(card.credit_limit),
      apr: String(card.annual_interest_rate),
      start_date: card.start_date ?? "",
      description: card.description ?? "",
    });
    setEditingCardId(card.id);
    setShowCardForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openStatement(card: CreditCardDebt) {
    const record = monthlyRecordFor(card.id);
    const defaultStatementDate =
      record?.statement_date ?? dateForMonth(selectedMonth);
    const defaultDue = new Date(`${defaultStatementDate}T12:00:00`);
    defaultDue.setDate(defaultDue.getDate() + 21);
    const statementBalance = finiteNumber(
      record?.statement_balance ??
        carriedForwardNative(card, selectedMonth),
    );
    const minimumBasis =
      selectedMonth === monthKey() ? cardCurrent(card) : statementBalance;

    setStatementTarget(card);
    setStatementForm({
      statement_balance: String(statementBalance),
      statement_date: defaultStatementDate,
      payment_due_date:
        record?.payment_due_date ?? localDateKey(defaultDue),
      minimum_payment: String(
        automaticMinimumPayment(minimumBasis),
      ),
      apr: String(card.annual_interest_rate ?? 0),
      interest_charged: String(
        record?.interest_charged ??
          (inMonth(card.statement_date, selectedMonth)
            ? card.interest_charged
            : 0),
      ),
    });
  }

  function openActivity(card: CreditCardDebt) {
    setActivityTarget(card);
    setActivityForm({
      ...EMPTY_ACTIVITY,
      occurred_at: dateTimeForMonth(selectedMonth),
    });
  }

  function openPayment(card: CreditCardDebt) {
    const metrics = monthlyMetrics(card);
    const suggested = Math.min(
      finiteNumber(card.current_balance),
      metrics.minimumRemaining > 0
        ? metrics.minimumRemaining
        : finiteNumber(card.current_balance),
    );
    setPaymentTarget(card);
    setPaymentForm({
      amount: suggested > 0 ? String(roundMoney(suggested)) : "",
      paid_at: dateTimeForMonth(selectedMonth),
      notes: `Credit-card payment · ${monthTitle(selectedMonth)}`,
    });
  }

  function paymentStatus(
    record: CreditCardMonthlyRecord | null,
    paidTowardStatement: number,
  ) {
    const minimum = finiteNumber(record?.minimum_payment);
    if (!record || minimum <= 0) return "No statement recorded";
    if (paidTowardStatement >= minimum) return "Minimum paid";
    if (paidTowardStatement > 0) return "Partially paid";
    return "Payment due";
  }

  async function saveCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("save-card");
    setNotice("");

    try {
      const openingBalance = roundMoney(cardForm.opening_balance || 0);
      const creditLimit = roundMoney(cardForm.credit_limit || 0);
      const apr = finiteNumber(cardForm.apr || 0);
      const lastFour = cardForm.last_four.trim();

      if (!cardForm.name.trim()) {
        throw new Error("Enter a card name.");
      }
      if (openingBalance < 0 || creditLimit < 0 || apr < 0) {
        throw new Error("Balances, credit limit and APR cannot be negative.");
      }
      if (lastFour && !/^\d{4}$/.test(lastFour)) {
        throw new Error("Last four digits must contain exactly four numbers.");
      }

      const limitConversion = await convertToEur(
        creditLimit,
        cardForm.currency,
      );

      if (editingCardId) {
        const existing = cards.find((card) => card.id === editingCardId);
        if (!existing) throw new Error("Credit card not found.");

        const { data, error } = await supabase
          .from("debts")
          .update({
            name: cardForm.name.trim(),
            lender: cardForm.lender.trim() || null,
            description: cardForm.description.trim() || null,
            card_last_four: lastFour || null,
            credit_limit: roundMoney(creditLimit),
            credit_limit_eur: roundMoney(limitConversion.eur),
            annual_interest_rate: apr,
            start_date: cardForm.start_date || null,
            autopay: false,
            autopay_enabled_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingCardId)
          .eq("user_id", userId)
          .ilike("category", "credit card")
          .select()
          .single();

        if (error) throw error;
        setCards((current) => upsertById(current, data as CreditCardDebt));
        setNotice("Credit card details updated.");
      } else {
        const openingConversion = await convertToEur(
          openingBalance,
          cardForm.currency,
        );

        const { data, error } = await supabase
          .from("debts")
          .insert({
            user_id: userId,
            name: cardForm.name.trim(),
            lender: cardForm.lender.trim() || null,
            description: cardForm.description.trim() || null,
            category: "Credit card",
            original_balance: roundMoney(openingBalance),
            current_balance: roundMoney(openingBalance),
            currency: cardForm.currency,
            original_balance_eur: roundMoney(openingConversion.eur),
            current_balance_eur: roundMoney(openingConversion.eur),
            exchange_rate_to_eur: roundRate(openingConversion.rate),
            annual_interest_rate: apr,
            minimum_payment: 0,
            minimum_payment_eur: 0,
            payment_due_day: null,
            autopay: false,
            autopay_enabled_at: null,
            start_date: cardForm.start_date || null,
            maturity_date: null,
            status: "active",
            card_last_four: lastFour || null,
            credit_limit: roundMoney(creditLimit),
            credit_limit_eur: roundMoney(limitConversion.eur),
            statement_balance: null,
            statement_balance_eur: null,
            statement_date: null,
            payment_due_date: null,
            interest_charged: 0,
            interest_charged_eur: 0,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        setCards((current) => upsertById(current, data as CreditCardDebt));
        setNotice("Credit card added without duplicating it in Debt.");
      }

      resetCardForm();
      notifyFiconterDataChange("all");
    } catch (error) {
      setNotice(readableError(error, "Credit card could not be saved."));
    } finally {
      setBusy(null);
    }
  }

  async function saveStatement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const card = statementTarget;
    if (!card || busy) return;
    setBusy("save-statement");
    setNotice("");

    try {
      const statementBalance = roundMoney(statementForm.statement_balance);
      const minimumPayment = automaticMinimumPayment(
        selectedMonth === monthKey() ? cardCurrent(card) : statementBalance,
      );
      const interestCharged = roundMoney(statementForm.interest_charged || 0);
      const apr = finiteNumber(statementForm.apr || 0);

      if (
        statementBalance < 0 ||
        minimumPayment < 0 ||
        interestCharged < 0 ||
        apr < 0
      ) {
        throw new Error("Statement values cannot be negative.");
      }
      if (!statementForm.statement_date || !statementForm.payment_due_date) {
        throw new Error("Statement date and payment due date are required.");
      }

      const [balanceConversion, minimumConversion, interestConversion] =
        await Promise.all([
          convertToEur(statementBalance, card.currency),
          convertToEur(minimumPayment, card.currency),
          convertToEur(interestCharged, card.currency),
        ]);

      const historicalStatement = Boolean(
        card.statement_date &&
          statementForm.statement_date < card.statement_date,
      );

      if (historicalStatement) {
        const { error } = await supabase.rpc("save_credit_card_monthly_record", {
          p_debt_id: card.id,
          p_statement_balance: statementBalance,
          p_statement_balance_eur: roundMoney(balanceConversion.eur),
          p_exchange_rate: roundRate(balanceConversion.rate),
          p_statement_date: statementForm.statement_date,
          p_payment_due_date: statementForm.payment_due_date,
          p_minimum_payment: minimumPayment,
          p_minimum_payment_eur: roundMoney(minimumConversion.eur),
          p_apr: apr,
          p_interest_charged: interestCharged,
          p_interest_charged_eur: roundMoney(interestConversion.eur),
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("debts")
          .update({
            statement_balance: statementBalance,
            statement_balance_eur: roundMoney(balanceConversion.eur),
            statement_date: statementForm.statement_date,
            payment_due_date: statementForm.payment_due_date,
            payment_due_day: Number(statementForm.payment_due_date.slice(8, 10)),
            minimum_payment: minimumPayment,
            minimum_payment_eur: roundMoney(minimumConversion.eur),
            annual_interest_rate: apr,
            interest_charged: interestCharged,
            interest_charged_eur: roundMoney(interestConversion.eur),
            updated_at: new Date().toISOString(),
          })
          .eq("id", card.id)
          .eq("user_id", userId)
          .ilike("category", "credit card")
          .select()
          .single();
        if (error) throw error;
        setCards((current) => upsertById(current, data as CreditCardDebt));
      }

      const statementMonth = statementForm.statement_date.slice(0, 7);
      const { data: monthlyRecord, error: monthlyRecordError } =
        await supabase
          .from("credit_card_monthly_records")
          .select(
            "id,debt_id,user_id,month_start,currency,statement_balance,statement_balance_eur,minimum_payment,minimum_payment_eur,interest_charged,interest_charged_eur,statement_date,payment_due_date,created_at,updated_at",
          )
          .eq("user_id", userId)
          .eq("debt_id", card.id)
          .eq("month_start", monthStart(statementMonth))
          .single();

      if (monthlyRecordError) throw monthlyRecordError;
      setMonthlyRecords((current) =>
        upsertById(
          current,
          monthlyRecord as CreditCardMonthlyRecord,
        ),
      );
      setSelectedMonth(statementMonth);

      setStatementTarget(null);
      setNotice(
        historicalStatement
          ? "Historical monthly statement saved without changing the current balance."
          : "Statement snapshot saved without changing the current balance.",
      );
      notifyFiconterDataChange("all");
    } catch (error) {
      setNotice(readableError(error, "Statement could not be updated."));
    } finally {
      setBusy(null);
    }
  }

  async function saveActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const card = activityTarget;
    if (!card || busy) return;
    setBusy("save-activity");
    setNotice("");

    try {
      const amount = roundMoney(activityForm.amount);
      if (amount <= 0 || !activityForm.description.trim()) {
        throw new Error("Enter an activity description and amount.");
      }

      const conversion = await convertToEur(amount, card.currency);
      const occurredAt = new Date(activityForm.occurred_at);
      if (Number.isNaN(occurredAt.getTime())) {
        throw new Error("Choose a valid activity date and time.");
      }

      const { data, error } = await supabase.rpc(
        "record_credit_card_activity",
        {
          p_debt_id: card.id,
          p_activity_type: activityForm.activity_type,
          p_description: activityForm.description.trim(),
          p_amount: amount,
          p_amount_eur: roundMoney(conversion.eur),
          p_exchange_rate: roundRate(conversion.rate),
          p_occurred_at: occurredAt.toISOString(),
          p_notes: activityForm.notes.trim() || undefined,
        },
      );

      if (error) throw error;
      const result = data as {
        debt?: CreditCardDebt;
        activity?: CreditCardActivity;
      } | null;
      if (result?.debt) {
        setCards((current) => upsertById(current, result.debt as CreditCardDebt));
      }
      if (result?.activity) {
        setActivities((current) =>
          upsertById(current, result.activity as CreditCardActivity),
        );
      }

      setActivityTarget(null);
      setNotice("Credit-card activity recorded and the debt balance updated.");
      notifyFiconterDataChange("all");
    } catch (error) {
      setNotice(readableError(error, "Card activity could not be recorded."));
    } finally {
      setBusy(null);
    }
  }

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const card = paymentTarget;
    if (!card || busy) return;
    setBusy("save-payment");
    setNotice("");

    try {
      const amount = roundMoney(paymentForm.amount);
      if (amount <= 0 || amount > finiteNumber(card.current_balance)) {
        throw new Error("Payment must be positive and not exceed the balance.");
      }

      const conversion = await convertToEur(amount, card.currency);
      const paidAt = new Date(paymentForm.paid_at);
      if (Number.isNaN(paidAt.getTime())) {
        throw new Error("Choose a valid payment date and time.");
      }

      const { data, error } = await supabase.rpc(
        "record_credit_card_payment",
        {
          p_debt_id: card.id,
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
        debt?: CreditCardDebt;
        payment?: DebtPayment;
      } | null;
      if (result?.debt) {
        setCards((current) => upsertById(current, result.debt as CreditCardDebt));
      }
      if (result?.payment) {
        setPayments((current) =>
          upsertById(current, result.payment as DebtPayment),
        );
      }

      setPaymentTarget(null);
      setNotice(
        "Payment recorded in Transactions, Cash Flow, Monthly Planner and Debt.",
      );
      notifyFiconterDataChange("all");
    } catch (error) {
      setNotice(readableError(error, "Credit-card payment could not be recorded."));
    } finally {
      setBusy(null);
    }
  }

  async function confirmReverseActivity() {
    const activity = deletingActivity;
    if (!activity || busy) return;
    setBusy(`activity-${activity.id}`);

    try {
      const { data, error } = await supabase.rpc(
        "reverse_credit_card_activity",
        { p_activity_id: activity.id },
      );
      if (error) throw error;

      const debt = (data as { debt?: CreditCardDebt } | null)?.debt;
      if (debt) {
        setCards((current) => upsertById(current, debt));
      }
      setActivities((current) =>
        current.filter((item) => item.id !== activity.id),
      );
      setDeletingActivity(null);
      setNotice("Card activity reversed and the balance restored.");
      notifyFiconterDataChange("all");
    } catch (error) {
      setNotice(readableError(error, "Card activity could not be reversed."));
    } finally {
      setBusy(null);
    }
  }

  async function confirmReversePayment() {
    const payment = deletingPayment;
    if (!payment || busy) return;
    setBusy(`payment-${payment.id}`);

    try {
      const { data, error } = await supabase.rpc("reverse_debt_payment", {
        p_payment_id: payment.id,
      });
      if (error) throw error;

      const debt = (data as { debt?: CreditCardDebt } | null)?.debt;
      if (debt) {
        setCards((current) => upsertById(current, debt));
      }
      setPayments((current) =>
        current.filter((item) => item.id !== payment.id),
      );
      setDeletingPayment(null);
      setNotice("Payment and linked transaction reversed.");
      notifyFiconterDataChange("all");
    } catch (error) {
      setNotice(readableError(error, "Payment could not be reversed."));
    } finally {
      setBusy(null);
    }
  }

  async function confirmDeleteCard() {
    const card = deletingCard;
    if (!card || busy) return;
    setBusy(`card-${card.id}`);

    try {
      const { data, error } = await supabase.rpc(
        "delete_debt_with_linked_transactions",
        { p_debt_id: card.id },
      );
      if (error) throw error;

      const deletedCount = Number(
        (data as { deleted_debt_count?: number } | null)?.deleted_debt_count ?? 0,
      );
      if (deletedCount !== 1) throw new Error("Credit card could not be deleted.");

      setCards((current) => current.filter((item) => item.id !== card.id));
      setActivities((current) =>
        current.filter((item) => item.debt_id !== card.id),
      );
      setPayments((current) =>
        current.filter((item) => item.debt_id !== card.id),
      );
      setMonthlyRecords((current) =>
        current.filter((item) => item.debt_id !== card.id),
      );
      setDeletingCard(null);
      setNotice("Credit card and its linked history deleted.");
      notifyFiconterDataChange("all");
    } catch (error) {
      setNotice(readableError(error, "Credit card could not be deleted."));
    } finally {
      setBusy(null);
    }
  }

  function cardTimeline(card: CreditCardDebt): TimelineItem[] {
    const cardActivities: TimelineItem[] = activities
      .filter(
        (activity) =>
          activity.debt_id === card.id &&
          inMonth(activity.occurred_at, selectedMonth),
      )
      .map((activity) => ({
        kind: "activity" as const,
        date: activity.occurred_at,
        activity,
      }));
    const cardPayments: TimelineItem[] = payments
      .filter(
        (payment) =>
          payment.debt_id === card.id &&
          inMonth(payment.paid_at, selectedMonth),
      )
      .map((payment) => ({
        kind: "payment" as const,
        date: payment.paid_at,
        payment,
      }));

    return [...cardActivities, ...cardPayments]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);
  }

  return (
    <section className={styles.shell}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Revolving credit control</span>
          <h1>Credit Cards</h1>
          <p>
            Manage changing balances, statements, interest and minimum payments
            while keeping Debt, Transactions, Cash Flow, Monthly Planner,
            Overview and Net Worth synchronized.
          </p>
        </div>
        <div className={styles.heroActions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              if (showCardForm) resetCardForm();
              else setShowCardForm(true);
            }}
          >
            {showCardForm ? <X size={18} /> : <Plus size={18} />}
            {showCardForm ? "Close form" : "Add credit card"}
          </button>
        </div>
      </header>

      <section className={styles.monthCalendarBar} aria-label="Credit card month navigation">
        <button
          type="button"
          className={styles.monthArrow}
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          title="Previous month"
        >
          <ChevronLeft size={20} />
        </button>

        <div className={styles.monthRail} role="list" aria-label="Available months">
          {Array.from({ length: 7 }, (_, index) => {
            const offset = index - 3;
            const date = new Date(`${selectedMonth}-01T12:00:00`);
            date.setMonth(date.getMonth() + offset);
            const key = monthKey(date);
            const isSelected = key === selectedMonth;
            const isCurrent = key === monthKey();
            const shortMonth = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date);
            return (
              <button
                key={key}
                type="button"
                role="listitem"
                className={`${styles.monthChip} ${isSelected ? styles.monthChipActive : ""}`}
                onClick={() => setSelectedMonth(key)}
                aria-current={isSelected ? "date" : undefined}
                aria-label={`View ${monthTitle(key)}`}
              >
                <span>{shortMonth}</span>
                <strong>{date.getFullYear()}</strong>
                {isCurrent ? <em>Current</em> : null}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className={styles.monthArrow}
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          title="Next month"
        >
          <ChevronRight size={20} />
        </button>

        <label className={styles.monthPicker}>
          <CalendarDays size={18} aria-hidden="true" />
          <span className={styles.srOnly}>Choose month</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(event) => {
              if (event.target.value) setSelectedMonth(event.target.value);
            }}
            aria-label="Choose credit-card month"
          />
        </label>
      </section>

      {notice ? <div className={styles.notice}>{notice}</div> : null}

      <section className={styles.monthSummary}>
        <div className={styles.monthSummaryHeading}>
          <div>
            <span>MONTHLY CREDIT-CARD RECORD</span>
            <h2>{monthTitle(selectedMonth)}</h2>
          </div>
          <p>
            Every statement, payment and interest charge remains attached to
            its original month.
          </p>
        </div>
        <div className={styles.summaryGrid}>
          <article>
            <ReceiptText />
            <span>Statement balances</span>
            <strong>{displayMoney(monthlyTotals.statementBalances)}</strong>
          </article>
          <article>
            <ArrowDownLeft />
            <span>Paid this month</span>
            <strong>{displayMoney(monthlyTotals.paidThisMonth)}</strong>
          </article>
          <article>
            <WalletCards />
            <span>Balance left to pay</span>
            <strong>{displayMoney(monthlyTotals.statementRemaining)}</strong>
          </article>
          <article>
            <Gauge />
            <span>Interest charged</span>
            <strong>{displayMoney(monthlyTotals.interest)}</strong>
          </article>
        </div>
        <div className={styles.currentPosition}>
          <span>Current total card debt</span>
          <strong>{displayMoney(totals.outstanding)}</strong>
          <span>Current available credit</span>
          <strong>{displayMoney(totals.availableCredit)}</strong>
          <span>Minimum still due</span>
          <strong>{displayMoney(monthlyTotals.minimumRemaining)}</strong>
        </div>
      </section>

      <div className={styles.accountingNote}>
        <CheckCircle2 size={20} />
        <div>
          <strong>One liability, no double counting</strong>
          <p>
            Card activity changes the shared Debt balance. Only confirmed card
            payments create cash-outflow transactions.
          </p>
        </div>
        <Link href="/dashboard/debt">
          Open total Debt <ArrowRight size={16} />
        </Link>
      </div>

      {showCardForm ? (
        <form className={styles.formCard} onSubmit={saveCard}>
          <div className={styles.formHeading}>
            <div>
              <span>{editingCardId ? "EDIT CARD" : "NEW CARD"}</span>
              <h2>
                {editingCardId
                  ? "Update card details"
                  : "Add a revolving credit account"}
              </h2>
            </div>
            {editingCardId ? (
              <button type="button" onClick={resetCardForm}>
                Cancel edit
              </button>
            ) : null}
          </div>

          <div className={styles.formGrid}>
            <label>
              Card name
              <input
                value={cardForm.name}
                onChange={(event) =>
                  setCardForm({ ...cardForm, name: event.target.value })
                }
                placeholder="e.g. TF Bank Gold"
                required
              />
            </label>
            <label>
              Issuer
              <input
                value={cardForm.lender}
                onChange={(event) =>
                  setCardForm({ ...cardForm, lender: event.target.value })
                }
                placeholder="Bank or card issuer"
              />
            </label>
            <label>
              Last four digits
              <input
                value={cardForm.last_four}
                onChange={(event) =>
                  setCardForm({
                    ...cardForm,
                    last_four: event.target.value.replace(/\D/g, "").slice(0, 4),
                  })
                }
                inputMode="numeric"
                maxLength={4}
                placeholder="1234"
              />
            </label>
            <label>
              Currency
              <select
                value={cardForm.currency}
                onChange={(event) =>
                  setCardForm({ ...cardForm, currency: event.target.value })
                }
                disabled={Boolean(editingCardId)}
              >
                {CURRENCY_CODES.map((code) => (
                  <option value={code} key={code}>
                    {currencySymbol(code)} {code} — {currencyName(code)}
                  </option>
                ))}
              </select>
            </label>
            {!editingCardId ? (
              <label>
                Current opening balance
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cardForm.opening_balance}
                  onChange={(event) =>
                    setCardForm({
                      ...cardForm,
                      opening_balance: event.target.value,
                    })
                  }
                  required
                />
              </label>
            ) : null}
            <label>
              Credit limit
              <input
                type="number"
                min="0"
                step="0.01"
                value={cardForm.credit_limit}
                onChange={(event) =>
                  setCardForm({ ...cardForm, credit_limit: event.target.value })
                }
                placeholder="0.00"
              />
            </label>
            <label>
              APR (%)
              <input
                type="number"
                min="0"
                step="0.01"
                value={cardForm.apr}
                onChange={(event) =>
                  setCardForm({ ...cardForm, apr: event.target.value })
                }
              />
            </label>
            <label>
              Account start date
              <input
                type="date"
                value={cardForm.start_date}
                onChange={(event) =>
                  setCardForm({ ...cardForm, start_date: event.target.value })
                }
              />
            </label>
            <label className={styles.fullWidth}>
              Notes
              <textarea
                rows={3}
                value={cardForm.description}
                onChange={(event) =>
                  setCardForm({ ...cardForm, description: event.target.value })
                }
                placeholder="Optional card notes"
              />
            </label>
          </div>

          <button className={styles.saveButton} disabled={busy === "save-card"}>
            {busy === "save-card"
              ? "Saving…"
              : editingCardId
                ? "Save card details"
                : "Add credit card"}
          </button>
        </form>
      ) : null}

      <div className={styles.cardGrid}>
        {cards.length ? (
          cards.map((card) => {
            const current = cardCurrent(card);
            const limit = cardLimit(card);
            const available = Math.max(0, limit - current);
            const utilization = limit > 0 ? (current / limit) * 100 : 0;
            const metrics = monthlyMetrics(card);
            const minimumRemaining = metrics.minimumRemaining;
            const timeline = cardTimeline(card);
            const estimatedInterest = roundMoney(
              current * (finiteNumber(card.annual_interest_rate) / 100 / 12),
            );

            return (
              <article className={styles.creditCard} key={card.id}>
                <div className={styles.cardTop}>
                  <div className={styles.cardIcon}>
                    <CreditCard size={23} />
                  </div>
                  <div className={styles.cardIdentity}>
                    <div>
                      <h2>{card.name}</h2>
                      <span className={styles.status}>{card.status}</span>
                    </div>
                    <p>
                      {card.lender || "No issuer"}
                      {card.card_last_four ? ` · •••• ${card.card_last_four}` : ""}
                    </p>
                  </div>
                  <div className={styles.cardActions}>
                    <button type="button" onClick={() => editCard(card)} aria-label="Edit card">
                      <Edit3 size={17} />
                    </button>
                    <button
                      type="button"
                      className={styles.dangerButton}
                      onClick={() => setDeletingCard(card)}
                      aria-label="Delete card"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>

                <div className={styles.balancePanel}>
                  <div className={styles.mainBalance}>
                    <span>Current balance</span>
                    <strong>{displayMoney(current)}</strong>
                    {card.currency !== baseCurrency ? (
                      <small>Original card balance: {money(card.current_balance, card.currency)}</small>
                    ) : null}
                  </div>
                  <div>
                    <span>Available credit</span>
                    <strong>{displayMoney(available)}</strong>
                  </div>
                  <div>
                    <span>Credit limit</span>
                    <strong>{limit > 0 ? displayMoney(limit) : "Not set"}</strong>
                  </div>
                </div>

                <div className={styles.utilizationMeta}>
                  <span>Credit utilization</span>
                  <strong>{limit > 0 ? `${utilization.toFixed(1)}%` : "—"}</strong>
                </div>
                <div className={styles.utilizationTrack}>
                  <span style={{ width: `${Math.min(100, Math.max(0, utilization))}%` }} />
                </div>

                <div className={styles.statementGrid}>
                  <div>
                    <span>Statement balance</span>
                    <strong>{displayMoney(metrics.statementBalance)}</strong>
                    <small>
                      {metrics.record
                        ? `${readableDate(metrics.record.statement_date)} · saved record`
                        : `Carried forward into ${monthTitle(selectedMonth)} · save statement to freeze record`}
                    </small>
                  </div>
                  <div>
                    <span>Paid this month</span>
                    <strong>{displayMoney(metrics.paidThisMonth)}</strong>
                    <small>
                      Confirmed payments dated in {monthTitle(selectedMonth)}
                    </small>
                  </div>
                  <div>
                    <span>Balance left to pay</span>
                    <strong>{displayMoney(current)}</strong>
                    <small>Mirrors Current balance — the live amount still owed</small>
                  </div>
                  <div>
                    <span>Minimum payment due</span>
                    <strong>
                      {metrics.record
                        ? displayMoney(metrics.minimumPayment)
                        : "Not recorded"}
                    </strong>
                    <small>
                      {metrics.isCurrentMonth
                        ? `Automatic 3% of Current balance · rounded up to the next cent · updates live`
                        : metrics.record
                          ? `Recorded minimum · ${displayMoney(minimumRemaining)} still to pay · ${paymentStatus(
                              metrics.record,
                              metrics.paidTowardStatement,
                            )}`
                          : "No historical minimum recorded"}
                    </small>
                  </div>
                  <div>
                    <span>Interest charged</span>
                    <strong>{displayMoney(metrics.interest)}</strong>
                    <small>
                      {finiteNumber(card.annual_interest_rate).toFixed(2)}% APR · ~
                      {displayMoney(estimatedInterest)} estimated monthly
                    </small>
                  </div>
                  <div>
                    <span>Monthly activity</span>
                    <strong>
                      {displayMoney(metrics.purchases + metrics.fees - metrics.refunds)}
                    </strong>
                    <small>
                      Purchases {displayMoney(metrics.purchases)} · Fees{" "}
                      {displayMoney(metrics.fees)} · Refunds{" "}
                      {displayMoney(metrics.refunds)}
                    </small>
                  </div>
                  <div>
                    <span>Payment due</span>
                    <strong>
                      {metrics.record
                        ? readableDate(metrics.record.payment_due_date)
                        : "Not set"}
                    </strong>
                    <small>
                      {displayMoney(metrics.paidTowardStatement)} paid
                      toward this statement
                    </small>
                  </div>
                  <div>
                    <span>Monthly record</span>
                    <strong>{monthTitle(selectedMonth)}</strong>
                    <small>
                      {metrics.record
                        ? "Statement snapshot saved permanently"
                        : "Activity and payments are still tracked by date"}
                    </small>
                  </div>
                </div>

                <div className={styles.actionGrid}>
                  <button type="button" onClick={() => openStatement(card)}>
                    <RefreshCw size={17} /> Update statement
                  </button>
                  <button type="button" onClick={() => openActivity(card)}>
                    <Plus size={17} /> Add activity
                  </button>
                  <button
                    type="button"
                    className={styles.paymentButton}
                    onClick={() => openPayment(card)}
                    disabled={current <= 0}
                  >
                    <ArrowDownLeft size={17} /> Record payment
                  </button>
                </div>

                <div className={styles.timeline}>
                  <div className={styles.timelineHeading}>
                    <div>
                      <span>CONNECTED MONTHLY HISTORY</span>
                      <h3>{monthTitle(selectedMonth)} activity</h3>
                    </div>
                    <Link href="/dashboard/transactions">Payments in Transactions</Link>
                  </div>

                  {timeline.length ? (
                    timeline.map((item) => {
                      if (item.kind === "payment") {
                        return (
                          <div className={styles.timelineRow} key={`payment-${item.payment.id}`}>
                            <span className={`${styles.timelineIcon} ${styles.paymentIcon}`}>
                              <ArrowDownLeft size={16} />
                            </span>
                            <div>
                              <strong>Credit-card payment</strong>
                              <small>{readableDateTime(item.payment.paid_at)}</small>
                              <p>{item.payment.notes || "Payment recorded in Transactions"}</p>
                            </div>
                            <div className={styles.timelineAmount}>
                              <strong className={styles.negativeEffect}>
                                −{displayMoney(paymentBase(item.payment))}
                              </strong>
                              <button
                                type="button"
                                onClick={() => setDeletingPayment(item.payment)}
                                aria-label="Reverse payment"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      }

                      const effect = activityEffectBase(item.activity);
                      return (
                        <div className={styles.timelineRow} key={`activity-${item.activity.id}`}>
                          <span
                            className={`${styles.timelineIcon} ${
                              effect < 0 ? styles.refundIcon : styles.chargeIcon
                            }`}
                          >
                            {effect < 0 ? (
                              <ArrowDownLeft size={16} />
                            ) : (
                              <ArrowUpRight size={16} />
                            )}
                          </span>
                          <div>
                            <strong>{item.activity.description}</strong>
                            <small>
                              {activityLabel(item.activity.activity_type)} · {readableDateTime(item.activity.occurred_at)}
                            </small>
                            {item.activity.notes ? <p>{item.activity.notes}</p> : null}
                          </div>
                          <div className={styles.timelineAmount}>
                            <strong className={effect < 0 ? styles.negativeEffect : styles.positiveEffect}>
                              {effect < 0 ? "−" : "+"}
                              {displayMoney(Math.abs(effect))}
                            </strong>
                            {item.activity.activity_type !== "statement_adjustment" ? (
                              <button
                                type="button"
                                onClick={() => setDeletingActivity(item.activity)}
                                aria-label="Reverse card activity"
                              >
                                <Trash2 size={14} />
                              </button>
                            ) : (
                              <span className={styles.lockedHistory}>Confirmed</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className={styles.emptyHistory}>
                      No card activity or payments were recorded in this month.
                    </p>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <div className={styles.emptyState}>
            <CreditCard size={38} />
            <h2>No credit cards yet</h2>
            <p>
              Add an existing card here. It will automatically contribute to
              Total Debt without creating a duplicate debt account.
            </p>
            <button type="button" onClick={() => setShowCardForm(true)}>
              <Plus size={17} /> Add first credit card
            </button>
          </div>
        )}
      </div>

      {statementTarget ? (
        <div className={styles.modalBackdrop}>
          <form className={styles.modal} onSubmit={saveStatement}>
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setStatementTarget(null)}
              aria-label="Close statement form"
            >
              <X size={19} />
            </button>
            <CalendarDays className={styles.modalIcon} />
            <span>
              MONTHLY STATEMENT · {monthTitle(selectedMonth).toUpperCase()}
            </span>
            <h2>Update {statementTarget.name}</h2>
            <p>
              {selectedMonth === monthKey()
                ? "Enter the statement exactly as issued. It is kept as a monthly record and does not change Current balance. The live minimum payment is calculated as 3% of Current balance, rounded up to the next cent when needed, and updates whenever the live balance changes."
                : "Enter the exact historical figures shown by the issuer. Historical minimum payment remains tied to that saved monthly record."}
            </p>
            <div className={styles.modalGrid}>
              <label>
                Statement balance
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={statementForm.statement_balance}
                  onChange={(event) => {
                    const statementBalance = event.target.value;
                    setStatementForm({
                      ...statementForm,
                      statement_balance: statementBalance,
                      minimum_payment: String(
                        automaticMinimumPayment(
                          selectedMonth === monthKey()
                            ? cardCurrent(statementTarget)
                            : statementBalance,
                        ),
                      ),
                    });
                  }}
                  required
                />
                {selectedMonth === monthKey() ? (
                  <small>Saved as a statement snapshot only; Current balance is not changed.</small>
                ) : null}
              </label>
              <label>
                Minimum payment due — automatic 3%
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={statementForm.minimum_payment}
                  readOnly
                  aria-readonly={true}
                />
                <small>
                  {selectedMonth === monthKey()
                    ? "Calculated as 3% of Current balance and rounded up to the next cent when needed."
                    : "Saved with the historical monthly record."}
                </small>
              </label>
              <label>
                Statement date
                <input
                  type="date"
                  value={statementForm.statement_date}
                  onChange={(event) =>
                    setStatementForm({
                      ...statementForm,
                      statement_date: event.target.value,
                    })
                  }
                  required
                />
              </label>
              <label>
                Payment due date
                <input
                  type="date"
                  value={statementForm.payment_due_date}
                  onChange={(event) =>
                    setStatementForm({
                      ...statementForm,
                      payment_due_date: event.target.value,
                    })
                  }
                  required
                />
              </label>
              <label>
                Interest charged
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={statementForm.interest_charged}
                  onChange={(event) =>
                    setStatementForm({
                      ...statementForm,
                      interest_charged: event.target.value,
                    })
                  }
                  required
                />
              </label>
              <label>
                APR (%)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={statementForm.apr}
                  onChange={(event) =>
                    setStatementForm({ ...statementForm, apr: event.target.value })
                  }
                  required
                />
              </label>
            </div>
            <button className={styles.modalPrimary} disabled={busy === "save-statement"}>
              {busy === "save-statement" ? "Updating…" : "Confirm statement"}
            </button>
          </form>
        </div>
      ) : null}

      {activityTarget ? (
        <div className={styles.modalBackdrop}>
          <form className={styles.modal} onSubmit={saveActivity}>
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setActivityTarget(null)}
              aria-label="Close activity form"
            >
              <X size={19} />
            </button>
            <ReceiptText className={styles.modalIcon} />
            <span>CARD ACTIVITY</span>
            <h2>Update {activityTarget.name}</h2>
            <p>
              Purchases, interest and fees increase the balance. Refunds and
              credits reduce it. They do not create a second cash expense.
            </p>
            <div className={styles.modalGrid}>
              <label>
                Activity type
                <select
                  value={activityForm.activity_type}
                  onChange={(event) =>
                    setActivityForm({
                      ...activityForm,
                      activity_type: event.target.value as ActivityForm["activity_type"],
                    })
                  }
                >
                  {ACTIVITY_OPTIONS.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Amount
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={activityForm.amount}
                  onChange={(event) =>
                    setActivityForm({ ...activityForm, amount: event.target.value })
                  }
                  required
                />
              </label>
              <label className={styles.modalFullWidth}>
                Description
                <input
                  value={activityForm.description}
                  onChange={(event) =>
                    setActivityForm({
                      ...activityForm,
                      description: event.target.value,
                    })
                  }
                  placeholder="Merchant, interest, annual fee or refund"
                  required
                />
              </label>
              <label>
                Date and time
                <input
                  type="datetime-local"
                  value={activityForm.occurred_at}
                  onChange={(event) =>
                    setActivityForm({
                      ...activityForm,
                      occurred_at: event.target.value,
                    })
                  }
                  required
                />
              </label>
              <label>
                Notes
                <input
                  value={activityForm.notes}
                  onChange={(event) =>
                    setActivityForm({ ...activityForm, notes: event.target.value })
                  }
                  placeholder="Optional"
                />
              </label>
            </div>
            <button className={styles.modalPrimary} disabled={busy === "save-activity"}>
              {busy === "save-activity" ? "Recording…" : "Record card activity"}
            </button>
          </form>
        </div>
      ) : null}

      {paymentTarget ? (
        <div className={styles.modalBackdrop}>
          <form className={styles.modal} onSubmit={savePayment}>
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setPaymentTarget(null)}
              aria-label="Close payment form"
            >
              <X size={19} />
            </button>
            <ArrowDownLeft className={styles.modalIcon} />
            <span>CONFIRMED PAYMENT</span>
            <h2>Pay {paymentTarget.name}</h2>
            <p>
              Record only a payment that actually left your bank or cash
              balance. FICONTER will add it to Transactions and reduce card debt.
            </p>
            <div className={styles.modalGrid}>
              <label>
                Payment amount
                <input
                  type="number"
                  min="0.01"
                  max={finiteNumber(paymentTarget.current_balance)}
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(event) =>
                    setPaymentForm({ ...paymentForm, amount: event.target.value })
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
                    setPaymentForm({ ...paymentForm, paid_at: event.target.value })
                  }
                  required
                />
              </label>
              <label className={styles.modalFullWidth}>
                Notes
                <input
                  value={paymentForm.notes}
                  onChange={(event) =>
                    setPaymentForm({ ...paymentForm, notes: event.target.value })
                  }
                  placeholder="Optional payment reference"
                />
              </label>
            </div>
            <div className={styles.paymentPreview}>
              <span>Current balance</span>
              <strong>{money(paymentTarget.current_balance, paymentTarget.currency)}</strong>
              <span>Minimum still due</span>
              <strong>
                {money(
                  monthlyMetrics(paymentTarget).minimumRemaining,
                  paymentTarget.currency,
                )}
              </strong>
            </div>
            <button className={styles.modalPrimary} disabled={busy === "save-payment"}>
              {busy === "save-payment" ? "Recording…" : "Record confirmed payment"}
            </button>
          </form>
        </div>
      ) : null}

      {deletingCard ? (
        <ConfirmModal
          title={`Delete ${deletingCard.name}?`}
          copy="This removes the card, its balance activity, payment history and linked payment transactions."
          confirmLabel="Delete credit card"
          busy={busy === `card-${deletingCard.id}`}
          onCancel={() => setDeletingCard(null)}
          onConfirm={() => void confirmDeleteCard()}
        />
      ) : null}

      {deletingActivity ? (
        <ConfirmModal
          title="Reverse this card activity?"
          copy="The activity will be deleted and its balance effect will be reversed."
          confirmLabel="Reverse activity"
          busy={busy === `activity-${deletingActivity.id}`}
          onCancel={() => setDeletingActivity(null)}
          onConfirm={() => void confirmReverseActivity()}
        />
      ) : null}

      {deletingPayment ? (
        <ConfirmModal
          title="Reverse this credit-card payment?"
          copy="The payment transaction will be removed and the card balance will be restored."
          confirmLabel="Reverse payment"
          busy={busy === `payment-${deletingPayment.id}`}
          onCancel={() => setDeletingPayment(null)}
          onConfirm={() => void confirmReversePayment()}
        />
      ) : null}
    </section>
  );
}

function ConfirmModal({
  title,
  copy,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  copy: string;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className={styles.modalBackdrop}>
      <section className={styles.confirmModal}>
        <Trash2 className={`${styles.modalIcon} ${styles.dangerIcon}`} />
        <span>CONFIRM CHANGE</span>
        <h2>{title}</h2>
        <p>{copy}</p>
        <div className={styles.modalActions}>
          <button type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.modalDanger}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
