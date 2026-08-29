import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(scriptsDir, "verify-localization.mjs");
const generatedPath = join(scriptsDir, ".verify-localization-governance.generated.mjs");

let source = readFileSync(sourcePath, "utf8");

const globalRowsBlock = `const globalTemplateRows = findCatalogRows(\n  "lib/i18n/globalRuntimeTemplates.ts",\n  "GLOBAL_RUNTIME_TEMPLATES",\n);`;
if (!source.includes(globalRowsBlock)) {
  throw new Error("Localization verifier structure changed: global template catalog block not found.");
}
source = source.replace(
  globalRowsBlock,
  `${globalRowsBlock}\nconst governanceRows = findCatalogRows(\n  "lib/i18n/governanceUiCatalog.ts",\n  "GOVERNANCE_UI_TRANSLATIONS",\n);\nconst governanceRowsBatch2 = findCatalogRows(\n  "lib/i18n/governanceUiCatalogBatch2.ts",\n  "GOVERNANCE_UI_TRANSLATIONS_BATCH_2",\n);`,
);

const catalogLoop = "for (const catalog of [fullRows, landingRows, wealthRows, wealthTemplateRows, globalTemplateRows])";
if (!source.includes(catalogLoop)) {
  throw new Error("Localization verifier structure changed: catalog validation loop not found.");
}
source = source.replace(
  catalogLoop,
  "for (const catalog of [fullRows, landingRows, wealthRows, wealthTemplateRows, globalTemplateRows, governanceRows, governanceRowsBatch2])",
);

const coveredTail = `  ...wealthRows.keys(),\n]);`;
if (!source.includes(coveredTail)) {
  throw new Error("Localization verifier structure changed: coverage set tail not found.");
}
source = source.replace(
  coveredTail,
  `  ...wealthRows.keys(),\n  ...governanceRows.keys(),\n  ...governanceRowsBatch2.keys(),\n]);`,
);

const globalCountAssert = "assert(globalTemplateRows.size >= 75, `Global runtime template catalog is unexpectedly small (${globalTemplateRows.size}).`);";
if (!source.includes(globalCountAssert)) {
  throw new Error("Localization verifier structure changed: global template count assertion not found.");
}
source = source.replace(
  globalCountAssert,
  `${globalCountAssert}\nassert(governanceRows.size >= 1, "Governance UI translation catalog is empty.");\nassert(governanceRowsBatch2.size >= 1, "Governance UI translation catalog batch 2 is empty.");`,
);

writeFileSync(generatedPath, source, "utf8");
try {
  const result = spawnSync(process.execPath, [generatedPath], {
    cwd: join(scriptsDir, ".."),
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  try { unlinkSync(generatedPath); } catch {}
}
