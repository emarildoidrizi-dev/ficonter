import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (name) => readFileSync(path.join(root, name), "utf8");

const request = read("components/AccountRecoveryForm.tsx");
const page = read("app/auth/recovery/page.tsx");
const confirm = read("app/auth/recovery/confirm/route.ts");
const genericConfirm = read("app/auth/confirm/route.ts");
const template = read("SUPABASE_RESET_PASSWORD_TEMPLATE.html");

const checks = [
  ["Reset request targets FICONTER recovery interstitial", request.includes('new URL("/auth/recovery"')],
  ["Interstitial defaults safely to update-password without redirect query", !request.includes('recoveryUrl.searchParams.set("next"') && page.includes('fallback = "/update-password"')],
  ["Interstitial is GET-safe and has no verifyOtp call", !page.includes("verifyOtp")],
  ["User confirmation is an explicit POST", page.includes('method="post" action="/auth/recovery/confirm"')],
  ["Token hash is submitted only after confirmation", page.includes('name="token_hash"')],
  ["POST route validates same-origin relative destination", confirm.includes('value.startsWith("//")')],
  ["POST route accepts recovery only", confirm.includes('type !== "recovery"')],
  ["POST route verifies token hash", confirm.includes("supabase.auth.verifyOtp") && confirm.includes("token_hash: tokenHash")],
  ["POST route redirects with 303", confirm.includes(", 303)")],
  ["Existing token confirm never consumes recovery token on GET", genericConfirm.includes('if (type === "recovery")')],
  ["Email template uses canonical FICONTER recovery route", template.includes("https://www.ficonter.com/auth/recovery?token_hash={{ .TokenHash }}&type=recovery")],
  ["Email template uses TokenHash", template.includes("{{ .TokenHash }}")],
  ["Email template explicitly marks recovery type", template.includes("type=recovery")],
  ["Email template does not use ConfirmationURL", !template.includes("{{ .ConfirmationURL }}")],
];

let failures = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failures += 1;
}

if (failures) {
  console.error(`\nPassword recovery link verification failed (${failures}/${checks.length}).`);
  process.exit(1);
}

console.log(`\nPassword recovery link verification passed (${checks.length}/${checks.length}).`);
