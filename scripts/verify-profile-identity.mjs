import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const settings = fs.readFileSync(path.join(root, "components/SettingsWorkspace.tsx"), "utf8");
const sidebar = fs.readFileSync(path.join(root, "components/Sidebar.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "components/SettingsWorkspace.module.css"), "utf8");

const checks = [
  [settings.includes("Full name") && settings.includes("Display name"), "Profile keeps editable full and display names"],
  [settings.includes("Login email") && settings.includes("New email"), "Email change is inside Profile"],
  [settings.includes("supabase.auth.updateUser") && settings.includes("emailRedirectTo"), "Email change uses authenticated confirmation flow"],
  [settings.includes('type: "email_change"') && settings.includes("resendEmailChange"), "Pending email confirmation can be resent"],
  [settings.includes("Pending confirmation") && settings.includes("current email remains active"), "Pending state is explained"],
  [settings.includes("pending_email_change"), "Pending email survives refresh through user metadata"],
  [!settings.includes("Phone number") && !settings.includes("phone_number"), "Phone field is not included"],
  [sidebar.includes("accountEmail") && sidebar.includes("detail.email"), "Sidebar identity updates when email changes"],
  [!sidebar.includes('["/dashboard/inbox", InboxIcon, "Inbox"]'), "Removed duplicate sidebar Inbox link stays removed"],
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
