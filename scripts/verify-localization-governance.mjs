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
  `${globalRowsBlock}\nconst governanceRows = findCatalogRows(\n  "lib/i18n/governanceUiCatalog.ts",\n  "GOVERNANCE_UI_TRANSLATIONS",\n);\nconst governanceRowsBatch2 = findCatalogRows(\n  "lib/i18n/governanceUiCatalogBatch2.ts",\n  "GOVERNANCE_UI_TRANSLATIONS_BATCH_2",\n);\nconst governanceRowsBatch3 = findCatalogRows(\n  "lib/i18n/governanceUiCatalogBatch3.ts",\n  "GOVERNANCE_UI_TRANSLATIONS_BATCH_3",\n);\nconst governanceRowsBatch4 = findCatalogRows(\n  "lib/i18n/governanceUiCatalogBatch4.ts",\n  "GOVERNANCE_UI_TRANSLATIONS_BATCH_4",\n);\nconst governanceRowsBatch5 = findCatalogRows(\n  "lib/i18n/governanceUiCatalogBatch5.ts",\n  "GOVERNANCE_UI_TRANSLATIONS_BATCH_5",\n);\nconst governanceRowsBatch6 = findCatalogRows(\n  "lib/i18n/governanceUiCatalogBatch6.ts",\n  "GOVERNANCE_UI_TRANSLATIONS_BATCH_6",\n);\nconst governanceRowsBatch7 = findCatalogRows(\n  "lib/i18n/governanceUiCatalogBatch7.ts",\n  "GOVERNANCE_UI_TRANSLATIONS_BATCH_7",\n);\nconst governanceRowsBatch8 = findCatalogRows(\n  "lib/i18n/governanceUiCatalogBatch8.ts",\n  "GOVERNANCE_UI_TRANSLATIONS_BATCH_8",\n);`,
);

const catalogLoop = "for (const catalog of [fullRows, landingRows, wealthRows, wealthTemplateRows, globalTemplateRows])";
if (!source.includes(catalogLoop)) {
  throw new Error("Localization verifier structure changed: catalog validation loop not found.");
}
source = source.replace(
  catalogLoop,
  "for (const catalog of [fullRows, landingRows, wealthRows, wealthTemplateRows, globalTemplateRows, governanceRows, governanceRowsBatch2, governanceRowsBatch3, governanceRowsBatch4, governanceRowsBatch5, governanceRowsBatch6, governanceRowsBatch7, governanceRowsBatch8])",
);

const coveredTail = `  ...wealthRows.keys(),\n]);`;
if (!source.includes(coveredTail)) {
  throw new Error("Localization verifier structure changed: coverage set tail not found.");
}
source = source.replace(
  coveredTail,
  `  ...wealthRows.keys(),\n  ...governanceRows.keys(),\n  ...governanceRowsBatch2.keys(),\n  ...governanceRowsBatch3.keys(),\n  ...governanceRowsBatch4.keys(),\n  ...governanceRowsBatch5.keys(),\n  ...governanceRowsBatch6.keys(),\n  ...governanceRowsBatch7.keys(),\n  ...governanceRowsBatch8.keys(),\n  // Internal transaction-description classifier used for Wealth calculations, not rendered UI.\n  "goal investment",\n]);`,
);

const globalCountAssert = "assert(globalTemplateRows.size >= 75, `Global runtime template catalog is unexpectedly small (${globalTemplateRows.size}).`);";
if (!source.includes(globalCountAssert)) {
  throw new Error("Localization verifier structure changed: global template count assertion not found.");
}
source = source.replace(
  globalCountAssert,
  `${globalCountAssert}\nassert(governanceRows.size >= 1, "Governance UI translation catalog is empty.");\nassert(governanceRowsBatch2.size >= 1, "Governance UI translation catalog batch 2 is empty.");\nassert(governanceRowsBatch3.size >= 1, "Governance UI translation catalog batch 3 is empty.");\nassert(governanceRowsBatch4.size >= 1, "Governance UI translation catalog batch 4 is empty.");\nassert(governanceRowsBatch5.size >= 1, "Governance UI translation catalog batch 5 is empty.");\nassert(governanceRowsBatch6.size >= 1, "Governance UI translation catalog batch 6 is empty.");\nassert(governanceRowsBatch7.size >= 1, "Governance UI translation catalog batch 7 is empty.");\nassert(governanceRowsBatch8.size >= 1, "Governance UI translation catalog batch 8 is empty.");`,
);

const nonLocalizableMarker = `const NON_LOCALIZABLE_VISIBLE = new Set([\n  "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "EUR", "SKU", "COGS", "APR", "you@example.com",\n]);`;
if (!source.includes(nonLocalizableMarker)) {
  throw new Error("Localization verifier structure changed: non-localizable set not found.");
}
source = source.replace(
  nonLocalizableMarker,
  `const NON_LOCALIZABLE_VISIBLE = new Set([\n  "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "EUR", "SKU", "COGS", "APR", "you@example.com",\n  // Security/technical literals whose exact characters must never be translated.\n  "FICONTER-RECOVERY-1.…",\n  // Internal E2EE maintenance step identifiers: used only in developer console warnings, never rendered to customers.\n  "legacy transaction migration",\n  "pending encrypted bill transaction finalization",\n  "pending encrypted debt payment finalization",\n  "pending recurring template transaction finalization",\n  "pending server transaction finalization",\n]);`,
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
