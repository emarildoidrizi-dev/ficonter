
import { requireAdmin } from "@/lib/admin/access";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { noStoreJson } from "@/lib/security/request";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    transactionId: string;
  }>;
};

type PayPalSubscription = {
  id?: string;
  start_time?: string;
};

type PayPalTransaction = {
  id?: string;
  status?: string;
  time?: string;
  payer_email?: string;
  payer_name?: {
    full_name?: string;
    given_name?: string;
    surname?: string;
  };
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
    throw new Error(
      "PayPal server configuration is incomplete.",
    );
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

function ascii(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfText(value: unknown) {
  return ascii(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function buildSimplePdf(
  title: string,
  lines: Array<{
    label?: string;
    value: string;
  }>,
) {
  const contentParts: string[] = [
    "BT",
    "/F2 18 Tf",
    "50 790 Td",
    `(${escapePdfText(title)}) Tj`,
    "/F1 10 Tf",
  ];

  for (const line of lines) {
    contentParts.push("0 -24 Td");

    if (line.label) {
      contentParts.push(
        `/F2 10 Tf (${escapePdfText(
          `${line.label}:`,
        )}) Tj`,
      );
      contentParts.push(
        `/F1 10 Tf 170 0 Td (${escapePdfText(
          line.value,
        )}) Tj`,
      );
      contentParts.push("-170 0 Td");
    } else {
      contentParts.push(
        `/F1 10 Tf (${escapePdfText(
          line.value,
        )}) Tj`,
      );
    }
  }

  contentParts.push("ET");

  const content = contentParts.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(
      content,
      "ascii",
    )} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(
    pdf,
    "ascii",
  );

  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(
      10,
      "0",
    )} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${
    objects.length + 1
  } /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "ascii");
}

function planLabel(planCode: string | null) {
  if (planCode === "personal_pro") {
    return "Ficonter Personal Pro";
  }

  if (planCode === "business_pro") {
    return "Ficonter Business Pro";
  }

  return "Ficonter subscription";
}

function billingLabel(
  billingInterval: string | null,
) {
  return billingInterval === "annual"
    ? "Annual"
    : "Monthly";
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { transactionId } =
      await context.params;

    if (
      !/^[A-Za-z0-9-]{3,50}$/.test(
        transactionId,
      )
    ) {
      return noStoreJson(
        { error: "Invalid transaction ID." },
        { status: 400 },
      );
    }

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

    const { admin: adminAccount } =
      await requireAdmin();

    if (adminAccount) {
      return noStoreJson(
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
      return noStoreJson(
        {
          error:
            "No PayPal subscription was found.",
        },
        { status: 404 },
      );
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

    const transaction = (
      history.transactions ?? []
    ).find(
      (candidate) =>
        candidate.id === transactionId,
    );

    if (!transaction) {
      return noStoreJson(
        {
          error:
            "This transaction does not belong to the current Ficonter subscription.",
        },
        { status: 404 },
      );
    }

    const gross =
      transaction.amount_with_breakdown
        ?.gross_amount;

    const fee =
      transaction.amount_with_breakdown
        ?.fee_amount;

    const net =
      transaction.amount_with_breakdown
        ?.net_amount;

    const payerName =
      transaction.payer_name?.full_name ||
      [
        transaction.payer_name?.given_name,
        transaction.payer_name?.surname,
      ]
        .filter(Boolean)
        .join(" ") ||
      user.user_metadata?.full_name ||
      user.user_metadata?.display_name ||
      "Ficonter customer";

    const { apiBase } =
      getPayPalConfiguration();

    const isSandbox =
      apiBase.includes("sandbox");

    const legalName =
      process.env.FICONTER_BILLING_LEGAL_NAME?.trim();

    const legalAddress =
      process.env.FICONTER_BILLING_ADDRESS?.trim();

    const vatId =
      process.env.FICONTER_BILLING_VAT_ID?.trim();

    const hasLegalInvoiceIdentity =
      Boolean(legalName && legalAddress);

    const documentTitle = isSandbox
      ? "FICONTER SANDBOX PAYMENT RECEIPT"
      : hasLegalInvoiceIdentity
        ? "FICONTER INVOICE"
        : "FICONTER PAYMENT RECEIPT";

    const lines = [
      {
        label: "Document number",
        value: `FIC-${transactionId}`,
      },
      {
        label: "Payment date",
        value: transaction.time
          ? new Date(
              transaction.time,
            ).toISOString()
          : "Unknown",
      },
      {
        label: "Customer",
        value: payerName,
      },
      {
        label: "Customer email",
        value:
          transaction.payer_email ||
          user.email ||
          "",
      },
      {
        label: "Plan",
        value: planLabel(
          subscription.plan_code,
        ),
      },
      {
        label: "Billing cycle",
        value: billingLabel(
          subscription.billing_interval,
        ),
      },
      {
        label: "Provider",
        value: "PayPal",
      },
      {
        label: "PayPal transaction",
        value: transactionId,
      },
      {
        label: "Status",
        value:
          transaction.status || "Unknown",
      },
      {
        label: "Amount",
        value: `${gross?.currency_code ?? "EUR"} ${
          gross?.value ?? "0.00"
        }`,
      },
      ...(fee
        ? [
            {
              label: "PayPal fee",
              value: `${
                fee.currency_code ?? "EUR"
              } ${fee.value ?? "0.00"}`,
            },
          ]
        : []),
      ...(net
        ? [
            {
              label: "Net amount",
              value: `${
                net.currency_code ?? "EUR"
              } ${net.value ?? "0.00"}`,
            },
          ]
        : []),
      ...(legalName
        ? [
            {
              label: "Seller",
              value: legalName,
            },
          ]
        : []),
      ...(legalAddress
        ? [
            {
              label: "Seller address",
              value: legalAddress,
            },
          ]
        : []),
      ...(vatId
        ? [
            {
              label: "VAT ID",
              value: vatId,
            },
          ]
        : []),
      {
        value: isSandbox
          ? "SANDBOX TEST DOCUMENT - NOT A TAX INVOICE."
          : hasLegalInvoiceIdentity
            ? "Generated from the PayPal transaction recorded for this Ficonter subscription."
            : "Payment receipt only. Configure Ficonter legal seller and tax details before using this document as a tax invoice.",
      },
    ];

    const pdf = buildSimplePdf(
      documentTitle,
      lines,
    );

    return new Response(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ficonter-billing-${transactionId}.pdf"`,
        "Cache-Control":
          "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error(
      "FICONTER billing PDF generation failed:",
      error,
    );

    return noStoreJson(
      {
        error:
          "The billing PDF could not be generated right now.",
      },
      { status: 500 },
    );
  }
}
