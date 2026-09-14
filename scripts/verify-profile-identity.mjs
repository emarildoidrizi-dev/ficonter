import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const profile = read("components/ProfileWorkspace.tsx");
const profilePage = read("app/dashboard/profile/page.tsx");
const settingsPage = read("app/dashboard/settings/page.tsx");
const sidebar = read("components/Sidebar.tsx");
const css = read("components/SettingsWorkspace.module.css");
const callback = read("app/auth/callback/route.ts");
const login = read("app/login/page.tsx");
const resultNotice = read("components/EmailChangeResultNotice.tsx");

const checks = [
  [profilePage.includes("<ProfileWorkspace") && profilePage.includes("<ProfileIdentityDetailsForm"), "Profile is a dedicated editable workspace"],
  [profile.includes("Full name") && profile.includes("Display name"), "Profile keeps editable names"],
  [profile.includes("Login email") && profile.includes("New email"), "Email change belongs to Profile"],
  [profile.includes("supabase.auth.updateUser") && profile.includes("emailRedirectTo"), "Email change uses authenticated confirmation"],
  [profile.includes('type: "email_change"') && profile.includes("resendEmailChange"), "Pending email confirmation can be resent"],
  [profile.includes("Pending confirmation") && profile.includes("current email remains active"), "Pending email state is explained"],
  [profile.includes("pending_email_change"), "Pending email survives refresh"],
  [profile.includes('encodeURIComponent("/dashboard/profile")'), "Email confirmation returns to Profile"],
  [settingsPage.includes('if (section === "profile")') && settingsPage.includes('redirect("/dashboard/profile")'), "Settings Profile compatibility URL redirects to Profile"],
  [callback.includes("isEmailChangeReturn") && callback.includes('email_change", status'), "Email-change callback has a dedicated completion path"],
  [callback.includes("if (!code)") && callback.includes("if (emailChangeReturn)"), "Email-change callback handles no-code returns"],
  [callback.includes('emailChangeReturnPath(next, "error")'), "Email-change errors stay in the Profile flow"],
  [login.includes("EmailChangeResultNotice"), "Login renders email confirmation guidance"],
  [resultNotice.includes("otp_expired") && resultNotice.includes("Resend link"), "Expired email-change links explain recovery"],
  [!profile.includes("Phone number") && !profile.includes("phone_number"), "Phone field is not included"],
  [sidebar.includes("accountEmail") && sidebar.includes("detail.email"), "Sidebar identity updates when email changes"],
  [!sidebar.includes('["/dashboard/inbox", InboxIcon, "Inbox"]'), "Duplicate sidebar Inbox stays removed"],
  [sidebar.includes('["/dashboard/documents", FileArchive, "Documents"]'), "Documents navigation stays intact"],
  [css.includes(".pendingEmailCard") && css.includes(".emailSecurityNote"), "Pending email UI is styled"],
];

let failed = false;
for (const [ok, label] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log(`PASS ${checks.length} profile identity checks`);
