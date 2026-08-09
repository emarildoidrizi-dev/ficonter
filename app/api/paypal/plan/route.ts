import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

export async function POST(request: Request) {
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

    const body = (await request.json()) as {
      planCode?: unknown;
      billingInterval?: unknown;
    };

    if (!isPaidPlan(body.planCode) || !isPaidInterval(body.billingInterval)) {
      return NextResponse.json(
        { error: "Invalid subscription plan." },
        { status: 400 },
      );
    }

    const environmentVariable =
      PAYPAL_PLAN_ENV[body.planCode][body.billingInterval];

    const planId = process.env[environmentVariable]?.trim();

    if (!planId) {
      return NextResponse.json(
        { error: "PayPal plan is not configured." },
        { status: 500 },
      );
    }

    return NextResponse.json({ planId });
  } catch {
    return NextResponse.json(
      { error: "Unable to prepare PayPal checkout." },
      { status: 500 },
    );
  }
}
