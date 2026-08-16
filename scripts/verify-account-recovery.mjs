import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (name) => readFileSync(path.join(root, name), "utf8");

const auth = read("components/AuthForm.tsx");
const recovery = read("components/AccountRecoveryForm.tsx");
const update = read("components/UpdatePasswordForm.tsx");
const recoverPage = read("app/recover-account/page.tsx");
const updatePage = read("app/update-password/page.tsx");
const callback = read("app/auth/callback/route.ts");
const confirm = read("app/auth/confirm/route.ts");
const recoveryLink = read("app/auth/recovery/page.tsx");
const recoveryConfirm = read("app/auth/recovery/confirm/route.ts");
const resetTemplate = read("SUPABASE_RESET_PASSWORD_TEMPLATE.html");
const helper = read("lib/auth/recovery.ts");
const css = read("components/AccountRecoveryForm.module.css");

const checks = [
  ["Login clearly identifies email as the FICONTER login", auth.includes("Email address <span") && auth.includes("your FICONTER login")],
  ["Login exposes password recovery", auth.includes('recover-account?mode=password') && auth.includes("Forgot password?")],
  ["Login exposes login-email recovery", auth.includes('recover-account?mode=username') && auth.includes("Forgot email / username?")],
  ["App/brand entry context is preserved into recovery", auth.includes("withAuthEntry") && recoverPage.includes("normalizeAuthEntry")],
  ["Recovery explicitly states there is no separate username", recovery.includes("FICONTER does not use a separate username")],
  ["Password reset uses Supabase resetPasswordForEmail", recovery.includes("resetPasswordForEmail")],
  ["Password recovery redirects to the scanner-safe FICONTER interstitial", recovery.includes('new URL("/auth/recovery"') && !recovery.includes('recoveryUrl.searchParams.set("next"')],
  ["Recovery GET does not consume the one-time token", recoveryLink.includes('form method="post" action="/auth/recovery/confirm"') && !recoveryLink.includes("verifyOtp")],
  ["Recovery token is consumed only by explicit POST", recoveryConfirm.includes("export async function POST") && recoveryConfirm.includes("supabase.auth.verifyOtp") && recoveryConfirm.includes('type: "recovery"')],
  ["Recovery confirmation prevents external next redirects", recoveryConfirm.includes('value.startsWith("//")')],
  ["Generic auth confirm defers recovery GETs to safe interstitial", confirm.includes('if (type === "recovery")') && confirm.includes('new URL("/auth/recovery"')],
  ["Hosted reset template uses canonical recovery URL + TokenHash instead of direct ConfirmationURL", resetTemplate.includes("https://www.ficonter.com/auth/recovery?token_hash={{ .TokenHash }}&type=recovery") && !resetTemplate.includes("{{ .ConfirmationURL }}")],
  ["Password requests use anti-enumeration messaging", recovery.includes("never confirms on this screen whether an email address has") && recovery.includes("If a FICONTER account uses that email")],
  ["Password reset resend cooldown is enforced", recovery.includes("RESEND_COOLDOWN_SECONDS = 60") && recovery.includes("passwordCooldown > 0")],
  ["Rate limiting is handled without account disclosure", recovery.includes("isRateLimited") && recovery.includes("Wait about a minute")],
  ["Phone recovery refuses account creation", recovery.includes("shouldCreateUser: false")],
  ["Phone numbers are normalized and validated as international numbers", recovery.includes("normalizePhone") && recovery.includes("isValidE164")],
  ["Phone recovery responses are generic against enumeration", recovery.includes("If that verified phone number is linked to a FICONTER account")],
  ["SMS verification uses Supabase verifyOtp", recovery.includes("verifyOtp") && recovery.includes('type: "sms"')],
  ["Recovered login is sourced from the verified auth user's email", recovery.includes("data.user?.email") && !recovery.includes("user_metadata?.username")],
  ["Temporary phone recovery signs out locally only", recovery.includes('signOut({ scope: "local" })')],
  ["SMS resend has a cooldown", recovery.includes("phoneCooldown > 0") && recovery.includes("Resend code")],
  ["No-phone fallback offers safe email recovery", recovery.includes("No verified phone linked?") && recovery.includes("Try email recovery")],
  ["Expired and invalid recovery links return to the recovery screen", callback.includes("recoveryFailurePath") && confirm.includes("recoveryFailurePath")],
  ["Auth callback prevents external next redirects", callback.includes('value.startsWith("//")') && confirm.includes('value.startsWith("//")')],
  ["Update-password validates the authenticated recovery user", update.includes("supabase.auth.getUser()")],
  ["Update-password listens for PASSWORD_RECOVERY", update.includes('event === "PASSWORD_RECOVERY"')],
  ["Password update uses Supabase updateUser", update.includes("supabase.auth.updateUser")],
  ["Successful password reset explicitly revokes old sessions", update.includes('scope: "global"') && update.includes("globalSignOutError")],
  ["Failed global revocation falls back to local cleanup", update.includes('signOut({ scope: "local" })')],
  ["Password reset returns to the correct app/web login context", update.includes("withAuthEntry") && updatePage.includes("normalizeAuthEntry")],
  ["Recovery error text is centralized", helper.includes("recoveryErrorMessage") && helper.includes("expired_link") && helper.includes("invalid_link")],
  ["Recovery UI includes status, alternative, and mobile action styling", css.includes(".info") && css.includes(".alternative") && css.includes(".actionRow") && css.includes("@media (max-width: 560px)")],
];

let failures = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failures += 1;
}

if (failures) {
  console.error(`\nAccount recovery verification failed (${failures}/${checks.length}).`);
  process.exit(1);
}

console.log(`\nAccount recovery verification passed (${checks.length}/${checks.length}).`);
