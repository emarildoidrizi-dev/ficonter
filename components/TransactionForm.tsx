"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { getActiveVaultKey } from "@/lib/e2ee/sessionKey";
import { decryptTransactionPayload, encryptTransactionPayload } from "@/lib/e2ee/transactionPayload";
import { ArrowLeft, ArrowRight, CalendarClock, Check, Repeat2, Star, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "./LanguageProvider";
import { notifyFiconterDataChange } from "@/lib/ficonterRealtime";
import { getExchangeRate } from "@/lib/performance/exchangeRateCache";
import { convertToReportingCurrency, finiteNumber, roundMoney, roundRate } from "@/lib/finance/money";
import type {
  EntryMode,
  TransactionPreset,
  TransactionTemplate,
} from "@/lib/effortlessEntry";
import { CATEGORY_GROUPS, CURRENCY_CODES, TRANSACTION_TYPES, currencyName, currencySymbol, formatCurrency, formatReportingCurrency } from "@/lib/financialOptions";
import { useCurrencyDisplay } from "@/components/CurrencyDisplayProvider";
import {
  BASE_CURRENCY_CHANGED_EVENT,
  readBrowserBaseCurrency,
} from "@/components/BaseCurrencyBootstrap";
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
  allowMultiCurrency?: boolean;
  onTemplateSaved?: (template: TransactionTemplate) => void;
  onSaved?: () => void;
};

function categoryForType(type: TransactionKind) {
  if (type === "income") return "Salary";
  if (type === "saving") return "General savings";
  return "Groceries";
}

const QUICK_CATEGORIES: Record<TransactionKind, string[]> = {
  expense: [
    "Groceries",
    "Restaurants",
    "Public transport",
    "Fuel",
    "Haircut",
    "Other / custom",
  ],
  income: [
    "Salary",
    "Wages",
    "Bonus",
    "Freelance",
    "Reimbursement",
    "Other income",
  ],
  saving: [
    "Emergency fund",
    "General savings",
    "Holiday savings",
    "House deposit",
    "Retirement",
    "Other / custom",
  ],
};

function actionLabel(type: TransactionKind) {
  if (type === "income") return "Add income";
  if (type === "saving") return "Add saving";
  return "Add expense";
}

export function TransactionForm({
  initialType = "expense",
  initialCategory,
  entryMode = "guided",
  preset,
  allowMultiCurrency = true,
  onTemplateSaved,
  onSaved,
}: Props) {
  const defaultType = preset?.type ?? initialType;
  const defaultCategory =
    preset?.category ?? initialCategory ?? categoryForType(defaultType);

  const { locale } = useLanguage();
  const supabase = useMemo(() => createClient(), []);
  const { baseCurrency } = useCurrencyDisplay();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [type, setType] = useState<TransactionKind>(defaultType);
  const [description, setDescription] = useState(preset?.description ?? "");
  const [currency, setCurrency] = useState(
    allowMultiCurrency ? preset?.currency ?? "EUR" : "EUR",
  );
  const currencyWasChosenRef = useRef(Boolean(preset?.currency));
  const [amount, setAmount] = useState(
    preset?.amount ? String(preset.amount) : "",
  );
  const [occurredAt, setOccurredAt] = useState(
    preset?.occurredAt ?? localDateTimeValue(),
  );
  const transactionTimeWasEdited = useRef(Boolean(preset?.occurredAt));
  const [category, setCategory] = useState(defaultCategory);
  const [customCategory, setCustomCategory] = useState("");
  const [guidedStep, setGuidedStep] = useState<1 | 2 | 3>(preset ? 2 : 1);
  const [showAllCategories, setShowAllCategories] = useState(false);
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
      (allowMultiCurrency ? CURRENCY_CODES : ["EUR"]).map((code) => ({
        code,
        symbol: currencySymbol(code),
        name: currencyName(code, locale),
      })).sort((a, b) =>
        a.name.localeCompare(b.name, locale, { sensitivity: "base" }),
      ),
    [allowMultiCurrency, locale],
  );

  useEffect(() => {
    if (!allowMultiCurrency || preset?.currency) return;

    const applyBaseCurrency = () => {
      if (currencyWasChosenRef.current) return;
      const workspace =
        document.documentElement.dataset.currencyWorkspace === "business"
          ? "business"
          : "personal";
      setCurrency(readBrowserBaseCurrency(workspace));
    };

    applyBaseCurrency();

    const handleBaseCurrencyChange = () => applyBaseCurrency();
    window.addEventListener(
      BASE_CURRENCY_CHANGED_EVENT,
      handleBaseCurrencyChange,
    );

    return () => {
      window.removeEventListener(
        BASE_CURRENCY_CHANGED_EVENT,
        handleBaseCurrencyChange,
      );
    };
  }, [allowMultiCurrency, preset?.currency]);

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
        const data = await getExchangeRate(currency, "EUR", {
          signal: controller.signal,
        });
        setRate({ rate: data.rate, date: data.date, source: data.source });
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

  const numericAmount = finiteNumber(amount);
  const euroAmount =
    numericAmount > 0
      ? convertToReportingCurrency(numericAmount, rate.rate)
      : 0;

  const quickCategories = QUICK_CATEGORIES[type];
  const visibleQuickCategories = quickCategories.includes(category)
    ? quickCategories
    : [category, ...quickCategories.slice(0, 5)];

  function changeType(nextType: TransactionKind) {
    setType(nextType);
    setCategory(categoryForType(nextType));
    setCustomCategory("");
    setShowAllCategories(false);
  }

  function continueGuidedEntry() {
    const enteredAmount = finiteNumber(amount);
    if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
      setError("Enter an amount greater than zero before continuing.");
      return;
    }
    if (category === "Other / custom" && !customCategory.trim()) {
      setError("Enter your custom category before continuing.");
      return;
    }
    setError("");
    setGuidedStep(3);
  }

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
        amount_eur: convertToReportingCurrency(originalAmount, rate.rate),
        exchange_rate_to_eur: roundRate(rate.rate),
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

      const resolvedOccurredAt = transactionTimeWasEdited.current
        ? occurredAt
        : localDateTimeValue();
      const localInstant = new Date(resolvedOccurredAt);
      if (Number.isNaN(localInstant.getTime())) {
        throw new Error("Please choose a valid transaction date and time.");
      }

      const originalAmount = roundMoney(amount);
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
      const vaultKey = getActiveVaultKey();
      if (!vaultKey) {
        throw new Error("Unlock your Financial Vault before adding a transaction.");
      }

      const expectedPayload = {
        description: finalDescription,
        amount: originalAmount,
        currency,
        amount_eur: convertToReportingCurrency(originalAmount, rate.rate),
        exchange_rate_to_eur: roundRate(rate.rate),
        exchange_rate_date: rate.date,
        exchange_rate_source: rate.source,
        type,
        category: finalCategory,
        transaction_date: resolvedOccurredAt.slice(0, 10),
        occurred_at: localInstant.toISOString(),
      };

      const encryptedPayload = await encryptTransactionPayload(
        vaultKey,
        user.id,
        expectedPayload,
      );
      const payload = {
        user_id: user.id,
        encrypted_payload: encryptedPayload,
        encryption_version: 1,
      };

      const { data: savedTransaction, error: insertError } = await supabase
        .from("transactions")
        .insert(payload)
        .select("id,user_id,encrypted_payload,encryption_version,created_at")
        .single();

      if (insertError) throw insertError;
      if (!savedTransaction?.encrypted_payload || savedTransaction.encryption_version !== 1) {
        throw new Error("Encrypted transaction payload was not saved correctly.");
      }

      const decryptedRoundTrip = await decryptTransactionPayload(
        vaultKey,
        user.id,
        savedTransaction,
      );
      const roundTripPayload = {
        description: decryptedRoundTrip.description,
        amount: decryptedRoundTrip.amount,
        currency: decryptedRoundTrip.currency,
        amount_eur: decryptedRoundTrip.amount_eur,
        exchange_rate_to_eur: decryptedRoundTrip.exchange_rate_to_eur,
        exchange_rate_date: decryptedRoundTrip.exchange_rate_date,
        exchange_rate_source: decryptedRoundTrip.exchange_rate_source,
        type: decryptedRoundTrip.type,
        category: decryptedRoundTrip.category,
        transaction_date: decryptedRoundTrip.transaction_date,
        occurred_at: decryptedRoundTrip.occurred_at,
      };
      if (JSON.stringify(roundTripPayload) !== JSON.stringify(expectedPayload)) {
        throw new Error("Encrypted transaction round-trip verification failed.");
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
        transactionPeriodKey: `${resolvedOccurredAt.slice(0, 7)}-01`,
        finalDescription,
        finalCategory,
        originalAmount,
      });

      window.dispatchEvent(
        new CustomEvent("ficonter:transaction-created", {
          detail: { id: savedTransaction.id, encryption_version: 1 },
        }),
      );

      setNotice(
        templateWarning
          ? "Transaction saved, but the reusable shortcut could not be created."
          : "Saved. Your connected financial views are updating now.",
      );
      setAmount("");
      setDescription("");
      currencyWasChosenRef.current = false;
      const workspace =
        document.documentElement.dataset.currencyWorkspace === "business"
          ? "business"
          : "personal";
      setCurrency(
        allowMultiCurrency
          ? readBrowserBaseCurrency(workspace)
          : "EUR",
      );
      setType(initialType);
      setCategory(initialCategory ?? categoryForType(initialType));
      setCustomCategory("");
      setRememberFavorite(false);
      setRepeatMonthly(false);
      setTemplateLabel("");
      setGuidedStep(1);
      setShowAllCategories(false);
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

  const typeSelector = (
    <div className="transaction-type-buttons" role="group" aria-label="Transaction type">
      {TRANSACTION_TYPES.map((option) => {
        const optionType = option.value as TransactionKind;
        return (
          <button
            key={option.value}
            type="button"
            className={type === option.value ? "is-active" : ""}
            aria-pressed={type === option.value}
            onClick={() => changeType(optionType)}
          >
            {option.value === "expense"
              ? "Expense"
              : option.value === "income"
                ? "Income"
                : "Saving"}
          </button>
        );
      })}
    </div>
  );

  const categorySelect = (
    <>
      <select
        className="input"
        name="category"
        value={category}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          setCategory(event.target.value)
        }
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
      {category === "Other / custom" && (
        <input
          className="input effortless-custom-category"
          value={customCategory}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setCustomCategory(event.target.value)
          }
          placeholder="Enter your own category"
          maxLength={80}
          required
        />
      )}
    </>
  );

  const exchangePreview = (
    <div className="fx-preview" aria-live="polite">
      {rateLoading ? (
        <span>Retrieving the latest reference rateâ€¦</span>
      ) : rateError ? (
        <span className="fx-preview-error">{rateError}</span>
      ) : (
        <>
          <div>
            <span>Base currency equivalent</span>
            <strong>{currency === baseCurrency ? formatCurrency(numericAmount, baseCurrency) : formatReportingCurrency(euroAmount)}</strong>
          </div>
          <small>
            {currency === baseCurrency
              ? "No display conversion required."
              : `Displayed in ${baseCurrency} Â· reference date ${rate.date}`}
          </small>
        </>
      )}
    </div>
  );

  const reusableSettings = (
    <div className="effortless-reuse-panel">
      <div className="effortless-reuse-title">
        <Star size={16} />
        <div>
          <strong>Save time next time</strong>
          <span>Optional shortcuts for entries you use again.</span>
        </div>
      </div>

      <div className="effortless-reuse-options">
        <label className="effortless-check-row">
          <input
            type="checkbox"
            checked={rememberFavorite}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setRememberFavorite(event.target.checked)
            }
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
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setRepeatMonthly(event.target.checked)
            }
          />
          <span>
            <strong>Repeat monthly</strong>
            <small>Place it in your monthly confirmation queue.</small>
          </span>
        </label>
      </div>

      {(rememberFavorite || repeatMonthly) && (
        <div className="transaction-form-grid effortless-template-fields">
          <div className="field">
            <label>Shortcut name</label>
            <input
              className="input"
              value={templateLabel}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setTemplateLabel(event.target.value)
              }
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
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setRecurringDay(event.target.value)
                }
              />
            </div>
          )}
        </div>
      )}
    </div>
  );

  const statusMessages = (
    <>
      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}
    </>
  );

  if (entryMode === "simple") {
    return (
      <form className="form effortless-simple-form" onSubmit={submit}>
        {preset && (
          <div className="effortless-preset-notice">
            <span>Shortcut loaded</span>
            <strong>{preset.label}</strong>
          </div>
        )}

        <div className="effortless-simple-intro">
          <span className="effortless-mode-icon">
            <Zap size={18} />
          </span>
          <div>
            <strong>Quick add</strong>
            <p>Choose what happened, enter the amount, and tap a category.</p>
          </div>
          <span className="effortless-time-pill">About 10 seconds</span>
        </div>

        <div className="field">
          <label>What happened?</label>
          {typeSelector}
        </div>

        <div className="effortless-simple-amount">
          <label htmlFor="simple-amount">Amount</label>
          <div>
            <span>{currencySymbol(currency)}</span>
            <input
              id="simple-amount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              required
              autoFocus={!preset}
              value={amount}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setAmount(event.target.value)
              }
              placeholder="0.00"
            />
            <small>{currency}</small>
          </div>
        </div>

        <div className="field">
          <div className="effortless-field-heading">
            <label>Choose a category</label>
            <button
              type="button"
              onClick={() => setShowAllCategories((current) => !current)}
            >
              {showAllCategories ? "Use quick choices" : "More categories"}
            </button>
          </div>

          {!showAllCategories ? (
            <div className="effortless-category-chips" role="group" aria-label="Quick categories">
              {visibleQuickCategories.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={category === item ? "is-active" : ""}
                  aria-pressed={category === item}
                  onClick={() => {
                    setCategory(item);
                    if (item !== "Other / custom") setCustomCategory("");
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          ) : (
            categorySelect
          )}
        </div>

        {category === "Other / custom" && !showAllCategories && (
          <div className="field">
            <label>Custom category</label>
            <input
              className="input"
              value={customCategory}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setCustomCategory(event.target.value)
              }
              placeholder="What was it for?"
              maxLength={80}
              required
            />
          </div>
        )}

        {currency !== "EUR" && (
          <div className="effortless-simple-fx-note">
            This shortcut uses {currency}. The base-currency conversion is reviewed automatically.
            {exchangePreview}
          </div>
        )}

        <div className="effortless-simple-defaults">
          <CalendarClock size={15} />
          <span>Saved for today at the current time. Description uses the category.</span>
        </div>

        {statusMessages}
        <button
          className="btn btn-primary effortless-primary-action"
          disabled={loading || rateLoading || Boolean(rateError)}
        >
          {loading
            ? "Savingâ€¦"
            : rateLoading
              ? "Retrieving rateâ€¦"
              : actionLabel(type)}
        </button>
        <p className="effortless-mode-footnote">
          Need another currency, a different date, or a recurring shortcut? Use Guided or Detailed entry.
        </p>
      </form>
    );
  }

  if (entryMode === "guided") {
    return (
      <form className="form effortless-guided-form" onSubmit={submit}>
        {preset && (
          <div className="effortless-preset-notice">
            <span>Shortcut loaded</span>
            <strong>{preset.label}</strong>
          </div>
        )}

        <div className="effortless-stepper" aria-label="Guided entry progress">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={guidedStep === step ? "is-current" : guidedStep > step ? "is-complete" : ""}
            >
              <span>{guidedStep > step ? <Check size={14} /> : step}</span>
              <small>
                {step === 1 ? "Type" : step === 2 ? "Amount" : "Review"}
              </small>
            </div>
          ))}
        </div>

        {guidedStep === 1 && (
          <section className="effortless-guided-step">
            <div className="effortless-guided-heading">
              <span>Step 1 of 3</span>
              <h4>What kind of money movement is this?</h4>
              <p>Choose one. FICONTER will prepare the right categories.</p>
            </div>
            <div className="effortless-guided-type-cards">
              <button
                type="button"
                className={type === "expense" ? "is-active" : ""}
                onClick={() => changeType("expense")}
              >
                <strong>Expense</strong>
                <span>Money spent on everyday needs or purchases.</span>
              </button>
              <button
                type="button"
                className={type === "income" ? "is-active" : ""}
                onClick={() => changeType("income")}
              >
                <strong>Income</strong>
                <span>Salary, wages, refunds, or other money received.</span>
              </button>
              <button
                type="button"
                className={type === "saving" ? "is-active" : ""}
                onClick={() => changeType("saving")}
              >
                <strong>Saving</strong>
                <span>Money intentionally moved toward future security.</span>
              </button>
            </div>
            <button
              type="button"
              className="btn btn-primary effortless-primary-action"
              onClick={() => {
                setError("");
                setGuidedStep(2);
              }}
            >
              Continue <ArrowRight size={16} />
            </button>
          </section>
        )}

        {guidedStep === 2 && (
          <section className="effortless-guided-step">
            <div className="effortless-guided-heading">
              <span>Step 2 of 3</span>
              <h4>How much was it, and where does it belong?</h4>
              <p>These are the only required details.</p>
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
                  autoFocus
                  value={amount}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setAmount(event.target.value)
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="field">
                <label>Category</label>
                {categorySelect}
              </div>
            </div>
            {statusMessages}
            <div className="effortless-guided-actions">
              <button
                type="button"
                className="btn effortless-secondary-action"
                onClick={() => {
                  setError("");
                  setGuidedStep(1);
                }}
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={continueGuidedEntry}
              >
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </section>
        )}

        {guidedStep === 3 && (
          <section className="effortless-guided-step">
            <div className="effortless-guided-heading">
              <span>Step 3 of 3</span>
              <h4>Review or add optional details</h4>
              <p>Your amount and category are ready. Everything below is optional unless you change currency.</p>
            </div>

            <div className="effortless-guided-summary">
              <div>
                <span>{type === "expense" ? "Expense" : type === "income" ? "Income" : "Saving"}</span>
                <strong>{category === "Other / custom" ? customCategory : category}</strong>
              </div>
              <strong>{formatCurrency(finiteNumber(amount), currency)}</strong>
            </div>

            <div className="field">
              <label>Description <span className="effortless-optional-label">Optional</span></label>
              <input
                className="input"
                name="description"
                value={description}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setDescription(event.target.value)
                }
                placeholder="FICONTER will use the category when left empty"
                maxLength={120}
              />
            </div>

            <div className="transaction-form-grid">
              <div className="field">
                <label>Currency</label>
                <select
                  className="input"
                  name="currency"
                  value={currency}
                  title={allowMultiCurrency ? undefined : "Personal Pro unlocks additional currencies"}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                    currencyWasChosenRef.current = true;
                    setCurrency(event.target.value);
                  }}
                >
                  {currencyOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.symbol} {option.code} â€” {option.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Date and time</label>
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

            {exchangePreview}
            {reusableSettings}
            {statusMessages}

            <div className="effortless-guided-actions">
              <button
                type="button"
                className="btn effortless-secondary-action"
                onClick={() => {
                  setError("");
                  setGuidedStep(2);
                }}
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button
                className="btn btn-primary"
                disabled={loading || rateLoading || Boolean(rateError)}
              >
                {loading
                  ? "Savingâ€¦"
                  : rateLoading
                    ? "Retrieving rateâ€¦"
                    : actionLabel(type)}
              </button>
            </div>
          </section>
        )}
      </form>
    );
  }

  return (
    <form className="form effortless-detailed-form" onSubmit={submit}>
      {preset && (
        <div className="effortless-preset-notice">
          <span>Shortcut loaded</span>
          <strong>{preset.label}</strong>
        </div>
      )}

      <div className="effortless-detailed-header">
        <div>
          <span>Full ledger entry</span>
          <h4>Record the complete transaction</h4>
          <p>Every available field is visible for precise control and reporting.</p>
        </div>
        <span className="effortless-detail-pill">Maximum detail</span>
      </div>

      <div className="field">
        <label>Money movement</label>
        {typeSelector}
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
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setAmount(event.target.value)
            }
            placeholder="0.00"
          />
        </div>
        <div className="field">
          <label>Category</label>
          {categorySelect}
        </div>
      </div>

      <div className="field">
        <label>Description</label>
        <input
          className="input"
          name="description"
          value={description}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setDescription(event.target.value)
          }
          placeholder="Merchant, purpose, or reference"
          maxLength={120}
        />
      </div>

      <div className="transaction-form-grid">
        <div className="field">
          <label>Currency</label>
          <select
            className="input"
            name="currency"
            value={currency}
            title={allowMultiCurrency ? undefined : "Personal Pro unlocks additional currencies"}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              currencyWasChosenRef.current = true;
              setCurrency(event.target.value);
            }}
          >
            {currencyOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.symbol} {option.code} â€” {option.name}
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

      {exchangePreview}
      {reusableSettings}
      {statusMessages}

      <button
        className="btn btn-primary effortless-primary-action"
        disabled={loading || rateLoading || Boolean(rateError)}
      >
        {loading
          ? "Savingâ€¦"
          : rateLoading
            ? "Retrieving rateâ€¦"
            : "Save complete transaction"}
      </button>
    </form>
  );
}
