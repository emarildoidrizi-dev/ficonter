import fs from 'node:fs';

const settings = fs.readFileSync('components/SettingsWorkspace.tsx', 'utf8');
const sidebar = fs.readFileSync('components/Sidebar.tsx', 'utf8');
const stack = fs.readFileSync('app/mobile-page-stack.css', 'utf8');

const checks = [
  ['Settings reads client search params', settings.includes('useSearchParams')],
  ['Phone Settings switches active content immediately', settings.includes('setActive(id);') && settings.includes('setMobileDetailOpen(true);')],
  ['Phone Settings uses native client history', settings.includes('window.history.pushState(null, "", target);')],
  ['Settings no longer calls router.push for section changes', !settings.includes('router.push(target, { scroll: false });')],
  ['Settings synchronizes Back/history URL into local state', settings.includes('const sectionFromUrl = searchParams.get("section")')],
  ['Settings parent restores when section query disappears', settings.includes('setMobileDetailOpen(false);')],
  ['Same-path Back uses browser history', sidebar.includes('window.history.back();')],
  ['Cross-path Back still uses client router', sidebar.includes('router.push(target, { scroll: false });')],
  ['Phone forward transition is 220ms', stack.includes('ficonter-mobile-page-forward 220ms')],
  ['Phone back transition is 200ms', stack.includes('ficonter-mobile-page-back 200ms')],
  ['Phone Settings taps use manipulation touch action', stack.includes('touch-action: manipulation;')],
  ['Tablet Settings contract remains present', stack.includes('V1.13 — Tablet/iPad contract.')],
];

for (const [label, ok] of checks) {
  if (!ok) throw new Error(`FAIL - ${label}`);
  console.log(`PASS - ${label}`);
}

console.log(`\n${checks.length}/${checks.length} checks passed.`);
