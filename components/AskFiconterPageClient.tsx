"use client";

import {
  ChevronRight,
  LockKeyhole,
  MessageCircleQuestion,
  Send,
  ShieldCheck,
  Sparkles,
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
import { loadAiInsightsInputsFromVault } from "@/lib/e2ee/aiInsightsSource";
import { reconcileAiInsightsToBaseCurrency } from "@/lib/finance/baseCurrencyReconciliation";
import { createClient } from "@/lib/supabase/client";
import {
  askFiconter,
  type AskFiconterAnswer,
  type AskFiconterEvidence,
} from "@/lib/wealth/askFiconter";
import type { AiInsightsInputs } from "@/lib/wealth/aiInsights";

import styles from "./AskFiconterPageClient.module.css";

type Exchange = {
  id: string;
  question: string;
  answer: AskFiconterAnswer;
};

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

export function AskFiconterPageClient({
  userId,
  baseCurrency,
}: {
  userId: string;
  baseCurrency: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { status: vaultStatus, vaultKey } = useVault();
  const { source, context: currencyContext, loading: currencyLoading } =
    useBaseCurrencySourceData(userId);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [question, setQuestion] = useState("");
  const [inputs, setInputs] = useState<AiInsightsInputs | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);

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

  const loadInputs = useCallback(async () => {
    if (vaultStatus !== "unlocked" || !vaultKey || currencyLoading) return;

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
  }, [currencyLoading, source, supabase, userId, vaultKey, vaultStatus]);

  useEffect(() => {
    void loadInputs();
  }, [loadInputs]);

  useEffect(() => {
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
  }, [loadInputs]);

  useEffect(() => {
    if (!exchanges.length) return;
    window.requestAnimationFrame(() => {
      bodyRef.current?.scrollTo({
        top: bodyRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, [exchanges]);

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

  const latestExchange = exchanges.length
    ? exchanges[exchanges.length - 1]
    : null;
  const latestFollowUps = latestExchange?.answer.followUps ?? [];
  const suggestionQuestions = latestFollowUps.length
    ? latestFollowUps.slice(0, 4)
    : starterQuestions;

  return (
    <section className={styles.page} aria-labelledby="ask-ficonter-page-title">
      <header className={styles.header}>
        <div className={styles.brandMark} aria-hidden="true">
          <MessageCircleQuestion size={19} />
        </div>
        <div className={styles.headerCopy}>
          <span>Financial decision intelligence</span>
          <h1 id="ask-ficonter-page-title">Ask FICONTER</h1>
          <p>Ask about purchases, financing, debt, savings or monthly commitments.</p>
        </div>
      </header>

      <div className={styles.privacyBar}>
        <ShieldCheck size={14} aria-hidden="true" />
        <span>Uses your unlocked FICONTER financial data.</span>
        <span className={styles.privacyDot}>•</span>
        <span>Questions are not saved here.</span>
      </div>

      <div className={styles.body} ref={bodyRef}>
        {vaultStatus !== "unlocked" || !vaultKey ? (
          <div className={styles.stateCard}>
            <LockKeyhole size={25} aria-hidden="true" />
            <h2>Unlock your Financial Vault first</h2>
            <p>
              Ask FICONTER only works with the financial information available inside
              your unlocked vault.
            </p>
          </div>
        ) : loading && !inputs ? (
          <div className={styles.stateCard}>
            <span className={styles.loadingOrb} aria-hidden="true" />
            <h2>Preparing your financial context</h2>
            <p>FICONTER is reconciling your current financial data.</p>
          </div>
        ) : error ? (
          <div className={`${styles.stateCard} ${styles.errorState}`}>
            <h2>Financial context could not be prepared</h2>
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
                  <Sparkles size={18} />
                </div>
                <div>
                  <h2>Ask a real financial decision.</h2>
                  <p>
                    FICONTER checks the decision against the financial data currently
                    available in your vault and explains the reasoning behind the answer.
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
                  <h2>{exchange.answer.title}</h2>
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
                        <section
                          className={styles.scenarioCard}
                          key={`${exchange.id}-${scenario.label}`}
                        >
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
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <form className={styles.composer} onSubmit={handleSubmit}>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask FICONTER…"
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
          <Send size={17} aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
