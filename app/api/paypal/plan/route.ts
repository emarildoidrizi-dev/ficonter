import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

import { isSameOriginRequest, noStoreJson } from "@/lib/security/request";
const PAYPAL_PLAN_ENV = {
  personal_pro: {
    monthly: "PAYPAL_PLAN_PERSONAL_MONTHLY",
    annual: "PAYPAL_PLAN_PERSONAL_ANNUAL",
  },
  business_pro: {
    monthly: "PAYPAL_PLAN_BUSINESS_MONTHLY",
    annual: "PAYPAL_PLAN_BUSINESS_ANNUAL",
  },
} as const;

type PaidPlan = keyof typeof PAYPAL_PLAN_ENV;
type PaidInterval = "monthly" | "annual";

function isPaidPlan(value: unknown): value is PaidPlan {
  return value === "personal_pro" || value === "business_pro";
}

function isPaidInterval(value: unknown): value is PaidInterval {
  return value === "monthly" || value === "annual";
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
      planCode?: unknown;
      billingInterval?: unknown;
    };

    if (!isPaidPlan(body.planCode) || !isPaidInterval(body.billingInterval)) {
      return noStoreJson(
        { error: "Invalid subscription plan." },
        { status: 400 },
      );
    }

    const environmentVariable =
      PAYPAL_PLAN_ENV[body.planCode][body.billingInterval];

    const planId = process.env[environmentVariable]?.trim();

    if (!planId) {
      return noStoreJson(
        { error: "PayPal plan is not configured." },
        { status: 500 },
      );
    }

    return noStoreJson({ planId });
  } catch {
    return noStoreJson(
      { error: "Unable to prepare PayPal checkout." },
      { status: 500 },
    );
  }
}
