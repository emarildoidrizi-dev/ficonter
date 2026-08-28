"use client";

import { ReactNode, useCallback, useEffect, useMemo, useRef } from "react";

import { useCurrencyDisplay } from "@/components/CurrencyDisplayProvider";
import { currentRecordAmountInBaseCurrency } from "@/lib/finance/baseCurrencyReconciliation";
import { finiteNumber, roundMoney } from "@/lib/finance/money";
import { formatCurrency } from "@/lib/financialOptions";

type CreditCardLike = {
  id: string;
  current_balance: number | string;
  current_balance_eur: number | string;
  currency: string;
  annual_interest_rate: number | string;
};

export function CreditCardLiveInterestView({
  cards,
  children,
}: {
  cards: CreditCardLike[];
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const { baseCurrency, latestRate } = useCurrencyDisplay();

  const labels = useMemo(
    () =>
      cards.map((card) => {
        const currentBalance = currentRecordAmountInBaseCurrency({
          originalAmount: card.current_balance,
          originalCurrency: card.currency,
          amountEur: card.current_balance_eur,
          context: {
            baseCurrency,
            latestRate,
            rateForDate: () => latestRate,
          },
        });
        const apr = Math.max(0, finiteNumber(card.annual_interest_rate));
        const liveInterest = roundMoney(
          Math.max(0, currentBalance) * (apr / 100 / 12),
        );

        return formatCurrency(liveInterest, baseCurrency);
      }),
    [baseCurrency, cards, latestRate],
  );

  const applyLiveInterest = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    const articles = Array.from(
      root.querySelectorAll<HTMLElement>('article[class*="creditCard"]'),
    );

    articles.forEach((article, index) => {
      const amount = labels[index];
      if (!amount) return;

      const blocks = Array.from(article.querySelectorAll<HTMLElement>("div"));
      const interestBlock = blocks.find((block) => {
        const label = Array.from(block.children).find(
          (child) => child.tagName === "SPAN",
        );
        const text = label?.textContent?.trim().toLowerCase() ?? "";
        return text === "interest charged" || text === "real-time interest charge";
      });

      if (!interestBlock) return;

      const label = Array.from(interestBlock.children).find(
        (child) => child.tagName === "SPAN",
      ) as HTMLElement | undefined;
      const value = Array.from(interestBlock.children).find(
        (child) => child.tagName === "STRONG",
      ) as HTMLElement | undefined;
      const helper = Array.from(interestBlock.children).find(
        (child) => child.tagName === "SMALL",
      ) as HTMLElement | undefined;

      // MutationObserver watches this subtree. Only write when the DOM really
      // differs, otherwise our own writes would continuously retrigger it.
      if (label && label.textContent !== "Real-time interest charge") {
        label.textContent = "Real-time interest charge";
      }
      if (value && value.textContent !== amount) {
        value.textContent = amount;
      }
      if (helper && helper.style.display !== "none") {
        helper.style.display = "none";
      }
    });
  }, [labels]);

  useEffect(() => {
    applyLiveInterest();
    const root = rootRef.current;
    if (!root) return;

    const scheduleApply = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        applyLiveInterest();
      });
    };

    const observer = new MutationObserver(scheduleApply);
    observer.observe(root, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [applyLiveInterest]);

  return <div ref={rootRef}>{children}</div>;
}
