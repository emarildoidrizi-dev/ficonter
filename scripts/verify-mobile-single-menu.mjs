import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const expect = (condition, message) => { if (!condition) throw new Error(message); };

const chrome = read("components/FiconterNativeAppChrome.tsx");
const css = read("components/FiconterNativeAppChrome.module.css");
const dashboardLayout = read("app/dashboard/layout.tsx");
const businessLayout = read("app/business/layout.tsx");

expect(chrome.includes('className={styles.brandMark}'), "Header brand must be non-interactive branding.");
expect(!chrome.includes('ref={menuButtonRef}'), "Legacy top-left menu trigger still exists.");
expect(chrome.includes('ref={moreButtonRef}'), "Bottom More must own the navigation trigger.");
expect(chrome.includes('aria-controls="ficonter-app-drawer"'), "More must control the navigation sheet.");
expect(chrome.includes('onClick={openAccount}'), "Avatar must open the account-only sheet.");
expect(chrome.includes('id="ficonter-account-sheet"'), "Account sheet is missing.");
expect(chrome.includes('href="/dashboard/settings?section=profile"'), "Profile action must open Account preferences directly.");
expect(chrome.includes('End this FICONTER session'), "Log-out action is missing from account sheet.");
expect(!chrome.includes('className={styles.accountPanel}'), "Account controls must not be duplicated inside More.");
expect(chrome.includes('label: "Platform admin"'), "Platform Admin group is missing from More.");
expect(chrome.includes('href: "/dashboard/admin"'), "Personal Admin entry is missing.");
expect(chrome.includes('href: "/dashboard/admin/usage"'), "Admin usage entry is missing.");
expect(chrome.includes('href: "/dashboard/admin/support"'), "Admin support entry is missing.");
expect(chrome.includes('href: "/business/admin"'), "Business Admin entry is missing.");
expect(dashboardLayout.includes('isAdmin={Boolean(admin)}'), "Dashboard layout does not pass admin access to mobile chrome.");
expect(businessLayout.includes('isAdmin={Boolean(admin)}'), "Business layout does not pass admin access to mobile chrome.");
expect(css.includes('.brandMark'), "Brand-only header styling is missing.");
expect(css.includes('.accountSheet'), "Account-only sheet styling is missing.");

console.log("FICONTER mobile single-menu governance: 18 checks passed.");
