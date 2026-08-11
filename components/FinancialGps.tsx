"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  CircleDollarSign,
  Compass,
  CreditCard,
  Flag,
  Gauge,
  Landmark,
  ListChecks,
  PiggyBank,
  ReceiptText,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Umbrella,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatReportingCurrency } from "@/lib/financialOptions";
import {
  normalizeAiInsightsInputs,
  type AiInsightDomain,
  type AiInsightsInputs,
} from "@/lib/wealth/aiInsights";
import {
  calculateFinancialGps,
  type FinancialGpsAction,
  type FinancialGpsMetric,
} from "@/lib/wealth/financialGps";
import type { SetupAcknowledgements } from "@/lib/wealth/setupReadiness";
import styles from "./FinancialGps.module.css";

const DOMAIN_ICONS: Record<AiInsightDomain | "Setup", typeof Compass> = {
  Setup: ListChecks,
  "Financial health": Gauge,
  "Cash flow": TrendingUp,
  Savings: PiggyBank,
  "Emergency fund": Umbrella,
  Debt: CreditCard,
  Bills: ReceiptText,
  Goals: Target,
  "Net worth": Landmark,
  "Financial independence": Flag,
  Planning: Route,
};

type Props = {
  userId: string;
  initialInputs: AiInsightsInputs;
  initialAcknowledgements: SetupAcknowledgements;
  initialError?: string;
};

function evidenceValue(
  item: FinancialGpsAction["evidence"][number],
): string {
  if (item.value === null) return "Not available";
  if (typeof item.value === "string") return item.value;

  switch (item.format) {
    case "currency":
      return formatReportingCurrency(item.value);
    case "percent":
      return `${item.value.toFixed(1)}%`;
    case "ratio":
      return `${item.value.toFixed(2)}×`;
    case "months":
      return `${item.value.toFixed(1)} months`;
    case "score":
      return `${Math.round(item.value)} / 100`;
    case "number":
      return Math.round(item.value).toLocaleString("en-GB");
    default:
      return String(item.value);
  }
}

function metricValue(metric: FinancialGpsMetric): string {
  if (metric.value === null) return "Pending";
  if (metric.format === "currency") return formatReportingCurrency(metric.value);
  if (metric.format === "months") return `${metric.value.toFixed(1)} months`;
  return `${metric.value.toFixed(1)}%`;
}

function ActionIcon({ domain }: { domain: FinancialGpsAction["domain"] }) {
  const Icon = DOMAIN_ICONS[domain] ?? Compass;
  return <Icon size={20} aria-hidden="true" />;
}

export function FinancialGps({
  userId,
  initialInputs,
  initialAcknowledgements,
  initialError = "",
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const timerRef = useRef<number | null>(null);
  const [inputs, setInputs] = useState(initialInputs);
  const [acknowledgements, setAcknowledgements] = useState(
    initialAcknowledgements,
  );
  const [error, setError] = useState(initialError);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionState, setConnectionState] = useState<
    "connecting" | "live" | "offline"
  >("connecting");

  const gps = useMemo(
    () => calculateFinancialGps(inputs, acknowledgements),
    [acknowledgements, inputs],
  );

  const refreshInputs = useCallback(
    async (showBusyState = false) => {
      if (showBusyState) setRefreshing(true);
      const { data, error: refreshError } = await supabase.rpc(
        "get_ai_insights_inputs",
      );

      if (refreshError) {
        setError(refreshError.message);
      } else {
        setInputs(normalizeAiInsightsInputs(data));
        setError("");
      }

      if (showBusyState) setRefreshing(false);
    },
    [supabase],
  );

  const scheduleRefresh = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void refreshInputs();
    }, 180);
  }, [refreshInputs]);

  useEffect(() => {
    function refreshFromPlatform() {
      scheduleRefresh();
    }

    function updateSetup(event: Event) {
      const detail = (event as CustomEvent<SetupAcknowledgements>).detail;
      if (detail) setAcknowledgements(detail);
    }

    window.addEventListener("ficonter:data-changed", refreshFromPlatform);
    window.addEventListener("ficonter:transaction-created", refreshFromPlatform);
    window.addEventListener("ficonter:transaction-upserted", refreshFromPlatform);
    window.addEventListener("ficonter:transaction-deleted", refreshFromPlatform);
    window.addEventListener("ficonter:setup-updated", updateSetup);

    return () => {
      window.removeEventListener("ficonter:data-changed", refreshFromPlatform);
      window.removeEventListener(
        "ficonter:transaction-created",
        refreshFromPlatform,
      );
      window.removeEventListener(
        "ficonter:transaction-upserted",
        refreshFromPlatform,
      );
      window.removeEventListener(
        "ficonter:transaction-deleted",
        refreshFromPlatform,
      );
      window.removeEventListener("ficonter:setup-updated", updateSetup);
    };
  }, [scheduleRefresh]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`financial-gps-${userId}`)
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
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") setConnectionState("live");
        else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setConnectionState("offline");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scheduleRefresh, supabase, userId]);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return (
    <>
      <header className="topbar">
        <div className="page-title">
          <h1>Financial GPS</h1>
          <p>One clear priority, a simple path, and no unnecessary complexity.</p>
        </div>
        <div className={styles.headerActions}>
          <span
            className={`${styles.liveState} ${styles[connectionState]}`}
            aria-label={`Financial GPS is ${connectionState}`}
          >
            <span />
            {connectionState === "live"
              ? "Live guidance"
              : connectionState === "offline"
                ? "Reconnecting"
                : "Connecting"}
          </span>
          <button
            type="button"
            className="btn btn-soft"
            disabled={refreshing}
            onClick={() => void refreshInputs(true)}
          >
            <RefreshCw size={17} className={refreshing ? styles.spin : ""} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>
            <Compass size={15} /> {gps.positionLabel}
          </span>
          <h2>{gps.headline}</h2>
          <p>{gps.summary}</p>
          <div className={styles.confidenceRow}>
            <span>
              <ShieldCheck size={15} /> {gps.confidenceLabel}
            </span>
            <span>{gps.setupCompletion}% profile complete</span>
            <span>{gps.coverage}% guidance coverage</span>
          </div>
        </div>
        <div className={styles.milestoneCard}>
          <span>Your next milestone</span>
          <strong>{gps.milestone}</strong>
          <small>
            Stage {gps.stageIndex + 1} of {gps.stages.length} · {gps.stage.label}
          </small>
        </div>
      </section>

      <section className={styles.journey} aria-label="Financial journey stages">
        {gps.stages.map((stage, index) => {
          const complete = index < gps.stageIndex;
          const current = index === gps.stageIndex;
          return (
            <div
              className={`${styles.journeyStep} ${
                complete ? styles.journeyComplete : ""
              } ${current ? styles.journeyCurrent : ""}`}
              key={stage.id}
            >
              <span className={styles.journeyDot}>
                {complete ? <Check size={15} /> : index + 1}
              </span>
              <div>
                <strong>{stage.label}</strong>
                <small>{stage.description}</small>
              </div>
            </div>
          );
        })}
      </section>

      <section className={styles.primaryGrid}>
        <article
          className={styles.primaryAction}
          data-tone={gps.primaryAction.tone}
        >
          <div className={styles.primaryIcon}>
            <ActionIcon domain={gps.primaryAction.domain} />
          </div>
          <div className={styles.primaryContent}>
            <span className={styles.sectionLabel}>Your focus now</span>
            <h2>{gps.primaryAction.title}</h2>
            <p>{gps.primaryAction.explanation}</p>
            <div className={styles.instruction}>
              <Sparkles size={18} />
              <div>
                <small>Recommended action</small>
                <strong>{gps.primaryAction.instruction}</strong>
              </div>
            </div>
            {gps.primaryAction.evidence.length ? (
              <div className={styles.evidenceRow}>
                {gps.primaryAction.evidence.map((evidence) => (
                  <span key={`${evidence.label}-${String(evidence.value)}`}>
                    <small>{evidence.label}</small>
                    <strong>{evidenceValue(evidence)}</strong>
                  </span>
                ))}
              </div>
            ) : null}
            <Link className="btn btn-gold" href={gps.primaryAction.href}>
              {gps.primaryAction.ctaLabel} <ArrowRight size={17} />
            </Link>
          </div>
        </article>

        <aside className={styles.comfortCard}>
          <div className={styles.comfortIcon}>
            <ShieldCheck size={22} />
          </div>
          <span className={styles.sectionLabel}>Calm by design</span>
          <h3>You do not need to solve everything today.</h3>
          <p>
            FICONTER ranks the next useful action from the information already in
            your account. It never moves money or makes a financial decision for
            you.
          </p>
          <div className={styles.comfortPoints}>
            <span><Check size={15} /> One priority at a time</span>
            <span><Check size={15} /> Plain-language explanation</span>
            <span><Check size={15} /> Direct route to the right tool</span>
          </div>
        </aside>
      </section>

      {gps.notice ? (
        <div className={styles.notice}>
          <AlertTriangle size={18} />
          <span>{gps.notice}</span>
          <Link href="/dashboard/setup">Review setup</Link>
        </div>
      ) : null}

      <section className={styles.metricGrid} aria-label="Financial GPS snapshot">
        {gps.metrics.map((metric) => (
          <article className={styles.metricCard} data-tone={metric.tone} key={metric.id}>
            <span>{metric.label}</span>
            <strong>{metricValue(metric)}</strong>
            <small>{metric.caption}</small>
          </article>
        ))}
      </section>

      <section className={styles.pathPanel}>
        <div className={styles.panelHeading}>
          <div>
            <span className={styles.sectionLabel}>Simple action path</span>
            <h2>Your next three moves</h2>
          </div>
          <Route size={24} />
        </div>
        <div className={styles.actionPath}>
          {gps.actionPath.map((action, index) => (
            <article className={styles.pathCard} key={action.id}>
              <div className={styles.pathNumber}>{index + 1}</div>
              <div className={styles.pathBody}>
                <div className={styles.pathDomain}>
                  <ActionIcon domain={action.domain} />
                  <span>{action.domain}</span>
                </div>
                <h3>{action.title}</h3>
                <p>{action.instruction}</p>
                <Link href={action.href}>
                  {action.ctaLabel} <ChevronRight size={16} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className={styles.disclaimer}>
        <CircleDollarSign size={16} />
        Financial GPS provides planning guidance from your recorded FICONTER data.
        It does not hold, transfer, invest, or reserve money.
      </footer>
    </>
  );
}
