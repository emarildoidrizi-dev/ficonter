import type { Metadata, Viewport } from "next";

import "./globals.css";
import "./theme-palettes.css";
import "./living-themes.css";
import "./native-mobile-app.css";
import "./coastal-shell.css";
import "./mobile-module-layouts.css";
import "./mobile-comfort.css";
import "./mobile-shell-v2.css";
import "./mobile-unified-v1.css";
import "./mobile-page-stack.css";
import "./theme-governance.css";

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
    var profileVersion = localStorage.getItem("ficonter-interface-profile-version");
    var appearance = localStorage.getItem("ficonter-appearance") || "light";
    var density = localStorage.getItem("ficonter-density") || "comfortable";
    var backgroundMotion = localStorage.getItem("ficonter-background-motion") || "static";
    var wallpaperScene = localStorage.getItem("ficonter-wallpaper-scene") || "coastal-island";

    if (profileVersion !== ${JSON.stringify(FIXED_INTERFACE_PROFILE_VERSION)}) {
      appearance = "light";
      density = "comfortable";
      backgroundMotion = "static";
      wallpaperScene = "coastal-island";
      localStorage.setItem("ficonter-appearance", appearance);
      localStorage.setItem("ficonter-density", density);
      localStorage.setItem("ficonter-background-motion", backgroundMotion);
      localStorage.setItem("ficonter-wallpaper-scene", wallpaperScene);
      localStorage.setItem("ficonter-interface-profile-version", ${JSON.stringify(FIXED_INTERFACE_PROFILE_VERSION)});
    }

    if (supported.indexOf(appearance) === -1) appearance = "light";
    if (density !== "compact") density = "comfortable";
    if (supportedMotion.indexOf(backgroundMotion) === -1) backgroundMotion = "static";
    if (supportedScenes.indexOf(wallpaperScene) === -1) wallpaperScene = "coastal-island";

    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var resolved = appearance === "system"
      ? (prefersDark ? "dark" : "light")
      : (darkThemes.indexOf(appearance) >= 0 ? "dark" : "light");

    root.dataset.theme = appearance;
    root.dataset.resolvedTheme = resolved;
    root.dataset.density = density;
    root.dataset.backgroundMotion = backgroundMotion;
    root.dataset.wallpaperScene = wallpaperScene;
    delete root.dataset.sidebarAtmosphereMode;
    delete root.dataset.sidebarAtmosphereStyle;
    delete root.dataset.sidebarAtmosphereMotion;
    root.style.colorScheme = resolved;
    localStorage.removeItem("ficonter-layout");
    localStorage.removeItem("ficonter-sidebar-atmosphere-mode");
    localStorage.removeItem("ficonter-sidebar-atmosphere-style");
    localStorage.removeItem("ficonter-sidebar-atmosphere-motion");
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


const mobileAppModeScript = `
(function () {
  try {
    var root = document.documentElement;
    var pathname = window.location.pathname || "";
    var inWorkspace =
      pathname === "/dashboard" ||
      pathname.indexOf("/dashboard/") === 0 ||
      pathname === "/business" ||
      pathname.indexOf("/business/") === 0;

    if (!inWorkspace) {
      root.dataset.ficonterNativeApp = "false";
      root.dataset.ficonterDevice = "desktop";
      root.dataset.ficonterDisplayMode = "browser";
      return;
    }

    var viewport = window.visualViewport;
    var width = Math.max(
      1,
      Math.round(
        (viewport && viewport.width) ||
          window.innerWidth ||
          root.clientWidth ||
          1024
      )
    );
    var height = Math.max(
      1,
      Math.round(
        (viewport && viewport.height) ||
          window.innerHeight ||
          root.clientHeight ||
          768
      )
    );
    var standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      navigator.standalone === true;
    var screenWidth =
      (window.screen && window.screen.width) || width;
    var screenHeight =
      (window.screen && window.screen.height) || height;
    var shortestPhysicalSide = Math.min(
      screenWidth,
      screenHeight
    );
    var touchCapable =
      (navigator.maxTouchPoints || 0) > 0 ||
      window.matchMedia("(pointer: coarse)").matches;
    var compactViewport = width <= 900;
    var tabletOrFoldable =
      touchCapable &&
      shortestPhysicalSide <= 1180 &&
      Math.max(width, height) <= 1440;
    var installedCompact = standalone && width <= 1180;
    var device = "desktop";

    if (
      width <= 640 ||
      (touchCapable && shortestPhysicalSide <= 640)
    ) {
      device = "phone";
    } else if (
      compactViewport ||
      tabletOrFoldable ||
      installedCompact
    ) {
      device = "tablet";
    }

    root.dataset.ficonterNativeApp =
      device === "desktop" ? "false" : "true";
    root.dataset.ficonterDevice = device;
    root.dataset.ficonterDisplayMode =
      standalone ? "standalone" : "browser";
    root.dataset.ficonterOrientation =
      width >= height ? "landscape" : "portrait";
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
        <script
          dangerouslySetInnerHTML={{
            __html: mobileAppModeScript,
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
