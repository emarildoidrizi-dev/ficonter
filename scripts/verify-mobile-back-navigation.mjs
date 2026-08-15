import fs from 'node:fs';

const chrome = fs.readFileSync('components/FiconterNativeAppChrome.tsx', 'utf8');
const sidebar = fs.readFileSync('components/Sidebar.tsx', 'utf8');
const business = fs.readFileSync('components/BusinessSidebar.tsx', 'utf8');
const css = fs.readFileSync('components/FiconterNativeAppChrome.module.css', 'utf8');

const checks = [
  ['ArrowLeft imported', chrome.includes('ArrowLeft,')],
  ['back command state computed', chrome.includes('showBackCommand')],
  ['personal roots excluded', chrome.includes('/dashboard/overview') && chrome.includes('/dashboard/transactions') && chrome.includes('/dashboard/budget')],
  ['business roots excluded', chrome.includes('/business/overview') && chrome.includes('/business/sales') && chrome.includes('/business/transactions')],
  ['chrome tracks internal route stack', chrome.includes('navigationStackRef') && chrome.includes('navigatingBackRef')],
  ['chrome back handler exists', chrome.includes('function goBackInstant()')],
  ['chrome back avoids loading overlay', chrome.includes('removeAttribute("data-ficonter-route-loading")')],
  ['chrome safe overview fallback exists', chrome.includes('fallbackBackHref') && chrome.includes('navigationStackRef.current = []')],
  ['personal header reads mobile route stack', sidebar.includes('ficonter:mobile-route-stack') && sidebar.includes('resolveBackTarget')],
  ['business header reads mobile route stack', business.includes('ficonter:mobile-route-stack') && business.includes('resolveBackTarget')],
  ['personal exhausted stack returns overview', sidebar.includes('return fallbackBackHref;') && sidebar.includes('No valid FICONTER page remains')],
  ['business exhausted stack returns overview', business.includes('return fallbackBackHref;') && business.includes('No valid FICONTER page remains')],
  ['back button rendered conditionally', chrome.includes('showBackCommand ? (') && chrome.includes('className={styles.backButton}')],
  ['back button accessible', chrome.includes('aria-label="Go back"') && chrome.includes('title="Back"')],
  ['back button touch target styled', css.includes('.backButton {') && css.includes('width: 32px') && css.includes('height: 32px')],
  ['back focus style exists', css.includes('.backButton:focus-visible')],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`Mobile back navigation verification failed (${failed.length}/${checks.length}):`);
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}
console.log(`FICONTER mobile back navigation: ${checks.length}/${checks.length} checks passed.`);
