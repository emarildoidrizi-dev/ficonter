# FICONTER V1.26 - Current Brand in Exports

## Rule
Every FICONTER-generated document that displays the FICONTER emblem must use the same current brand asset as the live platform: `/public/ficonter-mark.svg`.

## Changes
- Replaced the legacy synthetic gold circle + letter `F` used in canvas-generated PDFs.
- Transaction Ledger PDFs now render the current FICONTER Control Core emblem.
- Private Account Report PDFs now render the current FICONTER Control Core emblem.
- PDF headers now use the current `FICONTER` wordmark plus `FINANCIAL CONTROL CENTER` descriptor.
- Kept server-generated PayPal receipts free of any legacy emblem; their text identity remains FICONTER.
- Bumped the PWA static cache version so an installed app does not keep an older cached emblem.
- Added a release verification that fails if the legacy synthetic PDF emblem returns.

## Brand source of truth
`public/ficonter-mark.svg`

The public `icon.svg` is verified to be byte-identical to the current emblem asset.
