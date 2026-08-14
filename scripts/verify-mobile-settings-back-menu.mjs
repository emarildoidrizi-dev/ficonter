import fs from "node:fs";

const chrome = fs.readFileSync("components/FiconterNativeAppChrome.tsx", "utf8");
const settings = fs.readFileSync("components/SettingsWorkspace.tsx", "utf8");

const checks = [
  ["shell listens for Settings-menu reopen event", chrome.includes('window.addEventListener(\n      "ficonter:open-settings-menu"')],
  ["shell reopens quick Settings sheet", chrome.includes("setSettingsOpen(true)")],
  ["shell closes competing account sheet", chrome.includes("setAccountOpen(false)")],
  ["shell closes competing drawer", chrome.includes("setDrawerOpen(false)")],
  ["detail back dispatches menu reopen event", settings.includes('window.dispatchEvent(new CustomEvent("ficonter:open-settings-menu"))')],
  ["detail back does not retire detail into blank index", !settings.match(/function closeSettingsSection\(\)[\s\S]{0,220}setSectionDetailOpen\(false\)/)],
];

let passed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (ok) passed += 1;
}
console.log(`\n${passed}/${checks.length} checks passed.`);
if (passed !== checks.length) process.exit(1);
