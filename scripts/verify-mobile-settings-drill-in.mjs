import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const tsx = fs.readFileSync(path.join(root, 'components/SettingsWorkspace.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'components/SettingsWorkspace.module.css'), 'utf8');
const mobile = fs.readFileSync(path.join(root, 'app/mobile-module-layouts.css'), 'utf8');

const checks = [
  ['detail state exists', tsx.includes('sectionDetailOpen')],
  ['workspace view attribute exists', tsx.includes('data-settings-view')],
  ['section rows open drill-in', tsx.includes('openSettingsSection(id)')],
  ['back control exists', tsx.includes('mobileSectionBack') && tsx.includes('Back to Settings sections')],
  ['detail close handler exists', tsx.includes('closeSettingsSection')],
  ['settings top reset exists', tsx.includes('scrollSettingsToTop') && tsx.includes('scrollIntoView')],
  ['mobile index is retired', css.includes('.workspace[data-settings-view="index"]{display:none!important}')],
  ['mobile detail hides index', css.includes('.workspace[data-settings-view="detail"] .navigation{display:none!important}')],
  ['slide animation exists', css.includes('@keyframes settings-section-slide-in')],
  ['native shell index workspace is retired', mobile.includes('[class*="SettingsWorkspace_workspace"][data-settings-view="index"]') && mobile.includes('display: none !important')],
  ['native shell detail hides navigation', mobile.includes('[data-settings-view="detail"] [class*="SettingsWorkspace_navigation"]')],
  ['native shell restores vertical settings rows', mobile.includes('grid-template-columns: minmax(0, 1fr) !important')],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failed += 1;
}

console.log(`\n${checks.length - failed}/${checks.length} checks passed.`);
if (failed) process.exit(1);
