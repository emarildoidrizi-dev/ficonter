"use client";

import {
  ChevronRight,
  LockKeyhole,
  MessageCircleQuestion,
  Send,
  ShieldCheck,
  Sparkles,
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

import { useBaseCurrencySourceData } from "@/components/useBaseCurrencySourceData";
import { useVault } from "@/components/VaultProvider";
import { reconcileAiInsightsToBaseCurrency } from "@/lib/finance/baseCurrencyReconciliation";
import { loadAiInsightsInputsFromVault } from "@/lib/e2ee/aiInsightsSource";
import { createClient } from "@/lib/supabase/client";
import {
  askFiconter,
  type AskFiconterAnswer,
  type AskFiconterEvidence,
} from "@/lib/wealth/askFiconter";
import type { AiInsightsInputs } from "@/lib/wealth/aiInsights";
import styles from "./AskFiconterLauncher.module.css";

type Exchange = {
  id: string;
  question: string;
  answer: AskFiconterAnswer;
};

type IOSNavigator = Navigator & {
  standalone?: boolean;
};

const APP_RETRACTED_SESSION_KEY = "ficonter:ask-ficonter-retracted";
const APP_SWIPE_THRESHOLD = 34;

function isStandaloneApp() {
  if (typeof window === "undefined") return false;

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as IOSNavigator).standalone);
  const root = document.documentElement;

  return (
    standalone &&
    root.dataset.ficonterNativeApp !== "false" &&
    root.dataset.ficonterDevice !== "desktop"
  );
}

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toLocaleString("en-GB")} ${currency}`;
  }
}

function evidenceValue(item: AskFiconterEvidence, currency: string): string {
  if (item.value === null) return "Not available";
  if (typeof item.value === "string") return item.value;

  switch (item.format) {
    case "currency":
      return formatMoney(item.value, currency);
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

export function AskFiconterLauncher({
  userId,
  baseCurrency,
  available = true,
}: {
  userId: string;
  baseCurrency: string;
  available?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { status: vaultStatus, vaultKey } = useVault();
  const { source, context: currencyContext, loading: currencyLoading } =
    useBaseCurrencySourceData(userId);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pointerStartXRef = useRef<number | null>(null);
  const suppressLauncherClickRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [inputs, setInputs] = useState<AiInsightsInputs | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [standaloneApp, setStandaloneApp] = useState(false);
  const [appRetracted, setAppRetracted] = useState(false);
  const [appRetractReady, setAppRetractReady] = useState(false);

  const currency = baseCurrency.toUpperCase() || "EUR";
  const starterQuestions = useMemo(
    () => [
      `When could I afford a ${formatMoney(25000, currency)} car?`,
      "Should I buy or lease a car?",
      `Can I afford a ${formatMoney(350, currency)} monthly payment?`,
      "What should I improve first?",
    ],
    [currency],
  );
  const reconciledInputs = useMemo(
    () =>
      inputs
        ? reconcileAiInsightsToBaseCurrency(inputs, source, currencyContext)
        : null,
    [currencyContext, inputs, source],
  );

  useEffect(() => {
    const active = isStandaloneApp();
    setStandaloneApp(active);
    if (!active) return;

    try {
      setAppRetracted(
        window.sessionStorage.getItem(APP_RETRACTED_SESSION_KEY) === "1",
      );
    } catch {
      // Session persistence is optional; the launcher still works without it.
    } finally {
      setAppRetractReady(true);
    }
  }, []);

  useEffect(() => {
    if (!appRetractReady || !standaloneApp) return;

    try {
      window.sessionStorage.setItem(
        APP_RETRACTED_SESSION_KEY,
        appRetracted ? "1" : "0",
      );
    } catch {
      // Ignore storage restrictions in hardened/private app sessions.
    }
  }, [appRetractReady, appRetracted, standaloneApp]);

  const loadInputs = useCallback(async () => {
    if (!open || vaultStatus !== "unlocked" || !vaultKey || currencyLoading) {
      return;
    }

    setLoading(true);
    try {
      const nextInputs = await loadAiInsightsInputsFromVault(
        supabase,
        vaultKey,
        userId,
        source,
      );
      setInputs(nextInputs);
      setError("");
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "FICONTER could not prepare your financial context.",
      );
    } finally {
      setLoading(false);
    }
  }, [currencyLoading, open, source, supabase, userId, vaultKey, vaultStatus]);

  useEffect(() => {
    if (!open) return;
    void loadInputs();
  }, [loadInputs, open]);

  useEffect(() => {
    if (!open) return;

    function refreshFromPlatform() {
      void loadInputs();
    }

    window.addEventListener("ficonter:data-changed", refreshFromPlatform);
    window.addEventListener("ficonter:transaction-created", refreshFromPlatform);
    window.addEventListener("ficonter:transaction-upserted", refreshFromPlatform);
    window.addEventListener("ficonter:transaction-deleted", refreshFromPlatform);

    return () => {
      window.removeEventListener("ficonter:data-changed", refreshFromPlatform);
      window.removeEventListener("ficonter:transaction-created", refreshFromPlatform);
      window.removeEventListener("ficonter:transaction-upserted", refreshFromPlatform);
      window.removeEventListener("ficonter:transaction-deleted", refreshFromPlatform);
    };
  }, [loadInputs, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !exchanges.length) return;
    bodyRef.current?.scrollTo({
      top: bodyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [exchanges, open]);

  function runQuestion(rawQuestion: string) {
    const nextQuestion = rawQuestion.trim();
    if (!nextQuestion || !reconciledInputs) return;

    const answer = askFiconter(nextQuestion, reconciledInputs, currency);
    setExchanges((current) => [
      ...current,
      {
        id: `${Date.now()}-${current.length}`,
        question: nextQuestion,
        answer,
      },
    ]);
    setQuestion("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runQuestion(question);
  }

  function suppressNextLauncherClick() {
    suppressLauncherClickRef.current = true;
    window.setTimeout(() => {
      suppressLauncherClickRef.current = false;
    }, 0);
  }

  const latestExchange = exchanges.length
    ? exchanges[exchanges.length - 1]
    : null;
  const latestFollowUps = latestExchange?.answer.followUps ?? [];
  const suggestionQuestions = latestFollowUps.length
    ? latestFollowUps.slice(0, 4)
    : starterQuestions;

  if (!available) return null;

  return (
    <>
      <button
        type="button"
        className={styles.launcher}
        data-app-retracted={appRetracted ? "true" : "false"}
        style={
          standaloneApp
            ? {
                left: 0,
                right: "auto",
                bottom: "calc(132px + env(safe-area-inset-bottom))",
                width: "auto",
                maxWidth: "min(220px, calc(100vw - 24px))",
                minHeight: 52,
                padding: "7px 8px 7px 14px",
                flexDirection: "row-reverse",
                borderRadius: "0 999px 999px 0",
                touchAction: "pan-y",
                transform: appRetracted
                  ? "translateX(calc(-100% + 54px))"
                  : "translateX(0)",
                transition:
                  "transform .22s cubic-bezier(.2,.8,.2,1), box-shadow .18s ease, border-color .18s ease",
              }
            : undefined
        }
        onPointerDown={(event) => {
          if (!standaloneApp) return;
          pointerStartXRef.current = event.clientX;
          suppressLauncherClickRef.current = false;
        }}
        onPointerUp={(event) => {
          const startX = pointerStartXRef.current;
          pointerStartXRef.current = null;
          if (startX === null || !standaloneApp) return;

          const deltaX = event.clientX - startX;
          if (deltaX <= -APP_SWIPE_THRESHOLD) {
            setAppRetracted(true);
            suppressNextLauncherClick();
          } else if (deltaX >= APP_SWIPE_THRESHOLD) {
            setAppRetracted(false);
            suppressNextLauncherClick();
          }
        }}
        onPointerCancel={() => {
          pointerStartXRef.current = null;
        }}
        onClick={() => {
          if (suppressLauncherClickRef.current) return;
          setOpen(true);
        }}
        aria-label="Ask FICONTER about your finances"
        aria-haspopup="dialog"
      >
        <span className={styles.launcherIcon} aria-hidden="true">
          <Sparkles size={19} />
        </span>
        <span
          className={styles.launcherText}
          style={standaloneApp ? { display: "grid" } : undefined}
        >
          <strong>Ask FICONTER</strong>
          <small>Use my financial data</small>
        </span>
      </button>

      {open ? (
        <div
          className={styles.backdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ask-ficonter-title"
          >
            <header className={styles.header}>
              <div className={styles.brandMark} aria-hidden="true">
                <MessageCircleQuestion size={21} />
              </div>
              <div className={styles.headerCopy}>
                <span className={styles.eyebrow}>Financial decision intelligence</span>
                <h2 id="ask-ficonter-title">Ask FICONTER</h2>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setOpen(false)}
                aria-label="Close Ask FICONTER"
              >
                <X size={20} />
              </button>
            </header>

            <div className={styles.privacyBar}>
              <ShieldCheck size={15} aria-hidden="true" />
              <span>Calculated from your unlocked FICONTER financial data.</span>
              <span className={styles.dot}>•</span>
              <span>Questions are not saved by this feature.</span>
            </div>

            <div className={styles.body} ref={bodyRef}>
              {vaultStatus !== "unlocked" || !vaultKey ? (
                <div className={styles.stateCard}>
                  <LockKeyhole size={28} aria-hidden="true" />
                  <h3>Unlock your Financial Vault first</h3>
                  <p>
                    Ask FICONTER only works with the financial information available
                    inside your unlocked vault. It will not bypass the vault to answer.
                  </p>
                </div>
              ) : loading && !inputs ? (
                <div className={styles.stateCard}>
                  <span className={styles.loadingOrb} aria-hidden="true" />
                  <h3>Preparing your financial context</h3>
                  <p>FICONTER is reconciling your current financial data.</p>
                </div>
              ) : error ? (
                <div className={`${styles.stateCard} ${styles.errorState}`}>
                  <h3>Financial context could not be prepared</h3>
                  <p>{error}</p>
                  <button type="button" onClick={() => void loadInputs()}>
                    Try again
                  </button>
                </div>
              ) : (
                <>
                  {!exchanges.length ? (
                    <div className={styles.introCard}>
                      <div className={styles.introIcon} aria-hidden="true">
                        <Sparkles size={22} />
                      </div>
                      <div>
                        <h3>Ask a real decision, not just a budget question.</h3>
                        <p>
                          Purchases, financing, debt, savings, monthly commitments and
                          priorities are assessed against your current FICONTER data.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {exchanges.map((exchange) => (
                    <article className={styles.exchange} key={exchange.id}>
                      <div className={styles.questionBubble}>
                        <span>You</span>
                        <p>{exchange.question}</p>
                      </div>

                      <div
                        className={`${styles.answerCard} ${styles[`tone_${exchange.answer.tone}`] ?? ""}`}
                      >
                        <div className={styles.answerTopline}>
                          <span>FICONTER</span>
                          <small>{exchange.answer.confidence}</small>
                        </div>
                        <h3>{exchange.answer.title}</h3>
                        <strong className={styles.verdict}>{exchange.answer.verdict}</strong>
                        <p className={styles.summary}>{exchange.answer.summary}</p>
                        <p className={styles.detail}>{exchange.answer.detail}</p>

                        {exchange.answer.evidence.length ? (
                          <details className={styles.evidencePanel}>
                            <summary>Why FICONTER answered this way</summary>
                            <div className={styles.evidenceGrid}>
                              {exchange.answer.evidence.map((item) => (
                                <div className={styles.evidenceItem} key={item.key}>
                                  <span>{item.label}</span>
                                  <strong>{evidenceValue(item, currency)}</strong>
                                  {item.note ? <small>{item.note}</small> : null}
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : null}

                        {exchange.answer.scenarios.length ? (
                          <div className={styles.scenarioGrid}>
                            {exchange.answer.scenarios.map((scenario) => (
                              <section className={styles.scenarioCard} key={`${exchange.id}-${scenario.label}`}>
                                <span>{scenario.label}</span>
                                <strong>{scenario.headline}</strong>
                                <p>{scenario.detail}</p>
                              </section>
                            ))}
                          </div>
                        ) : null}

                        <p className={styles.disclaimer}>{exchange.answer.disclaimer}</p>
                      </div>
                    </article>
                  ))}

                  <div className={styles.suggestions} aria-label="Suggested questions">
                    {suggestionQuestions.map((suggestion) => (
                      <button
                        type="button"
                        key={suggestion}
                        onClick={() => runQuestion(suggestion)}
                        disabled={!reconciledInputs}
                      >
                        <span>{suggestion}</span>
                        <ChevronRight size={15} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <form className={styles.composer} onSubmit={handleSubmit}>
              <textarea
                ref={inputRef}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask FICONTER about a purchase, payment, savings target…"
                rows={1}
                maxLength={420}
                disabled={!reconciledInputs || vaultStatus !== "unlocked"}
                aria-label="Question for FICONTER"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (question.trim()) runQuestion(question);
                  }
                }}
              />
              <button
                type="submit"
                disabled={!question.trim() || !reconciledInputs}
                aria-label="Ask FICONTER"
              >
                <Send size={18} aria-hidden="true" />
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
