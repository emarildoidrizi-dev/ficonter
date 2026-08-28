import { NextRequest, NextResponse } from "next/server";
import {
  AI_INSIGHTS_CACHE_HOURS,
  SMART_INSIGHTS_ENGINE_VERSION,
  calculateAiInsightsContext,
  generateSmartInsightReport,
  normalizeAiInsightReport,
  normalizeAiInsightSnapshot,
  normalizeAiInsightsInputs,
} from "@/lib/wealth/aiInsights";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";

import { subscriptionApiAccessError } from "@/lib/subscriptionApiAccess";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERATION_COOLDOWN_MS = 5_000;

function jsonError(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    { error: message, ...extra },
    { status, headers: noStoreHeaders() },
  );
}

function ageMilliseconds(value: string): number {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp)
    ? Math.max(0, Date.now() - timestamp)
    : Number.POSITIVE_INFINITY;
}

async function loadInputsAndUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase,
      user: null,
      context: null,
      error: "Not authenticated.",
    };
  }

  const { data, error } = await supabase.rpc("get_ai_insights_inputs");
  if (error) {
    return {
      supabase,
      user,
      context: null,
      error: "Smart insight data could not be prepared.",
    };
  }

  const inputs = normalizeAiInsightsInputs(data);
  return {
    supabase,
    user,
    context: calculateAiInsightsContext(inputs),
    error: "",
  };
}

export async function POST(request: NextRequest) {
  const subscriptionAccessError = await subscriptionApiAccessError("smart_insights");
  if (subscriptionAccessError) return subscriptionAccessError;
  if (!isSameOriginRequest(request)) {
    return jsonError("Invalid request origin.", 403);
  }

  const state = await loadInputsAndUser();
  if (!state.user) return jsonError(state.error, 401);
  if (!state.context) return jsonError(state.error, 503);

  const { supabase, user, context } = state;

  if (!context.assessed || context.dataCoverage <= 0) {
    return jsonError(
      "Add financial records before generating Smart Insights.",
      409,
      { code: "not_enough_data" },
    );
  }

  const { data: matchingRows } = await supabase
    .from("ai_insight_snapshots")
    .select("id, data_fingerprint, report, model, data_coverage, generated_at")
    .eq("user_id", user.id)
    .eq("data_fingerprint", context.fingerprint)
    .eq("model", SMART_INSIGHTS_ENGINE_VERSION)
    .order("generated_at", { ascending: false })
    .limit(1);

  const cached = normalizeAiInsightSnapshot(matchingRows?.[0]);
  if (
    cached &&
    ageMilliseconds(cached.generatedAt) <
      AI_INSIGHTS_CACHE_HOURS * 60 * 60 * 1000
  ) {
    return NextResponse.json(
      { ok: true, cached: true, snapshot: cached },
      { headers: noStoreHeaders() },
    );
  }

  const { data: latestRows } = await supabase
    .from("ai_insight_snapshots")
    .select("generated_at")
    .eq("user_id", user.id)
    .eq("model", SMART_INSIGHTS_ENGINE_VERSION)
    .order("generated_at", { ascending: false })
    .limit(1);

  const latestGeneratedAt = latestRows?.[0]?.generated_at;
  if (
    typeof latestGeneratedAt === "string" &&
    ageMilliseconds(latestGeneratedAt) < GENERATION_COOLDOWN_MS
  ) {
    const retryAfter = Math.max(
      1,
      Math.ceil(
        (GENERATION_COOLDOWN_MS - ageMilliseconds(latestGeneratedAt)) / 1000,
      ),
    );
    return jsonError("Please wait before generating another report.", 429, {
      retryAfter,
    });
  }

  const report = normalizeAiInsightReport(
    generateSmartInsightReport(context),
  );
  if (!report) {
    console.error("Smart insight report failed application validation", {
      userId: user.id,
      fingerprint: context.fingerprint,
    });
    return jsonError("Smart Insights could not prepare a valid report.", 500);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("ai_insight_snapshots")
    .insert({
      user_id: user.id,
      data_fingerprint: context.fingerprint,
      report,
      model: SMART_INSIGHTS_ENGINE_VERSION,
      data_coverage: context.dataCoverage,
    })
    .select("id, data_fingerprint, report, model, data_coverage, generated_at")
    .single();

  if (insertError) {
    console.error("Smart insight snapshot could not be saved", {
      userId: user.id,
      message: insertError.message,
    });
    return jsonError("The Smart Insight report could not be saved.", 500);
  }

  const snapshot = normalizeAiInsightSnapshot(inserted);
  if (!snapshot) {
    return jsonError("The Smart Insight report could not be displayed.", 500);
  }

  const { data: olderRows } = await supabase
    .from("ai_insight_snapshots")
    .select("id")
    .eq("user_id", user.id)
    .eq("model", SMART_INSIGHTS_ENGINE_VERSION)
    .order("generated_at", { ascending: false })
    .range(12, 200);

  const olderIds = ((olderRows ?? []) as Array<{ id?: unknown }>)
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string");

  if (olderIds.length) {
    await supabase
      .from("ai_insight_snapshots")
      .delete()
      .eq("user_id", user.id)
      .in("id", olderIds);
  }

  return NextResponse.json(
    { ok: true, cached: false, snapshot },
    { headers: noStoreHeaders() },
  );
}

export async function DELETE(request: NextRequest) {
  const subscriptionAccessError = await subscriptionApiAccessError("smart_insights");
  if (subscriptionAccessError) return subscriptionAccessError;
  if (!isSameOriginRequest(request)) {
    return jsonError("Invalid request origin.", 403);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return jsonError("Not authenticated.", 401);

  const { error } = await supabase
    .from("ai_insight_snapshots")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    console.error("Smart insight history deletion failed", {
      userId: user.id,
      message: error.message,
    });
    return jsonError("Smart Insight history could not be cleared.", 500);
  }

  return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
}
