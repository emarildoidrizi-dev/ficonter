"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { notifyFiconterDataChange } from "@/lib/ficonterRealtime";
import {
  CATEGORY_GROUPS,
  CURRENCY_CODES,
  TRANSACTION_TYPES,
  currencyName,
  currencySymbol,
  formatCurrency,
} from "@/lib/financialOptions";

const groupedTypes = TRANSACTION_TYPES.reduce<Record<string, typeof TRANSACTION_TYPES>>(
  (groups, option) => {
    groups[option.group] ??= [];
    groups[option.group].push(option);
    return groups;
  },
  {},
);

function localDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

type RateState = {
  rate: number;
  date: string;
  source: string;
};

export function TransactionForm({
  initialType = "expense",
  initialCategory,
}: {
  initialType?: "expense" | "income" | "saving";
  initialCategory?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => localDateTimeValue());
  const transactionTimeWasEdited = useRef(false);
  const defaultCategory =
    initialCategory ??
    (initialType === "income"
      ? "Salary"
      : initialType === "saving"
        ? "General savings"
        : "Groceries");
  const [category, setCategory] = useState(defaultCategory);
  const [customCategory, setCustomCategory] = useState("");
  const [rate, setRate] = useState<RateState>({
    rate: 1,
    date: new Date().toISOString().slice(0, 10),
    source: "identity",
  });
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState("");

  const currencyOptions = useMemo(
    () =>
      CURRENCY_CODES.map((code) => ({
        code,
        symbol: currencySymbol(code),
        name: currencyName(code),
      })).sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );


  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!transactionTimeWasEdited.current) {
        setOccurredAt(localDateTimeValue());
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    if (currency === "EUR") {
      setRate({
        rate: 1,
        date: new Date().toISOString().slice(0, 10),
        source: "identity",
      });
      setRateError("");
      setRateLoading(false);
      return () => controller.abort();
    }

    async function loadRate() {
      setRateLoading(true);
      setRateError("");
      try {
        const response = await fetch(`/api/exchange-rate?from=${encodeURIComponent(currency)}&to=EUR`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to retrieve an exchange rate.");
        setRate({ rate: Number(data.rate), date: data.date, source: data.source });
      } catch (rateFetchError) {
        if ((rateFetchError as Error).name !== "AbortError") {
          setRateError((rateFetchError as Error).message);
        }
      } finally {
        if (!controller.signal.aborted) setRateLoading(false);
      }
    }

    void loadRate();
    return () => controller.abort();
  }, [currency]);

  const numericAmount = Number(amount);
  const euroAmount = Number.isFinite(numericAmount) && numericAmount > 0 ? numericAmount * rate.rate : 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    const formElement = event.currentTarget;
    setLoading(true);
    setError("");

    try {
      const form = new FormData(formElement);
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please log in again.");
      }

      if (currency !== "EUR" && (rateLoading || rateError || !rate.rate)) {
        throw new Error("A valid EUR exchange rate is required before this transaction can be saved.");
      }

      const finalCategory = category === "Other / custom" ? customCategory.trim() : category;
      if (!finalCategory) {
        throw new Error("Please enter a custom category.");
      }

      const localInstant = new Date(occurredAt);
      if (Number.isNaN(localInstant.getTime())) {
        throw new Error("Please choose a valid transaction date and time.");
      }

      const originalAmount = Number(form.get("amount"));
      if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
        throw new Error("Please enter a valid amount greater than zero.");
      }

      const description = String(form.get("description") ?? "").trim();
      if (!description) {
        throw new Error("Please enter a description.");
      }

      const payload = {
        user_id: user.id,
        description,
        amount: originalAmount,
        currency,
        amount_eur: Number((originalAmount * rate.rate).toFixed(6)),
        exchange_rate_to_eur: rate.rate,
        exchange_rate_date: rate.date,
        exchange_rate_source: rate.source,
        type: String(form.get("type")),
        category: finalCategory,
        transaction_date: occurredAt.slice(0, 10),
        occurred_at: localInstant.toISOString(),
      };

      const { data: savedTransaction, error: insertError } = await supabase
        .from("transactions")
        .insert(payload)
        .select("*")
        .single();

      if (insertError) throw insertError;
      if (!savedTransaction) {
        throw new Error("The saved transaction could not be returned.");
      }

      window.dispatchEvent(
        new CustomEvent("ficonter:transaction-created", {
          detail: savedTransaction,
        }),
      );

      formElement.reset();
      setAmount("");
      setCurrency("EUR");
      transactionTimeWasEdited.current = false;
      setOccurredAt(localDateTimeValue());
      setCategory(defaultCategory);
      setCustomCategory("");
      notifyFiconterDataChange("all");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save this transaction.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="field">
        <label>Description</label>
        <input className="input" name="description" required placeholder="What happened?" />
      </div>

      <div className="transaction-form-grid transaction-form-grid-amount">
        <div className="field">
          <label>Amount</label>
          <input
            className="input"
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <div className="field">
          <label>Currency</label>
          <select className="input" name="currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {currencyOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.symbol} {option.code} — {option.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="fx-preview" aria-live="polite">
        {rateLoading ? (
          <span>Retrieving the latest EUR reference rate…</span>
        ) : rateError ? (
          <span className="fx-preview-error">{rateError}</span>
        ) : (
          <>
            <div>
              <span>EUR equivalent</span>
              <strong>{formatCurrency(euroAmount, "EUR")}</strong>
            </div>
            <small>
              {currency === "EUR"
                ? "No conversion required."
                : `1 ${currency} = ${rate.rate.toFixed(6)} EUR · rate date ${rate.date}`}
            </small>
          </>
        )}
      </div>

      <div className="field">
        <label>Transaction type</label>
        <select className="input" name="type" defaultValue={initialType}>
          {Object.entries(groupedTypes).map(([group, options]) => (
            <optgroup key={group} label={group}>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="transaction-form-grid">
        <div className="field">
          <label>Category</label>
          <select className="input" name="category" value={category} onChange={(event) => setCategory(event.target.value)}>
            {CATEGORY_GROUPS.map((group) => (
              <optgroup key={group.group} label={group.group}>
                {group.items.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Exact date and time</label>
          <input
            className="input"
            name="occurred_at"
            type="datetime-local"
            required
            value={occurredAt}
            onChange={(event) => {
              transactionTimeWasEdited.current = true;
              setOccurredAt(event.target.value);
            }}
          />
        </div>
      </div>

      {category === "Other / custom" && (
        <div className="field">
          <label>Custom category</label>
          <input
            className="input"
            value={customCategory}
            onChange={(event) => setCustomCategory(event.target.value)}
            placeholder="Enter your own category"
            maxLength={80}
            required
          />
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      <button className="btn btn-primary" disabled={loading || rateLoading || Boolean(rateError)}>
        {loading ? "Saving…" : rateLoading ? "Retrieving rate…" : "Save transaction"}
      </button>
    </form>
  );
}
