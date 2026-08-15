import fs from 'node:fs';

const tsx = fs.readFileSync('components/FiconterNativeAppChrome.tsx', 'utf8');
const css = fs.readFileSync('components/FiconterNativeAppChrome.module.css', 'utf8');

const checks = [
  ['ArrowLeft imported', tsx.includes('ArrowLeft,')],
  ['back command state computed', tsx.includes('showBackCommand')],
  ['personal roots excluded', tsx.includes('/dashboard/overview') && tsx.includes('/dashboard/transactions') && tsx.includes('/dashboard/budget')],
  ['business roots excluded', tsx.includes('/business/overview') && tsx.includes('/business/sales') && tsx.includes('/business/transactions')],
  ['previous app route tracked', tsx.includes('previousAppPath') && tsx.includes('previousPathRef')],
  ['instant back handler exists', tsx.includes('function goBackInstant()')],
  ['back avoids loading overlay', tsx.includes('removeAttribute("data-ficonter-route-loading")')],
  ['back uses client router', tsx.includes('router.push(previousAppPath, { scroll: false })')],
  ['safe fallback exists', tsx.includes('fallbackBackHref')],
  ['back button rendered conditionally', tsx.includes('showBackCommand ? (') && tsx.includes('className={styles.backButton}')],
  ['back button accessible', tsx.includes('aria-label="Go back"') && tsx.includes('title="Back"')],
  ['back button touch target styled', css.includes('.backButton {') && css.includes('width: 32px') && css.includes('height: 32px')],
  ['back focus style exists', css.includes('.backButton:focus-visible')],
  ['route title layout accommodates back', css.includes('.routeCopy {') && css.includes('display: flex;')],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`Mobile back navigation verification failed (${failed.length}/${checks.length}):`);
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}
console.log(`FICONTER mobile back navigation: ${checks.length}/${checks.length} checks passed.`);
