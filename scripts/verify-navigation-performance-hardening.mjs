import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const boost = read('components/NavigationSpeedBoost.tsx');
const appBoost = read('components/InstalledAppPerformanceBoost.tsx');
const pwaRegister = read('components/PWARegister.tsx');
const dashboardLayout = read('app/dashboard/layout.tsx');
const businessLayout = read('app/business/layout.tsx');
const runtime = read('lib/navigationRuntime.ts');
const realtime = read('components/RealtimeRefreshBridge.tsx');
const overview = read('components/DashboardLiveOverview.tsx');
const currency = read('components/CurrencyDisplayProvider.tsx');
const mobile = read('components/FiconterNativeAppChrome.tsx');
const sidebar = read('components/Sidebar.tsx');
const businessSidebar = read('components/BusinessSidebar.tsx');
const palette = read('components/CommandPalette.tsx');
const notifications = read('components/NotificationCenter.tsx');
const routeError = read('components/WorkspaceRouteError.tsx');
const dashboardError = read('app/dashboard/error.tsx');
const businessError = read('app/business/error.tsx');
const businessLoading = read('app/business/loading.tsx');

const criticalStep = Number(
  appBoost.match(/CRITICAL_PREFETCH_STEP_MS\s*=\s*(\d+)/)?.[1] ?? Number.NaN,
);

const checks = [
  ['Central navigation intent runtime exists', runtime.includes('requestFiconterNavigationIntent') && runtime.includes('FICONTER_NAVIGATION_INTENT_EVENT')],
  ['Rapid duplicate navigation is guarded', runtime.includes('ROUTE_INTENT_GUARD_MS') && runtime.includes('DUPLICATE_INTENT_GUARD_MS')],
  ['Navigation target is globally visible to refresh bridges', runtime.includes('data') || runtime.includes('ficonterRouteTarget')],
  ['Link navigation is prefetched on intent', boost.includes('handlePointerDown') && boost.includes('router.prefetch(route)')],
  ['All internal link clicks claim one navigation intent', boost.includes('requestFiconterNavigationIntent(route, origin)')],
  ['Navigation completion clears pending state', boost.includes('data-ficonter-route-pending') && boost.includes('FICONTER_NAVIGATION_SETTLED_EVENT')],
  ['Stalled client navigation retries once', boost.includes('ROUTE_CLIENT_RETRY_MS') && boost.includes('router.replace(route, { scroll: false })')],
  ['Pathological navigation has a last-resort recovery', boost.includes('ROUTE_HARD_RECOVERY_MS') && boost.includes('window.location.assign(route)')],
  ['Installed app has a dedicated aggressive route warmup', appBoost.includes('isInstalledStandaloneApp()') && appBoost.includes('router.prefetch(route)')],
  ['Installed app critical destinations warm within a tight stagger', Number.isFinite(criticalStep) && criticalStep <= 30],
  ['Installed app warmup respects Save-Data and slow 2G connections', appBoost.includes('connection?.saveData') && appBoost.includes('"slow-2g", "2g"')],
  ['Installed app secondary routes warm during idle time', appBoost.includes('requestIdleCallback') && appBoost.includes('SECONDARY_IDLE_TIMEOUT_MS')],
  ['Installed app re-warms stale primary routes after iOS resume', appBoost.includes('visibilitychange') && appBoost.includes('PREFETCH_REFRESH_MS')],
  ['Personal workspace mounts the app-only performance fast path', dashboardLayout.includes('<InstalledAppPerformanceBoost workspace="personal" cacheKey={user.id} />')],
  ['Business workspace mounts the app-only performance fast path', businessLayout.includes('<InstalledAppPerformanceBoost') && businessLayout.includes('workspace="business"')],
  ['Installed app service-worker update work is deferred off startup', pwaRegister.includes('scheduleRegistrationUpdate(true)') && pwaRegister.includes('APP_UPDATE_IDLE_TIMEOUT_MS')],
  ['Browser service-worker updates preserve eager behavior', pwaRegister.includes('if (!isInstalledStandaloneApp())') && pwaRegister.includes('void updateRegistration(force);')],
  ['Realtime refresh yields to navigation', realtime.includes('isFiconterNavigationPending()') && realtime.includes('pendingWhileNavigatingRef')],
  ['Queued realtime refresh resumes after navigation settles', realtime.includes('FICONTER_NAVIGATION_SETTLED_EVENT') && realtime.includes('onNavigationSettled')],
  ['Overview realtime refresh cannot race a route transition', overview.includes('if (isFiconterNavigationPending()) return;')],
  ['Currency refresh cannot race a route transition', currency.includes('workspace === "personal" && !isFiconterNavigationPending()')],
  ['Mobile More drawer no longer prefetches every route on every open', !/function openDrawer\(\)[\s\S]{0,500}routes\.forEach/.test(mobile)],
  ['Mobile imperative Back/Add routes claim navigation intent', (mobile.match(/requestFiconterNavigationIntent/g) ?? []).length >= 4],
  ['Personal desktop imperative navigation claims intent', (sidebar.match(/requestFiconterNavigationIntent/g) ?? []).length >= 3],
  ['Business desktop Back claims intent', businessSidebar.includes('requestFiconterNavigationIntent(target, currentRoute)')],
  ['Command palette navigation claims intent', palette.includes('requestFiconterNavigationIntent(href, current)')],
  ['Notification navigation claims intent', notifications.includes('requestFiconterNavigationIntent')],
  ['Route error boundary offers retry and Overview recovery', routeError.includes('reset()') && routeError.includes('overviewHref') && routeError.includes('requestFiconterNavigationIntent')],
  ['Personal workspace has route error boundary', dashboardError.includes('WorkspaceRouteError')],
  ['Business workspace has route error boundary', businessError.includes('WorkspaceRouteError')],
  ['Business workspace has immediate loading boundary', businessLoading.includes('../dashboard/loading')],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}`);
  if (!ok) failed += 1;
}
console.log(`\n${checks.length - failed}/${checks.length} navigation-hardening checks passed.`);
if (failed) process.exit(1);
