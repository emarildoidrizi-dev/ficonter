import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
let passed = 0;

function read(relative) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    failures.push(`Missing ${relative}`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function check(name, condition) {
  if (condition) {
    passed += 1;
  } else {
    failures.push(name);
  }
}

const required = [
  "app/dashboard/insights/page.tsx",
  "app/api/wealth/ai-insights/route.ts",
  "components/AiInsights.tsx",
  "components/AiInsights.module.css",
  "lib/wealth/aiInsights.ts",
  "supabase/phase2_ai_insights.sql",
];

for (const file of required) check(`Required file exists: ${file}`, fs.existsSync(path.join(root, file)));

const route = read("app/api/wealth/ai-insights/route.ts");
const engine = read("lib/wealth/aiInsights.ts");
const component = read("components/AiInsights.tsx");
const sql = read("supabase/phase2_ai_insights.sql");
const sidebar = read("components/Sidebar.tsx");
const page = read("app/dashboard/insights/page.tsx");
const pkg = JSON.parse(read("package.json") || "{}");

check("AI route requires same-origin requests", route.includes("isSameOriginRequest"));
check("AI route authenticates the user", route.includes("supabase.auth.getUser"));
check("AI key remains server-only", route.includes("process.env.OPENAI_API_KEY") && !route.includes("NEXT_PUBLIC_OPENAI"));
check("Responses API storage is disabled", route.includes("store: false"));
check("Responses API uses structured output", route.includes('type: "json_schema"') && route.includes("strict: true"));
check("AI route caches reports by fingerprint", route.includes("data_fingerprint") && route.includes("AI_INSIGHTS_CACHE_HOURS"));
check("AI route rate-limits generation", route.includes("GENERATION_COOLDOWN_MS") && route.includes(", 429"));
check("AI route supports private history deletion", route.includes("export async function DELETE"));
check("No raw transaction table query in AI route", !route.includes('.from("transactions")'));
check("AI prompt explicitly excludes raw identity and ledger records", route.includes("No user identity") && route.includes("raw transaction descriptions"));
check("AI consent discloses temporary provider handling", component.includes("temporarily retain API request data") && component.includes("provider&apos;s API data policy"));
check("AI engine composes existing Cash Flow source", engine.includes("calculateCashFlowIntelligence"));
check("AI engine composes existing Financial Independence source", engine.includes("calculateFinancialIndependence"));
check("AI engine reuses existing Wealth Score", engine.includes("calculateWealthScore"));
check("AI engine creates verified evidence keys", engine.includes("AiEvidenceKey") && engine.includes("evidenceKeysOnly"));
check("AI empty accounts remain unassessed", component.includes("AI insights are not assessed yet") && engine.includes("const assessed"));
check("AI generation is explicitly on demand", component.includes("No automatic AI requests") && component.includes("Generate private report"));
check("AI consent is explicit and versioned", component.includes("AI_INSIGHTS_CONSENT_VERSION") && sql.includes("consent_version"));
check("AI preferences are protected by RLS", sql.includes("alter table public.ai_insight_preferences enable row level security"));
check("AI snapshots are protected by RLS", sql.includes("alter table public.ai_insight_snapshots enable row level security"));
check("AI aggregate function reuses existing Phase 2 RPCs", sql.includes("get_cash_flow_intelligence_inputs") && sql.includes("get_financial_independence_inputs"));
check("AI aggregate function is authenticated only", sql.includes("grant execute on function public.get_ai_insights_inputs() to authenticated"));
check("AI page is authenticated", page.includes('redirect("/login")'));
check("AI page loads latest private snapshot", page.includes("ai_insight_snapshots") && page.includes("user.id"));
check("Sidebar exposes AI Insights", sidebar.includes('"/dashboard/insights"') && sidebar.includes('"AI insights"'));
check("AI component refreshes on financial realtime changes", component.includes("postgres_changes") && component.includes("ficonter:data-changed"));
check("AI report displays deterministic evidence values", component.includes("evidenceValue") && component.includes("EvidenceChips"));
check("AI report includes a 90-day action plan", component.includes("90-DAY ACTION PLAN"));
check("AI report includes privacy controls", component.includes("Disable AI") && component.includes("Clear report history"));
check("Verification script is registered", pkg.scripts?.["verify:phase2-ai"] === "node scripts/verify-phase2-ai-insights.mjs");

if (failures.length) {
  console.error(`Phase 2 AI Insights verification failed (${failures.length} issues):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Phase 2 AI Insights verification passed (${passed} checks).`);
