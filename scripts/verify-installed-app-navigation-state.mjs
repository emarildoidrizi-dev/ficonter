import fs from 'node:fs';

const runtime = fs.readFileSync('lib/navigationRuntime.ts', 'utf8');
const visualSync = fs.readFileSync('components/InstalledAppNavigationVisualSync.tsx', 'utf8');
const settingsSync = fs.readFileSync('components/InstalledAppSettingsSelectionSync.tsx', 'utf8');
const dashboardLayout = fs.readFileSync('app/dashboard/layout.tsx', 'utf8');
const businessLayout = fs.readFileSync('app/business/layout.tsx', 'utf8');

const checks = [
  ['Runtime owns an explicit installed-phone primary state', runtime.includes('ficonterActivePrimary') && runtime.includes('ficonterPrimaryNavigationForTarget')],
  ['Runtime is restricted to installed standalone phones', runtime.includes('ficonterDisplayMode === "standalone"') && runtime.includes('ficonterDevice === "phone"')],
  ['Personal primary routes are complete', runtime.includes('"/dashboard/overview"') && runtime.includes('"/dashboard/transactions"') && runtime.includes('"/dashboard/budget"')],
  ['Business primary routes are complete', runtime.includes('"/business/overview"') && runtime.includes('"/business/sales"') && runtime.includes('"/business/transactions"')],
  ['Non-primary workspace routes resolve to More', runtime.includes('if (path.startsWith("/dashboard")) return "more";') && runtime.includes('if (path.startsWith("/business")) return "more";')],
  ['A visual navigation target is written before router settlement', runtime.includes('ficonterVisualTarget') && runtime.includes('primeFiconterNavigationVisual(target);')],
  ['Late route settlement cannot overwrite a newer target', runtime.includes('pendingVisualTarget && !routesEquivalent(canonical, pendingVisualTarget)') && runtime.includes('return false;')],
  ['Distinct newer route intents are not blocked by a global debounce', !runtime.includes('ROUTE_INTENT_GUARD_MS') && runtime.includes('existingTarget === target')],
  ['Global controller listens on pointer-down capture', visualSync.includes('document.addEventListener("pointerdown", handlePointerDown, true)')],
  ['Global controller primes internal anchors synchronously', visualSync.includes('primeFiconterNavigationVisual(route);')],
  ['Global controller explicitly handles More', visualSync.includes('primeFiconterMoreVisual(workspace)')],
  ['Bottom dock visual authority is root-state driven', visualSync.includes('data-ficonter-active-primary="transactions"') && visualSync.includes('data-ficonter-primary-nav="transactions"')],
  ['Bottom dock active-state transitions are disabled in installed phone app', visualSync.includes('transition: none !important')],
  ['Global controller has no selection MutationObserver', !visualSync.includes('MutationObserver')],
  ['Global controller has no selection timer', !visualSync.includes('setTimeout')],
  ['Global controller has no selection requestAnimationFrame', !visualSync.includes('requestAnimationFrame')],
  ['Settings controller has no MutationObserver', !settingsSync.includes('MutationObserver')],
  ['Settings controller has no intent timer', !settingsSync.includes('intentTimer')],
  ['Settings Back preserves last selection immediately', settingsSync.includes('primeFiconterSettingsParent(lastSelected)') && settingsSync.includes('setSelection(lastSelected);')],
  ['Personal workspace mounts the global controller', dashboardLayout.includes('<InstalledAppNavigationVisualSync workspace="personal" />')],
  ['Business workspace mounts the global controller', businessLayout.includes('<InstalledAppNavigationVisualSync workspace="business" />')],
];

for (const [label, ok] of checks) {
  if (!ok) throw new Error(`FAIL - ${label}`);
  console.log(`PASS - ${label}`);
}

console.log(`\n${checks.length}/${checks.length} installed-app navigation checks passed.`);
