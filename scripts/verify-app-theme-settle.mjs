import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS - ${message}`);
}

const guard = read("components/ThemeContrastGuard.tsx");
const governance = read("app/theme-governance.css");

const transitionMatch = governance.match(/transition-duration:\s*(\d+)ms/);
const settleMatch = guard.match(/APP_THEME_SETTLE_AUDIT_DELAY_MS\s*=\s*(\d+)/);

expect(Boolean(transitionMatch), "theme governance declares an explicit colour transition duration");
expect(Boolean(settleMatch), "installed app contrast guard declares a settled-theme audit delay");

const transitionMs = Number(transitionMatch?.[1]);
const settleMs = Number(settleMatch?.[1]);

expect(
  settleMs > transitionMs,
  "installed app final contrast audit runs after the colour transition has settled",
);
expect(
  guard.includes('root.dataset.ficonterNativeApp === "true"') &&
    guard.includes('root.dataset.ficonterDisplayMode === "standalone"'),
  "settled-theme behavior is restricted to the installed app and not browser sessions",
);
expect(
  guard.includes("clearAdjustments();") &&
    guard.includes("Any correction from the previous theme is now stale"),
  "stale automatic text-colour overrides are cleared before the app theme settles",
);
expect(
  guard.includes("window.clearTimeout(appSettleAuditTimer)"),
  "rapid installed-app theme changes debounce the settled audit",
);
expect(
  guard.includes("fullAuditFrame = window.requestAnimationFrame(runFullAudit)"),
  "installed app performs an authoritative full contrast pass after settling",
);
expect(
  guard.includes('if (!scheduleAppSettledAudit()) scheduleFullAudit();'),
  "browser sessions preserve the existing immediate contrast-audit path",
);
expect(
  guard.includes('"data-ficonter-display-mode"'),
  "contrast guard observes installed-versus-browser display mode",
);
expect(
  guard.includes("if (appSettleAuditTimer) window.clearTimeout(appSettleAuditTimer)"),
  "installed app settle timer is cleaned up on unmount",
);

console.log("FICONTER installed-app theme settling verification passed.");
