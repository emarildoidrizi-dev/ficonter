import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const entry = readFileSync(resolve(root, "lib/effortlessEntry.ts"), "utf8");
const localizer = readFileSync(resolve(root, "lib/i18n/dateText.ts"), "utf8");

const visibleConfigPhrases = [
  "About 10 seconds",
  "One screen · 3 choices",
  "About 30 seconds",
  "3 steps · optional details",
  "Maximum control",
  "Full form · all fields",
];

for (const phrase of visibleConfigPhrases) {
  if (!entry.includes(phrase)) {
    throw new Error(`Effortless Entry source phrase missing: ${phrase}`);
  }
  if (!localizer.includes(`\"${phrase}\"`)) {
    throw new Error(`Configuration-driven UI phrase is not localized: ${phrase}`);
  }
}

for (const language of ["de", "es", "sq", "ar", "pt", "it", "ru"]) {
  if (!localizer.includes(`${language}:`)) {
    throw new Error(`Configuration-driven localization is missing language ${language}`);
  }
}

console.log("Configuration-driven localization verification passed.");
