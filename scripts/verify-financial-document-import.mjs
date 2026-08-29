import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (relative) => readFileSync(path.join(root, relative), "utf8");

const extraction = read("lib/financialDocumentExtraction.ts");
const pdfImport = read("lib/pdfFinancialImport.ts");
const extractRoute = read("app/api/documents/[id]/extract/route.ts");
const importRoute = read("app/api/documents/[id]/import/route.ts");
const documentBoundary = read("lib/e2ee/documentVaultE2eeBoundary.ts");
const importBoundary = read("lib/e2ee/documentImportFetchBoundary.ts");
const encryptedWorkspace = read("components/EncryptedDocumentVaultWorkspace.tsx");
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
check("extract endpoint fails closed against server-side plaintext access", extractRoute.includes("server cannot read encrypted document contents") && extractRoute.includes("410") && !extractRoute.includes(".storage.from"));
check("import endpoint is POST-only", /export async function POST\(/.test(importRoute) && !/export async function GET\(/.test(importRoute));
check("import endpoint enforces same-origin request", /isSameOriginRequest\(request\)/.test(importRoute));
check("import endpoint authenticates the user", /supabase\.auth\.getUser\(\)/.test(importRoute));
check("import endpoint fails closed against server-side plaintext imports", importRoute.includes("run only inside the unlocked Financial Vault") && importRoute.includes("410") && !importRoute.includes('rpc("import_statement_transactions"'));
check("encrypted Document Vault workspace requires the Vault", encryptedWorkspace.includes("useVault") && encryptedWorkspace.includes('vaultStatus !== "unlocked"'));
check("encrypted Document Vault workspace installs file and import boundaries", encryptedWorkspace.includes("installDocumentVaultE2eeBoundary") && encryptedWorkspace.includes("installDocumentImportE2eeFetchBoundary"));
check("browser extraction decrypts stored document bytes", documentBoundary.includes("decryptStoredFile") && documentBoundary.includes("decryptDocumentFile"));
check("browser extraction uses the PDF engine only after decryption", documentBoundary.includes('import("unpdf")') && documentBoundary.includes("getDocumentProxy(bytes"));
check("browser PDF page count is bounded", documentBoundary.includes("pdf.numPages > 80"));
check("browser extraction rejects image-only scans until OCR", documentBoundary.includes("Image-only scans require browser OCR support"));
check("browser extraction feeds the shared financial extraction engine", documentBoundary.includes("extractFinancialDocumentDraft"));
check("PDF helper preserves positioned financial rows", pdfImport.includes("groupPdfTextItemsIntoLines"));
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
check("browser import encrypts Transactions before persistence", importBoundary.includes("encryptTransactionPayload") && importBoundary.includes('from("transactions").insert(writes)'));
check("browser import encrypts Bills before persistence", importBoundary.includes("encryptBillPayload") && importBoundary.includes('from("bills").insert'));
check("browser import encrypts Debt before persistence", importBoundary.includes("encryptDebtPayload") && importBoundary.includes('debt_kind: "standard"'));
check("browser import encrypts Credit Cards before persistence", importBoundary.includes("encryptCreditCardPayload") && importBoundary.includes('debt_kind: "credit_card"'));
check("all financial document imports persist ciphertext envelopes", importBoundary.includes("encrypted_payload") && importBoundary.includes("encryption_version: 1"));
check("browser imports are scoped to the authenticated Vault owner", importBoundary.includes("user_id: state.userId"));
check("bill duplicates are blocked", importBoundary.includes("A matching bill already exists"));
check("debt and card duplicates are blocked", importBoundary.includes("A matching credit card already exists") && importBoundary.includes("A matching debt already exists"));
check("bill categories are normalized by the shared extraction engine", extraction.includes("BILL_IMPORT_CATEGORIES"));
check("original document provenance is retained", importBoundary.includes("Document Vault import"));
check("successful import notifies realtime consumers", /notifyFiconterDataChange\("all"\)/.test(modal));
check("successful navigation stays client-side", /router\.push\(href/.test(modal) && !/window\.location/.test(modal));
check("Document Vault exposes Extract data", /> Extract data<\//.test(vault));
check("image extraction action is disabled until OCR support", /document\.mimeType !== "application\/pdf"/.test(vault) && /OCR/.test(vault));
check("supported destinations are explicit", /"transactions"[\s\S]*"bills"[\s\S]*"debt"[\s\S]*"credit_card"[\s\S]*"review"/.test(extraction));

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? "PASS" : "FAIL"} ${item.name}`);
if (failed.length) {
  console.error(`\nFinancial Document Import verification failed (${failed.length}/${checks.length} failed).`);
  process.exit(1);
}
console.log(`\nFinancial Document Import verification passed (${checks.length}/${checks.length}).`);
