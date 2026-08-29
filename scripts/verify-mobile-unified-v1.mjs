import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const layout = read("app/layout.tsx");
const css = read("app/mobile-unified-v1.css");
const chrome = read("components/FiconterNativeAppChrome.tsx");
const transactionsPage = read("app/dashboard/transactions/page.tsx");
const encryptedTransactions = read("components/EncryptedTransactionsWorkspace.tsx");

expect(layout.includes('import "./mobile-unified-v1.css";'), "Unified mobile stylesheet is not loaded.");
expect(layout.indexOf("mobile-unified-v1.css") > layout.indexOf("mobile-shell-v2.css"), "Unified stylesheet must load last.");
expect(css.includes('--fui-accent: #15564e'), "Unified visual tokens are missing.");
expect(css.includes('CoastalOverview_availableAmount'), "Overview treatment is missing.");
expect(css.includes('TransactionLedger_row'), "Transaction density treatment is missing.");
expect(css.includes('MonthlyPlanner_monthlyBudgetCard'), "Planner treatment is missing.");
expect(css.includes('SettingsWorkspace_navigation'), "Settings treatment is missing.");
expect(css.includes('BusinessOverview_shell'), "Business treatment is missing.");
expect(chrome.includes('href: "/dashboard/overview"'), "Overview route must point directly to /dashboard/overview.");
expect(chrome.includes('label: "Transactions"'), "Transactions bottom-nav label is missing.");
expect(chrome.includes('label: "Planner"'), "Planner bottom-nav label is missing.");
expect(chrome.includes('href: "/dashboard/settings?section=profile"'), "Profile must open Account preferences directly from More.");
expect(chrome.includes('avatarPath?: string'), "Header avatar support is missing.");
expect(
  transactionsPage.includes("EncryptedTransactionsWorkspace") && encryptedTransactions.includes("MobileTransactionsLayout"),
  "Transactions split view must remain reachable through the encrypted workspace.",
);
expect(exists("components/MobileTransactionsLayout.tsx"), "Transactions split component is missing.");
expect(exists("app/dashboard/profile/page.tsx") && read("app/dashboard/profile/page.tsx").includes("permanentRedirect"), "Legacy Profile route must remain only as a compatibility redirect.");
expect(!read("components/FiconterNativeAppChrome.tsx").includes("profileOnly"), "Obsolete profileOnly prop must not return.");

console.log("FICONTER unified mobile UI V1: 17 consolidation checks passed.");
