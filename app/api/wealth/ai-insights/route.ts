import { NextRequest, NextResponse } from "next/server";
import {
  AI_INSIGHT_DOMAINS,
  AI_INSIGHT_EVIDENCE_KEYS,
  AI_INSIGHT_HORIZONS,
  AI_INSIGHT_POSITIONS,
  AI_INSIGHT_PRIORITIES,
  AI_INSIGHTS_CACHE_HOURS,
  AI_INSIGHTS_CONSENT_VERSION,
  calculateAiInsightsContext,
  normalizeAiInsightReport,
  normalizeAiInsightSnapshot,
  normalizeAiInsightsInputs,
} from "@/lib/wealth/aiInsights";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
const GENERATION_COOLDOWN_MS = 2 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 45_000;

const reportSchema = {
  type: "object",
  properties: {
    schemaVersion: { type: "integer", enum: [1] },
    headline: { type: "string", minLength: 1, maxLength: 140 },
    summary: { type: "string", minLength: 1, maxLength: 620 },
    position: { type: "string", enum: [...AI_INSIGHT_POSITIONS] },
    priorities: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: insightItemSchema(),
    },
    opportunities: {
      type: "array",
      maxItems: 3,
      items: insightItemSchema(),
    },
    watchlist: {
      type: "array",
      maxItems: 3,
      items: insightItemSchema(),
    },
    actionPlan: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          order: { type: "integer", minimum: 1, maximum: 9 },
          horizon: { type: "string", enum: [...AI_INSIGHT_HORIZONS] },
          title: { type: "string", minLength: 1, maxLength: 110 },
          action: { type: "string", minLength: 1, maxLength: 280 },
          evidenceKeys: evidenceKeysSchema(),
        },
        required: ["order", "horizon", "title", "action", "evidenceKeys"],
        additionalProperties: false,
      },
    },
    dataLimitations: {
      type: "array",
      maxItems: 5,
      items: { type: "string", minLength: 1, maxLength: 220 },
    },
    disclaimer: { type: "string", minLength: 1, maxLength: 300 },
  },
  required: [
    "schemaVersion",
    "headline",
    "summary",
    "position",
    "priorities",
    "opportunities",
    "watchlist",
    "actionPlan",
    "dataLimitations",
    "disclaimer",
  ],
  additionalProperties: false,
} as const;

function evidenceKeysSchema() {
  return {
    type: "array",
    maxItems: 4,
    items: { type: "string", enum: [...AI_INSIGHT_EVIDENCE_KEYS] },
  } as const;
}

function insightItemSchema() {
  return {
    type: "object",
    properties: {
      domain: { type: "string", enum: [...AI_INSIGHT_DOMAINS] },
      priority: { type: "string", enum: [...AI_INSIGHT_PRIORITIES] },
      title: { type: "string", minLength: 1, maxLength: 110 },
      insight: { type: "string", minLength: 1, maxLength: 360 },
      action: { type: "string", minLength: 1, maxLength: 260 },
      evidenceKeys: evidenceKeysSchema(),
    },
    required: [
      "domain",
      "priority",
      "title",
      "insight",
      "action",
      "evidenceKeys",
    ],
    additionalProperties: false,
  } as const;
}

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { error: message, ...extra },
    { status, headers: noStoreHeaders() },
  );
}

function outputText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const root = value as Record<string, unknown>;
  if (typeof root.output_text === "string") return root.output_text;
  if (!Array.isArray(root.output)) return "";

  for (const item of root.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const row = part as Record<string, unknown>;
      if (row.type === "output_text" && typeof row.text === "string") {
        return row.text;
      }
    }
  }

  return "";
}

function ageMilliseconds(value: string): number {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? Math.max(0, Date.now() - timestamp) : Infinity;
}

async function loadInputsAndUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { supabase, user: null, inputs: null, context: null, error: "Not authenticated." };
  }

  const { data, error } = await supabase.rpc("get_ai_insights_inputs");
  if (error) {
    return {
      supabase,
      user,
      inputs: null,
      context: null,
      error: "AI insight data could not be prepared.",
    };
  }

  const inputs = normalizeAiInsightsInputs(data);
  return {
    supabase,
    user,
    inputs,
    context: calculateAiInsightsContext(inputs),
    error: "",
  };
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return jsonError("Invalid request origin.", 403);
  }

  const state = await loadInputsAndUser();
  if (!state.user) return jsonError(state.error, 401);
  if (!state.inputs || !state.context) return jsonError(state.error, 503);

  const { supabase, user, inputs, context } = state;

  if (
    !inputs.preferences.enabled ||
    inputs.preferences.consentVersion !== AI_INSIGHTS_CONSENT_VERSION ||
    !inputs.preferences.consentedAt
  ) {
    return jsonError("Enable private AI Insights before generating a report.", 403, {
      code: "consent_required",
    });
  }

  if (!context.assessed || context.dataCoverage <= 0) {
    return jsonError(
      "Add financial records before generating AI insights.",
      409,
      { code: "not_enough_data" },
    );
  }

  const { data: matchingRows } = await supabase
    .from("ai_insight_snapshots")
    .select("id, data_fingerprint, report, model, data_coverage, generated_at")
    .eq("user_id", user.id)
    .eq("data_fingerprint", context.fingerprint)
    .order("generated_at", { ascending: false })
    .limit(1);

  const cached = normalizeAiInsightSnapshot(matchingRows?.[0]);
  if (
    cached &&
    ageMilliseconds(cached.generatedAt) < AI_INSIGHTS_CACHE_HOURS * 60 * 60 * 1000
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
    .order("generated_at", { ascending: false })
    .limit(1);

  const latestGeneratedAt = latestRows?.[0]?.generated_at;
  if (
    typeof latestGeneratedAt === "string" &&
    ageMilliseconds(latestGeneratedAt) < GENERATION_COOLDOWN_MS
  ) {
    const retryAfter = Math.max(
      1,
      Math.ceil((GENERATION_COOLDOWN_MS - ageMilliseconds(latestGeneratedAt)) / 1000),
    );
    return jsonError("Please wait before generating another report.", 429, {
      retryAfter,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return jsonError("AI Insights is not configured yet.", 503, {
      code: "configuration_required",
    });
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.6-luna";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 2400,
        instructions:
          "You are FICONTER AI Insights, a careful financial-planning explainer. " +
          "Use only the aggregate metrics supplied. Never invent facts, balances, dates, forecasts, or causes. " +
          "Do not recalculate FICONTER scores. Do not recommend specific securities, loans, tax strategies, legal actions, or guaranteed outcomes. " +
          "Do not repeat exact financial amounts inside generated prose; choose evidenceKeys so the application can display verified values from its own source of truth. " +
          "Prioritize practical cash-flow resilience, debt reduction, emergency reserves, savings consistency, goal alignment, and long-term financial independence. " +
          "If data is incomplete, say so clearly. Keep the tone calm, premium, concise, and non-judgmental. " +
          "The disclaimer must state that the report is planning guidance, not individualized investment, tax, legal, or credit advice.",
        input:
          "Create a private FICONTER financial insight report from this aggregate data. " +
          "No user identity, raw transaction descriptions, or vendor-level records are included.\n\n" +
          JSON.stringify(context.promptPayload),
        text: {
          format: {
            type: "json_schema",
            name: "ficonter_ai_insight_report",
            strict: true,
            schema: reportSchema,
          },
        },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const responseBody = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      const detail =
        responseBody && typeof responseBody === "object"
          ? (responseBody as Record<string, unknown>).error
          : null;
      console.error("OpenAI insight generation failed", {
        userId: user.id,
        status: response.status,
        detail,
      });
      return jsonError("AI Insights could not generate a report right now.", 502);
    }

    const serialized = outputText(responseBody);
    if (!serialized) {
      console.error("OpenAI insight response contained no output text", {
        userId: user.id,
        model,
      });
      return jsonError("AI Insights returned an incomplete report.", 502);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized);
    } catch {
      console.error("OpenAI insight response was not valid JSON", {
        userId: user.id,
        model,
      });
      return jsonError("AI Insights returned an invalid report.", 502);
    }

    const report = normalizeAiInsightReport(parsed);
    if (!report) {
      console.error("OpenAI insight report failed application validation", {
        userId: user.id,
        model,
      });
      return jsonError("AI Insights returned an incomplete report.", 502);
    }

    const { data: inserted, error: insertError } = await supabase
      .from("ai_insight_snapshots")
      .insert({
        user_id: user.id,
        data_fingerprint: context.fingerprint,
        report,
        model,
        data_coverage: context.dataCoverage,
      })
      .select("id, data_fingerprint, report, model, data_coverage, generated_at")
      .single();

    if (insertError) {
      console.error("AI insight snapshot could not be saved", {
        userId: user.id,
        message: insertError.message,
      });
      return jsonError("The AI report was generated but could not be saved.", 500);
    }

    const snapshot = normalizeAiInsightSnapshot(inserted);
    if (!snapshot) {
      return jsonError("The AI report could not be prepared for display.", 500);
    }

    const { data: olderRows } = await supabase
      .from("ai_insight_snapshots")
      .select("id")
      .eq("user_id", user.id)
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
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    console.error("AI insight generation request failed", {
      userId: user.id,
      timedOut,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return jsonError(
      timedOut
        ? "AI Insights took too long to respond. Try again shortly."
        : "AI Insights is temporarily unavailable.",
      503,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function DELETE(request: NextRequest) {
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
    console.error("AI insight history deletion failed", {
      userId: user.id,
      message: error.message,
    });
    return jsonError("AI insight history could not be cleared.", 500);
  }

  return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
}
