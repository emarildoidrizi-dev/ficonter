import type { Metadata, Viewport } from "next";

import "./globals.css";
import "./theme-palettes.css";
import "./living-themes.css";
import "./native-mobile-app.css";
import "./coastal-shell.css";

import { KeyboardInteractionBridge } from "@/components/KeyboardInteractionBridge";
import { PWARegister } from "@/components/PWARegister";
import { GlobalLanguageControl } from "@/components/GlobalLanguageControl";
import { ThemeContrastGuard } from "@/components/ThemeContrastGuard";
import { LanguageProvider } from "@/components/LanguageProvider";

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE_NAME,
  LANGUAGE_STORAGE_KEY,
} from "@/lib/i18n/config";

import {
  APPEARANCE_VALUES,
  BACKGROUND_MOTION_VALUES,
  DARK_APPEARANCE_VALUES,
  FIXED_INTERFACE_PROFILE_VERSION,
  SIDEBAR_ATMOSPHERE_MODE_VALUES,
  SIDEBAR_ATMOSPHERE_MOTION_VALUES,
  SIDEBAR_ATMOSPHERE_VALUES,
  WALLPAPER_SCENE_VALUES,
} from "@/lib/interfaceThemes";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
  themeColor: "#dce9e3",
};

export const metadata: Metadata = {
  title: {
    default: "Ficonter",
    template: "%s · Ficonter",
  },
  description: "Your private financial command center.",
  applicationName: "Ficonter",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Ficonter",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      {
        url: "/ficonter-app-icon.png",
        type: "image/png",
        sizes: "512x512",
      },
    ],
    apple: [
      {
        url: "/apple-icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
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
    var supportedMotion = ${JSON.stringify(BACKGROUND_MOTION_VALUES)};
    var supportedScenes = ${JSON.stringify(WALLPAPER_SCENE_VALUES)};
    var supportedSidebarAtmospheres = ${JSON.stringify(SIDEBAR_ATMOSPHERE_VALUES)};
    var supportedSidebarAtmosphereModes = ${JSON.stringify(SIDEBAR_ATMOSPHERE_MODE_VALUES)};
    var supportedSidebarAtmosphereMotion = ${JSON.stringify(SIDEBAR_ATMOSPHERE_MOTION_VALUES)};
    var profileVersion = localStorage.getItem("ficonter-interface-profile-version");
    var appearance = localStorage.getItem("ficonter-appearance") || "light";
    var density = localStorage.getItem("ficonter-density") || "comfortable";
    var backgroundMotion = localStorage.getItem("ficonter-background-motion") || "animated";
    var wallpaperScene = localStorage.getItem("ficonter-wallpaper-scene") || "coastal-island";
    var sidebarAtmosphereMode = localStorage.getItem("ficonter-sidebar-atmosphere-mode") || "auto";
    var sidebarAtmosphereStyle = localStorage.getItem("ficonter-sidebar-atmosphere-style") || "none";
    var sidebarAtmosphereMotion = localStorage.getItem("ficonter-sidebar-atmosphere-motion") || "animated";

    if (profileVersion !== ${JSON.stringify(FIXED_INTERFACE_PROFILE_VERSION)}) {
      appearance = "light";
      density = "comfortable";
      backgroundMotion = "animated";
      wallpaperScene = "coastal-island";
      sidebarAtmosphereMode = "auto";
      sidebarAtmosphereStyle = "none";
      sidebarAtmosphereMotion = "animated";
      localStorage.setItem("ficonter-appearance", appearance);
      localStorage.setItem("ficonter-density", density);
      localStorage.setItem("ficonter-background-motion", backgroundMotion);
      localStorage.setItem("ficonter-wallpaper-scene", wallpaperScene);
      localStorage.setItem("ficonter-sidebar-atmosphere-mode", sidebarAtmosphereMode);
      localStorage.setItem("ficonter-sidebar-atmosphere-style", sidebarAtmosphereStyle);
      localStorage.setItem("ficonter-sidebar-atmosphere-motion", sidebarAtmosphereMotion);
      localStorage.setItem("ficonter-interface-profile-version", ${JSON.stringify(FIXED_INTERFACE_PROFILE_VERSION)});
    }

    if (supported.indexOf(appearance) === -1) appearance = "light";
    if (density !== "compact") density = "comfortable";
    if (supportedMotion.indexOf(backgroundMotion) === -1) backgroundMotion = "animated";
    if (supportedScenes.indexOf(wallpaperScene) === -1) wallpaperScene = "coastal-island";
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
        case "space-nebula":
          resolvedSidebarAtmosphere = "orbital";
          break;
        case "coastal-island":
          resolvedSidebarAtmosphere = "topography";
          break;
        case "aurora":
          resolvedSidebarAtmosphere = "lightbeam";
          break;
        case "ocean-horizon":
        case "sand-dunes":
        case "forest-mist":
          resolvedSidebarAtmosphere = "topography";
          break;
        case "marble-glow":
        case "future-grid":
          resolvedSidebarAtmosphere = "architectural";
          break;
        case "minimal-luxe":
          resolvedSidebarAtmosphere =
            resolved === "dark" ? "orbital" : "none";
          break;
        default:
          resolvedSidebarAtmosphere = "none";
      }
    }

    root.dataset.theme = appearance;
    root.dataset.resolvedTheme = resolved;
    root.dataset.density = density;
    root.dataset.backgroundMotion = backgroundMotion;
    root.dataset.wallpaperScene = wallpaperScene;
    root.dataset.sidebarAtmosphereMode = sidebarAtmosphereMode;
    root.dataset.sidebarAtmosphereStyle = resolvedSidebarAtmosphere;
    root.dataset.sidebarAtmosphereMotion = sidebarAtmosphereMotion;
    root.style.colorScheme = resolved;
    localStorage.removeItem("ficonter-layout");
  } catch (_) {}
})();`;

const languagePreferenceScript = `
(function () {
  try {
    var supported = ["en","de","es","sq","ar","pt","it","ru"];
    var stored = localStorage.getItem("${LANGUAGE_STORAGE_KEY}");
    var cookieMatch = document.cookie.match(
      new RegExp("(?:^|; )${LANGUAGE_COOKIE_NAME}=([^;]*)")
    );
    var language =
      stored ||
      (cookieMatch ? decodeURIComponent(cookieMatch[1]) : "en");

    language = String(language || "en")
      .toLowerCase()
      .split(/[-_]/)[0];

    if (supported.indexOf(language) === -1) {
      language = "en";
    }

    var rtl = language === "ar";
    var locale = {
      en: "en-GB",
      de: "de-DE",
      es: "es-ES",
      sq: "sq-AL",
      ar: "ar",
      pt: "pt-PT",
      it: "it-IT",
      ru: "ru-RU"
    }[language] || "en-GB";

    var root = document.documentElement;
    root.lang = locale;
    root.dir = rtl ? "rtl" : "ltr";
    root.dataset.language = language;
    root.dataset.direction = rtl ? "rtl" : "ltr";
  } catch (_) {}
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-GB"
      dir="ltr"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: interfacePreferenceScript,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: languagePreferenceScript,
          }}
        />
      </head>
      <body>
        <LanguageProvider initialLanguage={DEFAULT_LANGUAGE}>
          <KeyboardInteractionBridge />
          <ThemeContrastGuard />
          <PWARegister />
          <GlobalLanguageControl />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
