import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
const check = (name, condition) => checks.push({ name, condition: Boolean(condition) });

const register = read("components/PWARegister.tsx");
const sw = read("public/sw.js");
const speed = read("components/NavigationSpeedBoost.tsx");
const contrast = read("components/ThemeContrastGuard.tsx");
const manifest = read("app/manifest.ts");

check(
  "PWA cache uses the V1.35 mobile runtime recovery generation",
  sw.includes("ficonter-pwa-static-v14-mobile-runtime-recovery-v135"),
);
check(
  "Next build assets bypass the service-worker cache",
  sw.includes('if (url.pathname.startsWith("/_next/")) return;'),
);
check(
  "Navigation remains network-first with an explicit offline fallback",
  sw.includes('if (request.mode === "navigate")') &&
    sw.includes('fetch(request).catch') &&
    sw.includes('caches.match("/offline.html")'),
);
check(
  "Service worker activation removes obsolete FICONTER caches",
  sw.includes('key.startsWith("ficonter-pwa-")') && sw.includes("caches.delete(key)"),
);
check(
  "A newly activated worker claims existing clients",
  sw.includes("self.clients.claim()"),
);
check(
  "Activated worker announces its runtime version to open clients",
  sw.includes('type: "FICONTER_SW_ACTIVATED"') && sw.includes('version: RUNTIME_VERSION'),
);
check(
  "PWA registration bypasses HTTP cache when checking the worker script",
  register.includes('updateViaCache: "none"'),
);
check(
  "Existing controlled clients reload once after a service-worker takeover",
  register.includes('addEventListener("controllerchange"') &&
    register.includes("CONTROLLER_RELOAD_KEY") &&
    register.includes("window.location.reload()"),
);
check(
  "First-time service-worker installation does not force a reload loop",
  register.includes("hadControllerAtMount") &&
    register.includes("if (cancelled || !hadControllerAtMount) return"),
);
check(
  "Broken Next.js chunk/CSS loads trigger one guarded recovery",
  register.includes("runtimeAssetFailure") &&
    register.includes("ChunkLoadError") &&
    register.includes("ASSET_RECOVERY_KEY"),
);
check(
  "Runtime recovery clears legacy FICONTER service-worker caches",
  register.includes("clearLegacyFiconterCaches") &&
    register.includes('key.startsWith("ficonter-pwa-")'),
);
check(
  "Installed phones do not background-prefetch the whole financial app",
  speed.includes("const nativePhone = isNativePhoneApp()") &&
    speed.includes("criticalRoutes.slice(0, 2).forEach") &&
    speed.includes("if (nativePhone) return"),
);
check(
  "Touch/pointer navigation still prefetches the destination on demand",
  speed.includes("handlePointerDown") &&
    speed.includes("handleTouchStart") &&
    speed.includes("warmTarget(event.target)"),
);
check(
  "Theme contrast protection is split into small phone batches",
  contrast.includes("MOBILE_AUDIT_BATCH_SIZE = 18") &&
    contrast.includes("runContrastBatch") &&
    contrast.includes("window.requestAnimationFrame(runContrastBatch)"),
);
check(
  "Contrast protection still audits native phone content instead of disabling itself",
  !contrast.includes('if (root.dataset.ficonterNativeApp === "true") return'),
);
check(
  "The PWA still launches into the authenticated dashboard workspace",
  manifest.includes('start_url: "/dashboard"') && manifest.includes('display: "standalone"'),
);

for (const item of checks) {
  console.log(`${item.condition ? "PASS" : "FAIL"}  ${item.name}`);
}

const failed = checks.filter((item) => !item.condition);
if (failed.length) {
  console.error(`\n${failed.length} V1.35 PWA mobile runtime check(s) failed.`);
  process.exit(1);
}

console.log(`\n${checks.length}/${checks.length} FICONTER V1.35 PWA mobile runtime checks passed.`);
