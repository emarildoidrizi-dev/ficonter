import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const checks = [];
function check(name, condition) {
  checks.push({ name, ok: Boolean(condition) });
}

const component = read("components/StatementImportWorkspace.tsx");
const route = read("app/api/financial-file/pdf-extract/route.ts");
const parser = read("lib/pdfFinancialImport.ts");
const packageJson = JSON.parse(read("package.json"));
const nextConfig = read("next.config.ts");

check("UI renamed to Financial File Import", component.includes("Financial File Import"));
check("Old visible Statement Import title removed", !component.includes("<h2>Statement Import</h2>"));
check("PDF input accepted", component.includes(".pdf,.csv,.tsv,.txt"));
check("PDF upload route called", component.includes('/api/financial-file/pdf-extract'));
check("PDF review warning shown", component.includes("PDF layouts differ"));
check("Searchable PDF limitation explained", component.includes("Scanned image-only"));
check("PDF extraction endpoint authenticates", route.includes("supabase.auth.getUser"));
check("PDF extraction endpoint checks same origin", route.includes("isSameOriginRequest"));
check("PDF file size capped", route.includes("MAX_PDF_BYTES"));
check("PDF page count capped", route.includes("MAX_PAGES"));
check("PDF row count capped", route.includes("MAX_ROWS"));
check("PDF files are not stored", !route.includes("storage.from"));
check("Text-based PDF parser included", parser.includes("groupPdfTextItemsIntoLines"));
check("Transaction-line extraction included", parser.includes("extractTransactionsFromPdfLines"));
check("Direction assumptions are counted", parser.includes("assumedDirectionCount"));
check("unpdf dependency included", Boolean(packageJson.dependencies?.["unpdf"]));
check("unpdf remains server-side", route.includes('from "unpdf"') && route.includes('runtime = "nodejs"') && !component.includes('from "unpdf"'));

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? "PASS" : "FAIL"} ${item.name}`);
if (failed.length) {
  console.error(`\n${failed.length} verification check(s) failed.`);
  process.exit(1);
}
console.log(`\n${checks.length} Financial File Import checks passed.`);
