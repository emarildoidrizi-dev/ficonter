import type { Metadata } from "next";
import "./globals.css";
import "./theme-palettes.css";
import { KeyboardInteractionBridge } from "@/components/KeyboardInteractionBridge";
import { APPEARANCE_VALUES, DARK_APPEARANCE_VALUES } from "@/lib/interfaceThemes";

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
    var appearance = localStorage.getItem("ficonter-appearance") || "light";
    var density = localStorage.getItem("ficonter-density") || "comfortable";
    if (supported.indexOf(appearance) === -1) appearance = "light";
    if (density !== "compact") density = "comfortable";
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var resolved = appearance === "system"
      ? (prefersDark ? "dark" : "light")
      : (darkThemes.indexOf(appearance) >= 0 ? "dark" : "light");
    root.dataset.theme = appearance;
    root.dataset.resolvedTheme = resolved;
    root.dataset.density = density;
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
