export const FICONTER_NAVIGATION_INTENT_EVENT = "ficonter:navigation-intent";
export const FICONTER_NAVIGATION_SETTLED_EVENT = "ficonter:navigation-settled";
export const FICONTER_NAVIGATION_STALLED_EVENT = "ficonter:navigation-stalled";

const DUPLICATE_INTENT_GUARD_MS = 1_600;
const STALE_INTENT_MS = 12_000;

export type FiconterNavigationIntentDetail = {
  target: string;
  origin: string;
  startedAt: number;
};

export type FiconterPrimaryNavigation =
  | "overview"
  | "transactions"
  | "planner"
  | "sales"
  | "more";

export type FiconterSettingsSection =
  | "profile"
  | "security"
  | "financial"
  | "notifications"
  | "appearance"
  | "privacy"
  | "subscription";

const SETTINGS_SECTIONS = new Set<FiconterSettingsSection>([
  "profile",
  "security",
  "financial",
  "notifications",
  "appearance",
  "privacy",
  "subscription",
]);

function installedPhoneApp() {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  return (
    root.dataset.ficonterNativeApp === "true" &&
    root.dataset.ficonterDevice === "phone" &&
    root.dataset.ficonterDisplayMode === "standalone"
  );
}

function routeUrl(target: string) {
  try {
    return new URL(target, "https://ficonter.local");
  } catch {
    return null;
  }
}

function canonicalRoute(target: string) {
  const url = routeUrl(target);
  if (!url) return target;
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}`;
}

function routesEquivalent(left: string, right: string) {
  const a = routeUrl(left);
  const b = routeUrl(right);
  if (!a || !b) return left === right;

  const canonicalPath = (pathname: string) => {
    if (pathname === "/dashboard") return "/dashboard/overview";
    if (pathname === "/business") return "/business/overview";
    return pathname;
  };

  return (
    canonicalPath(a.pathname) === canonicalPath(b.pathname) &&
    a.searchParams.toString() === b.searchParams.toString()
  );
}

export function ficonterPrimaryNavigationForTarget(
  target: string,
): FiconterPrimaryNavigation | null {
  const url = routeUrl(target);
  if (!url) return null;
  const path = url.pathname;

  if (path === "/dashboard" || path === "/dashboard/overview") return "overview";
  if (path === "/dashboard/transactions" || path.startsWith("/dashboard/transactions/")) {
    return "transactions";
  }
  if (path === "/dashboard/budget" || path.startsWith("/dashboard/budget/")) return "planner";
  if (path.startsWith("/dashboard")) return "more";

  if (path === "/business" || path === "/business/overview") return "overview";
  if (path === "/business/sales" || path.startsWith("/business/sales/")) return "sales";
  if (path === "/business/transactions" || path.startsWith("/business/transactions/")) {
    return "transactions";
  }
  if (path.startsWith("/business")) return "more";

  return null;
}

function settingsSectionForTarget(target: string): FiconterSettingsSection | null {
  const url = routeUrl(target);
  if (!url || url.pathname !== "/dashboard/settings") return null;
  const section = url.searchParams.get("section") as FiconterSettingsSection | null;
  return section && SETTINGS_SECTIONS.has(section) ? section : null;
}

function writePrimaryVisual(primary: FiconterPrimaryNavigation | null) {
  if (!installedPhoneApp() || !primary) return;
  document.documentElement.dataset.ficonterActivePrimary = primary;
}

function writeSettingsVisual(target: string) {
  if (!installedPhoneApp()) return;
  const url = routeUrl(target);
  if (!url || url.pathname !== "/dashboard/settings") return;

  const root = document.documentElement;
  const section = settingsSectionForTarget(target);
  root.dataset.ficonterSettingsParent = section ? "false" : "true";
  if (section) root.dataset.ficonterSettingsSection = section;
  else if (!root.dataset.ficonterSettingsSection) root.dataset.ficonterSettingsSection = "security";
}

function bumpVisualRevision() {
  if (!installedPhoneApp()) return;
  const root = document.documentElement;
  const revision = Number(root.dataset.ficonterNavigationRevision ?? "0");
  root.dataset.ficonterNavigationRevision = String(
    Number.isFinite(revision) ? revision + 1 : 1,
  );
}

/**
 * Synchronously moves the installed phone app's visual navigation state to the
 * user's newest intent. This is deliberately independent from React/router
 * settlement so content and selection can never wait on each other.
 */
export function primeFiconterNavigationVisual(target: string): void {
  if (!installedPhoneApp()) return;
  const root = document.documentElement;
  const canonical = canonicalRoute(target);
  const primary = ficonterPrimaryNavigationForTarget(canonical);

  writePrimaryVisual(primary);
  writeSettingsVisual(canonical);
  root.dataset.ficonterVisualTarget = canonical;
  bumpVisualRevision();
}

export function primeFiconterMoreVisual(workspace: "personal" | "business"): void {
  if (!installedPhoneApp()) return;
  const root = document.documentElement;
  root.dataset.ficonterActivePrimary = "more";
  root.dataset.ficonterMoreOverlay = workspace;
  bumpVisualRevision();
}

export function closeFiconterMoreVisual(currentRoute: string): void {
  if (!installedPhoneApp()) return;
  const root = document.documentElement;
  delete root.dataset.ficonterMoreOverlay;
  if (!root.dataset.ficonterVisualTarget) {
    writePrimaryVisual(ficonterPrimaryNavigationForTarget(currentRoute));
    bumpVisualRevision();
  }
}

export function primeFiconterSettingsSection(section: FiconterSettingsSection): void {
  if (!installedPhoneApp()) return;
  const root = document.documentElement;
  root.dataset.ficonterActivePrimary = "more";
  root.dataset.ficonterSettingsSection = section;
  root.dataset.ficonterSettingsParent = "false";
  root.dataset.ficonterVisualTarget = `/dashboard/settings?section=${section}`;
  bumpVisualRevision();
}

export function primeFiconterSettingsParent(section?: FiconterSettingsSection | null): void {
  if (!installedPhoneApp()) return;
  const root = document.documentElement;
  root.dataset.ficonterActivePrimary = "more";
  if (section) root.dataset.ficonterSettingsSection = section;
  else if (!root.dataset.ficonterSettingsSection) root.dataset.ficonterSettingsSection = "security";
  root.dataset.ficonterSettingsParent = "true";
  root.dataset.ficonterVisualTarget = "/dashboard/settings";
  bumpVisualRevision();
}

/**
 * Confirms a committed route without allowing a late router commit from an
 * older tap to overwrite a newer visual intent.
 */
export function settleFiconterNavigationVisual(route: string): boolean {
  if (!installedPhoneApp()) return false;
  const root = document.documentElement;
  const canonical = canonicalRoute(route);
  const pendingVisualTarget = root.dataset.ficonterVisualTarget;

  if (pendingVisualTarget && !routesEquivalent(canonical, pendingVisualTarget)) {
    return false;
  }

  if (pendingVisualTarget) delete root.dataset.ficonterVisualTarget;
  delete root.dataset.ficonterMoreOverlay;
  writePrimaryVisual(ficonterPrimaryNavigationForTarget(canonical));
  writeSettingsVisual(canonical);
  bumpVisualRevision();
  return true;
}

export function currentFiconterSettingsSection(): FiconterSettingsSection | null {
  if (typeof document === "undefined") return null;
  const value = document.documentElement.dataset.ficonterSettingsSection as
    | FiconterSettingsSection
    | undefined;
  return value && SETTINGS_SECTIONS.has(value) ? value : null;
}

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

/**
 * Claims a navigation intent before calling router.push/replace.
 *
 * A distinct newer target always supersedes an older pending target. Only a
 * duplicate tap on the same target is suppressed. The NavigationSpeedBoost
 * listener owns retry/recovery and final route cleanup.
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
    elapsed >= STALE_INTENT_MS
  ) {
    clearFiconterNavigationState();
  }

  if (
    root.dataset.ficonterRoutePending === "true" &&
    existingTarget === target &&
    elapsed < DUPLICATE_INTENT_GUARD_MS
  ) {
    return false;
  }

  primeFiconterNavigationVisual(target);
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
