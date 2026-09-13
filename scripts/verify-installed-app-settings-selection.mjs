import fs from 'node:fs';

const sync = fs.readFileSync('components/InstalledAppSettingsSelectionSync.tsx', 'utf8');
const layout = fs.readFileSync('app/dashboard/layout.tsx', 'utf8');

const checks = [
  ['Installed app gate is enforced', sync.includes('isInstalledStandaloneApp()') && sync.includes('ficonterDevice !== "phone"')],
  ['Selection paints on pointer-down', sync.includes('pointerdown') && sync.includes('applySelection(section)')],
  ['Back/forward navigation resyncs selection', sync.includes('popstate') && sync.includes('handlePopState') && sync.includes('sectionFromLocation()')],
  ['Only one selected row is marked at a time', sync.includes('ficonterSettingsSelected = selected ? "true" : "false"')],
  ['Selected row receives immediate visual override', sync.includes('data-ficonter-settings-selected="true"') && sync.includes('background: var(--solid-bg) !important')],
  ['Selected row text uses the paired solid foreground token', sync.includes('button[data-ficonter-settings-selected="true"] strong') && sync.includes('color: var(--solid-text) !important')],
  ['Selected row bypasses delayed auto-contrast corrections', sync.includes('ficonterContrastIgnore = "true"') && sync.includes('clearManagedContrast')],
  ['Settings back restores the committed theme immediately', sync.includes('restoreCommittedInterfaceImmediately') && sync.includes('ficonter-appearance') && sync.includes('resolveAppearance')],
  ['App back button triggers immediate theme restoration', sync.includes('button[aria-label="Go back"]') && sync.includes('restoreCommittedInterfaceImmediately();')],
  ['Back restore temporarily disables theme transitions', sync.includes('ficonterSettingsBackSync = "true"') && sync.includes('transition-duration: 0ms !important')],
  ['Personal dashboard mounts settings selection sync', layout.includes('<InstalledAppSettingsSelectionSync />')],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}`);
  if (!ok) failed += 1;
}

console.log(`\n${checks.length - failed}/${checks.length} installed-app settings-selection checks passed.`);
if (failed) process.exit(1);
