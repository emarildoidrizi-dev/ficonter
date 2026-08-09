import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/access";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PayPalSubscription = {
  id?: string;
  start_time?: string;
};

type PayPalTransaction = {
  id?: string;
  status?: string;
  time?: string;
  amount_with_breakdown?: {
    gross_amount?: {
      currency_code?: string;
      value?: string;
    };
    fee_amount?: {
      currency_code?: string;
      value?: string;
    };
    net_amount?: {
      currency_code?: string;
      value?: string;
    };
  };
};

type PayPalTransactionsResponse = {
  transactions?: PayPalTransaction[];
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
  const { clientId, clientSecret, apiBase } =
    getPayPalConfiguration();

  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`,
  ).toString("base64");

  const response = await fetch(
    `${apiBase}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    },
  );

  const payload = (await response.json()) as {
    access_token?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(
      "Unable to authenticate with PayPal.",
    );
  }

  return payload.access_token;
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
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      "Unable to read the PayPal subscription.",
    );
  }

  return (await response.json()) as PayPalSubscription;
}

async function getPayPalTransactions(
  subscriptionId: string,
  startTime: string,
  accessToken: string,
) {
  const { apiBase } = getPayPalConfiguration();
  const endTime = new Date(
    Date.now() + 60_000,
  ).toISOString();

  const url = new URL(
    `${apiBase}/v1/billing/subscriptions/${encodeURIComponent(
      subscriptionId,
    )}/transactions`,
  );

  url.searchParams.set("start_time", startTime);
  url.searchParams.set("end_time", endTime);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      "Unable to read PayPal billing history.",
    );
  }

  return (await response.json()) as PayPalTransactionsResponse;
}

export async function GET() {
  try {
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

    const { admin: adminAccount } =
      await requireAdmin();

    if (adminAccount) {
      return NextResponse.json(
        {
          error:
            "Administrative accounts do not use customer billing.",
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
        "provider,paypal_subscription_id,plan_code,billing_interval",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (subscriptionError) {
      throw subscriptionError;
    }

    if (
      !subscription ||
      subscription.provider !== "paypal" ||
      typeof subscription.paypal_subscription_id !==
        "string"
    ) {
      return NextResponse.json({
        transactions: [],
      });
    }

    const subscriptionId =
      subscription.paypal_subscription_id;

    if (!/^I-[A-Za-z0-9]+$/.test(subscriptionId)) {
      throw new Error(
        "Invalid PayPal subscription identifier.",
      );
    }

    const accessToken =
      await getPayPalAccessToken();

    const paypalSubscription =
      await getPayPalSubscription(
        subscriptionId,
        accessToken,
      );

    if (paypalSubscription.id !== subscriptionId) {
      throw new Error(
        "PayPal returned a different subscription.",
      );
    }

    const fallbackStart = new Date(
      Date.now() - 5 * 365 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const history =
      await getPayPalTransactions(
        subscriptionId,
        paypalSubscription.start_time ??
          fallbackStart,
        accessToken,
      );

    const transactions = (
      history.transactions ?? []
    )
      .filter(
        (
          transaction,
        ): transaction is PayPalTransaction & {
          id: string;
          status: string;
          time: string;
        } =>
          typeof transaction.id === "string" &&
          typeof transaction.status === "string" &&
          typeof transaction.time === "string",
      )
      .map((transaction) => ({
        id: transaction.id,
        status: transaction.status,
        time: transaction.time,
        amount: {
          currency:
            transaction.amount_with_breakdown
              ?.gross_amount?.currency_code ??
            "EUR",
          value:
            transaction.amount_with_breakdown
              ?.gross_amount?.value ?? "0.00",
        },
        fee: transaction.amount_with_breakdown
          ?.fee_amount
          ? {
              currency:
                transaction.amount_with_breakdown
                  .fee_amount.currency_code ??
                "EUR",
              value:
                transaction.amount_with_breakdown
                  .fee_amount.value ?? "0.00",
            }
          : null,
        net: transaction.amount_with_breakdown
          ?.net_amount
          ? {
              currency:
                transaction.amount_with_breakdown
                  .net_amount.currency_code ??
                "EUR",
              value:
                transaction.amount_with_breakdown
                  .net_amount.value ?? "0.00",
            }
          : null,
      }))
      .sort(
        (a, b) =>
          Date.parse(b.time) - Date.parse(a.time),
      );

    return NextResponse.json(
      {
        transactions,
      },
      {
        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error(
      "FICONTER PayPal billing history failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Billing history could not be loaded right now.",
      },
      { status: 500 },
    );
  }
}
