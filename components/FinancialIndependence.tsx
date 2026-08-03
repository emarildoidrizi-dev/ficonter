"use client";

import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Info,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  isFinancialDataScope,
  notifyFiconterDataChange,
  subscribeFiconterDataChanges,
} from "@/lib/ficonterRealtime";
import { finiteNumber, roundMoney } from "@/lib/finance/money";
import { formatCurrency } from "@/lib/financialOptions";
import styles from "./FinancialIndependence.module.css";

type PlanningStyle = "safer" | "balanced" | "flexible";
type GrowthStyle = "conservative" | "moderate" | "optimistic";

type FinancialIndependencePayload = {
  settings?: {
    targetMonthlySpending?: number | string | null;
    withdrawalRate?: number | string | null;
    annualRealReturnRate?: number | string | null;
    updatedAt?: string | null;
  };
  netWorthGrowth?: Record<string, unknown>;
  savingsIntelligence?: Record<string, unknown>;
  emergencyFund?: Record<string, unknown>;
};

type PlanningOption = {
  id: PlanningStyle;
  label: string;
  description: string;
  rate: number;
};

type GrowthOption = {
  id: GrowthStyle;
  label: string;
  description: string;
  rate: number;
};

const PLANS: PlanningOption[] = [
  {
    id: "safer",
    label: "Safer plan",
    description: "A larger target with a wider long-term safety margin.",
    rate: 3.5,
  },
  {
    id: "balanced",
    label: "Balanced plan",
    description: "A practical long-term planning estimate for most users.",
    rate: 4,
  },
  {
    id: "flexible",
    label: "Flexible plan",
    description: "A lower target, but future spending may need to adjust.",
    rate: 4.5,
  },
];

const GROWTH_OPTIONS: GrowthOption[] = [
  {
    id: "conservative",
    label: "Conservative growth",
    description: "Uses slower growth for a more cautious timeline.",
    rate: 2,
  },
  {
    id: "moderate",
    label: "Moderate growth",
    description: "The recommended directional timeline assumption.",
    rate: 4,
  },
  {
    id: "optimistic",
    label: "Optimistic growth",
    description: "Shows a faster scenario, not a guaranteed outcome.",
    rate: 6,
  },
];

const money = (value: number) => formatCurrency(roundMoney(value), "EUR");

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readPath(source: unknown, path: string[]): unknown {
  let current: unknown = source;
  for (const key of path) {
    const record = asRecord(current);
    current = record[key];
  }
  return current;
}

function numericPath(source: unknown, ...paths: string[][]): number {
  for (const path of paths) {
    const value = readPath(source, path);
    if (value === null || value === undefined || value === "") continue;
    const number = finiteNumber(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function arrayPath(source: unknown, ...paths: string[][]): unknown[] {
  for (const path of paths) {
    const value = readPath(source, path);
    if (Array.isArray(value)) return value;
  }
  return [];
}

function planFromRate(rate: number): PlanningStyle {
  return PLANS.reduce((closest, option) =>
    Math.abs(option.rate - rate) < Math.abs(closest.rate - rate)
      ? option
      : closest,
  ).id;
}

function growthFromRate(rate: number): GrowthStyle {
  return GROWTH_OPTIONS.reduce((closest, option) =>
    Math.abs(option.rate - rate) < Math.abs(closest.rate - rate)
      ? option
      : closest,
  ).id;
}

function latestMonthlyRow(payload: FinancialIndependencePayload) {
  const rows = arrayPath(
    payload,
    ["netWorthGrowth", "growth", "monthly"],
    ["netWorthGrowth", "growth", "series"],
    ["netWorthGrowth", "growth"],
    ["netWorthGrowth", "monthly"],
  );
  return asRecord(rows.at(-1));
}

function deriveLifestyleNeed(payload: FinancialIndependencePayload): number {
  const settings = payload.settings ?? {};
  const storedInvestmentNeed = finiteNumber(settings.targetMonthlySpending);
  if (storedInvestmentNeed > 0) return roundMoney(storedInvestmentNeed);

  const candidates = [
    numericPath(payload, ["emergencyFund", "monthlyProtectionBaseline"]),
    numericPath(payload, ["emergencyFund", "protectionBaseline"]),
    numericPath(payload, ["emergencyFund", "oneMonthCommitments"]),
    numericPath(
      payload,
      ["savingsIntelligence", "cashFlow", "financialHealth", "planner", "plannedOutflow"],
      ["emergencyFund", "financialHealth", "planner", "plannedOutflow"],
    ),
    numericPath(
      payload,
      ["savingsIntelligence", "cashFlow", "financialHealth", "transactions", "currentMonthOutflow"],
      ["emergencyFund", "financialHealth", "transactions", "currentMonthOutflow"],
    ),
  ];

  return roundMoney(candidates.find((value) => value > 0) ?? 0);
}

function deriveCurrentCapital(payload: FinancialIndependencePayload): number {
  const latest = latestMonthlyRow(payload);
  const latestCapital = numericPath(
    latest,
    ["cumulativeCapital"],
    ["investedCapital"],
    ["totalCapital"],
    ["capital"],
  );
  if (latestCapital !== 0) return Math.max(0, roundMoney(latestCapital));

  const savingCapital = numericPath(payload, ["savingsIntelligence", "stats", "totalAmount"]);
  const emergencyCapital = numericPath(
    payload,
    ["emergencyFund", "financialHealth", "transactions", "emergencyFundSavings"],
  );
  return Math.max(0, roundMoney(savingCapital + emergencyCapital));
}

function deriveCurrentNetWorth(payload: FinancialIndependencePayload): number {
  const latest = latestMonthlyRow(payload);
  const latestNetWorth = numericPath(
    latest,
    ["netWorth"],
    ["currentNetWorth"],
    ["value"],
  );
  if (latestNetWorth !== 0) return roundMoney(latestNetWorth);

  const capital = deriveCurrentCapital(payload);
  const debt = numericPath(
    payload,
    ["netWorthGrowth", "financialHealth", "debts", "currentBalance"],
    ["emergencyFund", "financialHealth", "debts", "currentBalance"],
  );
  return roundMoney(capital - debt);
}

function deriveMonthlyContribution(payload: FinancialIndependencePayload): number {
  const rows = arrayPath(payload, ["savingsIntelligence", "monthlySavings"])
    .map(asRecord)
    .slice(-6);

  if (!rows.length) return 0;
  const total = rows.reduce((sum, row) => sum + finiteNumber(row.savings), 0);
  return roundMoney(total / rows.length);
}

function deriveSavingConsistency(payload: FinancialIndependencePayload): {
  contributingMonths: number;
  observedMonths: number;
} {
  const rows = arrayPath(payload, ["savingsIntelligence", "monthlySavings"])
    .map(asRecord)
    .slice(-6);

  return {
    contributingMonths: rows.filter((row) => finiteNumber(row.savings) > 0).length,
    observedMonths: rows.length,
  };
}

function deriveCashFlowMargin(payload: FinancialIndependencePayload): number {
  const rows = arrayPath(payload, ["savingsIntelligence", "cashFlow", "monthly"])
    .map(asRecord)
    .filter((row) => finiteNumber(row.income) > 0)
    .slice(-3);

  if (rows.length) {
    const income = rows.reduce((sum, row) => sum + finiteNumber(row.income), 0);
    const outflow = rows.reduce((sum, row) => sum + finiteNumber(row.outflow), 0);
    return income > 0 ? ((income - outflow) / income) * 100 : 0;
  }

  const income = numericPath(
    payload,
    ["emergencyFund", "financialHealth", "transactions", "totalIncome"],
  );
  const expenses = numericPath(
    payload,
    ["emergencyFund", "financialHealth", "transactions", "totalExpenses"],
  );
  const savings = numericPath(
    payload,
    ["emergencyFund", "financialHealth", "transactions", "totalSavings"],
  );
  return income > 0 ? ((income - expenses - savings) / income) * 100 : 0;
}

function estimateYearsToTarget({
  currentCapital,
  monthlyContribution,
  targetCapital,
  annualRealGrowth,
}: {
  currentCapital: number;
  monthlyContribution: number;
  targetCapital: number;
  annualRealGrowth: number;
}): number | null {
  if (targetCapital <= currentCapital) return 0;
  if (monthlyContribution <= 0 && annualRealGrowth <= 0) return null;

  const monthlyGrowth = annualRealGrowth / 100 / 12;
  let capital = Math.max(0, currentCapital);
  const maximumMonths = 100 * 12;

  for (let month = 1; month <= maximumMonths; month += 1) {
    capital = capital * (1 + monthlyGrowth) + Math.max(0, monthlyContribution);
    if (capital >= targetCapital) return month / 12;
  }

  return null;
}

function readableError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim();
    if (message) return message;
  }
  return fallback;
}

export function FinancialIndependence({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [payload, setPayload] = useState<FinancialIndependencePayload | null>(null);
  const [lifestyleNeed, setLifestyleNeed] = useState("");
  const [planningStyle, setPlanningStyle] = useState<PlanningStyle>("balanced");
  const [growthStyle, setGrowthStyle] = useState<GrowthStyle>("moderate");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const refreshTimerRef = useRef<number | null>(null);
  const loadedOnceRef = useRef(false);

  const hydrate = useCallback((data: FinancialIndependencePayload) => {
    setPayload(data);

    if (!loadedOnceRef.current) {
      const lifestyle = deriveLifestyleNeed(data);
      const withdrawal = finiteNumber(data.settings?.withdrawalRate) || 4;
      const growth = finiteNumber(data.settings?.annualRealReturnRate) || 4;

      setLifestyleNeed(lifestyle > 0 ? String(lifestyle) : "");
      setPlanningStyle(planFromRate(withdrawal));
      setGrowthStyle(growthFromRate(growth));
      loadedOnceRef.current = true;
    }
  }, []);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_financial_independence_inputs");
    if (error) throw error;
    hydrate((data ?? {}) as FinancialIndependencePayload);
  }, [hydrate, supabase]);

  useEffect(() => {
    let active = true;
    void refresh().catch((error: unknown) => {
      if (active) setNotice(readableError(error, "Financial Independence could not be loaded."));
    });

    return () => {
      active = false;
    };
  }, [refresh]);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        void refresh().catch(() => undefined);
      }, 120);
    };

    const unsubscribe = subscribeFiconterDataChanges((change) => {
      if (isFinancialDataScope(change.scope)) scheduleRefresh();
    });
    const handleFocus = () => scheduleRefresh();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      unsubscribe();
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    };
  }, [refresh]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const selectedPlan = PLANS.find((option) => option.id === planningStyle) ?? PLANS[1];
  const selectedGrowth =
    GROWTH_OPTIONS.find((option) => option.id === growthStyle) ?? GROWTH_OPTIONS[1];

  const lifestyleMonthly = Math.max(0, finiteNumber(lifestyleNeed));
  const investmentMonthlyNeed = roundMoney(lifestyleMonthly);
  const annualInvestmentNeed = investmentMonthlyNeed * 12;
  const selectedTarget =
    selectedPlan.rate > 0 ? annualInvestmentNeed / (selectedPlan.rate / 100) : 0;

  const currentCapital = payload ? deriveCurrentCapital(payload) : 0;
  const currentNetWorth = payload ? deriveCurrentNetWorth(payload) : 0;
  const monthlyContribution = payload ? deriveMonthlyContribution(payload) : 0;
  const consistency = payload
    ? deriveSavingConsistency(payload)
    : { contributingMonths: 0, observedMonths: 0 };
  const cashFlowMargin = payload ? deriveCashFlowMargin(payload) : 0;
  const reserveAmount = payload
    ? numericPath(
        payload,
        ["emergencyFund", "financialHealth", "transactions", "emergencyFundSavings"],
      )
    : 0;
  const overdueBills = payload
    ? numericPath(payload, ["emergencyFund", "financialHealth", "bills", "overdueCount"])
    : 0;

  const progress = selectedTarget > 0
    ? Math.max(0, Math.min(100, (currentCapital / selectedTarget) * 100))
    : investmentMonthlyNeed === 0 && lifestyleMonthly > 0
      ? 100
      : 0;

  const yearsToTarget = estimateYearsToTarget({
    currentCapital,
    monthlyContribution,
    targetCapital: selectedTarget,
    annualRealGrowth: selectedGrowth.rate,
  });

  const scenarioTargets = PLANS.map((plan) => ({
    ...plan,
    target: plan.rate > 0 ? annualInvestmentNeed / (plan.rate / 100) : 0,
  }));

  const milestoneValues = Array.from(
    new Set(
      [10_000, 50_000, selectedTarget * 0.25, selectedTarget * 0.5, selectedTarget]
        .map((value) => roundMoney(value))
        .filter((value) => value > 0 && value <= selectedTarget),
    ),
  ).sort((a, b) => a - b);

  const foundationChecks = [
    {
      label: "Positive net wealth",
      achieved: currentNetWorth > 0,
      detail:
        currentNetWorth > 0
          ? `Recorded capital exceeds liabilities by ${money(currentNetWorth)}.`
          : `Recorded liabilities currently exceed capital by ${money(Math.abs(currentNetWorth))}.`,
    },
    {
      label: "Three-month reserve",
      achieved: lifestyleMonthly > 0 && reserveAmount >= lifestyleMonthly * 3,
      detail:
        lifestyleMonthly > 0
          ? `${(reserveAmount / lifestyleMonthly).toFixed(1)} months of the selected lifestyle need are protected.`
          : "Enter a monthly lifestyle need to calculate reserve coverage.",
    },
    {
      label: "Positive cash-flow margin",
      achieved: cashFlowMargin > 0,
      detail: `${cashFlowMargin.toFixed(1)}% average recorded cash-flow margin.`,
    },
    {
      label: "Consistent wealth contribution",
      achieved: consistency.contributingMonths >= 3,
      detail:
        consistency.observedMonths > 0
          ? `${consistency.contributingMonths} of the last ${consistency.observedMonths} recorded months included a contribution; current six-month pace is ${money(monthlyContribution)} per month.`
          : "No contribution history is available yet.",
    },
    {
      label: "No overdue bills",
      achieved: overdueBills === 0,
      detail:
        overdueBills === 0
          ? "No recorded bills are overdue."
          : `${overdueBills} recorded ${overdueBills === 1 ? "bill is" : "bills are"} overdue.`,
    },
  ];

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    if (lifestyleMonthly <= 0) {
      setNotice("Enter a realistic monthly lifestyle amount greater than zero.");
      return;
    }

    setBusy(true);
    setNotice("");

    try {
      const payloadToSave = {
        user_id: userId,
        target_monthly_spending: investmentMonthlyNeed,
        withdrawal_rate: selectedPlan.rate,
        annual_real_return_rate: selectedGrowth.rate,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("financial_independence_settings")
        .upsert(payloadToSave, { onConflict: "user_id" });
      if (error) throw error;

      notifyFiconterDataChange("all");
      await refresh();
      setNotice("Financial Independence plan updated.");
    } catch (error) {
      setNotice(readableError(error, "The Financial Independence plan could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.shell}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>LONG-TERM PLANNING</span>
          <h1>Financial Independence</h1>
          <p>
            Estimate how much invested capital could support the part of your future lifestyle
            that must be funded by investments.
          </p>
        </div>
        <div className={styles.heroBadge}>
          <ShieldCheck size={20} />
          <span>Planning estimate only</span>
        </div>
      </header>

      {notice ? <div className={styles.notice}>{notice}</div> : null}

      <form className={styles.setupCard} onSubmit={savePlan}>
        <div className={styles.cardHeading}>
          <div>
            <span>YOUR FUTURE MONTHLY NEED</span>
            <h2>Start with real-life amounts</h2>
          </div>
          <WalletCards size={24} />
        </div>

        <div className={styles.inputGrid}>
          <label>
            <span>Monthly income needed from investments</span>
            <small>
              Enter only the amount your investments would need to cover after any pension or
              other dependable future income.
            </small>
            <div className={styles.moneyInput}>
              <b>€</b>
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={lifestyleNeed}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setLifestyleNeed(event.target.value)
                }
                placeholder="1,500.00"
              />
            </div>
          </label>
        </div>

        <div className={styles.needSummary}>
          <span>Your investments would need to provide</span>
          <strong>{money(investmentMonthlyNeed)} per month</strong>
          <small>This amount is used for the long-term target estimate.</small>
        </div>

        <div className={styles.optionSection}>
          <div className={styles.sectionHeading}>
            <div>
              <span>PLANNING STYLE</span>
              <h3>Choose a simple approach</h3>
            </div>
            <p>The Balanced plan is recommended as the default planning view.</p>
          </div>

          <div className={styles.planGrid} role="radiogroup" aria-label="Planning style">
            {PLANS.map((plan) => {
              const selected = planningStyle === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`${styles.planButton} ${selected ? styles.selectedPlan : ""}`}
                  onClick={() => setPlanningStyle(plan.id)}
                >
                  <span>
                    {plan.label}
                    {plan.id === "balanced" ? <em>Recommended</em> : null}
                  </span>
                  <small>{plan.description}</small>
                  <strong>{money(annualInvestmentNeed / (plan.rate / 100))}</strong>
                </button>
              );
            })}
          </div>
        </div>

        <details className={styles.advanced}>
          <summary>
            <span>
              <TrendingUp size={18} /> Timeline assumption
            </span>
            <ChevronDown size={18} />
          </summary>
          <div className={styles.growthGrid} role="radiogroup" aria-label="Growth assumption">
            {GROWTH_OPTIONS.map((option) => {
              const selected = growthStyle === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={selected ? styles.selectedGrowth : ""}
                  onClick={() => setGrowthStyle(option.id)}
                >
                  <span>{option.label}</span>
                  <small>{option.description}</small>
                </button>
              );
            })}
          </div>
          <p>
            This assumption changes only the directional timeline. It does not change the
            selected investment target.
          </p>
        </details>

        <button className={styles.saveButton} disabled={busy}>
          <Sparkles size={18} />
          {busy ? "Saving plan…" : "Save planning assumptions"}
        </button>
      </form>

      <div className={styles.resultGrid}>
        <article className={styles.primaryResult}>
          <div className={styles.resultHeader}>
            <div>
              <span>ESTIMATED LONG-TERM INVESTMENT TARGET</span>
              <h2>{money(selectedTarget)}</h2>
            </div>
            <Target size={30} />
          </div>
          <p>
            Based on {money(investmentMonthlyNeed)} per month from investments using the
            {` ${selectedPlan.label.toLowerCase()}`}.
          </p>
          <div className={styles.formulaLine}>
            <span>Annual income needed</span>
            <strong>{money(annualInvestmentNeed)}</strong>
            <i>→</i>
            <span>Selected approach</span>
            <strong>{selectedPlan.label}</strong>
          </div>
          <div className={styles.disclaimer}>
            <Info size={17} />
            <span>This is not a bill, debt or amount you must save immediately.</span>
          </div>
        </article>

        <article className={styles.progressCard}>
          <span>RECORDED PROGRESS</span>
          <strong>{money(currentCapital)}</strong>
          <p>of {money(selectedTarget)}</p>
          <div className={styles.progressTrack}>
            <i style={{ width: `${progress}%` }} />
          </div>
          <b>{progress.toFixed(1)}% of the estimated target</b>
        </article>

        <article className={styles.timelineCard}>
          <span>DIRECTIONAL TIMELINE</span>
          <strong>
            {yearsToTarget === null
              ? "No practical timeline yet"
              : yearsToTarget === 0
                ? "Target reached"
                : `About ${yearsToTarget.toFixed(yearsToTarget < 10 ? 1 : 0)} years`}
          </strong>
          <p>
            Uses {money(monthlyContribution)} average monthly wealth-building and the
            {` ${selectedGrowth.label.toLowerCase()}`} assumption.
          </p>
          <small>Market returns, taxes, fees and contribution changes can alter this result.</small>
        </article>
      </div>

      <section className={styles.comparisonSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span>COMPARISON RANGE</span>
            <h2>One need, three planning views</h2>
          </div>
          <p>The target changes because each style assumes a different annual draw from capital.</p>
        </div>
        <div className={styles.comparisonGrid}>
          {scenarioTargets.map((scenario) => (
            <article
              key={scenario.id}
              className={scenario.id === planningStyle ? styles.activeComparison : ""}
            >
              <span>{scenario.label}</span>
              <strong>{money(scenario.target)}</strong>
              <p>{scenario.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.milestoneSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span>CAPITAL MILESTONES</span>
            <h2>Understandable progress checkpoints</h2>
          </div>
          <p>These are checkpoints toward the target, not separate amounts you must pay.</p>
        </div>
        <div className={styles.milestoneGrid}>
          {milestoneValues.length ? (
            milestoneValues.map((milestone, index) => {
              const achieved = currentCapital >= milestone;
              const isTarget = milestone === roundMoney(selectedTarget);
              const labels = ["First milestone", "Foundation", "Quarter target", "Halfway"];
              return (
                <article key={milestone} className={achieved ? styles.achievedMilestone : ""}>
                  {achieved ? <CheckCircle2 size={20} /> : <Target size={20} />}
                  <span>{isTarget ? "Estimated target" : labels[index] ?? "Progress milestone"}</span>
                  <strong>{money(milestone)}</strong>
                </article>
              );
            })
          ) : (
            <p className={styles.emptyState}>Enter a monthly lifestyle amount to create milestones.</p>
          )}
        </div>
      </section>

      <section className={styles.foundationSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span>WHAT SHOULD BE STABLE FIRST</span>
            <h2>Your financial foundation</h2>
          </div>
          <p>Financial independence becomes more practical after short-term stability improves.</p>
        </div>
        <div className={styles.foundationGrid}>
          {foundationChecks.map((check) => (
            <article key={check.label} className={check.achieved ? styles.foundationPassed : ""}>
              {check.achieved ? <CheckCircle2 size={21} /> : <CircleAlert size={21} />}
              <div>
                <span>{check.label}</span>
                <strong>{check.achieved ? "Achieved" : "Not achieved"}</strong>
                <p>{check.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <details className={styles.explanation}>
        <summary>
          <span>
            <Info size={19} /> How FICONTER calculates this estimate
          </span>
          <ChevronDown size={19} />
        </summary>
        <div>
          <p>
            FICONTER multiplies the monthly income needed from investments by 12 and divides
            the annual amount by the selected planning rate.
          </p>
          <dl>
            <div>
              <dt>Safer plan</dt>
              <dd>Uses a 3.5% annual planning rate.</dd>
            </div>
            <div>
              <dt>Balanced plan</dt>
              <dd>Uses a 4% annual planning rate.</dd>
            </div>
            <div>
              <dt>Flexible plan</dt>
              <dd>Uses a 4.5% annual planning rate.</dd>
            </div>
          </dl>
          <p>
            These are planning assumptions, not guarantees. Actual sustainability depends on
            investment performance, inflation, taxes, fees, retirement duration and spending
            flexibility.
          </p>
        </div>
      </details>
    </section>
  );
}
