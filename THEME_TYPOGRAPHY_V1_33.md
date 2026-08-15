# FICONTER V1.33 — Theme-synchronised typography

Typography now derives directly from the same `data-theme` and `data-resolved-theme` attributes that drive the palette. There is no independent typography state, timer or post-render synchronization step.

When a saved theme is applied, FICONTER updates the palette and its typography profile in the same browser style recalculation. Each premium theme has a deliberate interface/display/numeric typography profile while preserving the existing font sizes and layout geometry.

Financial figures use tabular lining numerals for stable alignment. Buttons, inputs, menus and navigation remain practical sans-serif controls. Page/module headings receive the theme display profile. Text colour continues to use the semantic contrast tokens from the existing theme visibility layer.

The existing explicit-save rule is unchanged: Appearance choices remain drafts until **Save appearance**. Once saved, colour and typography switch together immediately.
