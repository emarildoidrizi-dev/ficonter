import fs from "node:fs";

const chrome = fs.readFileSync("components/FiconterNativeAppChrome.tsx", "utf8");
const settings = fs.readFileSync("components/SettingsWorkspace.tsx", "utf8");
const settingsPage = fs.readFileSync("app/dashboard/settings/page.tsx", "utf8");
const profilePage = fs.readFileSync("app/dashboard/profile/page.tsx", "utf8");
const css = fs.readFileSync("components/FiconterNativeAppChrome.module.css", "utf8");

const checks = [
  ["avatar opens profile menu", chrome.includes("onClick={openAccount}")],
  ["profile menu has dedicated dialog", chrome.includes('id="ficonter-account-sheet"')],
  ["profile menu links only to profile editor", chrome.includes('href="/dashboard/profile"')],
  ["profile menu has sign out", chrome.includes('className={styles.accountSheetSignOut}')],
  ["all-sections drawer no longer renders account panel", !chrome.includes('<div className={styles.accountPanel}>')],
  ["dedicated profile route registered", chrome.includes('href: "/dashboard/profile"')],
  ["settings hides profile from its section list", settings.includes('sections.filter((section) => section.id !== "profile")')],
  ["settings defaults to security", settings.includes(': "security";')],
  ["profile-only workspace supported", settings.includes("profileOnly = false")],
  ["settings profile query redirects", settingsPage.includes('redirect("/dashboard/profile")')],
  ["profile page uses profile-only mode", profilePage.includes('profileOnly={true}')],
  ["profile sheet mobile styling exists", css.includes(".accountSheetOpen")],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  for (const [name] of failed) console.error(`FAIL: ${name}`);
  process.exit(1);
}

console.log(`FICONTER profile/settings split: ${checks.length}/${checks.length} checks passed.`);
