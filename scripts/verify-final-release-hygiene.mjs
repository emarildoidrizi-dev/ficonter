import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoots = ["app", "components", "lib"];
const sourceExtensions = new Set([".ts", ".tsx"]);
const asAnyBaselinePath = "scripts/release-hygiene-as-any-baseline.json";

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(relative));
    else out.push(relative);
  }
  return out;
}

function portable(relative) {
  return relative.split(path.sep).join("/");
}

const sourceFiles = sourceRoots.flatMap(walk).filter((file) => sourceExtensions.has(path.extname(file)));
const checks = [];
const expect = (condition, message) => checks.push([condition, message]);

for (const forbidden of ["baseline_restore", "upload-to-repository", "node_modules-test-copy"]) {
  const found = walk(".").some((file) => file.split(path.sep).includes(forbidden));
  expect(!found, `No stale ${forbidden} source snapshot is packaged`);
}

expect(!fs.existsSync(path.join(root, "app/mobile-screen-stack.css")), "Retired second mobile transition stylesheet is absent");
for (const file of [
  "components/MobileNavigationController.tsx",
  "components/PWAMobileDock.tsx",
  "components/HorizonOverviewBoard.tsx",
  "components/HorizonCommandStrip.tsx",
  "components/ReloadToOverviewOnRefresh.tsx",
  "components/FinancialGpsSummary.tsx",
  "components/FinancialSetupSummary.tsx",
]) {
  expect(!fs.existsSync(path.join(root, file)), `${file} is retired`);
}

const joined = sourceFiles.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
expect(!/\b(?:TODO|FIXME|HACK|XXX)\b/.test(joined), "No unresolved source TODO/FIXME/HACK markers remain");
expect(!/@ts-(?:ignore|expect-error)/.test(joined), "No TypeScript error suppression directives remain");

const baselineFile = path.join(root, asAnyBaselinePath);
expect(fs.existsSync(baselineFile), "Unsafe-cast baseline is versioned");
let baseline = { baselineCommit: "", allowedFiles: [] };
try {
  baseline = JSON.parse(fs.readFileSync(baselineFile, "utf8"));
} catch {
  // The explicit check below reports a deterministic failure.
}
const allowedAsAnyFiles = new Set(Array.isArray(baseline.allowedFiles) ? baseline.allowedFiles : []);
const asAnyFiles = sourceFiles
  .filter((file) => /\bas any\b/.test(fs.readFileSync(path.join(root, file), "utf8")))
  .map(portable)
  .sort();
const unexpectedAsAnyFiles = asAnyFiles.filter((file) => !allowedAsAnyFiles.has(file));
expect(
  typeof baseline.baselineCommit === "string" && /^[0-9a-f]{40}$/.test(baseline.baselineCommit),
  "Unsafe-cast baseline records the audited production commit",
);
expect(
  unexpectedAsAnyFiles.length === 0,
  `No new 'as any' escape hatches appear outside the audited baseline${unexpectedAsAnyFiles.length ? `: ${unexpectedAsAnyFiles.join(", ")}` : ""}`,
);

expect(!fs.readdirSync(root).some((name) => name.endsWith(".tsbuildinfo")), "No local TypeScript build cache is packaged");

const importPattern = /(?:from\s+|import\s*\()["']([^"']+)["']/g;
let missingImports = [];
for (const file of sourceFiles) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  for (const match of text.matchAll(importPattern)) {
    const spec = match[1];
    if (!(spec.startsWith("@/") || spec.startsWith("./") || spec.startsWith("../"))) continue;
    const base = spec.startsWith("@/")
      ? path.join(root, spec.slice(2))
      : path.resolve(root, path.dirname(file), spec);
    const candidates = [
      base,
      `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, `${base}.mjs`, `${base}.json`,
      path.join(base, "index.ts"), path.join(base, "index.tsx"), path.join(base, "index.js"),
    ];
    if (!candidates.some((candidate) => fs.existsSync(candidate))) missingImports.push(`${file} -> ${spec}`);
  }
}
expect(missingImports.length === 0, `All local imports resolve${missingImports.length ? `: ${missingImports.join(", ")}` : ""}`);

let passed = 0;
for (const [condition, message] of checks) {
  console.log(`${condition ? "PASS" : "FAIL"} - ${message}`);
  if (condition) passed += 1;
}
console.log(`\n${passed}/${checks.length} final release hygiene checks passed across ${sourceFiles.length} source files.`);
if (passed !== checks.length) process.exit(1);
