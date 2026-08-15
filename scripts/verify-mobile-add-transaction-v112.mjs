import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const chrome = read('components/FiconterNativeAppChrome.tsx');
const personalPage = read('app/dashboard/transactions/page.tsx');
const entry = read('components/EffortlessEntryWorkspace.tsx');
const businessPage = read('app/business/transactions/page.tsx');
const businessLedger = read('components/BusinessTransactionLedger.tsx');

const checks = [
  ['plus is labelled Add transaction', chrome.includes('aria-label="Add transaction"')],
  ['personal transaction target is defined', chrome.includes('"/dashboard/transactions"')],
  ['business transaction target is defined', chrome.includes('"/business/transactions"')],
  ['plus target is always add=1', chrome.includes('const addHref = `${transactionsHref}?add=1`;')],
  ['same transactions page uses direct add event without a page reload', chrome.includes('if (pathname === transactionsHref)') && chrome.includes('window.dispatchEvent(new Event(quickAddEventName))')],
  ['same page query is updated with replace rather than refresh', chrome.includes('router.replace(addHref, { scroll: false })')],
  ['cross-page plus navigation goes to add route', chrome.includes('router.push(addHref, { scroll: false })')],
  ['personal route reads add query', personalPage.includes('const directAdd = addValue === "1";')],
  ['personal route opens add view directly', personalPage.includes('initialView={directAdd || setupValue ? "add" : "ledger"}')],
  ['personal entry receives directAdd', personalPage.includes('directAdd={directAdd}')],
  ['direct add forces simple transaction entry', entry.includes('directAdd ? "simple" : "guided"')],
  ['direct add focuses amount field', entry.includes('amountInput?.focus({ preventScroll: true })')],
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
