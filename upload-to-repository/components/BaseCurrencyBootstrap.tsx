"use client";

import { useEffect } from "react";
import {
  DEFAULT_BASE_CURRENCY,
  normalizeCurrency,
} from "@/lib/finance/currencyEngine";
import type { CurrencyCode } from "@/lib/financialOptions";

export const BASE_CURRENCY_CHANGED_EVENT = "ficonter:base-currency-changed";
export const PERSONAL_BASE_CURRENCY_STORAGE_KEY =
  "ficonter-personal-base-currency";
export const BUSINESS_BASE_CURRENCY_STORAGE_KEY =
  "ficonter-business-base-currency";

type Props = {
  currency?: string | null;
  workspace: "personal" | "business";
};

export function BaseCurrencyBootstrap({
  currency,
  workspace,
}: Props) {
  useEffect(() => {
    const normalized = normalizeCurrency(
      currency,
      DEFAULT_BASE_CURRENCY,
    );

    const root = document.documentElement;
    root.dataset.baseCurrency = normalized;
    root.dataset.currencyWorkspace = workspace;

    try {
      localStorage.setItem(
        workspace === "personal"
          ? PERSONAL_BASE_CURRENCY_STORAGE_KEY
          : BUSINESS_BASE_CURRENCY_STORAGE_KEY,
        normalized,
      );
    } catch {
      // Browser storage is optional; server state remains the source of truth.
    }

    window.dispatchEvent(
      new CustomEvent(BASE_CURRENCY_CHANGED_EVENT, {
        detail: {
          currency: normalized,
          workspace,
        },
      }),
    );
  }, [currency, workspace]);

  return null;
}

export function readBrowserBaseCurrency(
  workspace: "personal" | "business" = "personal",
): CurrencyCode {
  if (typeof document !== "undefined") {
    const fromDocument = document.documentElement.dataset.baseCurrency;
    if (fromDocument) return normalizeCurrency(fromDocument);
  }

  if (typeof localStorage !== "undefined") {
    try {
      const stored = localStorage.getItem(
        workspace === "personal"
          ? PERSONAL_BASE_CURRENCY_STORAGE_KEY
          : BUSINESS_BASE_CURRENCY_STORAGE_KEY,
      );
      if (stored) return normalizeCurrency(stored);
    } catch {
      // Fall through to EUR.
    }
  }

  return DEFAULT_BASE_CURRENCY;
}
