# FICONTER Financial Document Import V1.1 — Multilingual Extraction

## Scope

V1.1 upgrades the existing review-before-import financial document engine so searchable financial PDFs can be interpreted independently of the user's FICONTER interface language.

Supported document-language recognition in this release:

- English (`en`)
- German (`de`)
- Spanish (`es`)
- Albanian (`sq`)
- Arabic (`ar`)
- Portuguese (`pt`)
- Italian (`it`)
- Russian (`ru`)

French interface localization is intentionally not part of this branch.

## What changed

- Added automatic financial-document language detection.
- The review screen now displays the detected document language.
- Expanded financial vocabulary for payslips, invoices, receipts, loans, credit-card statements, balances, minimum payments, due dates, APR/interest, recurrence, and common bill categories.
- Expanded bank-statement income/expense direction recognition across all eight supported document languages.
- Expanded transaction category suggestions for common multilingual salary, refund, rent, groceries, utilities, transport, pharmacy, fuel, and other recurring descriptions.
- Added Unicode-safe financial text matching so Arabic and Cyrillic text is not discarded during normalization.
- Added Arabic-Indic and Eastern Arabic digit normalization.
- Added Arabic decimal/thousands separator and percent-sign normalization.
- Added Arabic AED/SAR/QAR currency-marker normalization and Russian RUB/₽ support in the PDF parser.
- Added RTL-aware PDF text-item ordering for Arabic statement lines.
- Preserved the mandatory Review & Import workflow and all duplicate protections.

## Safety / governance

The detected language does not grant permission to import. Extraction remains draft-only. FICONTER still requires the customer to review and explicitly approve data before any module is changed.

Language detection is used as metadata and parsing assistance; the parser also relies on structure, dates, amounts, currencies, debit/credit direction, and financial field patterns. This prevents the engine from depending on a single translated keyword.

## Still not included in V1.1

- OCR for image-only/scanned PDFs
- JPG/PNG document extraction
- Business workspace document ingestion
- Full Document Vault CSV/XLSX ingestion path
- Handwritten financial documents

These remain separate later phases.

## Verification

The multilingual fixture suite validates:

- 8/8 bank-statement languages
- income/expense direction in all 8 languages
- Arabic-Indic and Eastern Arabic numerals
- Arabic AED marker normalization
- RTL PDF text ordering
- payslip net salary extraction in all 8 languages
- invoice amount/due-date/module mapping across ES/SQ/AR/PT/IT/RU
- electricity bill categorization across ES/SQ/AR/PT/IT/RU
- credit-card balance, minimum payment, credit limit, due date, and APR extraction across ES/SQ/AR/PT/IT/RU

Run:

`npm run verify:financial-document-multilingual`
