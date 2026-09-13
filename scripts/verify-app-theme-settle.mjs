import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS - ${message}`);
}

const guard = read("components/ThemeContrastGuard.tsx");
const settingsSync = read("components/InstalledAppSettingsSelectionSync.tsx");
const rootLayout = read("app/layout.tsx");
const governance = read("app/theme-governance.css");

expect(
  guard.includes('root.dataset.ficonterNativeApp === "true"') &&
    guard.includes('root.dataset.ficonterDisplayMode === "standalone"'),
  "contrast guard detects the installed standalone app",
);
expect(
  guard.includes("if (installedApp) {") &&
    guard.includes("clearExistingAutoContrastOverrides();") &&
    guard.includes("return;"),
  "installed app exits the JavaScript contrast guard before observers are installed",
);
expect(
  guard.includes("semantic CSS theme tokens as the single source") &&
    guard.includes("Never recolour app text after render"),
  "installed app documents CSS as the sole runtime colour authority",
);
expect(
  !guard.includes("APP_VISUAL_SETTLE_AUDIT_DELAY_MS") &&
    !guard.includes("scheduleAppSettledAudit") &&
    !guard.includes("scheduleAppSettledScopeAudit"),
  "installed app has no delayed post-render contrast audit path",
);
expect(
  guard.includes('new MutationObserver(() => scheduleFullAudit())') &&
    guard.includes("scheduleIncrementalAudit(node)"),
  "browser sessions retain the existing automatic contrast safety audit",
);
expect(
  rootLayout.includes("mobileAppModeScript") &&
    rootLayout.includes("<ThemeContrastGuard />"),
  "display mode is established by the root layout before the contrast guard mounts",
);
expect(
  governance.includes("transition-duration:"),
  "theme governance still owns visual transition timing",
);
expect(
  settingsSync.includes('button[data-ficonter-settings-selected="true"] strong') &&
    settingsSync.includes("color: var(--solid-text) !important"),
  "selected Settings text uses the semantic foreground token immediately",
);
expect(
  settingsSync.includes('data-ficonter-settings-back-sync="true"') &&
    settingsSync.includes("transition-duration: 0ms !important"),
  "installed Settings back navigation commits its saved theme without a delayed colour transition",
);

console.log("FICONTER installed-app CSS theme authority verification passed.");
