import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const expect = (source, fragment, message) => {
  if (!source.includes(fragment)) throw new Error(message);
};

const mobile = read("app/native-mobile-app.css");
const guard = read("components/ThemeContrastGuard.tsx");
const chrome = read("components/FiconterNativeAppChrome.module.css");

for (const token of [
  "--mobile-text-primary",
  "--mobile-text-secondary",
  "--mobile-text-tertiary",
  "--mobile-canvas",
  "--mobile-surface",
  "--mobile-control-bg",
  "--mobile-border",
  "--mobile-accent",
]) {
  expect(mobile, token, `Missing mobile semantic token: ${token}`);
}

expect(mobile, '[data-resolved-theme="light"]', "Mobile must explicitly honor the light color scheme.");
expect(mobile, '[data-resolved-theme="dark"]', "Mobile must explicitly honor the dark color scheme.");
expect(mobile, "--mobile-page-title-size", "Mobile must use one page-title scale token.");
expect(mobile, "var(--mobile-control-text-size)", "Mobile controls must use the stable control type token.");
expect(mobile, "var(--mobile-text-tertiary)", "Mobile placeholders must use the tertiary semantic text token.");
expect(guard, 'record.addedNodes', "Runtime contrast audit must protect newly rendered mobile content incrementally.");
if (guard.includes('if (root.dataset.ficonterNativeApp === "true") return')) {
  throw new Error("Runtime contrast protection must not skip native mobile mode.");
}
expect(guard, '"data-ficonter-native-app"', "Contrast guard must react when mobile mode changes.");
expect(chrome, "var(--mobile-chrome-text)", "Mobile chrome must use stable text tokens.");
expect(chrome, "var(--mobile-chrome-accent)", "Mobile chrome must use stable accent tokens.");

if (/html\[data-ficonter-native-app="true"\]\s*\{[\s\S]{0,1400}color-scheme:\s*dark;/.test(mobile)) {
  throw new Error("Mobile root still forces dark color-scheme regardless of the selected theme.");
}

console.log("FICONTER mobile UI Phase 2: 19 stabilization checks passed.");
