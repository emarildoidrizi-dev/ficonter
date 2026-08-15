import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/access";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type PayPalSubscription = {
  id?: string;
  status?: string;
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
    throw new Error("Unable to retrieve the PayPal subscription.");
  }

  return (await response.json()) as PayPalSubscription;
}

async function cancelPayPalSubscription(
  subscriptionId: string,
  accessToken: string,
) {
  const { apiBase } = getPayPalConfiguration();

  const response = await fetch(
    `${apiBase}/v1/billing/subscriptions/${encodeURIComponent(
      subscriptionId,
    )}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        reason: "Customer requested cancellation from FICONTER.",
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");

    console.error(
      "PayPal subscription cancellation failed:",
      response.status,
      body,
    );

    throw new Error("PayPal could not cancel the subscription.");
  }
}

function isFutureDate(value: string | null | undefined) {
  if (!value) return false;

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) && timestamp > Date.now();
}

export async function POST(request: Request) {
  try {
    const requestOrigin = new URL(request.url).origin;
    const suppliedOrigin = request.headers.get("origin");

    if (suppliedOrigin && suppliedOrigin !== requestOrigin) {
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const { admin: adminAccount } = await requireAdmin();

    if (adminAccount) {
      return NextResponse.json(
        {
          error:
            "Administrative accounts do not require subscriptions.",
        },
        { status: 403 },
      );
    }

    const admin = createServiceClient();

    const {
      data: subscription,
      error: subscriptionError,
    } = await admin
      .from("subscriptions")
      .select(
        "plan_code,status,provider,paypal_subscription_id,current_period_end,cancel_at_period_end",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (subscriptionError) {
      throw subscriptionError;
    }

    if (!subscription) {
      return NextResponse.json(
        { error: "No subscription was found for this account." },
        { status: 404 },
      );
    }

    if (
      subscription.plan_code !== "personal_pro" &&
      subscription.plan_code !== "business_pro"
    ) {
      return NextResponse.json(
        {
          error:
            "This account does not have a paid FICONTER plan.",
        },
        { status: 400 },
      );
    }

    if (
      subscription.provider !== "paypal" ||
      typeof subscription.paypal_subscription_id !== "string" ||
      !/^I-[A-Za-z0-9]+$/.test(
        subscription.paypal_subscription_id,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "This subscription is not managed by PayPal.",
        },
        { status: 400 },
      );
    }

    if (subscription.cancel_at_period_end === true) {
      return NextResponse.json({
        success: true,
        alreadyCanceled: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd:
          subscription.current_period_end ?? null,
      });
    }

    const subscriptionId =
      subscription.paypal_subscription_id;

    const accessToken = await getPayPalAccessToken();

    const paypalSubscription =
      await getPayPalSubscription(
        subscriptionId,
        accessToken,
      );

    if (paypalSubscription.id !== subscriptionId) {
      throw new Error(
        "PayPal returned a different subscription ID.",
      );
    }

    const currentPeriodEnd =
      paypalSubscription.billing_info?.next_billing_time ??
      subscription.current_period_end ??
      null;

    /*
     * Fail safely. Never cancel a customer's PayPal renewal unless
     * FICONTER can first verify the date through which paid access
     * must remain available.
     */
    if (
      paypalSubscription.status !== "CANCELLED" &&
      !isFutureDate(currentPeriodEnd)
    ) {
      return NextResponse.json(
        {
          error:
            "The paid-through date could not be verified. The subscription was not canceled.",
        },
        { status: 409 },
      );
    }

    if (paypalSubscription.status !== "CANCELLED") {
      await cancelPayPalSubscription(
        subscriptionId,
        accessToken,
      );
    }

    const { error: updateError } = await admin
      .from("subscriptions")
      .update({
        status: "canceled",
        cancel_at_period_end: true,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq(
        "paypal_subscription_id",
        subscriptionId,
      );

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd,
      message:
        "Your subscription will not renew. Paid access remains available until the end of the current billing period.",
    });
  } catch (error) {
    console.error(
      "FICONTER subscription cancellation failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to cancel the subscription right now.",
      },
      { status: 500 },
    );
  }
}
