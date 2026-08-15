import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const chrome = read('components/FiconterNativeAppChrome.tsx');
const personalPage = read('app/dashboard/transactions/page.tsx');
const entry = read('components/EffortlessEntryWorkspace.tsx');
const businessPage = read('app/business/transactions/page.tsx');
const businessLedger = read('components/BusinessTransactionLedger.tsx');

const checks = [
  ['plus is labelled Add transaction', chrome.includes('aria-label="Add transaction"')],
  ['personal plus target is dedicated add route', chrome.includes('"/dashboard/transactions?add=1"')],
  ['business plus target is dedicated add route', chrome.includes('"/business/transactions?add=1"')],
  ['plus no longer dispatches quick-add event', !chrome.includes('new CustomEvent("ficonter:quick-add-transaction")')],
  ['plus no longer routes with #quick-add', !chrome.includes('`${addHref}#quick-add`')],
  ['same dedicated target does not replay navigation', chrome.includes('if (currentHref === addHref) return;')],
  ['personal route reads add query', personalPage.includes('const directAdd = addValue === "1";')],
  ['personal route opens add view directly', personalPage.includes('initialView={directAdd || setupValue ? "add" : "ledger"}')],
  ['personal entry receives directAdd', personalPage.includes('directAdd={directAdd}')],
  ['direct add forces simple transaction entry', entry.includes('directAdd ? "simple" : "guided"')],
  ['business route reads add query', businessPage.includes('const directAdd = addValue === "1";')],
  ['business ledger opens form from plus route', businessLedger.includes('useState(initialAdd)')],
];

let passed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}`);
  if (ok) passed += 1;
}
console.log(`\n${passed}/${checks.length} checks passed.`);
if (passed !== checks.length) process.exit(1);
