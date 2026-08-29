import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);

function read(path) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const config = read("lib/i18n/config.ts");
const messages = read("lib/i18n/messages.ts");
const runtimeTranslator = read("lib/i18n/runtimeTranslator.ts");
const packageJson = JSON.parse(read("package.json"));

assert(
  config.includes('export const DEFAULT_LANGUAGE: FiconterLanguage = "en";'),
  "English must remain the permanent default language.",
);

assert(
  messages.includes("translatedMessages[language]?.[key] ?? englishMessages[key]"),
  "Message translation failures must fall back to English.",
);

assert(
  runtimeTranslator.includes("cacheSet(cacheKey, source);\n  return source;"),
  "Runtime translation failures must preserve the English source string as the safety fallback.",
);

assert(
  packageJson.scripts?.build?.includes("verify:localization"),
  "Localization verification must run before every production build.",
);

assert(
  packageJson.scripts?.["verify:all"]?.includes("verify:localization"),
  "Localization verification must remain part of full platform verification.",
);

console.log("Localization governance verified: complete translations required; English remains the permanent safety fallback.");
