export const FICONTER_NAVIGATION_INTENT_EVENT = "ficonter:navigation-intent";
export const FICONTER_NAVIGATION_SETTLED_EVENT = "ficonter:navigation-settled";
export const FICONTER_NAVIGATION_STALLED_EVENT = "ficonter:navigation-stalled";

const ROUTE_INTENT_GUARD_MS = 320;
const DUPLICATE_INTENT_GUARD_MS = 1_600;
const STALE_INTENT_MS = 12_000;

export type FiconterNavigationIntentDetail = {
  target: string;
  origin: string;
  startedAt: number;
};

export function isFiconterNavigationPending(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.ficonterRoutePending === "true";
}

export function currentFiconterNavigationTarget(): string | null {
  if (typeof document === "undefined") return null;
  return document.documentElement.dataset.ficonterRouteTarget ?? null;
}

export function navigationIntentAgeMs(): number {
  if (typeof document === "undefined") return Number.POSITIVE_INFINITY;
  const startedAt = Number(
    document.documentElement.dataset.ficonterRouteIntentAt ?? "0",
  );
  if (!Number.isFinite(startedAt) || startedAt <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, Date.now() - startedAt);
}

export function clearFiconterNavigationState(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.removeAttribute("data-ficonter-route-loading");
  root.removeAttribute("data-ficonter-route-pending");
  root.removeAttribute("data-ficonter-route-target");
  root.removeAttribute("data-ficonter-route-intent-at");
}

function projectSettingsParentImmediately(): void {
  if (typeof document === "undefined") return;

  const page = document.querySelector<HTMLElement>(".ficonter-settings-page");
  const workspace = page?.querySelector<HTMLElement>("[data-mobile-detail]");

  if (workspace) {
    workspace.dataset.mobileDetail = "false";
  }

  if (page) {
    page.dataset.settingsDetail = "false";
  }
}

function consumeInstalledPhoneSettingsBack(
  target: string,
  current: string,
  root: HTMLElement,
): boolean {
  if (
    root.dataset.ficonterNativeApp !== "true" ||
    root.dataset.ficonterDevice !== "phone" ||
    root.dataset.ficonterDisplayMode !== "standalone"
  ) {
    return false;
  }

  let originUrl: URL;
  let targetUrl: URL;

  try {
    originUrl = new URL(current, window.location.origin);
    targetUrl = new URL(target, window.location.origin);
  } catch {
    return false;
  }

  // Settings detail screens are already client-mounted in the installed phone
  // app. Back must reverse the native history entry created by pushState rather
  // than launching another force-dynamic Next.js route request.
  if (
    originUrl.pathname !== "/dashboard/settings" ||
    !originUrl.searchParams.has("section") ||
    targetUrl.pathname !== "/dashboard/settings" ||
    targetUrl.searchParams.has("section")
  ) {
    return false;
  }

  clearFiconterNavigationState();

  // Paint the parent screen in the current interaction frame. React/Next then
  // reconciles the same state from the native popstate without a visible second
  // refresh or stale-detail frame.
  projectSettingsParentImmediately();

  if (window.history.length > 1) {
    window.history.back();
    return true;
  }

  // Defensive standalone-launch fallback: when there is no prior history entry,
  // normalize the URL locally and leave the already-painted parent visible.
  const localParentUrl = new URL(window.location.href);
  localParentUrl.searchParams.delete("section");
  const parentSearch = localParentUrl.searchParams.toString();
  const parentHref = `${localParentUrl.pathname}${
    parentSearch ? `?${parentSearch}` : ""
  }${localParentUrl.hash}`;

  window.history.replaceState(window.history.state, "", parentHref);
  return true;
}

/**
 * Claims a navigation intent before calling router.push/replace.
 *
 * Returns false when the tap is a duplicate/accidental rapid second intent.
 * The NavigationSpeedBoost listener owns the timers, retry, and final cleanup.
 *
 * Installed-phone Settings detail Back is consumed as a native local history
 * transition. The caller receives false, so it never reaches router.push and
 * therefore never starts a server-backed Settings refresh.
 */
export function requestFiconterNavigationIntent(
  target: string,
  origin?: string,
): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return true;

  const current = origin ?? `${window.location.pathname}${window.location.search}`;
  if (!target || target === current) return false;

  const root = document.documentElement;

  if (consumeInstalledPhoneSettingsBack(target, current, root)) {
    return false;
  }

  const now = Date.now();
  const existingTarget = root.dataset.ficonterRouteTarget ?? null;
  const existingStartedAt = Number(root.dataset.ficonterRouteIntentAt ?? "0");
  const elapsed = existingStartedAt > 0 ? now - existingStartedAt : Number.POSITIVE_INFINITY;

  // A bfcache restore, interrupted PWA transition, or crashed client render can
  // leave DOM navigation flags behind after the timers that owned them are gone.
  // Never let that stale state block a legitimate future tap indefinitely.
  if (
    root.dataset.ficonterRoutePending === "true" &&
    elapsed >= STALE_INTENT_MS
  ) {
    clearFiconterNavigationState();
  }

  if (
    root.dataset.ficonterRoutePending === "true" &&
    (elapsed < ROUTE_INTENT_GUARD_MS ||
      (existingTarget === target && elapsed < DUPLICATE_INTENT_GUARD_MS))
  ) {
    return false;
  }

  root.dataset.ficonterRoutePending = "true";
  root.dataset.ficonterRouteTarget = target;
  root.dataset.ficonterRouteIntentAt = String(now);

  window.dispatchEvent(
    new CustomEvent<FiconterNavigationIntentDetail>(FICONTER_NAVIGATION_INTENT_EVENT, {
      detail: { target, origin: current, startedAt: now },
    }),
  );
  return true;
}
