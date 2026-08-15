import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

const css = read('components/SettingsWorkspace.module.css');
const workspace = read('components/SettingsWorkspace.tsx');
const page = read('app/dashboard/settings/page.tsx');

const checks = [
  ['detail state exists', workspace.includes('data-mobile-detail={mobileDetailOpen ? "true" : "false"}')],
  ['section click opens mobile detail', workspace.includes('setMobileDetailOpen(true)')],
  ['section click updates query route', workspace.includes('router.push(`/dashboard/settings?section=${id}`')],
  ['parent route can start without section', page.includes('initialSection={section}')],
  ['detail page is marked by query', page.includes('data-settings-detail={hasExplicitSettingsSection ? "true" : "false"}')],
  ['mobile workspace becomes single screen', css.includes('.workspace[data-mobile-detail="false"] .navigation')],
  ['parent hides detail panel', css.includes('.workspace[data-mobile-detail="false"] .panel') && css.includes('display: none !important;')],
  ['detail hides parent navigation', css.includes('.workspace[data-mobile-detail="true"] .navigation')],
  ['detail panel is full width', css.includes('.workspace[data-mobile-detail="true"] .panel') && css.includes('width: 100% !important;')],
  ['detail enters from right', css.includes('@keyframes ficonter-settings-detail-in') && css.includes('translate3d(100%,0,0)')],
  ['parent reverse motion exists', css.includes('@keyframes ficonter-settings-parent-in') && css.includes('translate3d(-28%,0,0)')],
  ['reduced motion supported', css.includes('@media (prefers-reduced-motion: reduce)')],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`FICONTER Mobile Settings Screen Replacement V1.9: ${checks.length - failed.length}/${checks.length} checks passed.`);
  for (const [name] of failed) console.error(`FAIL: ${name}`);
  process.exit(1);
}
console.log(`FICONTER Mobile Settings Screen Replacement V1.9: ${checks.length}/${checks.length} checks passed.`);
