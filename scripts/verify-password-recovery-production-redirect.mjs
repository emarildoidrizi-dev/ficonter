import fs from "node:fs";

const form = fs.readFileSync("components/AccountRecoveryForm.tsx", "utf8");
const page = fs.readFileSync("app/auth/recovery/page.tsx", "utf8");
const template = fs.readFileSync("SUPABASE_RESET_PASSWORD_TEMPLATE.html", "utf8");

const checks = [
  ["reset request targets /auth/recovery", form.includes('new URL("/auth/recovery", recoveryOrigin)')],
  ["reset redirectTo stays query-free", !form.includes('recoveryUrl.searchParams.set("next"')],
  ["recovery page defaults to /update-password", page.includes('fallback = "/update-password"')],
  ["email uses canonical production recovery URL", template.includes('https://www.ficonter.com/auth/recovery?token_hash={{ .TokenHash }}&type=recovery')],
  ["email does not use direct ConfirmationURL", !template.includes('{{ .ConfirmationURL }}')],
  ["current FICONTER email emblem is used", template.includes('email-assets/ficonter-email-emblem.png')],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`\n${failed}/${checks.length} password recovery production redirect checks failed.`);
  process.exit(1);
}

console.log(`\n${checks.length}/${checks.length} password recovery production redirect checks passed.`);
