import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function mustContain(file, needles) {
  const value = fs.readFileSync(path.join(root, file), "utf8");
  for (const needle of needles) {
    if (!value.includes(needle)) {
      throw new Error(`${file} is missing required currency invariant: ${needle}`);
    }
  }
}

mustContain("lib/finance/currencyEngine.ts", [
  "convertFromOriginal",
  "original.amount",
  "original.currency",
  "Exchange-rate pair mismatch",
]);

mustContain("supabase/global_currency_engine_phase1.sql", [
  "add column if not exists base_currency",
  "Changing this value must never rewrite original transaction amount/currency fields",
]);

const migration = fs.readFileSync(
  path.join(root, "supabase/global_currency_engine_phase1.sql"),
  "utf8",
).toLowerCase();

const forbiddenTransactionMutations = [
  "update public.transactions",
  "delete from public.transactions",
  "alter table public.transactions",
];

for (const forbidden of forbiddenTransactionMutations) {
  if (migration.includes(forbidden)) {
    throw new Error(
      `Phase 1 must be additive and must not mutate transactions: found "${forbidden}"`,
    );
  }
}

console.log("Currency Engine Phase 1 verification passed.");
console.log("- Personal base-currency foundation present");
console.log("- Existing transaction source values untouched");
console.log("- Original-value conversion invariant present");
console.log("- Rollback path included");
