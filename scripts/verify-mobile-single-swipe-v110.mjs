import fs from 'node:fs';

const settingsCss = fs.readFileSync('components/SettingsWorkspace.module.css', 'utf8');
const stackCss = fs.readFileSync('app/mobile-page-stack.css', 'utf8');
const settings = fs.readFileSync('components/SettingsWorkspace.tsx', 'utf8');

const checks = [
  ['Settings still uses parent/detail state', settings.includes('data-mobile-detail={mobileDetailOpen ? "true" : "false"}')],
  ['Settings parent still hides detail', settingsCss.includes('.workspace[data-mobile-detail="false"] .panel') && settingsCss.includes('display: none !important;')],
  ['Settings detail still hides parent', settingsCss.includes('.workspace[data-mobile-detail="true"] .navigation')],
  ['Settings detail remains full width', settingsCss.includes('.workspace[data-mobile-detail="true"] .panel') && settingsCss.includes('width: 100% !important;')],
  ['Nested detail animation removed', !settingsCss.includes('@keyframes ficonter-settings-detail-in')],
  ['Nested parent animation removed', !settingsCss.includes('@keyframes ficonter-settings-parent-in')],
  ['Nested Settings screens explicitly disable animation', settingsCss.includes('animation: none !important;')],
  ['Global forward page animation remains', stackCss.includes('@keyframes ficonter-mobile-page-forward')],
  ['Global backward page animation remains', stackCss.includes('@keyframes ficonter-mobile-page-back')],
  ['Global forward transition applies at route level', stackCss.includes('data-ficonter-nav-direction="forward"') && stackCss.includes('.app-main > *')],
  ['Global back transition applies at route level', stackCss.includes('data-ficonter-nav-direction="back"')],
  ['Reduced motion remains supported globally', stackCss.includes('@media (prefers-reduced-motion: reduce)')],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`FICONTER Mobile Single Swipe V1.10: ${checks.length - failed.length}/${checks.length} checks passed.`);
  for (const [name] of failed) console.error(`FAIL: ${name}`);
  process.exit(1);
}
console.log(`FICONTER Mobile Single Swipe V1.10: ${checks.length}/${checks.length} checks passed.`);
