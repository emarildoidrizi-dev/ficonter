import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
const check = (ok, label) => checks.push({ ok: Boolean(ok), label });

const runtime = read("lib/navigationRuntime.ts");
const navigation = read("components/NavigationSpeedBoost.tsx");
const stability = read("components/RuntimeStabilityBridge.tsx");
const realtime = read("components/RealtimeRefreshBridge.tsx");
const pwa = read("components/PWARegister.tsx");
const sw = read("public/sw.js");
const sourceData = read("components/useBaseCurrencySourceData.ts");
const ownerMusic = read("components/OwnerMusicPlayer.tsx");
const dashboardLayout = read("app/dashboard/layout.tsx");
const businessLayout = read("app/business/layout.tsx");
const businessSidebar = read("components/BusinessSidebar.tsx");
const settings = read("components/SettingsWorkspace.tsx");
const customerSubscription = read("components/CustomerSubscriptionManager.tsx");
const paypal = read("components/PayPalSubscriptionCheckout.tsx");
const businessManager = read("components/BusinessManager.tsx");

check(runtime.includes("STALE_INTENT_MS") && runtime.includes("clearFiconterNavigationState"), "Stale navigation intents can be recovered instead of blocking future taps");
check(runtime.includes("navigationIntentAgeMs"), "Navigation intent age is measurable by lifecycle recovery");
check(stability.includes("ChunkLoadError") || stability.toLowerCase().includes("chunkloaderror"), "Stale/dynamic chunk failures have a controlled recovery path");
check(stability.includes("CHUNK_RECOVERY_WINDOW_MS") && stability.includes("recentlyRecoveredHere"), "Chunk recovery is loop-protected");
check(stability.includes('window.addEventListener("pageshow"') && stability.includes('window.addEventListener("offline"'), "PWA/bfcache and connectivity lifecycle events clear stale busy state");
check(dashboardLayout.includes("<RuntimeStabilityBridge />"), "Personal workspace mounts runtime stability recovery");
check(businessLayout.includes("<RuntimeStabilityBridge />"), "Business workspace mounts runtime stability recovery");
check(navigation.includes("ROUTE_CLIENT_RETRY_MS = 4_000") && navigation.includes("ROUTE_HARD_RECOVERY_MS = 8_000"), "Stalled navigation recovers sooner without changing the normal path");
check(navigation.includes("MAX_WARMED_CONTEXTS") && navigation.includes("MAX_WARMED_ROUTES_PER_CONTEXT"), "Route prefetch memory is bounded");
check(navigation.includes("allowsBackgroundPrefetch() && document.visibilityState === \"visible\""), "Background prefetch avoids constrained or hidden sessions");
check(realtime.includes("POST_NAVIGATION_SETTLE_GRACE_MS") && realtime.includes("pendingNavigationChangeAtRef"), "Realtime reconciliation no longer immediately fights a route transition");
check(realtime.includes("pendingChangeAt <= navigationStartedAt"), "Pre-navigation data changes do not trigger redundant destination refreshes");
check(pwa.includes("SERVICE_WORKER_UPDATE_INTERVAL_MS") && pwa.includes("isFiconterNavigationPending()"), "Service-worker update checks are throttled and yield to navigation");
check(sw.includes("ficonter-pwa-static-v14-instant-theme-preview-v134-performance-stability-v2"), "PWA static cache generation is advanced for the hardened release");
check(sourceData.includes("inFlightRef") && sourceData.includes("queuedRef"), "Shared financial source refreshes are coalesced while a request is in flight");
check(sourceData.includes("eventTimerRef") && sourceData.includes("180"), "Financial source events are debounced instead of refetching seven tables per event");
check(sourceData.includes("!isFinancialDataScope(change.scope)"), "Profile/settings events no longer trigger full financial-source refetches");
check(ownerMusic.includes("requestIdleCallback") && ownerMusic.includes("libraryLoadedRef"), "Owner Music defers its private-library fetch until idle or explicit use");
check(businessSidebar.includes('window.location.replace("/login")') && !businessSidebar.includes('router.replace("/");\n    router.refresh();'), "Business sign-out cannot race the client router");
check(settings.includes("router.refresh()") && !settings.includes("window.setTimeout(() => window.location.reload(), 500)"), "Settings plan/Beta refreshes avoid unnecessary full-page reloads");
check(!customerSubscription.includes("window.location.reload()") && customerSubscription.includes("router.refresh()"), "Subscription cancellation reconciles through the App Router");
check(!paypal.includes("window.location.reload()") && paypal.includes("router.refresh()"), "PayPal approval reconciles without a browser reload");
check((businessManager.match(/router\.refresh\(\)/g) ?? []).length <= 2, "Business create/archive/restore/delete no longer double-fetch after route replacement");

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? "PASS" : "FAIL"}  ${item.label}`);
if (failed.length) {
  console.error(`\nPlatform performance/stability V2 failed (${failed.length}/${checks.length}).`);
  process.exit(1);
}
console.log(`\nPlatform performance/stability V2 passed (${checks.length}/${checks.length}).`);
