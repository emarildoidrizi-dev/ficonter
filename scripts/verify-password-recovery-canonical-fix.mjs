import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const request = read("components/AccountRecoveryForm.tsx");
const landing = read("app/page.tsx");
const template = read("SUPABASE_RESET_PASSWORD_TEMPLATE.html");

const checks = [
  ["Hosted reset request uses canonical production origin", request.includes('"https://www.ficonter.com"')],
  ["Hosted reset request targets /auth/recovery", request.includes('new URL("/auth/recovery", recoveryOrigin)')],
  ["Local development can keep local origin", request.includes('isLocal') && request.includes('window.location.origin')],
  ["Email template hardcodes canonical recovery route", template.includes('https://www.ficonter.com/auth/recovery?token_hash={{ .TokenHash }}&type=recovery')],
  ["Email template no longer relies on RedirectTo", !template.includes('{{ .RedirectTo }}')],
  ["Landing page catches recovery tokens", landing.includes('params.token_hash && params.type === "recovery"')],
  ["Landing safety net redirects to scanner-safe route", landing.includes('redirect(`/auth/recovery?${recoveryParams.toString()}`)')],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed += 1;
}

if (failed) process.exit(1);
console.log(`\n${checks.length}/${checks.length} canonical recovery checks passed.`);
