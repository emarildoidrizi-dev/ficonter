"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BASE_CURRENCY_CHANGED_EVENT,
  readBrowserBaseCurrency,
} from "@/components/BaseCurrencyBootstrap";
import {
  getExchangeRate,
  type ExchangeRateResult,
} from "@/lib/performance/exchangeRateCache";
import {
  formatCurrency,
  setReportingCurrencyRuntime,
  type CurrencyCode,
} from "@/lib/financialOptions";
import {
  DEFAULT_BASE_CURRENCY,
  normalizeCurrency,
} from "@/lib/finance/currencyEngine";
import { finiteNumber, roundConvertedAmount } from "@/lib/finance/money";
import { useRouter } from "next/navigation";

type Workspace = "personal" | "business";

type CurrencyDisplayContextValue = {
  workspace: Workspace;
  reportingCurrency: CurrencyCode;
  baseCurrency: CurrencyCode;
  latestRate: number | null;
  rateDate: string | null;
  rateSource: string | null;
  loading: boolean;
  error: string;
  convertReportingAmount: (value: unknown) => number | null;
  formatReportingAmount: (value: unknown) => string;
};

const CurrencyDisplayContext = createContext<CurrencyDisplayContextValue | null>(null);

export function CurrencyDisplayProvider({
  workspace,
  baseCurrency: initialBaseCurrency,
  reportingCurrency: initialReportingCurrency,
  children,
}: {
  workspace: Workspace;
  baseCurrency?: string | null;
  reportingCurrency?: string | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const reportingCurrency = normalizeCurrency(
    initialReportingCurrency,
    workspace === "personal" ? DEFAULT_BASE_CURRENCY : normalizeCurrency(initialBaseCurrency),
  );
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>(() =>
    normalizeCurrency(initialBaseCurrency, reportingCurrency),
  );
  const [latestRate, setLatestRate] = useState<number | null>(() =>
    normalizeCurrency(initialBaseCurrency, reportingCurrency) === reportingCurrency ? 1 : null,
  );
  const [rateDate, setRateDate] = useState<string | null>(null);
  const [rateSource, setRateSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadRate = useCallback(
    async (nextBase: CurrencyCode, forceRefresh = false) => {
      if (nextBase === reportingCurrency) {
        setLatestRate(1);
        setRateDate(new Date().toISOString().slice(0, 10));
        setRateSource("identity");
        setLoading(false);
        setError("");
        return;
      }

      setLatestRate(null);
      setRateDate(null);
      setRateSource(null);
      setLoading(true);
      setError("");
      try {
        const result = await getExchangeRate(reportingCurrency, nextBase, {
          forceRefresh,
        });
        setLatestRate(result.rate);
        setRateDate(result.date);
        setRateSource(result.source);
      } catch (cause) {
        setLatestRate(null);
        setRateDate(null);
        setRateSource(null);
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load the selected base-currency rate.",
        );
      } finally {
        setLoading(false);
      }
    },
    [reportingCurrency],
  );

  useEffect(() => {
    const normalized = normalizeCurrency(initialBaseCurrency, reportingCurrency);
    setBaseCurrency(normalized);
    void loadRate(normalized);
  }, [initialBaseCurrency, loadRate, reportingCurrency]);

  useEffect(() => {
    function onCurrencyChanged(event: Event) {
      const detail = (event as CustomEvent<{ currency?: string; workspace?: Workspace }>).detail;
      if (detail?.workspace && detail.workspace !== workspace) return;
      const normalized = normalizeCurrency(
        detail?.currency ?? readBrowserBaseCurrency(workspace),
        reportingCurrency,
      );
      setBaseCurrency(normalized);
      if (normalized !== reportingCurrency) setLatestRate(null);
      void loadRate(normalized, true);
    }

    window.addEventListener(BASE_CURRENCY_CHANGED_EVENT, onCurrencyChanged);
    return () => window.removeEventListener(BASE_CURRENCY_CHANGED_EVENT, onCurrencyChanged);
  }, [loadRate, reportingCurrency, workspace]);

  const convertReportingAmount = useCallback(
    (value: unknown): number | null => {
      const amount = finiteNumber(value);
      if (baseCurrency === reportingCurrency) return amount;
      if (!latestRate || !Number.isFinite(latestRate) || latestRate <= 0) return null;
      return roundConvertedAmount(amount * latestRate);
    },
    [baseCurrency, latestRate, reportingCurrency],
  );

  const formatReportingAmount = useCallback(
    (value: unknown): string => {
      const converted = convertReportingAmount(value);
      if (converted === null) return `— ${baseCurrency}`;
      return formatCurrency(converted, baseCurrency);
    },
    [baseCurrency, convertReportingAmount],
  );

  useEffect(() => {
    if (baseCurrency !== reportingCurrency && !latestRate) return;

    setReportingCurrencyRuntime({
      workspace,
      reportingCurrency,
      baseCurrency,
      rate: latestRate ?? 1,
    });

    if (workspace === "personal") {
      router.refresh();
    }
  }, [baseCurrency, latestRate, reportingCurrency, router, workspace]);

  const value = useMemo<CurrencyDisplayContextValue>(
    () => ({
      workspace,
      reportingCurrency,
      baseCurrency,
      latestRate,
      rateDate,
      rateSource,
      loading,
      error,
      convertReportingAmount,
      formatReportingAmount,
    }),
    [
      baseCurrency,
      convertReportingAmount,
      error,
      formatReportingAmount,
      latestRate,
      loading,
      rateDate,
      rateSource,
      reportingCurrency,
      workspace,
    ],
  );

  return (
    <CurrencyDisplayContext.Provider value={value}>
      {children}
    </CurrencyDisplayContext.Provider>
  );
}

export function useCurrencyDisplay(): CurrencyDisplayContextValue {
  const context = useContext(CurrencyDisplayContext);
  if (!context) {
    return {
      workspace: "personal",
      reportingCurrency: DEFAULT_BASE_CURRENCY,
      baseCurrency: DEFAULT_BASE_CURRENCY,
      latestRate: 1,
      rateDate: null,
      rateSource: "identity",
      loading: false,
      error: "",
      convertReportingAmount: (value) => finiteNumber(value),
      formatReportingAmount: (value) =>
        formatCurrency(finiteNumber(value), DEFAULT_BASE_CURRENCY),
    };
  }
  return context;
}

export function useHistoricalReportingRates(dates: Array<string | null | undefined>) {
  const { reportingCurrency, baseCurrency, latestRate } = useCurrencyDisplay();
  const normalizedDates = useMemo(
    () => [...new Set(dates.filter((date): date is string => Boolean(date)).map((date) => date.slice(0, 10)))].sort(),
    [dates.join("|")],
  );
  const [rates, setRates] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;

    if (baseCurrency === reportingCurrency || !normalizedDates.length) {
      setRates({});
      return () => {
        active = false;
      };
    }

    void Promise.all(
      normalizedDates.map(async (date) => {
        try {
          const result = await getExchangeRate(reportingCurrency, baseCurrency, { date });
          return [date, result.rate] as const;
        } catch {
          return [date, latestRate ?? 1] as const;
        }
      }),
    ).then((entries) => {
      if (!active) return;
      setRates(Object.fromEntries(entries));
    });

    return () => {
      active = false;
    };
  }, [baseCurrency, latestRate, normalizedDates, reportingCurrency]);

  const rateForDate = useCallback(
    (date?: string | null) => {
      if (baseCurrency === reportingCurrency) return 1;
      const key = date?.slice(0, 10) ?? "";
      return (key && rates[key]) || latestRate || null;
    },
    [baseCurrency, latestRate, rates, reportingCurrency],
  );

  const formatHistoricalReportingAmount = useCallback(
    (value: unknown, date?: string | null) => {
      const amount = finiteNumber(value);
      const rate = rateForDate(date);
      if (!rate) return `— ${baseCurrency}`;
      return formatCurrency(roundConvertedAmount(amount * rate), baseCurrency);
    },
    [baseCurrency, rateForDate],
  );

  return { rates, rateForDate, formatHistoricalReportingAmount };
}
