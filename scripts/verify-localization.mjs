import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const config = read("lib/i18n/config.ts");
const phrases = read("lib/i18n/phrases.ts");
const rootLayout = read("app/layout.tsx");
const dashboardLayout = read("app/dashboard/layout.tsx");
const businessLayout = read("app/business/layout.tsx");
const workspaceSwitcher = read("components/WorkspaceSwitcher.tsx");
const settings = read("components/SettingsWorkspace.tsx");
const provider = read("components/LanguageProvider.tsx");

for (const language of ["en", "de", "es", "sq", "ar", "pt", "it", "ru"]) {
  assert(config.includes(`"${language}"`), `Missing supported language: ${language}`);
}

assert(rootLayout.includes("<LanguageProvider"), "Root layout is missing LanguageProvider.");
assert(rootLayout.includes("<GlobalLanguageControl"), "Public language selector is missing.");
assert(workspaceSwitcher.includes("<LanguageSelector"), "Top-bar language selector is missing.");
assert(settings.includes('active === "language"'), "Settings language section is missing.");
assert(settings.includes('<LanguageSelector variant="settings"'), "Settings selector is not active.");
assert(dashboardLayout.includes("AuthenticatedLanguageBootstrap"), "Personal account language bootstrap is missing.");
assert(businessLayout.includes("AuthenticatedLanguageBootstrap"), "Business account language bootstrap is missing.");
assert(provider.includes("supabase.auth.updateUser"), "Account language persistence is missing.");
assert(provider.includes("MutationObserver"), "Instant full-page translation bridge is missing.");
assert(provider.includes("root.dir = option.direction"), "RTL document direction is missing.");

const phraseCount = (phrases.match(/^\s+".*": p\(/gm) ?? []).length;
assert(phraseCount >= 400, `Translation phrase coverage is too small (${phraseCount}).`);

console.log(`Localization verification passed with ${phraseCount} translated interface phrases.`);
