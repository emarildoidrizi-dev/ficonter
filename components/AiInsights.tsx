"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Check,
  CircleAlert,
  Clock3,
  DatabaseZap,
  Gauge,
  Lightbulb,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/financialOptions";
import {
  calculateAiInsightsContext,
  normalizeAiInsightSnapshot,
  normalizeAiInsightsInputs,
  type AiEvidenceMetric,
  type AiInsightDomain,
  type AiInsightItem,
  type AiInsightSnapshot,
  type AiInsightsInputs,
} from "@/lib/wealth/aiInsights";
import styles from "./AiInsights.module.css";

type Props = {
  userId: string;
  initialInputs: AiInsightsInputs;
  initialSnapshot: AiInsightSnapshot | null;
  initialFingerprint: string;
  initialError?: string;
};

const DOMAIN_ROUTES: Partial<Record<AiInsightDomain, string>> = {
  "Cash flow": "/dashboard/cash-flow",
  Savings: "/dashboard/savings",
  "Emergency fund": "/dashboard/emergency-fund",
  Debt: "/dashboard/debt",
  Bills: "/dashboard/bills",
  Goals: "/dashboard/goals",
  "Net worth": "/dashboard/net-worth",
  "Financial independence": "/dashboard/financial-independence",
  Planning: "/dashboard/budget",
  "Financial health": "/dashboard",
};

function dateTimeLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function evidenceValue(metric: AiEvidenceMetric): string {
  if (metric.value === null) return "Not available";
  if (typeof metric.value === "string") return metric.value;

  switch (metric.format) {
    case "currency":
      return formatCurrency(metric.value, "EUR");
    case "percent":
      return `${metric.value.toFixed(1)}%`;
    case "ratio":
      return `${metric.value.toFixed(2)}×`;
    case "months":
      return `${metric.value.toFixed(1)} months`;
    case "score":
      return `${Math.round(metric.value)} / 100`;
    case "number":
      return Math.round(metric.value).toLocaleString("en-GB");
    default:
      return String(metric.value);
  }
}

function positionTone(position: string): string {
  if (position === "Strong" || position === "Stable") return "positive";
  if (position === "At risk") return "critical";
  if (position === "Needs attention") return "warning";
  return "info";
}

function domainIcon(domain: AiInsightDomain) {
  if (domain === "Cash flow") return TrendingUp;
  if (domain === "Financial independence" || domain === "Goals") return Target;
  if (domain === "Financial health" || domain === "Planning") return Gauge;
  if (domain === "Debt" || domain === "Bills") return AlertTriangle;
  return Lightbulb;
}

function EvidenceChips({
  item,
  evidence,
}: {
  item: Pick<AiInsightItem, "evidenceKeys">;
  evidence: ReturnType<typeof calculateAiInsightsContext>["evidence"];
}) {
  if (!item.evidenceKeys.length) return null;

  return (
    <div className={styles.evidenceRow} aria-label="Verified FICONTER evidence">
      {item.evidenceKeys.map((key) => {
        const metric = evidence[key];
        return (
          <span className={styles.evidenceChip} key={key}>
            <small>{metric.label}</small>
            <strong>{evidenceValue(metric)}</strong>
          </span>
        );
      })}
    </div>
  );
}

function InsightCard({
  item,
  evidence,
}: {
  item: AiInsightItem;
  evidence: ReturnType<typeof calculateAiInsightsContext>["evidence"];
}) {
  const Icon = domainIcon(item.domain);
  const route = DOMAIN_ROUTES[item.domain];

  return (
    <article className={styles.insightCard} data-priority={item.priority}>
      <div className={styles.insightTop}>
        <span className={styles.insightIcon}>
          <Icon size={19} aria-hidden="true" />
        </span>
        <div>
          <span>{item.domain}</span>
          <strong>{item.priority}</strong>
        </div>
      </div>
      <h3>{item.title}</h3>
      <p>{item.insight}</p>
      <div className={styles.cardAction}>
        <span>Recommended action</span>
        <strong>{item.action}</strong>
      </div>
      <EvidenceChips item={item} evidence={evidence} />
      {route ? (
        <Link className={styles.moduleLink} href={route} prefetch={false}>
          Open {item.domain}
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      ) : null}
    </article>
  );
}

function InsightSection({
  eyebrow,
  title,
  items,
  evidence,
  emptyMessage,
}: {
  eyebrow: string;
  title: string;
  items: AiInsightItem[];
  evidence: ReturnType<typeof calculateAiInsightsContext>["evidence"];
  emptyMessage: string;
}) {
  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
      </header>
      {items.length ? (
        <div className={styles.insightGrid}>
          {items.map((item, index) => (
            <InsightCard
              item={item}
              evidence={evidence}
              key={`${item.domain}-${item.title}-${index}`}
            />
          ))}
        </div>
      ) : (
        <p className={styles.emptyInline}>{emptyMessage}</p>
      )}
    </section>
  );
}

export function AiInsights({
  userId,
  initialInputs,
  initialSnapshot,
  initialFingerprint,
  initialError = "",
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const refreshTimerRef = useRef<number | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const [inputs, setInputs] = useState(initialInputs);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [fingerprint, setFingerprint] = useState(initialFingerprint);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    setInputs(initialInputs);
    setFingerprint(initialFingerprint);
    setError(initialError);
    setSnapshot(initialSnapshot);
  }, [initialError, initialFingerprint, initialInputs, initialSnapshot]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    };
  }, []);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(""), 5000);
  }, []);

  const context = useMemo(() => calculateAiInsightsContext(inputs), [inputs]);
  const stale = Boolean(snapshot && snapshot.dataFingerprint !== fingerprint);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const { data, error: refreshError } = await supabase.rpc(
      "get_ai_insights_inputs",
    );

    if (refreshError) {
      setError(refreshError.message);
    } else {
      const normalized = normalizeAiInsightsInputs(data);
      const updatedContext = calculateAiInsightsContext(normalized);
      setInputs(normalized);
      setFingerprint(updatedContext.fingerprint);
      setError("");
    }
    setRefreshing(false);
  }, [supabase]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void refresh();
    }, 250);
  }, [refresh]);

  useEffect(() => {
    const onPlatformChange = () => scheduleRefresh();
    window.addEventListener("ficonter:data-changed", onPlatformChange);
    return () => {
      window.removeEventListener("ficonter:data-changed", onPlatformChange);
    };
  }, [scheduleRefresh]);

  useEffect(() => {
    const update = () => scheduleRefresh();
    const channel = supabase
      .channel(`smart-insights:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${userId}`,
        },
        update,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bills",
          filter: `user_id=eq.${userId}`,
        },
        update,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "debts",
          filter: `user_id=eq.${userId}`,
        },
        update,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "debt_payments",
          filter: `user_id=eq.${userId}`,
        },
        update,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "goals",
          filter: `user_id=eq.${userId}`,
        },
        update,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "monthly_budget_items",
          filter: `user_id=eq.${userId}`,
        },
        update,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "financial_independence_settings",
          filter: `user_id=eq.${userId}`,
        },
        update,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scheduleRefresh, supabase, userId]);

  useEffect(() => {
    function handleVisible() {
      if (document.visibilityState === "visible") void refresh();
    }
    document.addEventListener("visibilitychange", handleVisible);
    return () => document.removeEventListener("visibilitychange", handleVisible);
  }, [refresh]);

  async function generateInsights() {
    if (generating || !context.assessed) return;
    setGenerating(true);
    setError("");

    try {
      const response = await fetch("/api/wealth/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        cached?: boolean;
        retryAfter?: number;
        snapshot?: unknown;
      };

      if (!response.ok) {
        const suffix = payload.retryAfter
          ? ` Try again in ${payload.retryAfter} seconds.`
          : "";
        setError(
          `${payload.error || "Smart Insights could not generate a report."}${suffix}`,
        );
      } else {
        const normalized = normalizeAiInsightSnapshot(payload.snapshot);
        if (!normalized) {
          setError("Smart Insights returned an invalid report.");
        } else {
          setSnapshot(normalized);
          showNotice(
            payload.cached
              ? "Your Smart Insight report is already up to date."
              : "Your Smart Insight report is ready.",
          );
        }
      }
    } catch {
      setError("Smart Insights is temporarily unavailable.");
    }

    setGenerating(false);
  }

  async function clearHistory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (clearing) return;
    setClearing(true);
    setError("");

    try {
      const response = await fetch("/api/wealth/ai-insights", {
        method: "DELETE",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error || "Smart Insight history could not be cleared.");
      } else {
        setSnapshot(null);
        setClearOpen(false);
        showNotice("Smart Insight history was cleared.");
      }
    } catch {
      setError("Smart Insight history could not be cleared.");
    }

    setClearing(false);
  }

  const report = stale ? null : snapshot?.report ?? null;

  return (
    <div className={styles.shell}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>WEALTH ENGINE</span>
          <h1>Smart insights</h1>
          <p>
            Turn FICONTER&apos;s verified financial signals into a prioritized,
            practical action plan without external AI requests or parallel
            calculations.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.refreshButton}
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
          >
            <RefreshCw
              className={refreshing ? styles.spinning : undefined}
              size={17}
              aria-hidden="true"
            />
            Refresh data
          </button>
          <button
            className={styles.generateButton}
            type="button"
            onClick={() => void generateInsights()}
            disabled={generating || !context.assessed}
          >
            <Sparkles size={17} aria-hidden="true" />
            {generating
              ? "Preparing…"
              : stale
                ? "Update insights"
                : snapshot
                  ? "Refresh insights"
                  : "Generate insights"}
          </button>
        </div>
      </header>

      {notice ? (
        <div className={styles.notice} role="status">
          <Check size={17} aria-hidden="true" />
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className={styles.error} role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          {error}
        </div>
      ) : null}

      <section className={styles.metricGrid} aria-label="Smart Insight status">
        <article>
          <DatabaseZap aria-hidden="true" />
          <span>Data readiness</span>
          <strong>{context.dataCoverage}%</strong>
          <small>{context.confidence} aggregate data readiness</small>
        </article>
        <article>
          <Gauge aria-hidden="true" />
          <span>Sources connected</span>
          <strong>
            {context.connectedSources} / {context.totalSources}
          </strong>
          <small>Existing Wealth Engine modules only</small>
        </article>
        <article>
          <ShieldCheck aria-hidden="true" />
          <span>Analysis mode</span>
          <strong>Rules-based</strong>
          <small>No external AI request</small>
        </article>
        <article>
          <Clock3 aria-hidden="true" />
          <span>Latest report</span>
          <strong>{stale ? "Update required" : snapshot ? "Generated" : "Not generated"}</strong>
          <small>
            {stale
              ? "Financial data has changed"
              : snapshot
                ? dateTimeLabel(snapshot.generatedAt)
                : "Generate when ready"}
          </small>
        </article>
      </section>

      <section className={styles.configurationPanel}>
        <ShieldCheck size={24} aria-hidden="true" />
        <div>
          <strong>Cost-free private analysis</strong>
          <p>
            Smart Insights is generated inside FICONTER from the same verified
            scores, totals, and forecasts already used across the platform. No
            financial information is sent to OpenAI or another external AI
            provider.
          </p>
        </div>
      </section>

      {!context.assessed ? (
        <section className={styles.emptyState}>
          <BrainCircuit size={42} aria-hidden="true" />
          <span className={styles.eyebrow}>NOT ENOUGH DATA</span>
          <h2>Smart insights are not assessed yet</h2>
          <p>
            Add income and outflow records before FICONTER prepares a meaningful
            report. Empty accounts remain at 0% coverage and are never given
            invented conclusions.
          </p>
          <Link href="/dashboard/transactions" prefetch={false}>
            Add financial activity
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      ) : null}

      {context.assessed && stale ? (
        <div className={styles.staleNotice} role="status">
          <RefreshCw size={18} aria-hidden="true" />
          <div>
            <strong>Your financial data changed</strong>
            <span>
              Generate an updated report to align the insights with the latest
              FICONTER figures.
            </span>
          </div>
        </div>
      ) : null}

      {context.assessed && !report ? (
        <section className={styles.readyState}>
          <div className={styles.readyIcon}>
            <Sparkles size={30} aria-hidden="true" />
          </div>
          <span className={styles.eyebrow}>PRIVATE INTELLIGENCE</span>
          <h2>Your verified financial signals are ready</h2>
          <p>
            Generate a concise report with priorities, opportunities, watch
            items, and a practical 90-day action plan. FICONTER remains the
            source of truth for every displayed metric.
          </p>
          <button
            className={styles.generateButton}
            type="button"
            onClick={() => void generateInsights()}
            disabled={generating}
          >
            <Sparkles size={18} aria-hidden="true" />
            {generating ? "Preparing smart report…" : "Generate smart report"}
          </button>
        </section>
      ) : null}

      {context.assessed && report ? (
        <>
          <section className={styles.hero} data-tone={positionTone(report.position)}>
            <div className={styles.heroIcon}>
              <BrainCircuit size={27} aria-hidden="true" />
            </div>
            <div className={styles.heroBody}>
              <div className={styles.heroTop}>
                <div>
                  <span>SMART INSIGHT REPORT</span>
                  <h2>{report.headline}</h2>
                </div>
                <div className={styles.positionBadge}>
                  <small>Position</small>
                  <strong>{report.position}</strong>
                  <span>{snapshot ? `${snapshot.dataCoverage}% report-data readiness` : ""}</span>
                </div>
              </div>
              <p>{report.summary}</p>
              <div className={styles.reportMeta}>
                <span>
                  <Clock3 size={15} aria-hidden="true" />
                  {snapshot ? dateTimeLabel(snapshot.generatedAt) : ""}
                </span>
                <span>
                  <ShieldCheck size={15} aria-hidden="true" />
                  On-demand FICONTER analysis
                </span>
                {stale ? <strong>Update available</strong> : <strong>Current</strong>}
              </div>
            </div>
          </section>

          <InsightSection
            eyebrow="TOP PRIORITIES"
            title="What deserves attention first"
            items={report.priorities}
            evidence={context.evidence}
            emptyMessage="No priority was identified from the available data."
          />

          <div className={styles.twoColumn}>
            <InsightSection
              eyebrow="OPPORTUNITIES"
              title="Where momentum can improve"
              items={report.opportunities}
              evidence={context.evidence}
              emptyMessage="More history is needed to identify reliable opportunities."
            />
            <InsightSection
              eyebrow="WATCHLIST"
              title="Signals to keep visible"
              items={report.watchlist}
              evidence={context.evidence}
              emptyMessage="No additional watch item was identified."
            />
          </div>

          <section className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span>90-DAY ACTION PLAN</span>
                <h2>Turn insight into progress</h2>
              </div>
            </header>
            <ol className={styles.actionPlan}>
              {report.actionPlan.map((step, index) => (
                <li key={`${step.order}-${step.title}-${index}`}>
                  <span className={styles.stepNumber}>{step.order}</span>
                  <div className={styles.stepBody}>
                    <div className={styles.stepTop}>
                      <span>{step.horizon}</span>
                      <h3>{step.title}</h3>
                    </div>
                    <p>{step.action}</p>
                    <EvidenceChips item={step} evidence={context.evidence} />
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className={styles.disclosurePanel}>
            <div>
              <AlertTriangle size={20} aria-hidden="true" />
              <div>
                <strong>Data limitations</strong>
                {report.dataLimitations.length ? (
                  <ul>
                    {report.dataLimitations.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    No material limitation was identified beyond the displayed
                    report-data coverage.
                  </p>
                )}
              </div>
            </div>
            <p>{report.disclaimer}</p>
          </section>
        </>
      ) : null}

      <section className={styles.privacyFooter}>
        <div>
          <ShieldCheck size={20} aria-hidden="true" />
          <div>
            <strong>Private Smart Insight controls</strong>
            <span>
              Reports stay in your FICONTER account and use no paid external AI
              service.
            </span>
          </div>
        </div>
        <div className={styles.footerActions}>
          <button
            type="button"
            className={styles.dangerButton}
            onClick={() => setClearOpen(true)}
            disabled={!snapshot}
          >
            <Trash2 size={16} aria-hidden="true" />
            Clear report history
          </button>
        </div>
      </section>

      {clearOpen ? (
        <div className={styles.modalBackdrop} role="presentation">
          <form
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-smart-title"
            onSubmit={clearHistory}
          >
            <button
              className={styles.closeButton}
              type="button"
              aria-label="Close"
              onClick={() => setClearOpen(false)}
            >
              <X size={20} aria-hidden="true" />
            </button>
            <span className={styles.eyebrow}>PRIVATE DATA CONTROL</span>
            <h2 id="clear-smart-title">Clear Smart Insight history?</h2>
            <p>
              This permanently removes all saved Smart Insight reports for your
              account. Transactions, balances, scores, and other FICONTER records
              remain unchanged.
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => setClearOpen(false)}
              >
                Cancel
              </button>
              <button
                className={styles.dangerButton}
                type="submit"
                disabled={clearing}
                data-enter-confirm="true"
              >
                <Trash2 size={16} aria-hidden="true" />
                {clearing ? "Clearing…" : "Clear permanently"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
