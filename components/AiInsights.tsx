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
  EyeOff,
  Gauge,
  Lightbulb,
  LockKeyhole,
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
  AI_INSIGHTS_CONSENT_VERSION,
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
  aiConfigured: boolean;
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
  aiConfigured,
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
  const [savingConsent, setSavingConsent] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
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
  const enabled =
    inputs.preferences.enabled &&
    inputs.preferences.consentVersion === AI_INSIGHTS_CONSENT_VERSION &&
    Boolean(inputs.preferences.consentedAt);
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
      .channel(`ai-insights:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` },
        update,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bills", filter: `user_id=eq.${userId}` },
        update,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "debts", filter: `user_id=eq.${userId}` },
        update,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "debt_payments", filter: `user_id=eq.${userId}` },
        update,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "goals", filter: `user_id=eq.${userId}` },
        update,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "monthly_budget_items", filter: `user_id=eq.${userId}` },
        update,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "financial_independence_settings", filter: `user_id=eq.${userId}` },
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

  async function enableInsights(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consentChecked || savingConsent) return;

    setSavingConsent(true);
    setError("");
    const now = new Date().toISOString();
    const { error: saveError } = await supabase
      .from("ai_insight_preferences")
      .upsert({
        user_id: userId,
        enabled: true,
        consent_version: AI_INSIGHTS_CONSENT_VERSION,
        consented_at: now,
        updated_at: now,
      });

    if (saveError) {
      setError(saveError.message);
    } else {
      setInputs((current) => ({
        ...current,
        preferences: {
          enabled: true,
          consentVersion: AI_INSIGHTS_CONSENT_VERSION,
          consentedAt: now,
          updatedAt: now,
        },
      }));
      setConsentChecked(false);
      showNotice("Private AI Insights is enabled.");
    }
    setSavingConsent(false);
  }

  async function disableInsights() {
    if (savingConsent) return;
    setSavingConsent(true);
    setError("");
    const now = new Date().toISOString();
    const { error: saveError } = await supabase
      .from("ai_insight_preferences")
      .upsert({
        user_id: userId,
        enabled: false,
        consent_version: AI_INSIGHTS_CONSENT_VERSION,
        consented_at: inputs.preferences.consentedAt,
        updated_at: now,
      });

    if (saveError) {
      setError(saveError.message);
    } else {
      setInputs((current) => ({
        ...current,
        preferences: {
          ...current.preferences,
          enabled: false,
          updatedAt: now,
        },
      }));
      showNotice("AI Insights is disabled. Existing private reports were kept.");
    }
    setSavingConsent(false);
  }

  async function generateInsights() {
    if (generating || !enabled || !context.assessed) return;
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
        setError(`${payload.error || "AI Insights could not generate a report."}${suffix}`);
      } else {
        const normalized = normalizeAiInsightSnapshot(payload.snapshot);
        if (!normalized) {
          setError("AI Insights returned an invalid report.");
        } else {
          setSnapshot(normalized);
          showNotice(
            payload.cached
              ? "Your current private AI report is already up to date."
              : "Your private AI report is ready.",
          );
        }
      }
    } catch {
      setError("AI Insights is temporarily unavailable.");
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
        setError(payload.error || "AI insight history could not be cleared.");
      } else {
        setSnapshot(null);
        setClearOpen(false);
        showNotice("AI insight history was cleared.");
      }
    } catch {
      setError("AI insight history could not be cleared.");
    }

    setClearing(false);
  }

  const report = snapshot?.report ?? null;

  return (
    <div className={styles.shell}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>WEALTH ENGINE</span>
          <h1>AI insights</h1>
          <p>
            Turn FICONTER&apos;s verified financial signals into a private,
            prioritized action plan without creating parallel balances or scores.
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
          {enabled ? (
            <button
              className={styles.generateButton}
              type="button"
              onClick={() => void generateInsights()}
              disabled={generating || !context.assessed || !aiConfigured}
            >
              <Sparkles size={17} aria-hidden="true" />
              {generating ? "Generating…" : snapshot ? "Refresh insights" : "Generate insights"}
            </button>
          ) : null}
        </div>
      </header>

      {notice ? (
        <div className={styles.notice} role="status">
          <Check size={18} aria-hidden="true" />
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className={styles.error} role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          {error}
        </div>
      ) : null}

      <section className={styles.metricGrid} aria-label="AI insight readiness">
        <article>
          <DatabaseZap aria-hidden="true" />
          <span>Data readiness</span>
          <strong>{context.dataCoverage}%</strong>
          <small>{context.confidence} aggregate coverage</small>
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
          <LockKeyhole aria-hidden="true" />
          <span>Analysis mode</span>
          <strong>{enabled ? "On demand" : "Disabled"}</strong>
          <small>No automatic AI requests</small>
        </article>
        <article>
          <Clock3 aria-hidden="true" />
          <span>Latest report</span>
          <strong>{snapshot ? dateTimeLabel(snapshot.generatedAt) : "Not generated"}</strong>
          <small>{stale ? "Financial data has changed" : snapshot ? "Current data fingerprint" : "Generate when ready"}</small>
        </article>
      </section>

      {!enabled ? (
        <section className={styles.consentPanel}>
          <div className={styles.consentIcon}>
            <ShieldCheck size={28} aria-hidden="true" />
          </div>
          <div className={styles.consentBody}>
            <span className={styles.eyebrow}>PRIVATE BY CHOICE</span>
            <h2>Enable private AI analysis</h2>
            <p>
              FICONTER sends only summarized financial metrics and category-level
              totals when you request a report. Names, email addresses, raw
              transaction descriptions and vendor-level records are excluded.
            </p>
            <p className={styles.providerDisclosure}>
              FICONTER requests that the AI provider does not store the generated
              response. The provider may still temporarily retain API request data
              for security and abuse monitoring unless zero-data-retention controls
              are enabled for the API account.
            </p>
            <div className={styles.privacyGrid}>
              <div>
                <EyeOff size={18} aria-hidden="true" />
                <strong>No raw ledger records</strong>
                <span>Only verified aggregate metrics are prepared.</span>
              </div>
              <div>
                <LockKeyhole size={18} aria-hidden="true" />
                <strong>Server-only credentials</strong>
                <span>The AI API key is never exposed to the browser.</span>
              </div>
              <div>
                <DatabaseZap size={18} aria-hidden="true" />
                <strong>No duplicate calculations</strong>
                <span>AI explains existing FICONTER results; it does not recalculate them.</span>
              </div>
            </div>
            <form className={styles.consentForm} onSubmit={enableInsights}>
              <label>
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(event) => setConsentChecked(event.target.checked)}
                />
                <span>
                  I understand that summarized financial metrics will be sent to
                  FICONTER&apos;s configured AI provider only when I generate a report,
                  and may be handled temporarily under that provider&apos;s API data policy.
                </span>
              </label>
              <button
                className={styles.generateButton}
                type="submit"
                disabled={!consentChecked || savingConsent}
              >
                <ShieldCheck size={17} aria-hidden="true" />
                {savingConsent ? "Enabling…" : "Enable AI insights"}
              </button>
            </form>
          </div>
        </section>
      ) : null}

      {enabled && !aiConfigured ? (
        <section className={styles.configurationPanel}>
          <AlertTriangle size={24} aria-hidden="true" />
          <div>
            <strong>AI service configuration is required</strong>
            <p>
              The private insight workspace is ready, but the server-side AI key
              has not been configured yet. No financial data has been sent.
            </p>
          </div>
        </section>
      ) : null}

      {enabled && !context.assessed ? (
        <section className={styles.emptyState}>
          <BrainCircuit size={42} aria-hidden="true" />
          <span className={styles.eyebrow}>NOT ENOUGH DATA</span>
          <h2>AI insights are not assessed yet</h2>
          <p>
            Add income and outflow records before FICONTER prepares a meaningful
            private report. Empty accounts remain at 0% coverage and are never
            given invented conclusions.
          </p>
          <Link href="/dashboard/transactions" prefetch={false}>
            Add financial activity
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      ) : null}

      {enabled && context.assessed && stale ? (
        <div className={styles.staleNotice} role="status">
          <RefreshCw size={18} aria-hidden="true" />
          <div>
            <strong>Your financial data changed</strong>
            <span>Generate an updated report to align the insights with the latest FICONTER figures.</span>
          </div>
        </div>
      ) : null}

      {enabled && context.assessed && !report ? (
        <section className={styles.readyState}>
          <div className={styles.readyIcon}>
            <Sparkles size={30} aria-hidden="true" />
          </div>
          <span className={styles.eyebrow}>PRIVATE INTELLIGENCE</span>
          <h2>Your verified financial signals are ready</h2>
          <p>
            Generate a concise report with priorities, opportunities, watch items
            and a practical 90-day action plan. FICONTER remains the source of truth
            for every displayed metric.
          </p>
          <button
            className={styles.generateButton}
            type="button"
            onClick={() => void generateInsights()}
            disabled={generating || !aiConfigured}
          >
            <Sparkles size={18} aria-hidden="true" />
            {generating ? "Generating private report…" : "Generate private report"}
          </button>
        </section>
      ) : null}

      {enabled && report ? (
        <>
          <section
            className={styles.hero}
            data-tone={positionTone(report.position)}
          >
            <div className={styles.heroIcon}>
              <BrainCircuit size={27} aria-hidden="true" />
            </div>
            <div className={styles.heroBody}>
              <div className={styles.heroTop}>
                <div>
                  <span>PRIVATE AI REPORT</span>
                  <h2>{report.headline}</h2>
                </div>
                <div className={styles.positionBadge}>
                  <small>Position</small>
                  <strong>{report.position}</strong>
                  <span>{snapshot ? `${snapshot.dataCoverage}% coverage` : ""}</span>
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
                  On-demand private analysis
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
                  <p>No material limitation was identified beyond the displayed data coverage.</p>
                )}
              </div>
            </div>
            <p>{report.disclaimer}</p>
          </section>
        </>
      ) : null}

      {enabled ? (
        <section className={styles.privacyFooter}>
          <div>
            <ShieldCheck size={20} aria-hidden="true" />
            <div>
              <strong>AI privacy controls</strong>
              <span>Disable future requests or remove every saved private report.</span>
            </div>
          </div>
          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => void disableInsights()}
              disabled={savingConsent}
            >
              <EyeOff size={16} aria-hidden="true" />
              Disable AI
            </button>
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
      ) : null}

      {clearOpen ? (
        <div className={styles.modalBackdrop} role="presentation">
          <form
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-ai-title"
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
            <h2 id="clear-ai-title">Clear AI report history?</h2>
            <p>
              This permanently removes all saved AI reports for your account. Your
              transactions, balances, scores and other FICONTER records remain unchanged.
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
