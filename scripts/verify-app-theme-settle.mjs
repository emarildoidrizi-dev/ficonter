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

const transitionDurations = [
  ...governance.matchAll(/transition-duration:\s*(\d+)ms/g),
].map((match) => Number(match[1]));
const longestGovernanceTransitionMs = Math.max(...transitionDurations, 0);
const settleMatch = guard.match(/APP_VISUAL_SETTLE_AUDIT_DELAY_MS\s*=\s*(\d+)/);

expect(
  transitionDurations.length > 0,
  "theme governance declares explicit colour transition durations",
);
expect(
  Boolean(settleMatch),
  "installed app contrast guard declares a settled-visual audit delay",
);

const settleMs = Number(settleMatch?.[1]);

expect(
  settleMs > longestGovernanceTransitionMs,
  "installed app final contrast audit runs after global colour transitions have settled",
);
expect(
  settleMs > 180,
  "installed app audit also outlives 180ms interactive control transitions",
);
expect(
  guard.includes('root.dataset.ficonterNativeApp === "true"') &&
    guard.includes('root.dataset.ficonterDisplayMode === "standalone"'),
  "settled-visual behavior is restricted to the installed app and not browser sessions",
);
expect(
  guard.includes("clearAdjustments();") &&
    guard.includes("Any correction from the previous visual state is now stale"),
  "stale automatic text-colour overrides are cleared before app visual states settle",
);
expect(
  guard.includes("clearScopeAdjustments(scope);") &&
    guard.includes("scheduleAppSettledScopeAudit(record.target)"),
  "active-state class changes clear stale app text corrections and trigger a settled scope audit",
);
expect(
  guard.includes('attributeFilter: ["class"]') &&
    guard.includes("attributeOldValue: true"),
  "installed app contrast guard observes class-driven surface changes",
);
expect(
  guard.includes("normalizedClassWithoutAutoContrast") &&
    guard.includes('className !== "ficonter-auto-contrast"'),
  "the observer ignores its own automatic contrast class mutations to avoid feedback loops",
);
expect(
  guard.includes("if (!scheduleAppSettledScopeAudit(node)) scheduleIncrementalAudit(node);"),
  "new app subtrees wait for visual settling while browser added-node audits remain immediate",
);
expect(
  guard.includes("if (!scheduleAppSettledAudit()) scheduleFullAudit(0);"),
  "the installed app initial audit waits for mounted active controls to finish transitioning",
);
expect(
  guard.includes("window.clearTimeout(appSettleAuditTimer)"),
  "rapid installed-app theme changes debounce the full settled audit",
);
expect(
  guard.includes("fullAuditFrame = window.requestAnimationFrame(runFullAudit)"),
  "installed app performs an authoritative full contrast pass after settling",
);
expect(
  guard.includes('if (!scheduleAppSettledAudit()) scheduleFullAudit();'),
  "browser sessions preserve the existing immediate full-audit path",
);
expect(
  guard.includes('"data-ficonter-display-mode"'),
  "contrast guard observes installed-versus-browser display mode",
);
expect(
  guard.includes("if (appScopeAuditTimer) window.clearTimeout(appScopeAuditTimer)") &&
    guard.includes("if (appScopeAuditFrame) window.cancelAnimationFrame(appScopeAuditFrame)"),
  "installed app scoped settle work is cleaned up on unmount",
);

console.log("FICONTER installed-app visual settling verification passed.");
