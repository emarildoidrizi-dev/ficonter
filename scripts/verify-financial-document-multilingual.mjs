import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const temp = mkdtempSync(path.join(tmpdir(), "ficonter-multilingual-import-"));

const replacements = {
  "@/lib/financialOptions": "./financialOptions.mjs",
  "@/lib/financialDocumentLanguage": "./financialDocumentLanguage.mjs",
  "@/lib/statementImport": "./statementImport.mjs",
  "@/lib/pdfFinancialImport": "./pdfFinancialImport.mjs",
  "@/lib/documentVault": "./documentVault.mjs",
};

function compile(name) {
  let source = readFileSync(path.join(root, "lib", `${name}.ts`), "utf8");
  for (const [from, to] of Object.entries(replacements)) source = source.split(from).join(to);
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
    reportDiagnostics: true,
    fileName: `${name}.ts`,
  });
  const errors = (result.diagnostics ?? []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  if (errors.length) {
    throw new Error(errors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")).join("\n"));
  }
  writeFileSync(path.join(temp, `${name}.mjs`), result.outputText);
}

function assert(name, condition, details = "") {
  console.log(`${condition ? "PASS" : "FAIL"} ${name}${details ? ` · ${details}` : ""}`);
  if (!condition) throw new Error(name);
}

try {
  for (const name of ["financialOptions", "financialDocumentLanguage", "statementImport", "pdfFinancialImport", "financialDocumentExtraction"]) compile(name);

  const languageModule = await import(pathToFileURL(path.join(temp, "financialDocumentLanguage.mjs")));
  const pdfModule = await import(pathToFileURL(path.join(temp, "pdfFinancialImport.mjs")));
  const extractionModule = await import(pathToFileURL(path.join(temp, "financialDocumentExtraction.mjs")));

  const bankFixtures = {
    en: ["Bank statement", "Transaction date Description Amount", "14/08/2026 Salary ACME +2500.00 EUR", "15/08/2026 Card payment Market 58.70 EUR"],
    de: ["Kontoauszug", "Buchungsdatum Verwendungszweck Betrag", "14.08.2026 Gehalt ACME +2500,00 EUR", "15.08.2026 Kartenzahlung Markt 58,70 EUR"],
    es: ["Extracto bancario", "Fecha de operación Descripción Importe", "14.08.2026 Nómina ACME +2500,00 EUR", "15.08.2026 Pago supermercado 58,70 EUR"],
    sq: ["Pasqyra bankare", "Data e transaksionit Përshkrimi Shuma", "14.08.2026 Paga ACME +2500,00 EUR", "15.08.2026 Pagesë ushqimore 58,70 EUR"],
    ar: ["كشف حساب", "تاريخ العملية الوصف المبلغ", "١٤/٠٨/٢٠٢٦ راتب ACME +٢٥٠٠٫٠٠ AED", "١٥/٠٨/٢٠٢٦ دفع سوبرماركت ٥٨٫٧٠ AED"],
    pt: ["Extrato bancário", "Data da transação Descrição Valor", "14.08.2026 Salário ACME +2500,00 EUR", "15.08.2026 Pagamento supermercado 58,70 EUR"],
    it: ["Estratto conto", "Data operazione Descrizione Importo", "14.08.2026 Stipendio ACME +2500,00 EUR", "15.08.2026 Pagamento supermercato 58,70 EUR"],
    ru: ["Банковская выписка", "Дата операции Описание Сумма", "14.08.2026 Зарплата ACME +2500,00 RUB", "15.08.2026 Оплата супермаркет 58,70 RUB"],
  };

  for (const [code, lines] of Object.entries(bankFixtures)) {
    const detected = languageModule.detectFinancialDocumentLanguage(lines);
    const parsed = pdfModule.extractTransactionsFromPdfLines(lines).rows.slice(1);
    assert(`${code} bank-statement language detected`, detected.code === code, `${detected.code}/${detected.confidence}`);
    assert(`${code} bank-statement rows parsed`, parsed.length === 2);
    assert(`${code} income/expense direction recognized`, Number(parsed[0][2]) > 0 && Number(parsed[1][2]) < 0);
  }

  assert("Arabic-Indic digits and decimal separator normalize", languageModule.normalizeFinancialDigits("١٢٣٤٫٥٦") === "1234.56");
  assert("Eastern Arabic digits normalize", languageModule.normalizeFinancialDigits("۱۲۳۴٫۵۶") === "1234.56");
  assert("Arabic AED currency marker normalizes", languageModule.normalizeFinancialCurrencyMarkers("١٢٠٫٥٠ د.إ").includes("120.50 AED"));
  const rtlLine = pdfModule.groupPdfTextItemsIntoLines([
    { str: "كشف", transform: [1, 0, 0, 1, 300, 500], width: 30 },
    { str: "حساب", transform: [1, 0, 0, 1, 220, 500], width: 35 },
    { str: "المبلغ", transform: [1, 0, 0, 1, 120, 500], width: 50 },
  ])[0];
  assert("Arabic PDF text items preserve RTL reading order", rtlLine === "كشف حساب المبلغ", rtlLine);

  const payslipFixtures = [
    ["en", ["ACME LTD", "Payslip", "Net pay 2,500.00 EUR", "Pay date 31.08.2026"]],
    ["de", ["ACME GmbH", "Gehaltsabrechnung", "Nettoverdienst 2.500,00 EUR", "Zahlungsdatum 31.08.2026"]],
    ["es", ["ACME SL", "Nómina", "Salario neto 2.500,00 EUR", "Fecha de pago 31.08.2026"]],
    ["sq", ["ACME SHPK", "Paga", "Paga neto 2.500,00 EUR", "Data e pagesës 31.08.2026"]],
    ["ar", ["شركة ACME", "صافي الراتب ٢٥٠٠٫٠٠ AED", "تاريخ الدفع ٣١/٠٨/٢٠٢٦"]],
    ["pt", ["ACME LDA", "Salário líquido 2.500,00 EUR", "Data de pagamento 31.08.2026"]],
    ["it", ["ACME SRL", "Stipendio netto 2.500,00 EUR", "Data di pagamento 31.08.2026"]],
    ["ru", ["ACME ООО", "Заработная плата", "К выплате 2500,00 RUB", "Дата выплаты 31.08.2026"]],
  ];

  for (const [code, lines] of payslipFixtures) {
    const result = extractionModule.extractFinancialDocumentDraft({
      documentId: "fixture", fileName: "payslip.pdf", displayName: "Payslip", category: "payslip", documentDate: null,
      lines, baseCurrency: "EUR", rules: [], existingTransactions: [],
    });
    const row = result.transactions?.[0];
    assert(`${code} payslip net salary extracted`, result.documentLanguage.code === code && row?.amount === 2500 && row?.date === "2026-08-31" && row?.type === "income");
  }

  const invoiceFixtures = [
    ["es", ["Factura Electricidad", "Importe a pagar 120,50 EUR", "Fecha de vencimiento 30.08.2026"]],
    ["sq", ["Faturë Energji elektrike", "Shuma për t'u paguar 120,50 EUR", "Afati i pagesës 30.08.2026"]],
    ["ar", ["فاتورة كهرباء", "المبلغ المستحق ١٢٠٫٥٠ د.إ", "تاريخ الاستحقاق ٣٠/٠٨/٢٠٢٦"]],
    ["pt", ["Fatura Eletricidade", "Valor a pagar 120,50 EUR", "Data de vencimento 30.08.2026"]],
    ["it", ["Fattura Energia elettrica", "Importo dovuto 120,50 EUR", "Data di scadenza 30.08.2026"]],
    ["ru", ["Счет на оплату Электроэнергия", "Сумма к оплате 120,50 RUB", "Срок оплаты 30.08.2026"]],
  ];

  for (const [code, lines] of invoiceFixtures) {
    const result = extractionModule.extractFinancialDocumentDraft({
      documentId: "fixture", fileName: "invoice.pdf", displayName: "Invoice", category: "invoice_receipt", documentDate: null,
      lines, baseCurrency: "EUR", rules: [], existingTransactions: [],
    });
    assert(`${code} invoice maps to Bills`, result.destination === "bills" && result.bill?.amount === 120.5 && result.bill?.dueDate === "2026-08-30");
    assert(`${code} electricity invoice category recognized`, result.bill?.category === "Electricity");
  }

  const cardFixtures = [
    ["es", ["Estado de cuenta de tarjeta de crédito", "Saldo actual 1.240,50 EUR", "Pago mínimo 80,00 EUR", "Límite de crédito 5.000,00 EUR", "Fecha de vencimiento 25.08.2026", "Tasa de interés 22,6%"]],
    ["sq", ["Pasqyra e kartës së kreditit", "Gjendja aktuale 1.240,50 EUR", "Pagesa minimale 80,00 EUR", "Limiti i kredisë 5.000,00 EUR", "Afati i pagesës 25.08.2026", "Interesi vjetor 22,6%"]],
    ["ar", ["كشف بطاقة ائتمان", "الرصيد الحالي ١٢٤٠٫٥٠ AED", "الحد الأدنى للدفع ٨٠٫٠٠ AED", "الحد الائتماني ٥٠٠٠٫٠٠ AED", "تاريخ الاستحقاق ٢٥/٠٨/٢٠٢٦", "معدل الفائدة السنوي ٢٢٫٦٪"]],
    ["pt", ["Fatura do cartão de crédito", "Saldo atual 1.240,50 EUR", "Pagamento mínimo 80,00 EUR", "Limite de crédito 5.000,00 EUR", "Data de vencimento 25.08.2026", "Taxa de juros 22,6%"]],
    ["it", ["Estratto carta di credito", "Saldo attuale 1.240,50 EUR", "Pagamento minimo 80,00 EUR", "Limite di credito 5.000,00 EUR", "Data di scadenza 25.08.2026", "Tasso di interesse 22,6%"]],
    ["ru", ["Выписка по кредитной карте", "Текущий баланс 1 240,50 RUB", "Минимальный платеж 80,00 RUB", "Кредитный лимит 5 000,00 RUB", "Срок оплаты 25.08.2026", "Процентная ставка 22,6%"]],
  ];

  for (const [code, lines] of cardFixtures) {
    const result = extractionModule.extractFinancialDocumentDraft({
      documentId: "fixture", fileName: "card.pdf", displayName: "Card", category: "loan_document", documentDate: null,
      lines, baseCurrency: "EUR", rules: [], existingTransactions: [],
    });
    const card = result.debt;
    assert(`${code} credit-card statement recognized`, result.destination === "credit_card");
    assert(`${code} credit-card balances and APR extracted`, card?.currentBalance === 1240.5 && card?.minimumPayment === 80 && card?.creditLimit === 5000 && card?.paymentDueDate === "2026-08-25" && card?.annualInterestRate === 22.6);
  }

  const modal = readFileSync(path.join(root, "components/FinancialDocumentExtractionModal.tsx"), "utf8");
  assert("review screen displays detected document language", /Document language[\s\S]*documentLanguage\.label/.test(modal));
  assert("document intelligence version is V1.1", /DOCUMENT INTELLIGENCE · V1\.1/.test(modal));

  console.log("\nMultilingual financial document verification passed.");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
