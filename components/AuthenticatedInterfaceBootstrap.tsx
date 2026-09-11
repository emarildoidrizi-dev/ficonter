import { InterfacePreferencesBootstrap } from "@/components/InterfacePreferencesBootstrap";
import {
  DARK_APPEARANCE_VALUES,
  FIXED_INTERFACE_PROFILE_VERSION,
  normalizeAppearance,
  normalizeBackgroundMotion,
  normalizeSurfaceOpacity,
  normalizeWallpaperScene,
} from "@/lib/interfaceThemes";

type DensityPreference = "comfortable" | "compact";

type Props = {
  appearance?: string | null;
  density?: string | null;
  backgroundMotion?: string | null;
  wallpaperScene?: string | null;
  surfaceOpacity?: number | string | null;
  wallpaperAccessEnabled?: boolean;
};

function normalizeDensity(value: string | null | undefined): DensityPreference {
  return value === "compact" ? "compact" : "comfortable";
}

const typographyIntegrityCss = `
html[data-theme] .app-shell,
html[data-theme] .app-shell * {
  font-family: var(--font-interface) !important;
}
html[data-theme] .app-shell :where(h1,h2,h3,h4,h5,h6,[class*="title" i],[class*="heading" i]) {
  font-family: var(--font-display) !important;
  font-weight: var(--font-display-weight);
  letter-spacing: var(--font-display-tracking);
}
html[data-theme] .app-shell :where(output,[class*="amount" i],[class*="balance" i],[class*="metricValue" i],[class*="statValue" i],[class*="number" i],[class*="money" i],td:last-child) {
  font-family: var(--font-numeric) !important;
  font-variant-numeric: tabular-nums lining-nums;
  font-feature-settings: "tnum" 1, "lnum" 1;
  letter-spacing: var(--font-numeric-tracking);
}
html[data-theme] .app-shell :where(th,legend,.eyebrow,[class*="eyebrow" i],[class*="label" i]) {
  letter-spacing: var(--font-label-tracking);
}
html[data-theme] .app-shell,
html[data-theme] .app-main {
  color: var(--text-primary);
}
html[data-theme] .app-shell :where(input,select,textarea,option) {
  color: var(--text-primary);
  caret-color: var(--text-primary);
}
html[data-theme] .app-shell :where(input,textarea)::placeholder {
  color: var(--text-tertiary) !important;
  -webkit-text-fill-color: var(--text-tertiary) !important;
  opacity: 1 !important;
}
html[data-theme] .app-shell :where([role="dialog"],[role="menu"],[role="listbox"],[role="option"],[role="alert"],[role="status"],[role="tooltip"]) {
  color: var(--text-primary);
}
html[data-theme] .app-shell :where([class*="subtitle" i],[class*="description" i],[class*="caption" i],[class*="meta" i],[class*="muted" i],[class*="hint" i],[class*="helper" i]) {
  color: var(--text-secondary);
}
`;

export function AuthenticatedInterfaceBootstrap({
  appearance,
  density,
  backgroundMotion,
  wallpaperScene,
  surfaceOpacity,
  wallpaperAccessEnabled = false,
}: Props) {
  const normalizedAppearance = normalizeAppearance(appearance);
  const normalizedDensity = normalizeDensity(density);
  const normalizedBackgroundMotion = normalizeBackgroundMotion(backgroundMotion);
  const normalizedWallpaperScene = wallpaperAccessEnabled
    ? normalizeWallpaperScene(wallpaperScene)
    : "coastal-island";
  const normalizedSurfaceOpacity = normalizeSurfaceOpacity(surfaceOpacity);

  const prepaintScript = `
(function () {
  try {
    var root = document.documentElement;
    var appearance = ${JSON.stringify(normalizedAppearance)};
    var density = ${JSON.stringify(normalizedDensity)};
    var backgroundMotion = ${JSON.stringify(normalizedBackgroundMotion)};
    var wallpaperScene = ${JSON.stringify(normalizedWallpaperScene)};
    var surfaceOpacity = ${JSON.stringify(normalizedSurfaceOpacity)};
    var darkThemes = ${JSON.stringify(DARK_APPEARANCE_VALUES)};
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var resolvedTheme = appearance === "system"
      ? (prefersDark ? "dark" : "light")
      : (darkThemes.indexOf(appearance) >= 0 ? "dark" : "light");

    root.dataset.theme = appearance;
    root.dataset.resolvedTheme = resolvedTheme;
    root.dataset.density = density;
    root.dataset.backgroundMotion = backgroundMotion;
    root.dataset.wallpaperScene = wallpaperScene;
    root.dataset.surfaceOpacity = String(surfaceOpacity);
    root.style.setProperty("--ficonter-surface-opacity", String(surfaceOpacity) + "%");
    root.style.colorScheme = resolvedTheme;

    delete root.dataset.sidebarAtmosphereMode;
    delete root.dataset.sidebarAtmosphereStyle;
    delete root.dataset.sidebarAtmosphereMotion;

    localStorage.setItem("ficonter-appearance", appearance);
    localStorage.setItem("ficonter-density", density);
    localStorage.setItem("ficonter-background-motion", backgroundMotion);
    localStorage.setItem("ficonter-wallpaper-scene", wallpaperScene);
    localStorage.setItem("ficonter-surface-opacity", String(surfaceOpacity));
    localStorage.setItem(
      "ficonter-interface-profile-version",
      ${JSON.stringify(FIXED_INTERFACE_PROFILE_VERSION)}
    );
    localStorage.removeItem("ficonter-layout");
    localStorage.removeItem("ficonter-sidebar-atmosphere-mode");
    localStorage.removeItem("ficonter-sidebar-atmosphere-style");
    localStorage.removeItem("ficonter-sidebar-atmosphere-motion");
  } catch (_) {}
})();`;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: prepaintScript }} />
      <style dangerouslySetInnerHTML={{ __html: typographyIntegrityCss }} />
      <InterfacePreferencesBootstrap
        appearance={normalizedAppearance}
        density={normalizedDensity}
        backgroundMotion={normalizedBackgroundMotion}
        wallpaperScene={normalizedWallpaperScene}
        surfaceOpacity={normalizedSurfaceOpacity}
        wallpaperAccessEnabled={wallpaperAccessEnabled}
      />
    </>
  );
}
