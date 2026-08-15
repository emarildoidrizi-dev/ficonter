import type { NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { isSameOriginRequest, noStoreJson } from "@/lib/security/request";
export const runtime = "nodejs";

type PaidPlan = "personal_pro" | "business_pro";
type PaidInterval = "monthly" | "annual";

type ConfiguredPlan = {
  planCode: PaidPlan;
  billingInterval: PaidInterval;
  planId: string;
};

type PayPalSubscription = {
  id?: string;
  plan_id?: string;
  status?: string;
  start_time?: string;
  subscriber?: {
    payer_id?: string;
  };
  billing_info?: {
    next_billing_time?: string;
  };
};

function getPayPalConfiguration() {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  const apiBase = process.env.PAYPAL_API_BASE?.trim();

  if (!clientId || !clientSecret || !apiBase) {
    throw new Error("PayPal server configuration is incomplete.");
  }

  return {
    clientId,
    clientSecret,
    apiBase: apiBase.replace(/\/$/, ""),
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
  const { clientId, clientSecret, apiBase } = getPayPalConfiguration();

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

async function getPayPalSubscription(subscriptionId: string) {
  const { apiBase } = getPayPalConfiguration();
  const accessToken = await getPayPalAccessToken();

  const response = await fetch(
    `${apiBase}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
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
    throw new Error("Unable to verify the PayPal subscription.");
  }

  return (await response.json()) as PayPalSubscription;
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return noStoreJson(
      { error: "This request could not be verified." },
      { status: 403 },
    );
  }

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return noStoreJson(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as {
      subscriptionId?: unknown;
    };

    const subscriptionId =
      typeof body.subscriptionId === "string"
        ? body.subscriptionId.trim()
        : "";

    if (!/^I-[A-Za-z0-9]+$/.test(subscriptionId)) {
      return noStoreJson(
        { error: "Invalid PayPal subscription ID." },
        { status: 400 },
      );
    }

    const subscription =
      await getPayPalSubscription(subscriptionId);

    if (
      subscription.id !== subscriptionId ||
      subscription.status !== "ACTIVE"
    ) {
      return noStoreJson(
        { error: "The PayPal subscription is not active." },
        { status: 400 },
      );
    }

    const configuredPlan = getConfiguredPlans().find(
      (plan) => plan.planId === subscription.plan_id,
    );

    if (!configuredPlan) {
      return noStoreJson(
        { error: "This PayPal plan does not belong to FICONTER." },
        { status: 400 },
      );
    }

    const admin = createServiceClient();

    const {
      data: existingClaim,
      error: existingClaimError,
    } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("paypal_subscription_id", subscriptionId)
      .maybeSingle();

    if (existingClaimError) {
      throw existingClaimError;
    }

    if (
      existingClaim &&
      existingClaim.user_id !== user.id
    ) {
      return noStoreJson(
        {
          error:
            "This PayPal subscription is already linked to another account.",
        },
        { status: 409 },
      );
    }

    const { error: updateError } = await admin
      .from("subscriptions")
      .upsert(
        {
          user_id: user.id,
          plan_code: configuredPlan.planCode,
          status: "active",
          billing_interval: configuredPlan.billingInterval,
          provider: "paypal",
          paypal_payer_id:
            subscription.subscriber?.payer_id ?? null,
          paypal_subscription_id: subscriptionId,
          paypal_plan_id: subscription.plan_id ?? null,
          current_period_start:
            subscription.start_time ?? null,
          current_period_end:
            subscription.billing_info?.next_billing_time ?? null,
          cancel_at_period_end: false,
        },
        {
          onConflict: "user_id",
        },
      );

    if (updateError) {
      throw updateError;
    }

    return noStoreJson({
      success: true,
      planCode: configuredPlan.planCode,
      billingInterval: configuredPlan.billingInterval,
      subscriptionId,
    });
  } catch (error) {
    console.error(
      "PayPal subscription confirmation failed:",
      error,
    );

    return noStoreJson(
      { error: "Unable to confirm the PayPal subscription." },
      { status: 500 },
    );
  }
}
