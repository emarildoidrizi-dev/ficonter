import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS - ${message}`);
}

const settings = read("components/SettingsWorkspace.tsx");
const typography = read("app/theme-typography-v133.css");
const palettes = read("app/theme-palettes.css");
const sw = read("public/sw.js");

const previewStart = settings.indexOf("function applyInterfacePreview");
const persistedStart = settings.indexOf("function applyInterface(preferences");
const previewBlock = settings.slice(previewStart, persistedStart);
const themeChangeStart = settings.indexOf("const next = { ...preferences, appearance: value }");
const themeChangeBlock = settings.slice(themeChangeStart, themeChangeStart + 700);

expect(previewStart >= 0, "a dedicated live appearance preview function exists");
expect(settings.includes("function applyInterfaceDom"), "theme DOM mutation is centralized in one synchronous function");
expect(settings.includes("root.dataset.theme = preferences.appearance"), "live preview updates the global theme attribute directly");
expect(settings.includes("root.dataset.resolvedTheme = resolvedTheme"), "live preview resolves light/dark system state in the same DOM commit");
expect(previewBlock.includes("applyInterfaceDom(preferences)"), "preview uses the same global DOM theme source of truth");
expect(!previewBlock.includes("localStorage.setItem"), "preview does not persist into localStorage");
expect(!previewBlock.includes("saveMetadata"), "preview does not wait for Supabase persistence");
expect(themeChangeBlock.includes("applyInterfacePreview(next);"), "theme click applies the live preview immediately");
expect(themeChangeBlock.indexOf("applyInterfacePreview(next);") < themeChangeBlock.indexOf("setPreferences(next);"), "DOM theme switches before the React state rerender");
expect(!themeChangeBlock.includes("router.refresh") && !themeChangeBlock.includes("window.location"), "theme click requires no refresh or navigation");
expect(settings.includes('if (active !== "appearance")') && settings.includes("applyInterfacePreview(savedPreferences);"), "leaving Appearance restores the last saved theme when the preview was not saved");
expect(settings.includes("applyInterfacePreview(savedPreferencesRef.current);"), "leaving Settings entirely restores the last saved appearance");
expect(settings.includes("savedPreferencesRef.current = next;") && settings.includes("applyInterface(next);"), "Save appearance commits the preview and updates the saved snapshot");
expect(typography.includes('html[data-theme="midnight"]') && typography.includes("var(--font-display)"), "typography is controlled by the same data-theme attribute as the palette");
expect(typography.includes("font family is not delayed") || (!typography.includes("transition: font") && !typography.includes("transition-property: font-family")), "font family has no transition delay");
expect(palettes.includes("data-theme"), "theme palette is also rooted in data-theme");
expect(sw.includes("instant-theme-preview-v134") || sw.includes("mobile-runtime-recovery-v135"), "PWA cache is versioned for the instant preview release or a newer runtime recovery");

console.log("FICONTER V1.34 instant theme + typography preview verification passed.");
