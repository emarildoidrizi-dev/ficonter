import { NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type PaidPlan = "personal_pro" | "business_pro";
type PaidInterval = "monthly" | "annual";
type FiconterStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid";

type ConfiguredPlan = {
  planCode: PaidPlan;
  billingInterval: PaidInterval;
  planId: string;
};

type PayPalSubscription = {
  id?: string;
  plan_id?: string;
  status?: string;
  subscriber?: {
    payer_id?: string;
  };
  billing_info?: {
    next_billing_time?: string;
  };
};

type PayPalWebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    billing_agreement_id?: string;
  };
};

function getPayPalConfiguration() {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  const apiBase = process.env.PAYPAL_API_BASE?.trim();
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();

  if (!clientId || !clientSecret || !apiBase) {
    throw new Error("PayPal server configuration is incomplete.");
  }

  if (!webhookId) {
    throw new Error("PAYPAL_WEBHOOK_ID is not configured.");
  }

  return {
    clientId,
    clientSecret,
    apiBase: apiBase.replace(/\/$/, ""),
    webhookId,
  };
}

function getConfiguredPlans(): ConfiguredPlan[] {
  const plans: Array<{
    planCode: PaidPlan;
    billingInterval: PaidInterval;
    planId: string | undefined;
  }> = [
    {
      planCode: "personal_pro",
      billingInterval: "monthly",
      planId: process.env.PAYPAL_PLAN_PERSONAL_MONTHLY?.trim(),
    },
    {
      planCode: "personal_pro",
      billingInterval: "annual",
      planId: process.env.PAYPAL_PLAN_PERSONAL_ANNUAL?.trim(),
    },
    {
      planCode: "business_pro",
      billingInterval: "monthly",
      planId: process.env.PAYPAL_PLAN_BUSINESS_MONTHLY?.trim(),
    },
    {
      planCode: "business_pro",
      billingInterval: "annual",
      planId: process.env.PAYPAL_PLAN_BUSINESS_ANNUAL?.trim(),
    },
  ];

  return plans.filter(
    (plan): plan is ConfiguredPlan =>
      typeof plan.planId === "string" && plan.planId.length > 0,
  );
}

async function getPayPalAccessToken() {
  const { clientId, clientSecret, apiBase } =
    getPayPalConfiguration();

  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`,
  ).toString("base64");

  const response = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  const result = (await response.json()) as {
    access_token?: string;
  };

  if (!response.ok || !result.access_token) {
    throw new Error("Unable to authenticate with PayPal.");
  }

  return result.access_token;
}

async function verifyPayPalWebhook(
  rawBody: string,
  headers: Headers,
  accessToken: string,
) {
  const { apiBase, webhookId } = getPayPalConfiguration();

  const transmissionId =
    headers.get("paypal-transmission-id");
  const transmissionTime =
    headers.get("paypal-transmission-time");
  const transmissionSig =
    headers.get("paypal-transmission-sig");
  const certUrl =
    headers.get("paypal-cert-url");
  const authAlgo =
    headers.get("paypal-auth-algo");

  if (
    !transmissionId ||
    !transmissionTime ||
    !transmissionSig ||
    !certUrl ||
    !authAlgo
  ) {
    return false;
  }

  /*
   * Keep the original webhook JSON intact when sending it
   * back to PayPal for verification.
   */
  const verificationBody =
    `{"transmission_id":${JSON.stringify(transmissionId)},` +
    `"transmission_time":${JSON.stringify(transmissionTime)},` +
    `"cert_url":${JSON.stringify(certUrl)},` +
    `"auth_algo":${JSON.stringify(authAlgo)},` +
    `"transmission_sig":${JSON.stringify(transmissionSig)},` +
    `"webhook_id":${JSON.stringify(webhookId)},` +
    `"webhook_event":${rawBody}}`;

  const response = await fetch(
    `${apiBase}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: verificationBody,
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("PayPal webhook verification request failed.");
  }

  const result = (await response.json()) as {
    verification_status?: string;
  };

  return result.verification_status === "SUCCESS";
}

async function getPayPalSubscription(
  subscriptionId: string,
  accessToken: string,
) {
  const { apiBase } = getPayPalConfiguration();

  const response = await fetch(
    `${apiBase}/v1/billing/subscriptions/${encodeURIComponent(
      subscriptionId,
    )}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      "Unable to retrieve PayPal subscription.",
    );
  }

  return (await response.json()) as PayPalSubscription;
}

function extractSubscriptionId(
  event: PayPalWebhookEvent,
) {
  const candidates = [
    event.resource?.id,
    event.resource?.billing_agreement_id,
  ];

  return (
    candidates.find(
      (value) =>
        typeof value === "string" &&
        /^I-[A-Za-z0-9]+$/.test(value),
    ) ?? null
  );
}

function determineFiconterStatus(
  paypalStatus: string | undefined,
  eventType: string,
): FiconterStatus {
  if (
    eventType ===
    "BILLING.SUBSCRIPTION.PAYMENT.FAILED"
  ) {
    return "past_due";
  }

  switch (paypalStatus) {
    case "ACTIVE":
      return "active";

    case "SUSPENDED":
      return "past_due";

    case "CANCELLED":
    case "EXPIRED":
      return "canceled";

    case "APPROVAL_PENDING":
    case "APPROVED":
      return "trialing";

    default:
      return "unpaid";
  }
}

const SUPPORTED_EVENTS = new Set([
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.UPDATED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.EXPIRED",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
  "PAYMENT.SALE.COMPLETED",
]);

export async function POST(request: Request) {
  try {
    /*
     * Read the raw body first. PayPal webhook verification
     * depends on the original message.
     */
    const rawBody = await request.text();

    let event: PayPalWebhookEvent;

    try {
      event = JSON.parse(rawBody) as PayPalWebhookEvent;
    } catch {
      return NextResponse.json(
        { error: "Invalid webhook payload." },
        { status: 400 },
      );
    }

    const accessToken = await getPayPalAccessToken();

    const verified = await verifyPayPalWebhook(
      rawBody,
      request.headers,
      accessToken,
    );

    if (!verified) {
      return NextResponse.json(
        { error: "Invalid PayPal webhook signature." },
        { status: 401 },
      );
    }

    const eventType = event.event_type ?? "";

    /*
     * Acknowledge PayPal events that FICONTER does not need.
     */
    if (!SUPPORTED_EVENTS.has(eventType)) {
      return NextResponse.json({
        received: true,
        ignored: true,
      });
    }

    const subscriptionId =
      extractSubscriptionId(event);

    if (!subscriptionId) {
      return NextResponse.json({
        received: true,
        ignored: true,
      });
    }

    /*
     * Do not trust the webhook payload alone.
     * Retrieve the subscription directly from PayPal.
     */
    const subscription =
      await getPayPalSubscription(
        subscriptionId,
        accessToken,
      );

    if (subscription.id !== subscriptionId) {
      throw new Error(
        "PayPal returned a different subscription ID.",
      );
    }

    const configuredPlan = getConfiguredPlans().find(
      (plan) => plan.planId === subscription.plan_id,
    );

    /*
     * Ignore PayPal subscriptions that are not one of
     * FICONTER's four configured subscription plans.
     */
    if (!configuredPlan) {
      return NextResponse.json({
        received: true,
        ignored: true,
      });
    }

    const status = determineFiconterStatus(
      subscription.status,
      eventType,
    );

    const admin = createServiceClient();

    /*
     * Only update an existing subscription that has already
     * been linked to a FICONTER customer.
     */
    const {
      data: existingSubscription,
      error: existingError,
    } = await admin
      .from("subscriptions")
      .select("user_id, current_period_end")
      .eq("paypal_subscription_id", subscriptionId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (!existingSubscription) {
      return NextResponse.json({
        received: true,
        ignored: true,
        reason: "Subscription is not linked to a FICONTER user.",
      });
    }
const isCancellation =
  eventType === "BILLING.SUBSCRIPTION.CANCELLED" ||
  subscription.status === "CANCELLED";

const currentPeriodEnd =
  subscription.billing_info?.next_billing_time ??
  (isCancellation
    ? existingSubscription.current_period_end
    : null);
    const { error: updateError } = await admin
      .from("subscriptions")
      .update({
        plan_code: configuredPlan.planCode,
        status,
        billing_interval:
          configuredPlan.billingInterval,
        provider: "paypal",
        paypal_payer_id:
          subscription.subscriber?.payer_id ?? null,
        paypal_plan_id:
          subscription.plan_id ?? null,
     current_period_end: currentPeriodEnd,
cancel_at_period_end: isCancellation,
        updated_at: new Date().toISOString(),
      })
      .eq("paypal_subscription_id", subscriptionId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      received: true,
      updated: true,
      eventType,
      subscriptionId,
      status,
    });
  } catch (error) {
    console.error(
      "PayPal webhook processing failed:",
      error,
    );

    /*
     * A non-2xx response tells PayPal the event was not
     * successfully processed and allows delivery retries.
     */
    return NextResponse.json(
      { error: "Unable to process PayPal webhook." },
      { status: 500 },
    );
  }
}
