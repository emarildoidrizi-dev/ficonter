"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  ChartNoAxesCombined,
  CircleDollarSign,
  Gauge,
  Landmark,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { formatCurrency } from "@/lib/financialOptions";
import {
  NET_WORTH_GROWTH_PERIODS,
  calculateNetWorthGrowth,
  type NetWorthGrowthInputs,
  type NetWorthGrowthMonth,
  type NetWorthGrowthPeriod,
} from "@/lib/wealth/netWorthGrowth";
import styles from "./NetWorthGrowth.module.css";

type Props = {
  inputs: NetWorthGrowthInputs;
};

function monthLabel(month: string): string {
  const parsed = new Date(`${month}-01T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return month;
  return parsed.toLocaleDateString(undefined, { month: "short" });
}

function yearLabel(month: string): string {
  return month.slice(0, 4);
}

function fullMonthLabel(month: string): string {
  const parsed = new Date(`${month}-01T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return month;
  return parsed.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function signedCurrency(value: number): string {
  if (Math.abs(value) < 0.005) return formatCurrency(0, "EUR");
  return `${value > 0 ? "+" : ""}${formatCurrency(value, "EUR")}`;
}

function percentage(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function periodButtonLabel(period: NetWorthGrowthPeriod): string {
  return period === "all" ? "All" : `${period}M`;
}

function chartPath(
  months: readonly NetWorthGrowthMonth[],
  value: (month: NetWorthGrowthMonth) => number,
  width: number,
  height: number,
  minimum: number,
  maximum: number,
): string {
  if (!months.length) return "";
  const horizontalPadding = 38;
  const verticalPadding = 26;
  const availableWidth = width - horizontalPadding * 2;
  const availableHeight = height - verticalPadding * 2;
  const range = Math.max(1, maximum - minimum);

  return months
    .map((month, index) => {
      const x =
        months.length === 1
          ? width / 2
          : horizontalPadding + (index / (months.length - 1)) * availableWidth;
      const y =
        verticalPadding +
        ((maximum - value(month)) / range) * availableHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function toneIcon(tone: string) {
  if (tone === "positive") return TrendingUp;
  if (tone === "critical") return TrendingDown;
  if (tone === "warning") return ShieldCheck;
  return Sparkles;
}

export function NetWorthGrowth({ inputs }: Props) {
  const [period, setPeriod] = useState<NetWorthGrowthPeriod>(12);
  const result = useMemo(
    () => calculateNetWorthGrowth(inputs, period),
    [inputs, period],
  );

  const chartWidth = Math.max(760, result.selectedMonthly.length * 86);
  const chartHeight = 300;
  const allChartValues = result.selectedMonthly.flatMap((month) => [
    month.netWorth,
    month.cumulativeCapital,
    month.debtOutstanding,
  ]);
  const chartMinimum = Math.min(0, ...allChartValues);
  const chartMaximum = Math.max(1, ...allChartValues);
  const netWorthPath = chartPath(
    result.selectedMonthly,
    (month) => month.netWorth,
    chartWidth,
    chartHeight,
    chartMinimum,
    chartMaximum,
  );
  const capitalPath = chartPath(
    result.selectedMonthly,
    (month) => month.cumulativeCapital,
    chartWidth,
    chartHeight,
    chartMinimum,
    chartMaximum,
  );
  const debtPath = chartPath(
    result.selectedMonthly,
    (month) => month.debtOutstanding,
    chartWidth,
    chartHeight,
    chartMinimum,
    chartMaximum,
  );
  const statusSlug = result.label.toLowerCase();

  return (
    <section className={styles.module}>
      <article className={styles.hero} data-status={statusSlug}>
        <div className={styles.heroTop}>
          <div>
            <span className={styles.eyebrow}>Net worth growth</span>
            <h2>{result.label}</h2>
            <p>{result.summary}</p>
          </div>
          <div className={styles.confidence}>
            <small>Trend confidence</small>
            <strong>{result.confidence}</strong>
            <span>{result.dataCoverage}% coverage</span>
          </div>
        </div>

        <div className={styles.periodRow}>
          <div>
            <small>Analysis period</small>
            <strong>{result.periodLabel}</strong>
          </div>
          <div className={styles.periodSelector} aria-label="Net worth growth period">
            {NET_WORTH_GROWTH_PERIODS.map((option) => (
              <button
                type="button"
                key={option}
                className={period === option ? styles.periodActive : undefined}
                aria-pressed={period === option}
                onClick={() => setPeriod(option)}
              >
                {periodButtonLabel(option)}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.heroMetrics}>
          <span>
            <small>Net worth change</small>
            <strong
              className={
                result.metrics.selectedPeriodChange >= 0
                  ? styles.positive
                  : styles.negative
              }
            >
              {signedCurrency(result.metrics.selectedPeriodChange)}
            </strong>
          </span>
          <span>
            <small>Growth rate</small>
            <strong>{percentage(result.metrics.selectedPeriodGrowthRate)}</strong>
          </span>
          <span>
            <small>Average monthly growth</small>
            <strong>{signedCurrency(result.metrics.averageMonthlyGrowth)}</strong>
          </span>
          <span>
            <small>Positive growth months</small>
            <strong>
              {result.metrics.positiveGrowthMonths} / {result.metrics.selectedMonths}
            </strong>
          </span>
        </div>
      </article>

      <div className={styles.metricGrid}>
        <article>
          <WalletCards aria-hidden="true" />
          <span>Opening net worth</span>
          <strong>{formatCurrency(result.metrics.openingNetWorth, "EUR")}</strong>
          <small>Position before the selected period</small>
        </article>
        <article>
          <Landmark aria-hidden="true" />
          <span>Current net worth</span>
          <strong
            className={
              result.metrics.currentNetWorth >= 0
                ? styles.positive
                : styles.negative
            }
          >
            {formatCurrency(result.metrics.currentNetWorth, "EUR")}
          </strong>
          <small>Same live value used by Net Worth and Wealth Score</small>
        </article>
        <article>
          <TrendingUp aria-hidden="true" />
          <span>Capital added</span>
          <strong>{signedCurrency(result.metrics.capitalAdded)}</strong>
          <small>Income minus recorded expenses</small>
        </article>
        <article>
          <TrendingDown aria-hidden="true" />
          <span>Net debt reduction</span>
          <strong
            className={
              result.metrics.netDebtReduction >= 0
                ? styles.positive
                : styles.negative
            }
          >
            {signedCurrency(result.metrics.netDebtReduction)}
          </strong>
          <small>Opening debt minus current debt</small>
        </article>
      </div>

      <article className={styles.chartPanel}>
        <header className={styles.panelHeader}>
          <div>
            <span>Recorded trajectory</span>
            <h3>Capital, liabilities and net worth</h3>
            <p>
              Savings remain part of recorded capital and are never added twice.
              Scroll horizontally when the selected history is wider than the panel.
            </p>
          </div>
          <div className={styles.legend} aria-label="Growth chart legend">
            <span><i className={styles.netWorthDot} />Net worth</span>
            <span><i className={styles.capitalDot} />Capital</span>
            <span><i className={styles.debtDot} />Liabilities</span>
          </div>
        </header>

        {result.selectedMonthly.length ? (
          <div className={styles.chartScroller}>
            <div className={styles.chartCanvas} style={{ width: chartWidth }}>
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                role="img"
                aria-label={`${result.periodLabel} net worth, capital and liability trend`}
              >
                <line
                  className={styles.zeroLine}
                  x1="38"
                  x2={chartWidth - 38}
                  y1={
                    26 +
                    ((chartMaximum - 0) /
                      Math.max(1, chartMaximum - chartMinimum)) *
                      (chartHeight - 52)
                  }
                  y2={
                    26 +
                    ((chartMaximum - 0) /
                      Math.max(1, chartMaximum - chartMinimum)) *
                      (chartHeight - 52)
                  }
                />
                <polyline className={styles.capitalLine} points={capitalPath} />
                <polyline className={styles.debtLine} points={debtPath} />
                <polyline className={styles.netWorthLine} points={netWorthPath} />
              </svg>
              <div
                className={styles.chartLabels}
                style={{
                  gridTemplateColumns: `repeat(${Math.max(1, result.selectedMonthly.length)}, minmax(54px, 1fr))`,
                }}
              >
                {result.selectedMonthly.map((month) => (
                  <span key={month.month}>
                    <strong>{monthLabel(month.month)}</strong>
                    <small>{yearLabel(month.month)}</small>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className={styles.empty}>No recorded history is available yet.</p>
        )}
      </article>

      <div className={styles.twoColumn}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span>Growth drivers</span>
              <h3>What changed the position</h3>
            </div>
          </header>
          <div className={styles.driverList}>
            <div>
              <span className={styles.driverIcon}><CircleDollarSign /></span>
              <div>
                <strong>Retained capital</strong>
                <small>Income minus expenses</small>
              </div>
              <b>{signedCurrency(result.metrics.capitalAdded)}</b>
            </div>
            <div>
              <span className={styles.driverIcon}><ShieldCheck /></span>
              <div>
                <strong>Recorded debt payments</strong>
                <small>Principal payments recorded in Debt</small>
              </div>
              <b>{formatCurrency(result.metrics.recordedDebtPayments, "EUR")}</b>
            </div>
            <div>
              <span className={styles.driverIcon}><PiggyBank /></span>
              <div>
                <strong>Savings allocation</strong>
                <small>Part of retained capital, shown separately</small>
              </div>
              <b>{formatCurrency(result.metrics.savingsAllocated, "EUR")}</b>
            </div>
            <div>
              <span className={styles.driverIcon}><Gauge /></span>
              <div>
                <strong>Liability movement</strong>
                <small>Net reduction after new or increased debt</small>
              </div>
              <b>{signedCurrency(result.metrics.netDebtReduction)}</b>
            </div>
          </div>
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span>Growth range</span>
              <h3>Best and weakest months</h3>
            </div>
          </header>
          <div className={styles.extremeGrid}>
            <div className={styles.bestMonth}>
              <ArrowUpRight aria-hidden="true" />
              <small>Best month</small>
              <strong>
                {result.bestMonth ? fullMonthLabel(result.bestMonth.month) : "—"}
              </strong>
              <b>
                {result.bestMonth
                  ? signedCurrency(result.bestMonth.netWorthChange)
                  : formatCurrency(0, "EUR")}
              </b>
            </div>
            <div className={styles.weakMonth}>
              <ArrowDownRight aria-hidden="true" />
              <small>Weakest month</small>
              <strong>
                {result.weakestMonth
                  ? fullMonthLabel(result.weakestMonth.month)
                  : "—"}
              </strong>
              <b>
                {result.weakestMonth
                  ? signedCurrency(result.weakestMonth.netWorthChange)
                  : formatCurrency(0, "EUR")}
              </b>
            </div>
          </div>
          <div className={styles.momentumSummary}>
            <span>
              <small>Recent 3-month average</small>
              <strong>{signedCurrency(result.metrics.recentThreeMonthAverage)}</strong>
            </span>
            <span>
              <small>Previous 3-month average</small>
              <strong>{signedCurrency(result.metrics.priorThreeMonthAverage)}</strong>
            </span>
            <span>
              <small>Momentum change</small>
              <strong
                className={
                  result.metrics.momentumChange >= 0
                    ? styles.positive
                    : styles.negative
                }
              >
                {signedCurrency(result.metrics.momentumChange)}
              </strong>
            </span>
          </div>
        </article>
      </div>

      <div className={styles.twoColumn}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span>Annual record</span>
              <h3>Growth by calendar year</h3>
            </div>
          </header>
          {result.annual.length ? (
            <div className={styles.yearList}>
              {result.annual.slice(-5).reverse().map((year) => (
                <div key={year.year}>
                  <strong>{year.year}</strong>
                  <span>
                    <small>Net worth change</small>
                    <b className={year.change >= 0 ? styles.positive : styles.negative}>
                      {signedCurrency(year.change)}
                    </b>
                  </span>
                  <span>
                    <small>Capital added</small>
                    <b>{signedCurrency(year.retainedCapital)}</b>
                  </span>
                  <span>
                    <small>Debt reduction</small>
                    <b>{signedCurrency(year.debtReduction)}</b>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>Annual growth will appear as history builds.</p>
          )}
        </article>

        <article className={styles.forecastPanel}>
          <div className={styles.forecastIcon}>
            <ChartNoAxesCombined aria-hidden="true" />
          </div>
          <span>Directional 12-month outlook</span>
          {result.metrics.forecastAvailable &&
          result.metrics.projectedTwelveMonthNetWorth !== null &&
          result.metrics.trailingSixMonthGrowth !== null ? (
            <>
              <h3>
                {formatCurrency(
                  result.metrics.projectedTwelveMonthNetWorth,
                  "EUR",
                )}
              </h3>
              <p>
                Based only on completed month-to-month net-worth changes from
                the latest six eligible months. This is a planning estimate,
                not a guarantee.
              </p>
              <div>
                <small>Trailing completed-month pace</small>
                <strong>
                  {signedCurrency(result.metrics.trailingSixMonthGrowth)}
                </strong>
              </div>
            </>
          ) : (
            <>
              <h3 className={styles.forecastUnavailable}>
                Outlook unavailable
              </h3>
              <p>
                More financial history is needed before FICONTER can calculate
                a responsible direction. The current net-worth balance is never
                treated as a recurring monthly loss.
              </p>
              <div>
                <small>Completed month-to-month changes</small>
                <strong>
                  {result.metrics.forecastHistoryMonths} / 3 required
                </strong>
              </div>
            </>
          )}
        </article>
      </div>

      <article className={styles.insightsPanel}>
        <header className={styles.panelHeader}>
          <div>
            <span>Growth intelligence</span>
            <h3>What the history is saying</h3>
          </div>
        </header>
        <div className={styles.insightGrid}>
          {result.insights.map((insight) => {
            const Icon = toneIcon(insight.tone);
            return (
              <div key={insight.id} data-tone={insight.tone}>
                <span><Icon aria-hidden="true" /></span>
                <section>
                  <strong>{insight.title}</strong>
                  <p>{insight.detail}</p>
                  <small>{insight.action}</small>
                </section>
              </div>
            );
          })}
        </div>
        <div className={styles.nextAction}>
          <CalendarRange aria-hidden="true" />
          <div>
            <span>Next best action</span>
            <strong>{result.nextBestAction}</strong>
          </div>
        </div>
      </article>
    </section>
  );
}
