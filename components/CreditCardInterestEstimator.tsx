"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, CreditCard } from "lucide-react";

import { finiteNumber, roundMoney } from "@/lib/finance/money";
import { formatCurrency } from "@/lib/financialOptions";

type EstimatorCard = {
  id: string;
  name: string;
  current_balance: number | string;
  currency: string;
  annual_interest_rate: number | string;
  status?: string | null;
};

function monthlyInterest(amount: unknown, apr: unknown) {
  const balance = Math.max(0, finiteNumber(amount));
  const annualRate = Math.max(0, finiteNumber(apr));
  return roundMoney(balance * (annualRate / 100 / 12));
}

export function CreditCardInterestEstimator({ cards }: { cards: EstimatorCard[] }) {
  const activeCards = useMemo(
    () => cards.filter((card) => card.status !== "paused"),
    [cards],
  );
  const [cardId, setCardId] = useState(activeCards[0]?.id ?? "");
  const [plannedPurchase, setPlannedPurchase] = useState("");

  useEffect(() => {
    if (!activeCards.length) {
      setCardId("");
      return;
    }
    if (!activeCards.some((card) => card.id === cardId)) {
      setCardId(activeCards[0].id);
    }
  }, [activeCards, cardId]);

  if (!activeCards.length) return null;

  const card = activeCards.find((item) => item.id === cardId) ?? activeCards[0];
  const balance = Math.max(0, finiteNumber(card.current_balance));
  const purchase = Math.max(0, finiteNumber(plannedPurchase));
  const apr = Math.max(0, finiteNumber(card.annual_interest_rate));
  const currentEstimate = monthlyInterest(balance, apr);
  const purchaseImpact = monthlyInterest(purchase, apr);
  const projectedBalance = roundMoney(balance + purchase);
  const projectedEstimate = monthlyInterest(projectedBalance, apr);

  return (
    <section
      style={{
        display: "grid",
        gap: 16,
        padding: 20,
        border: "1px solid var(--border-subtle, #ddd5c9)",
        borderRadius: 18,
        background: "var(--surface-card, #fff)",
      }}
      aria-label="Credit card interest estimator"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Calculator size={20} />
        <div>
          <strong style={{ display: "block" }}>Credit Card Interest Estimator</strong>
          <span style={{ color: "var(--text-secondary, #716960)", fontSize: 13 }}>
            Approximate only. Your issuer may calculate interest differently.
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 12,
        }}
      >
        <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
          Card
          <select value={card.id} onChange={(event) => setCardId(event.target.value)}>
            {activeCards.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6, fontWeight: 700 }}>
          Planned purchase
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={plannedPurchase}
            onChange={(event) => setPlannedPurchase(event.target.value)}
            placeholder="0.00"
          />
        </label>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 12,
        }}
      >
        <div>
          <span style={{ display: "block", color: "var(--text-secondary, #716960)", fontSize: 12 }}>
            Current balance
          </span>
          <strong>{formatCurrency(balance, card.currency)}</strong>
        </div>
        <div>
          <span style={{ display: "block", color: "var(--text-secondary, #716960)", fontSize: 12 }}>
            APR
          </span>
          <strong>{apr.toFixed(2)}%</strong>
        </div>
        <div>
          <span style={{ display: "block", color: "var(--text-secondary, #716960)", fontSize: 12 }}>
            Estimated monthly interest now
          </span>
          <strong>{formatCurrency(currentEstimate, card.currency)}</strong>
        </div>
        <div>
          <span style={{ display: "block", color: "var(--text-secondary, #716960)", fontSize: 12 }}>
            Extra interest from purchase
          </span>
          <strong>{formatCurrency(purchaseImpact, card.currency)}</strong>
        </div>
        <div>
          <span style={{ display: "block", color: "var(--text-secondary, #716960)", fontSize: 12 }}>
            Projected balance
          </span>
          <strong>{formatCurrency(projectedBalance, card.currency)}</strong>
        </div>
        <div>
          <span style={{ display: "block", color: "var(--text-secondary, #716960)", fontSize: 12 }}>
            Projected monthly interest
          </span>
          <strong>{formatCurrency(projectedEstimate, card.currency)}</strong>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          color: "var(--text-secondary, #716960)",
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        <CreditCard size={16} style={{ flex: "0 0 auto", marginTop: 1 }} />
        <span>
          Estimate uses balance × APR ÷ 12. It does not post interest or change your card balance. Actual bank interest remains editable when the statement arrives.
        </span>
      </div>
    </section>
  );
}
