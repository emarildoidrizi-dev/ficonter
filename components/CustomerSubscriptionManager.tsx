"use client";

import { useMemo, useState } from "react";

type SubscriptionSnapshot = {
  plan_code?: string | null;
  status?: string | null;
  billing_interval?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  provider?: string | null;
};

type Props = {
  subscription: SubscriptionSnapshot | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function planName(planCode: string | null | undefined) {
  if (planCode === "personal_pro") return "Ficonter Personal Pro";
  if (planCode === "business_pro") return "Ficonter Business Pro";
  return "";
}

export function CustomerSubscriptionManager({ subscription }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState("");

  const name = planName(subscription?.plan_code);
  const paidThrough = useMemo(
    () => formatDate(subscription?.current_period_end),
    [subscription?.current_period_end],
  );

  const paidCancellationGrace =
    subscription?.status === "canceled" &&
    subscription?.cancel_at_period_end === true &&
    Boolean(subscription?.current_period_end) &&
    Date.parse(String(subscription?.current_period_end)) > Date.now();

  const canCancel =
    subscription?.provider === "paypal" &&
    Boolean(name) &&
    (subscription?.status === "active" ||
      subscription?.status === "trialing") &&
    subscription?.cancel_at_period_end !== true;

  if (
    !name ||
    subscription?.provider !== "paypal" ||
    (!canCancel && !paidCancellationGrace)
  ) {
    return null;
  }

  async function cancelSubscription() {
    if (canceling) return;

    setCanceling(true);
    setError("");

    try {
      const response = await fetch("/api/paypal/cancel", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error || "The subscription could not be canceled.",
        );
      }

      window.location.reload();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The subscription could not be canceled.",
      );
      setCanceling(false);
    }
  }

  return (
    <>
      <div
        style={{
          margin: "0 0 18px",
          padding: "16px 18px",
          border: "1px solid rgba(172, 145, 91, 0.35)",
          borderRadius: 18,
          background: "rgba(20, 30, 44, 0.86)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              opacity: 0.68,
            }}
          >
            Manage subscription
          </span>

          <strong style={{ fontSize: 17 }}>{name}</strong>

          <span style={{ fontSize: 13, opacity: 0.78 }}>
            {paidCancellationGrace
              ? paidThrough
                ? `Will not renew · Paid access until ${paidThrough}`
                : "Will not renew"
              : paidThrough
                ? `Active · Next billing date ${paidThrough}`
                : "Active PayPal subscription"}
          </span>

          {error ? (
            <span
              role="alert"
              style={{ fontSize: 13, color: "#ffb4ab", marginTop: 4 }}
            >
              {error}
            </span>
          ) : null}
        </div>

        {canCancel ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            style={{
              border: "1px solid rgba(255, 126, 126, 0.55)",
              borderRadius: 12,
              background: "rgba(130, 35, 35, 0.12)",
              color: "inherit",
              padding: "10px 14px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Cancel subscription
          </button>
        ) : (
          <span
            style={{
              borderRadius: 999,
              padding: "8px 11px",
              background: "rgba(199, 170, 111, 0.16)",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            Cancellation scheduled
          </span>
        )}
      </div>

      {confirming ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-subscription-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.62)",
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !canceling) {
              setConfirming(false);
            }
          }}
        >
          <div
            style={{
              width: "min(520px, 100%)",
              borderRadius: 20,
              border: "1px solid rgba(172, 145, 91, 0.35)",
              background: "#172233",
              padding: 24,
              boxShadow: "0 24px 80px rgba(0,0,0,0.42)",
            }}
          >
            <div
              id="cancel-subscription-title"
              style={{ fontSize: 22, fontWeight: 900, marginBottom: 10 }}
            >
              Cancel your subscription?
            </div>

            <p style={{ lineHeight: 1.55, opacity: 0.86, margin: "0 0 10px" }}>
              Future renewal will stop. Your FICONTER account and financial data
              will not be deleted.
            </p>

            <p style={{ lineHeight: 1.55, opacity: 0.86, margin: "0 0 20px" }}>
              {paidThrough
                ? `You will keep your paid plan access until ${paidThrough}.`
                : "FICONTER will first verify your paid-through date before allowing cancellation."}
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                disabled={canceling}
                onClick={() => setConfirming(false)}
                style={{
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 12,
                  background: "transparent",
                  color: "inherit",
                  padding: "10px 14px",
                  fontWeight: 800,
                  cursor: canceling ? "default" : "pointer",
                }}
              >
                Keep subscription
              </button>

              <button
                type="button"
                disabled={canceling}
                onClick={() => void cancelSubscription()}
                style={{
                  border: 0,
                  borderRadius: 12,
                  background: "#b14d4d",
                  color: "#fff",
                  padding: "10px 14px",
                  fontWeight: 900,
                  cursor: canceling ? "default" : "pointer",
                  opacity: canceling ? 0.7 : 1,
                }}
              >
                {canceling ? "Canceling…" : "Confirm cancellation"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
