# FICONTER Financial Document Import V1

Target branch: `feature/financial-document-import`

## Goal

Let a signed-in FICONTER user upload a financial PDF to the existing private Document Vault, extract a draft of the financial information, review/correct it, and explicitly confirm the records before they enter FICONTER's financial modules.

## User flow

1. Open **Document Vault**.
2. Upload and categorize a searchable PDF.
3. Press **Extract data** on the document card.
4. FICONTER reads the private PDF server-side and proposes a destination.
5. Review every detected value. Possible duplicate transactions start excluded.
6. Press **Import approved data**.
7. Only approved values are written to the existing financial source of truth.
8. Open the destination module to see the imported records.

## V1 routing

| Document category / signal | Suggested FICONTER destination |
| --- | --- |
| Bank statement | Transactions |
| Payslip | Transactions → Salary income |
| Paid receipt | Transactions → Expense |
| Unpaid invoice | Bills |
| Insurance invoice/premium | Bills |
| Loan document | Debt |
| Credit-card statement for a new card | Credit Cards |
| Tax document | Manual review |
| Pension record | Manual review |
| Contract / other | Manual review |

The destination is a draft recommendation. Nothing is committed during extraction.

## Safety controls

- Extraction endpoint is authenticated and checks source-document ownership.
- The source file remains in the existing private `financial-documents` Storage bucket.
- Extraction is read-only. Commit happens only through a separate same-origin POST request after explicit confirmation.
- Transactions reuse the existing `import_statement_transactions` database RPC instead of creating a second ledger path.
- Bills, debts and cards are validated server-side before insert.
- Duplicate transaction signatures are surfaced before import and the existing transaction import RPC applies its own duplicate controls.
- Matching bills, debts and credit cards are blocked by default instead of silently creating another record.
- Imported rows retain Document Vault provenance in their import metadata/notes.
- Realtime financial modules are notified after a successful import.
- Currency conversion is resolved through FICONTER's existing exchange-rate endpoint before commit.

## Processing limits

- Searchable PDF only in V1.
- Maximum PDF size: 10 MB (aligned with the current Document Vault file limit).
- Maximum 80 PDF pages per extraction request.
- Maximum 2,000 transaction rows per confirmed import.
- Extraction has a bounded server timeout.

## Deliberate V1 limitations

- Image-only/scanned PDFs and JPG/PNG documents are not OCR'd yet. They remain usable as private Vault documents, but **Extract data** is disabled for image files and image-only PDFs return a clear OCR-required state.
- CSV/Excel direct ingestion is not part of this first Document Vault extraction release.
- A credit-card statement matching an existing card is blocked from creating a duplicate. Updating/reconciling an existing card statement is a separate V2 workflow.
- Business-workspace document ingestion is not added in V1; this release extends the current Personal Document Vault.
- Tax, pension and general contracts are review-only until a destination-specific schema is approved.

## Verification

Run:

```bash
npm run verify:financial-document-import
npm run verify:localization
npm run verify:release-candidate
```

The feature-specific verification checks authentication/ownership controls, read-only extraction, mandatory review, destination routing, duplicate protection, same-origin commit, provenance, realtime refresh, and client-side navigation.

## Suggested commit

`feat(documents): extract reviewed financial data into FICONTER modules`
