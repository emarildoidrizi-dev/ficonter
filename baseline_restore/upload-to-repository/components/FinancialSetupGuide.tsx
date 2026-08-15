"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarRange,
  Check,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  ListChecks,
  PiggyBank,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingDown,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  normalizeFinancialHealthInputs,
  type FinancialHealthInputs,
} from "@/lib/wealth/financialHealth";
import {
  calculateFinancialSetup,
  serializeSetupAcknowledgements,
  type FinancialSetupStepId,
  type SetupAcknowledgementKey,
  type SetupAcknowledgements,
} from "@/lib/wealth/setupReadiness";
import styles from "./FinancialSetupGuide.module.css";

const STEP_ICONS = {
  income: CircleDollarSign,
  expenses: TrendingDown,
  bills: ReceiptText,
  debt: CreditCard,
  savings: PiggyBank,
  goals: Target,
  planner: CalendarRange,
} satisfies Record<FinancialSetupStepId, typeof CircleDollarSign>;

const ACKNOWLEDGEMENT_FIELD = {
  noBills: "no_bills",
  debtFree: "debt_free",
  noSavingsYet: "no_savings_yet",
  noGoalsYet: "no_goals_yet",
} satisfies Record<SetupAcknowledgementKey, string>;

type Props = {
  userId: string;
  initialInputs: FinancialHealthInputs;
  initialAcknowledgements: SetupAcknowledgements;
  initialError?: string;
};

export function FinancialSetupGuide({
  userId,
  initialInputs,
  initialAcknowledgements,
  initialError = "",
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const refreshTimerRef = useRef<number | null>(null);
  const [inputs, setInputs] = useState(initialInputs);
  const [acknowledgements, setAcknowledgements] = useState(
    initialAcknowledgements,
  );
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState("");
  const [savingKey, setSavingKey] = useState<SetupAcknowledgementKey | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const setup = useMemo(
    () => calculateFinancialSetup(inputs, acknowledgements),
    [acknowledgements, inputs],
  );

  const refreshInputs = useCallback(
    async (showBusyState = false) => {
      if (showBusyState) setRefreshing(true);
      const { data, error: refreshError } = await supabase.rpc(
        "get_financial_health_inputs",
      );

      if (refreshError) {
        setError(refreshError.message);
      } else {
        setInputs(normalizeFinancialHealthInputs(data));
        setError("");
      }

      if (showBusyState) setRefreshing(false);
    },
    [supabase],
  );

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void refreshInputs();
    }, 180);
  }, [refreshInputs]);

  useEffect(() => {
    function refreshFromPlatformEvent() {
      scheduleRefresh();
    }

    window.addEventListener("ficonter:data-changed", refreshFromPlatformEvent);
    window.addEventListener(
      "ficonter:transaction-created",
      refreshFromPlatformEvent,
    );
    window.addEventListener(
      "ficonter:transaction-upserted",
      refreshFromPlatformEvent,
    );
    window.addEventListener(
      "ficonter:transaction-deleted",
      refreshFromPlatformEvent,
    );

    return () => {
      window.removeEventListener(
        "ficonter:data-changed",
        refreshFromPlatformEvent,
      );
      window.removeEventListener(
        "ficonter:transaction-created",
        refreshFromPlatformEvent,
      );
      window.removeEventListener(
        "ficonter:transaction-upserted",
        refreshFromPlatformEvent,
      );
      window.removeEventListener(
        "ficonter:transaction-deleted",
        refreshFromPlatformEvent,
      );
    };
  }, [scheduleRefresh]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`financial-setup-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${userId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bills",
          filter: `user_id=eq.${userId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "debts",
          filter: `user_id=eq.${userId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "goals",
          filter: `user_id=eq.${userId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "monthly_budget_plans",
          filter: `user_id=eq.${userId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "monthly_budget_items",
          filter: `user_id=eq.${userId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scheduleRefresh, supabase, userId]);

  useEffect(
    () => () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
    },
    [],
  );

  async function toggleAcknowledgement(key: SetupAcknowledgementKey) {
    if (savingKey) return;

    setSavingKey(key);
    setMessage("");
    setError("");

    const next: SetupAcknowledgements = {
      ...acknowledgements,
      [key]: !acknowledgements[key],
      updatedAt: new Date().toISOString(),
    };

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Your authenticated session could not be verified.");

      const metadata = user.user_metadata ?? {};
      const currentSetup =
        metadata.ficonter_setup && typeof metadata.ficonter_setup === "object"
          ? (metadata.ficonter_setup as Record<string, unknown>)
          : {};
      const serialized = serializeSetupAcknowledgements(next);
      const field = ACKNOWLEDGEMENT_FIELD[key];

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          ...metadata,
          ficonter_setup: {
            ...currentSetup,
            ...serialized,
            [field]: next[key],
          },
        },
      });
      if (updateError) throw updateError;

      setAcknowledgements(next);
      setMessage(
        next[key]
          ? "Your current financial position has been confirmed."
          : "The confirmation was removed.",
      );
      window.dispatchEvent(
        new CustomEvent("ficonter:setup-updated", { detail: next }),
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "The setup confirmation could not be saved.",
      );
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className={styles.workspace}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Guided financial setup</span>
          <h2>
            {setup.profileComplete
              ? "Your financial profile is complete."
              : "Give every score the context it needs."}
          </h2>
          <p>
            FICONTER distinguishes between a confirmed zero and information that
            has not been entered. Complete each area once so future scores,
            forecasts and insights can be interpreted accurately.
          </p>
        </div>

        <div className={styles.progressCard}>
          <div className={styles.progressTop}>
            <div>
              <span>Profile completion</span>
              <strong>{setup.completionPercentage}%</strong>
            </div>
            <div className={styles.scoreState} data-ready={setup.scoreReady}>
              <ShieldCheck size={17} aria-hidden="true" />
              <span>
                Score status <strong>{setup.scoreReadinessLabel}</strong>
              </span>
            </div>
          </div>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label="Financial setup completion"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={setup.completionPercentage}
          >
            <span style={{ width: `${setup.completionPercentage}%` }} />
          </div>
          <small>
            {setup.completedCount} of {setup.totalCount} areas complete
            {setup.confirmedEmptyCount
              ? ` · ${setup.confirmedEmptyCount} confirmed as currently zero`
              : ""}
          </small>
        </div>
      </section>

      {error ? <div className={styles.error}>{error}</div> : null}
      {message ? <div className={styles.success}>{message}</div> : null}

      <section className={styles.statusPanel}>
        <div>
          <ListChecks size={20} aria-hidden="true" />
          <div>
            <strong>
              {setup.nextStep
                ? `Next step: ${setup.nextStep.title}`
                : "All setup steps are complete"}
            </strong>
            <span>
              {setup.nextStep
                ? setup.nextStep.description
                : "You can review or update any area whenever your situation changes."}
            </span>
          </div>
        </div>
        <button
          type="button"
          className={styles.refreshButton}
          disabled={refreshing}
          onClick={() => void refreshInputs(true)}
        >
          <RefreshCw
            size={16}
            className={refreshing ? styles.spinning : ""}
            aria-hidden="true"
          />
          {refreshing ? "Refreshing" : "Refresh status"}
        </button>
      </section>

      <section className={styles.steps} aria-label="Financial setup steps">
        {setup.steps.map((step, index) => {
          const Icon = STEP_ICONS[step.id];
          const confirming =
            step.acknowledgementKey === savingKey && savingKey !== null;
          const acknowledgementSelected = step.acknowledgementKey
            ? acknowledgements[step.acknowledgementKey]
            : false;

          return (
            <article
              className={styles.step}
              data-complete={step.completed}
              key={step.id}
            >
              <div className={styles.stepNumber} aria-hidden="true">
                {step.completed ? <Check size={17} /> : index + 1}
              </div>
              <div className={styles.stepIcon} aria-hidden="true">
                <Icon size={20} />
              </div>
              <div className={styles.stepBody}>
                <div className={styles.stepHeading}>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                  <span className={styles.badge}>
                    {step.recorded
                      ? "Recorded"
                      : step.confirmedEmpty
                        ? "Confirmed zero"
                        : "Not complete"}
                  </span>
                </div>

                <div className={styles.stepActions}>
                  <Link href={step.href} className={styles.moduleLink}>
                    Open module
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>

                  {step.acknowledgementKey && !step.recorded ? (
                    <button
                      type="button"
                      className={styles.confirmButton}
                      data-selected={acknowledgementSelected}
                      disabled={Boolean(savingKey)}
                      onClick={() =>
                        void toggleAcknowledgement(step.acknowledgementKey!)
                      }
                    >
                      {acknowledgementSelected ? (
                        <CheckCircle2 size={16} aria-hidden="true" />
                      ) : null}
                      {confirming
                        ? "Saving confirmation…"
                        : step.confirmationLabel}
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className={styles.explanation}>
        <div>
          <ShieldCheck size={21} aria-hidden="true" />
          <div>
            <strong>No money movement and no duplicate balances</strong>
            <p>
              This guide reads the same Transactions, Bills, Debt, Savings,
              Goals and Monthly Planner records already used throughout
              FICONTER. Confirmations only describe whether an empty area is
              intentional; they never create financial amounts.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
