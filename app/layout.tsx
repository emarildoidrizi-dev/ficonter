import type { Metadata } from "next";
import "./globals.css";
import "./theme-palettes.css";
import "./living-themes.css";
import { KeyboardInteractionBridge } from "@/components/KeyboardInteractionBridge";
import {
  APPEARANCE_VALUES,
  BACKGROUND_MOTION_VALUES,
  DARK_APPEARANCE_VALUES,
  SIDEBAR_ATMOSPHERE_MODE_VALUES,
  SIDEBAR_ATMOSPHERE_MOTION_VALUES,
  SIDEBAR_ATMOSPHERE_VALUES,
  WALLPAPER_SCENE_VALUES,
} from "@/lib/interfaceThemes";
import { INTERFACE_LAYOUT_VALUES } from "@/lib/interfaceLayout";

export const metadata: Metadata = {
  title: {
    default: "Ficonter",
    template: "%s · Ficonter",
  },
  description: "Your private financial command center.",
  applicationName: "Ficonter",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/ficonter-app-icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "512x512", type: "image/png" }],
  },
  openGraph: {
    title: "Ficonter",
    description: "Your private financial command center.",
    siteName: "Ficonter",
    type: "website",
  },
};

const interfacePreferenceScript = `
(function () {
  try {
    var root = document.documentElement;
    var supported = ${JSON.stringify(APPEARANCE_VALUES)};
    var darkThemes = ${JSON.stringify(DARK_APPEARANCE_VALUES)};
    var supportedLayouts = ${JSON.stringify(INTERFACE_LAYOUT_VALUES)};
    var supportedMotion = ${JSON.stringify(BACKGROUND_MOTION_VALUES)};
    var supportedScenes = ${JSON.stringify(WALLPAPER_SCENE_VALUES)};
    var supportedSidebarAtmospheres = ${JSON.stringify(SIDEBAR_ATMOSPHERE_VALUES)};
    var supportedSidebarAtmosphereModes = ${JSON.stringify(SIDEBAR_ATMOSPHERE_MODE_VALUES)};
    var supportedSidebarAtmosphereMotion = ${JSON.stringify(SIDEBAR_ATMOSPHERE_MOTION_VALUES)};
    var appearance = localStorage.getItem("ficonter-appearance") || "light";
    var density = localStorage.getItem("ficonter-density") || "comfortable";
    var layout = localStorage.getItem("ficonter-layout") || "horizon";
    var backgroundMotion = localStorage.getItem("ficonter-background-motion") || "animated";
    var wallpaperScene = localStorage.getItem("ficonter-wallpaper-scene") || "space-nebula";
    var sidebarAtmosphereMode = localStorage.getItem("ficonter-sidebar-atmosphere-mode") || "auto";
    var sidebarAtmosphereStyle = localStorage.getItem("ficonter-sidebar-atmosphere-style") || "none";
    var sidebarAtmosphereMotion = localStorage.getItem("ficonter-sidebar-atmosphere-motion") || "animated";
    if (supported.indexOf(appearance) === -1) appearance = "light";
    if (density !== "compact") density = "comfortable";
    if (supportedLayouts.indexOf(layout) === -1) layout = "horizon";
    if (supportedMotion.indexOf(backgroundMotion) === -1) backgroundMotion = "animated";
    if (supportedScenes.indexOf(wallpaperScene) === -1) wallpaperScene = "space-nebula";
    if (supportedSidebarAtmosphereModes.indexOf(sidebarAtmosphereMode) === -1) sidebarAtmosphereMode = "auto";
    if (supportedSidebarAtmospheres.indexOf(sidebarAtmosphereStyle) === -1) sidebarAtmosphereStyle = "none";
    if (supportedSidebarAtmosphereMotion.indexOf(sidebarAtmosphereMotion) === -1) sidebarAtmosphereMotion = "animated";
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var resolved = appearance === "system"
      ? (prefersDark ? "dark" : "light")
      : (darkThemes.indexOf(appearance) >= 0 ? "dark" : "light");
    var resolvedSidebarAtmosphere = sidebarAtmosphereStyle;
    if (sidebarAtmosphereMode === "auto") {
      switch (wallpaperScene) {
        case "space-nebula": resolvedSidebarAtmosphere = "orbital"; break;
        case "aurora": resolvedSidebarAtmosphere = "lightbeam"; break;
        case "ocean-horizon":
        case "sand-dunes":
        case "forest-mist": resolvedSidebarAtmosphere = "topography"; break;
        case "marble-glow":
        case "future-grid": resolvedSidebarAtmosphere = "architectural"; break;
        case "minimal-luxe": resolvedSidebarAtmosphere = resolved === "dark" ? "orbital" : "none"; break;
        default: resolvedSidebarAtmosphere = "none";
      }
    }
    root.dataset.theme = appearance;
    root.dataset.resolvedTheme = resolved;
    root.dataset.density = density;
    root.dataset.layout = layout;
    root.dataset.backgroundMotion = backgroundMotion;
    root.dataset.wallpaperScene = wallpaperScene;
    root.dataset.sidebarAtmosphereMode = sidebarAtmosphereMode;
    root.dataset.sidebarAtmosphereStyle = resolvedSidebarAtmosphere;
    root.dataset.sidebarAtmosphereMotion = sidebarAtmosphereMotion;
    root.style.colorScheme = resolved;
  } catch (_) {}
})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: interfacePreferenceScript }} />
      </head>
      <body>
        <KeyboardInteractionBridge />
        {children}
      </body>
    </html>
  );
}
