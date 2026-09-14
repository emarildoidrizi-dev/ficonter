import fs from 'node:fs';

const settings = fs.readFileSync('components/SettingsWorkspace.tsx', 'utf8');
const instantSync = fs.readFileSync('components/InstalledAppSettingsSelectionSync.tsx', 'utf8');
const runtime = fs.readFileSync('lib/navigationRuntime.ts', 'utf8');
const sidebar = fs.readFileSync('components/Sidebar.tsx', 'utf8');
const stack = fs.readFileSync('app/mobile-page-stack.css', 'utf8');

const checks = [
  ['Settings reads client search params', settings.includes('useSearchParams')],
  ['Phone Settings switches active content immediately', settings.includes('setActive(id);') && settings.includes('setMobileDetailOpen(true);')],
  ['Phone Settings uses native client history', settings.includes('window.history.pushState(null, "", target);')],
  ['Settings no longer calls router.push for section changes', !settings.includes('router.push(target, { scroll: false });')],
  ['Settings synchronizes Back/history URL into local state', settings.includes('const sectionFromUrl = searchParams.get("section")')],
  ['Settings parent restores when section query disappears', settings.includes('setMobileDetailOpen(false);')],
  ['Installed app handles Settings Back on pointer-down', instantSync.includes('button[aria-label="Go back"]') && instantSync.includes('primeFiconterSettingsParent(lastSelected)')],
  ['Installed app preserves the selected row on Back', instantSync.includes('setSelection(lastSelected);') && instantSync.includes('showParent();')],
  ['Settings selection no longer depends on MutationObserver', !instantSync.includes('MutationObserver')],
  ['Settings selection no longer uses intent timers', !instantSync.includes('intentTimer')],
  ['Settings selection no longer waits for requestAnimationFrame', !instantSync.includes('requestAnimationFrame')],
  ['Settings visual state is owned by shared navigation runtime', instantSync.includes('primeFiconterSettingsSection') && runtime.includes('ficonterSettingsSection')],
  ['Installed Settings styling is standalone phone only', instantSync.includes('data-ficonter-display-mode="standalone"') && instantSync.includes('data-ficonter-device="phone"')],
  ['Settings selected-row visual transitions are disabled in phone app', instantSync.includes('transition: none !important')],
  ['Settings page-stack animation is bypassed in phone app', instantSync.includes('.app-main > .ficonter-settings-page') && instantSync.includes('animation: none !important')],
  ['Same-path Back uses browser history', sidebar.includes('window.history.back();')],
  ['Cross-path Back still uses client router', sidebar.includes('router.push(target, { scroll: false });')],
  ['Global phone forward transition remains available', stack.includes('ficonter-mobile-page-forward 220ms')],
  ['Global phone back transition remains available', stack.includes('ficonter-mobile-page-back 200ms')],
  ['Phone Settings taps use manipulation touch action', stack.includes('touch-action: manipulation;')],
  ['Tablet Settings contract remains present', stack.includes('V1.13 — Tablet/iPad contract.')],
];

for (const [label, ok] of checks) {
  if (!ok) throw new Error(`FAIL - ${label}`);
  console.log(`PASS - ${label}`);
}

console.log(`\n${checks.length}/${checks.length} checks passed.`);
