"use client";

import { useEffect, useId, useState } from "react";

type PaidPlan = "personal_pro" | "business_pro";
type BillingInterval = "monthly" | "annual";

type PayPalSubscriptionCheckoutProps = {
  planCode: PaidPlan;
  billingInterval: BillingInterval;
  onApproved?: (subscriptionId: string) => void;
};

type PayPalActions = {
  subscription: {
    create: (options: { plan_id: string }) => Promise<string>;
  };
};

type PayPalButtonsInstance = {
  render: (selector: string) => Promise<void>;
};

type PayPalNamespace = {
  Buttons: (options: {
    createSubscription: (
      data: unknown,
      actions: PayPalActions,
    ) => Promise<string>;
    onApprove: (data: { subscriptionID?: string }) => void;
    onCancel: () => void;
    onError: (error: unknown) => void;
  }) => PayPalButtonsInstance;
};

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

const PAYPAL_SCRIPT_ID = "ficonter-paypal-subscription-sdk";

async function loadPayPalSdk(clientId: string) {
  if (window.paypal) {
    return;
  }

  const existingScript = document.getElementById(
    PAYPAL_SCRIPT_ID,
  ) as HTMLScriptElement | null;

  if (existingScript) {
    await new Promise<void>((resolve, reject) => {
      if (window.paypal) {
        resolve();
        return;
      }

      existingScript.addEventListener("load", () => resolve(), {
        once: true,
      });

      existingScript.addEventListener(
        "error",
        () => reject(new Error("Unable to load PayPal checkout.")),
        { once: true },
      );
    });

    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");

    const parameters = new URLSearchParams({
      "client-id": clientId,
      vault: "true",
      intent: "subscription",
      currency: "EUR",
      components: "buttons",
    });

    script.id = PAYPAL_SCRIPT_ID;
    script.src = `https://www.paypal.com/sdk/js?${parameters.toString()}`;
    script.async = true;

    script.addEventListener("load", () => resolve(), { once: true });

    script.addEventListener(
      "error",
      () => reject(new Error("Unable to load PayPal checkout.")),
      { once: true },
    );

    document.head.appendChild(script);
  });
}

export default function PayPalSubscriptionCheckout({
  planCode,
  billingInterval,
  onApproved,
}: PayPalSubscriptionCheckoutProps) {
  const reactId = useId();
  const containerId = `paypal-subscription-${reactId.replace(/:/g, "")}`;

  const [error, setError] = useState<string | null>(null);
  const [approvedSubscriptionId, setApprovedSubscriptionId] = useState<
    string | null
  >(null);

  useEffect(() => {
    let cancelled = false;

    async function initialiseCheckout() {
      try {
        setError(null);
        setApprovedSubscriptionId(null);

        const clientId =
          process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim();

        if (!clientId) {
          throw new Error("PayPal Sandbox Client ID is not configured.");
        }

        const response = await fetch("/api/paypal/plan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            planCode,
            billingInterval,
          }),
        });

        const result = (await response.json()) as {
          planId?: string;
          error?: string;
        };

        if (!response.ok || !result.planId) {
          throw new Error(
            result.error ?? "Unable to prepare PayPal subscription.",
          );
        }

        await loadPayPalSdk(clientId);

        if (cancelled || !window.paypal) {
          return;
        }

        const container = document.getElementById(containerId);

        if (!container) {
          throw new Error("PayPal checkout container is unavailable.");
        }

        container.innerHTML = "";

        const buttons = window.paypal.Buttons({
          createSubscription(_data, actions) {
            return actions.subscription.create({
              plan_id: result.planId!,
            });
          },

          onApprove(data) {
            const subscriptionId = data.subscriptionID;

            if (!subscriptionId) {
              setError(
                "PayPal approved the checkout but returned no subscription ID.",
              );
              return;
            }

            setApprovedSubscriptionId(subscriptionId);
            onApproved?.(subscriptionId);
          },

          onCancel() {
            setError("PayPal checkout was cancelled.");
          },

          onError() {
            setError(
              "PayPal could not complete the subscription. Please try again.",
            );
          },
        });

        await buttons.render(`#${containerId}`);
      } catch (checkoutError) {
        if (cancelled) {
          return;
        }

        setError(
          checkoutError instanceof Error
            ? checkoutError.message
            : "Unable to open PayPal checkout.",
        );
      }
    }

    void initialiseCheckout();

    return () => {
      cancelled = true;
    };
  }, [billingInterval, containerId, onApproved, planCode]);

  if (approvedSubscriptionId) {
    return (
      <div role="status">
        PayPal Sandbox subscription approved successfully.
      </div>
    );
  }

  return (
    <div>
      <div id={containerId} />

      {error ? (
        <p role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
