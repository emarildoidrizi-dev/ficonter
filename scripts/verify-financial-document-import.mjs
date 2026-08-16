import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (relative) => readFileSync(path.join(root, relative), "utf8");

const extraction = read("lib/financialDocumentExtraction.ts");
const extractRoute = read("app/api/documents/[id]/extract/route.ts");
const importRoute = read("app/api/documents/[id]/import/route.ts");
const modal = read("components/FinancialDocumentExtractionModal.tsx");
const vault = read("components/DocumentVault.tsx");
const packageJson = JSON.parse(read("package.json"));

const checks = [];
function check(name, condition) {
  checks.push({ name, ok: Boolean(condition) });
}

check("feature verification script registered", packageJson.scripts?.["verify:financial-document-import"] === "node scripts/verify-financial-document-import.mjs");
check("extract endpoint is read-only GET", /export async function GET\(/.test(extractRoute) && !/export async function POST\(/.test(extractRoute));
check("extract endpoint requires financial-documents access", /subscriptionApiAccessError\("financial_documents"\)/.test(extractRoute));
check("extract endpoint authenticates the user", /supabase\.auth\.getUser\(\)/.test(extractRoute));
check("extract endpoint scopes document lookup to user", /\.eq\("user_id", user\.id\)/.test(extractRoute));
check("private document is downloaded server-side", /service\.storage\s*\n?\s*\.from\(DOCUMENT_BUCKET\)\s*\n?\s*\.download\(document\.storage_path\)/.test(extractRoute));
check("V1 limits extraction to PDFs", /document\.mime_type !== "application\/pdf"/.test(extractRoute));
check("image-only scans are explicitly rejected until OCR", /image-only scan/.test(extractRoute) && /OCR/.test(extractRoute));
check("PDF size is bounded", /MAX_PDF_BYTES = 10 \* 1024 \* 1024/.test(extractRoute));
check("PDF page count is bounded", /MAX_PAGES = 80/.test(extractRoute));
check("PDF extraction has a timeout", /EXTRACTION_TIMEOUT_MS/.test(extractRoute) && /withTimeout/.test(extractRoute));
check("bank statements map to Transactions", /category === "bank_statement"[\s\S]*destination: "transactions"/.test(extraction));
check("payslips map to income Transactions", /category === "payslip"[\s\S]*type: "income"[\s\S]*category: "Salary"/.test(extraction));
check("paid receipts map to expense Transactions", /paidReceiptSignal[\s\S]*documentType: "Paid receipt"[\s\S]*destination: "transactions"[\s\S]*type: "expense"/.test(extraction));
check("unpaid invoices and insurance map to Bills", /documentType: category === "insurance" \? "Insurance bill \/ policy" : "Invoice"[\s\S]*destination: "bills"/.test(extraction));
check("loan documents map to Debt", /looksLikeCard \? "credit_card" : "debt"/.test(extraction));
check("credit-card statements map to Credit Cards", /documentType: looksLikeCard \? "Credit-card statement" : "Loan document"/.test(extraction));
check("unsupported sensitive documents stay review-only", /destination: "review"[\s\S]*not safe to auto-map in V1/.test(extraction));
check("transaction duplicate signatures are checked during extraction", /transactionSignature/.test(extraction) && /possibleDuplicate/.test(extraction));
check("possible duplicate transactions start excluded", /included: Boolean\([\s\S]*!possibleDuplicate\)/.test(extraction));
check("review is mandatory in UI", /Review required/.test(modal) && /draft-only/.test(modal) && /Import approved data/.test(modal));
check("review UI permits row-level transaction selection", /type="checkbox" checked=\{row\.included\}/.test(modal));
check("import endpoint is POST-only", /export async function POST\(/.test(importRoute) && !/export async function GET\(/.test(importRoute));
check("import endpoint enforces same-origin request", /isSameOriginRequest\(request\)/.test(importRoute));
check("import endpoint authenticates and scopes source document", /supabase\.auth\.getUser\(\)/.test(importRoute) && /\.eq\("user_id", user\.id\)/.test(importRoute));
check("transaction commit reuses controlled import RPC", /rpc\("import_statement_transactions"/.test(importRoute));
check("bill duplicates are blocked", /A matching bill already exists/.test(importRoute));
check("debt and card duplicates are blocked", /A matching credit card already exists/.test(importRoute) && /A matching debt already exists/.test(importRoute));
check("bill categories match the Bills module vocabulary", /BILL_IMPORT_CATEGORIES/.test(extraction) && /BILL_CATEGORIES\.has\(category\)/.test(importRoute));
check("original document provenance is retained", /Imported from Document Vault/.test(importRoute));
check("successful import notifies realtime consumers", /notifyFiconterDataChange\("all"\)/.test(modal));
check("successful navigation stays client-side", /router\.push\(href/.test(modal) && !/window\.location/.test(modal));
check("Document Vault exposes Extract data", /> Extract data<\//.test(vault));
check("image extraction action is disabled in V1", /document\.mimeType !== "application\/pdf"/.test(vault) && /OCR/.test(vault));
check("supported destinations are explicit", /"transactions"[\s\S]*"bills"[\s\S]*"debt"[\s\S]*"credit_card"[\s\S]*"review"/.test(extraction));

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? "PASS" : "FAIL"} ${item.name}`);
if (failed.length) {
  console.error(`\nFinancial Document Import verification failed (${failed.length}/${checks.length} failed).`);
  process.exit(1);
}
console.log(`\nFinancial Document Import verification passed (${checks.length}/${checks.length}).`);
