# FICONTER Financial File Import v2

This update broadens the existing transaction-file importer and removes the narrow customer-facing name “Statement Import.”

## Customer-facing changes

- Renames the workspace to **Financial File Import**.
- Renames the collapsed card to **Import financial records**.
- Accepts searchable PDF files in addition to CSV, TSV and TXT.
- Describes supported sources as bank statements, card statements, payment reports and transaction exports.
- Keeps the four-step review flow: upload, field matching, review and completion.
- Shows PDF page count and extracted transaction count.
- Warns customers when PDF transaction direction had to be inferred.
- Clearly explains that scanned image-only and password-protected PDFs are not supported yet.

## PDF safeguards

- Authentication and same-origin verification are required.
- PDF size is limited to 10 MB.
- PDF length is limited to 80 pages.
- A maximum of 2,000 possible transactions is extracted.
- Files are processed in memory and are not stored by the extraction endpoint.
- Nothing enters the FICONTER ledger until the customer reviews and confirms it.

## Compatibility

- Uses the existing Statement Import database tables and RPC internally, so no new Supabase SQL is required.
- Existing CSV, TSV and TXT imports continue to work.
- Existing duplicate detection, category rules, exchange-rate conversion and realtime updates remain unchanged.
