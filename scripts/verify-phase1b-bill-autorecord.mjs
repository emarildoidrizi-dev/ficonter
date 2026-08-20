import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const migrationPath = path.join(
  repo,
  "supabase",
  "migrations",
  "20260820122500_fix_automatic_payment_cadence.sql",
);

if (!fs.existsSync(migrationPath)) {
  throw new Error("Phase 1B-A migration is missing.");
}

const sql = fs.readFileSync(migrationPath, "utf8");

const required = [
  "ficonter-automatic-payments",
  "'* * * * *'",
  "public.process_automatic_payments()",
  "cron.unschedule",
  "cron.schedule",
];

for (const token of required) {
  if (!sql.includes(token)) {
    throw new Error(`Phase 1B-A migration is missing required token: ${token}`);
  }
}

if (sql.includes("'*/15 * * * *'")) {
  throw new Error("Old 15-minute cron cadence is still present in the Phase 1B-A migration.");
}

console.log("FICONTER PHASE 1B-A BILL AUTO-RECORDING CADENCE VERIFICATION PASSED.");
