const themeTypographyIntegrity = `
html[data-theme] .app-shell,
html[data-theme] .app-shell * {
  font-family: var(--font-interface) !important;
}
html[data-theme] .app-shell :where(h1,h2,h3,h4,h5,h6,[class*="title" i],[class*="heading" i]) {
  font-family: var(--font-display) !important;
  font-weight: var(--font-display-weight);
  letter-spacing: var(--font-display-tracking);
}
html[data-theme] .app-shell :where(output,[class*="amount" i],[class*="balance" i],[class*="metricValue" i],[class*="statValue" i],[class*="number" i],[class*="money" i],[class*="total" i] strong,td:last-child) {
  font-family: var(--font-numeric) !important;
  font-variant-numeric: tabular-nums lining-nums;
  font-feature-settings: "tnum" 1, "lnum" 1;
  letter-spacing: var(--font-numeric-tracking);
}
html[data-theme] .app-shell :where(th,legend,.eyebrow,[class*="eyebrow" i],[class*="label" i]) {
  letter-spacing: var(--font-label-tracking);
}
html[data-theme] .app-shell,
html[data-theme] .app-main,
html[data-theme] .app-shell :where([role="dialog"],[role="menu"],[role="listbox"],[role="option"],[role="alert"],[role="status"],[role="tooltip"]) {
  color: var(--text-primary);
}
html[data-theme] .app-shell :where(input,select,textarea,option) {
  color: var(--text-primary);
  caret-color: var(--text-primary);
}
html[data-theme] .app-shell :where(input,textarea)::placeholder {
  color: var(--text-tertiary) !important;
  -webkit-text-fill-color: var(--text-tertiary) !important;
  opacity: 1 !important;
}
html[data-theme] .app-shell :where([class*="subtitle" i],[class*="description" i],[class*="caption" i],[class*="meta" i],[class*="muted" i],[class*="hint" i],[class*="helper" i]) {
  color: var(--text-secondary);
}
`;

export function LivingThemeBackdrop() {
  return (
    <>
      <style>{themeTypographyIntegrity}</style>
      <div className="living-theme-backdrop" aria-hidden="true">
        <span className="living-theme-scene" />
        <span className="living-theme-readability" />
      </div>
    </>
  );
}
