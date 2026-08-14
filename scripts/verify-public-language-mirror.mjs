import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const provider = read("components/LanguageProvider.tsx");
const selector = read("components/LanguageSelector.tsx");
const selectorCss = read("components/LanguageSelector.module.css");
const bootstrap = read("components/AuthenticatedLanguageBootstrap.tsx");
const globalControl = read("components/GlobalLanguageControl.tsx");
const landing = read("app/page.tsx");
const config = read("lib/i18n/config.ts");
const chrome = read("components/FiconterNativeAppChrome.tsx");
const chromeCss = read("components/FiconterNativeAppChrome.module.css");

const checks = [
  [provider.includes("readBrowserLanguagePreference()"), "provider reads the persisted browser language before replacing it"],
  [provider.includes("LANGUAGE_CHANGED_EVENT"), "provider broadcasts/listens for language changes"],
  [provider.includes('window.addEventListener("storage"'), "provider mirrors language changes across tabs"],
  [provider.includes('window.addEventListener("pageshow"'), "provider restores the selected language after history navigation"],
  [selector.includes("data-language-world-control"), "public selector exposes the top world control"],
  [selector.includes("<Globe2"), "world/globe icon is rendered"],
  [selectorCss.includes(".public .worldIcon"), "public world icon has visible styling"],
  [globalControl.includes("insideApplication || landingOwnsLanguageControl"), "auth pages keep the global top language control while app/landing avoid duplicates"],
  [landing.includes('<LanguageSelector variant="public" />'), "landing page has the shared public language selector"],
  [bootstrap.includes("browserLanguagePreference"), "authenticated bootstrap reads the public/login preference"],
  [bootstrap.includes("accountLanguage !== browserLanguage"), "public/login choice is mirrored to the authenticated account when needed"],
  [bootstrap.includes("normalizeLanguage(language), false"), "new devices inherit the account language back to public pages"],
  [selector.includes('type Variant = "compact" | "settings" | "public" | "icon"'), "selector supports a globe-only authenticated header variant"],
  [chrome.includes('<LanguageSelector variant="icon" />'), "authenticated mobile header renders the world language control"],
  [chromeCss.includes('.headerLanguage'), "authenticated globe has a dedicated header position"],
  [["en", "de", "es", "sq", "ar", "pt", "it", "ru"].every((code) => config.includes(`\"${code}\"`)), "all eight launch languages remain available"],
];

let passed = 0;
for (const [ok, label] of checks) {
  if (!ok) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    passed += 1;
    console.log(`PASS: ${label}`);
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`Public language mirror verification passed ${passed}/${checks.length}.`);
