"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Repeat2, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyFiconterDataChange } from "@/lib/ficonterRealtime";
import type {
  EntryMode,
  TransactionPreset,
  TransactionTemplate,
} from "@/lib/effortlessEntry";
import {
  CATEGORY_GROUPS,
  CURRENCY_CODES,
  TRANSACTION_TYPES,
  currencyName,
  currencySymbol,
  formatCurrency,
} from "@/lib/financialOptions";

function localDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

type RateState = {
  rate: number;
  date: string;
  source: string;
};

type TransactionKind = "expense" | "income" | "saving";

type Props = {
  initialType?: TransactionKind;
  initialCategory?: string;
  entryMode?: EntryMode;
  preset?: TransactionPreset | null;
  onTemplateSaved?: (template: TransactionTemplate) => void;
  onSaved?: () => void;
};

function categoryForType(type: TransactionKind) {
  if (type === "income") return "Salary";
  if (type === "saving") return "General savings";
  return "Groceries";
}

export function TransactionForm({
  initialType = "expense",
  initialCategory,
  entryMode = "guided",
  preset,
  onTemplateSaved,
  onSaved,
}: Props) {
  const defaultType = preset?.type ?? initialType;
  const defaultCategory =
    preset?.category ?? initialCategory ?? categoryForType(defaultType);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [type, setType] = useState<TransactionKind>(defaultType);
  const [description, setDescription] = useState(preset?.description ?? "");
  const [currency, setCurrency] = useState(preset?.currency ?? "EUR");
  const [amount, setAmount] = useState(
    preset?.amount ? String(preset.amount) : "",
  );
  const [occurredAt, setOccurredAt] = useState(
    preset?.occurredAt ?? localDateTimeValue(),
  );
  const transactionTimeWasEdited = useRef(Boolean(preset?.occurredAt));
  const [category, setCategory] = useState(defaultCategory);
  const [customCategory, setCustomCategory] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(entryMode === "detailed");
  const [rememberFavorite, setRememberFavorite] = useState(false);
  const [repeatMonthly, setRepeatMonthly] = useState(false);
  const [recurringDay, setRecurringDay] = useState(() =>
    String(new Date(preset?.occurredAt ?? Date.now()).getDate()),
  );
  const [templateLabel, setTemplateLabel] = useState(preset?.label ?? "");
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
    if (entryMode === "detailed") setShowAdvanced(true);
  }, [entryMode]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!transactionTimeWasEdited.current && !preset?.occurredAt) {
        setOccurredAt(localDateTimeValue());
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [preset?.occurredAt]);

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
        const response = await fetch(
          `/api/exchange-rate?from=${encodeURIComponent(currency)}&to=EUR`,
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );
        const data = (await response.json()) as {
          error?: string;
          rate?: number;
          date?: string;
          source?: string;
        };
        if (!response.ok || !data.rate || !data.date || !data.source) {
          throw new Error(data.error || "Unable to retrieve an exchange rate.");
        }
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
  const euroAmount =
    Number.isFinite(numericAmount) && numericAmount > 0
      ? numericAmount * rate.rate
      : 0;

  async function createReusableTemplate({
    supabase,
    userId,
    transactionId,
    transactionPeriodKey,
    finalDescription,
    finalCategory,
    originalAmount,
  }: {
    supabase: ReturnType<typeof createClient>;
    userId: string;
    transactionId: string;
    transactionPeriodKey: string;
    finalDescription: string;
    finalCategory: string;
    originalAmount: number;
  }): Promise<string | null> {
    if (!rememberFavorite && !repeatMonthly) return null;

    const label = templateLabel.trim() || finalDescription || finalCategory;
    const day = Number(recurringDay);

    const { data: savedTemplate, error: templateError } = await supabase
      .from("transaction_templates")
      .insert({
        user_id: userId,
        label,
        description: finalDescription,
        amount: originalAmount,
        currency,
        amount_eur: Number((originalAmount * rate.rate).toFixed(6)),
        exchange_rate_to_eur: rate.rate,
        exchange_rate_date: rate.date,
        exchange_rate_source: rate.source,
        type,
        category: finalCategory,
        is_favorite: rememberFavorite,
        is_recurring: repeatMonthly,
        day_of_month: repeatMonthly ? day : null,
        is_active: true,
      })
      .select("*")
      .single();

    if (templateError || !savedTemplate) {
      return templateError?.message || "The reusable shortcut could not be created.";
    }

    if (repeatMonthly) {
      const { error: postingError } = await supabase
        .from("transaction_template_postings")
        .insert({
          template_id: savedTemplate.id,
          user_id: userId,
          period_key: transactionPeriodKey,
          transaction_id: transactionId,
        });

      if (postingError) {
        await supabase.from("transaction_templates").delete().eq("id", savedTemplate.id);
        return postingError.message;
      }
    }

    onTemplateSaved?.(savedTemplate as TransactionTemplate);
    return null;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) throw new Error("Please log in again.");

      if (currency !== "EUR" && (rateLoading || rateError || !rate.rate)) {
        throw new Error(
          "A valid EUR exchange rate is required before this transaction can be saved.",
        );
      }

      const finalCategory =
        category === "Other / custom" ? customCategory.trim() : category;
      if (!finalCategory) throw new Error("Please enter a custom category.");

      const localInstant = new Date(occurredAt);
      if (Number.isNaN(localInstant.getTime())) {
        throw new Error("Please choose a valid transaction date and time.");
      }

      const originalAmount = Number(amount);
      if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
        throw new Error("Please enter a valid amount greater than zero.");
      }

      const finalDescription = description.trim() || finalCategory;
      const recurringDayNumber = Number(recurringDay);
      if (
        repeatMonthly &&
        (!Number.isInteger(recurringDayNumber) ||
          recurringDayNumber < 1 ||
          recurringDayNumber > 31)
      ) {
        throw new Error("Choose a monthly repeat day between 1 and 31.");
      }

      const payload = {
        user_id: user.id,
        description: finalDescription,
        amount: originalAmount,
        currency,
        amount_eur: Number((originalAmount * rate.rate).toFixed(6)),
        exchange_rate_to_eur: rate.rate,
        exchange_rate_date: rate.date,
        exchange_rate_source: rate.source,
        type,
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

      if (preset?.templateId && preset.periodKey) {
        const { error: postingError } = await supabase
          .from("transaction_template_postings")
          .insert({
            template_id: preset.templateId,
            user_id: user.id,
            period_key: preset.periodKey,
            transaction_id: savedTransaction.id,
          });

        if (postingError) {
          await supabase.from("transactions").delete().eq("id", savedTransaction.id);
          if (postingError.code === "23505") {
            throw new Error("This recurring entry has already been added for this month.");
          }
          throw postingError;
        }
      }

      const templateWarning = await createReusableTemplate({
        supabase,
        userId: user.id,
        transactionId: savedTransaction.id,
        transactionPeriodKey: `${occurredAt.slice(0, 7)}-01`,
        finalDescription,
        finalCategory,
        originalAmount,
      });

      window.dispatchEvent(
        new CustomEvent("ficonter:transaction-created", {
          detail: savedTransaction,
        }),
      );

      setNotice(
        templateWarning
          ? "Transaction saved, but the reusable shortcut could not be created."
          : "Saved. Your connected financial views are updating now.",
      );
      setAmount("");
      setDescription("");
      setCurrency("EUR");
      setType(initialType);
      setCategory(initialCategory ?? categoryForType(initialType));
      setCustomCategory("");
      setRememberFavorite(false);
      setRepeatMonthly(false);
      setTemplateLabel("");
      transactionTimeWasEdited.current = false;
      setOccurredAt(localDateTimeValue());
      notifyFiconterDataChange("all");
      onSaved?.();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save this transaction.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      {preset && (
        <div className="effortless-preset-notice">
          <span>Shortcut loaded</span>
          <strong>{preset.label}</strong>
        </div>
      )}

      <div className="field">
        <label>Money movement</label>
        <div className="transaction-type-buttons" role="group" aria-label="Transaction type">
          {TRANSACTION_TYPES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={type === option.value ? "is-active" : ""}
              aria-pressed={type === option.value}
              onClick={() => {
                const nextType = option.value as TransactionKind;
                setType(nextType);
                if (!category || category === categoryForType(type)) {
                  setCategory(categoryForType(nextType));
                }
              }}
            >
              {option.value === "expense"
                ? "Expense"
                : option.value === "income"
                  ? "Income"
                  : "Saving"}
            </button>
          ))}
        </div>
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
            inputMode="decimal"
            required
            autoFocus={!preset}
            value={amount}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setAmount(event.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="field">
          <label>Category</label>
          <select
            className="input"
            name="category"
            value={category}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => setCategory(event.target.value)}
          >
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
      </div>

      {category === "Other / custom" && (
        <div className="field">
          <label>Custom category</label>
          <input
            className="input"
            value={customCategory}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setCustomCategory(event.target.value)}
            placeholder="Enter your own category"
            maxLength={80}
            required
          />
        </div>
      )}

      <div className="field">
        <label>
          {entryMode === "simple" ? "Note (optional)" : "Description (optional)"}
        </label>
        <input
          className="input"
          name="description"
          value={description}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setDescription(event.target.value)}
          placeholder="FICONTER will use the category when left empty"
          maxLength={120}
        />
      </div>

      {entryMode !== "detailed" && (
        <button
          type="button"
          className="effortless-advanced-toggle"
          onClick={() => setShowAdvanced((current) => !current)}
          aria-expanded={showAdvanced}
        >
          More details
          <ChevronDown size={16} className={showAdvanced ? "is-open" : ""} />
        </button>
      )}

      {showAdvanced && (
        <div className="effortless-advanced-fields">
          <div className="transaction-form-grid">
            <div className="field">
              <label>Currency</label>
              <select
                className="input"
                name="currency"
                value={currency}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => setCurrency(event.target.value)}
              >
                {currencyOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.symbol} {option.code} — {option.name}
                  </option>
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
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  transactionTimeWasEdited.current = true;
                  setOccurredAt(event.target.value);
                }}
              />
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
        </div>
      )}

      <details className="effortless-reuse-details">
        <summary>
          <span>
            <Star size={16} /> Save time next time
          </span>
          <ChevronDown size={16} />
        </summary>
        <div className="effortless-reuse-body">
          <label className="effortless-check-row">
            <input
              type="checkbox"
              checked={rememberFavorite}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setRememberFavorite(event.target.checked)}
            />
            <span>
              <strong>Save as a favourite</strong>
              <small>Reuse this entry later with one tap.</small>
            </span>
          </label>

          <label className="effortless-check-row">
            <input
              type="checkbox"
              checked={repeatMonthly}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setRepeatMonthly(event.target.checked)}
            />
            <span>
              <strong>Repeat monthly</strong>
              <small>Place it in a calm monthly confirmation queue.</small>
            </span>
          </label>

          {(rememberFavorite || repeatMonthly) && (
            <div className="transaction-form-grid">
              <div className="field">
                <label>Shortcut name</label>
                <input
                  className="input"
                  value={templateLabel}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setTemplateLabel(event.target.value)}
                  placeholder={description || category || "Monthly entry"}
                  maxLength={80}
                />
              </div>
              {repeatMonthly && (
                <div className="field">
                  <label>
                    <Repeat2 size={14} /> Day of month
                  </label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    max="31"
                    step="1"
                    value={recurringDay}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setRecurringDay(event.target.value)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </details>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}
      <button
        className="btn btn-primary"
        disabled={loading || rateLoading || Boolean(rateError)}
      >
        {loading ? "Saving…" : rateLoading ? "Retrieving rate…" : "Save transaction"}
      </button>
    </form>
  );
}
