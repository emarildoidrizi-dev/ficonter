import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const personal = read('components/Sidebar.tsx');
const business = read('components/BusinessSidebar.tsx');
const chrome = read('components/FiconterNativeAppChrome.tsx');

const checks = [
  ['personal fallback is Overview', personal.includes('const fallbackBackHref = "/dashboard/overview"')],
  ['business fallback is Overview', business.includes('const fallbackBackHref = "/business/overview"')],
  ['personal resolves internal stack first', personal.includes('sessionStorage.getItem("ficonter:mobile-route-stack")')],
  ['business resolves internal stack first', business.includes('sessionStorage.getItem("ficonter:mobile-route-stack")')],
  ['personal exhausted stack falls home', personal.includes('No valid FICONTER page remains') && personal.includes('return fallbackBackHref;')],
  ['business exhausted stack falls home', business.includes('No valid FICONTER page remains') && business.includes('return fallbackBackHref;')],
  ['personal stale same-route target falls home', personal.includes('resolvedTarget && resolvedTarget !== currentRoute')],
  ['business stale same-route target falls home', business.includes('resolvedTarget && resolvedTarget !== currentRoute')],
  ['chrome has explicit route stack', chrome.includes('navigationStackRef = useRef<string[]>([])')],
  ['chrome pops previous route', chrome.includes('let target = stack.pop() ?? null')],
  ['chrome clears exhausted stack', chrome.includes('navigationStackRef.current = []')],
  ['chrome falls back to workspace home', chrome.includes('router.push(fallbackBackHref, { scroll: false })')],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`Mobile Back Home Fallback V1.19 failed (${failed.length}/${checks.length}):`);
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}
console.log(`FICONTER Mobile Back Home Fallback V1.19: ${checks.length}/${checks.length} checks passed.`);
