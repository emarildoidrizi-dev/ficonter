export const FICONTER_NAVIGATION_INTENT_EVENT = "ficonter:navigation-intent";
export const FICONTER_NAVIGATION_SETTLED_EVENT = "ficonter:navigation-settled";
export const FICONTER_NAVIGATION_STALLED_EVENT = "ficonter:navigation-stalled";

const ROUTE_INTENT_GUARD_MS = 320;
const DUPLICATE_INTENT_GUARD_MS = 1_600;

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

/**
 * Claims a navigation intent before calling router.push/replace.
 *
 * Returns false when the tap is a duplicate/accidental rapid second intent.
 * The NavigationSpeedBoost listener owns the timers, retry, and final cleanup.
 */
export function requestFiconterNavigationIntent(
  target: string,
  origin?: string,
): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return true;

  const current = origin ?? `${window.location.pathname}${window.location.search}`;
  if (!target || target === current) return false;

  const root = document.documentElement;
  const now = Date.now();
  const existingTarget = root.dataset.ficonterRouteTarget ?? null;
  const existingStartedAt = Number(root.dataset.ficonterRouteIntentAt ?? "0");
  const elapsed = existingStartedAt > 0 ? now - existingStartedAt : Number.POSITIVE_INFINITY;

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
