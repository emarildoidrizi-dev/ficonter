import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const nav = read('components/NavigationSpeedBoost.tsx');
const sidebar = read('components/Sidebar.tsx');
const business = read('components/BusinessSidebar.tsx');
const settings = read('components/SettingsWorkspace.tsx');
const settingsPage = read('app/dashboard/settings/page.tsx');
const css = read('app/mobile-page-stack.css');
const layout = read('app/layout.tsx');

const checks = [
  ['global route stack storage', nav.includes('ficonter:mobile-route-stack')],
  ['query-aware route key', nav.includes('useSearchParams') && nav.includes('routeKey')],
  ['forward direction detection', nav.includes('"forward"') && nav.includes('data-ficonter') === false ? true : nav.includes('ficonterNavDirection')],
  ['back direction detection', nav.includes('direction = "back"')],
  ['transition activation', nav.includes('ficonterNavTransition = "active"')],
  ['personal back reads stack', sidebar.includes('resolveBackTarget') && sidebar.includes('ficonter:mobile-route-stack')],
  ['business back reads stack', business.includes('resolveBackTarget') && business.includes('ficonter:mobile-route-stack')],
  ['personal route includes query', sidebar.includes('useSearchParams') && sidebar.includes('routeKey')],
  ['business route includes query', business.includes('useSearchParams') && business.includes('routeKey')],
  ['settings mobile detail state', settings.includes('mobileDetailOpen') && settings.includes('data-mobile-detail')],
  ['settings section uses instant client history', settings.includes('window.history.pushState(null, "", target)') && settings.includes('setActive(id)')],
  ['settings detail is URL-addressable', settingsPage.includes('data-settings-detail')],
  ['settings list hides panel', css.includes('data-mobile-detail="false"') && css.includes('SettingsWorkspace_panel')],
  ['settings detail hides list', css.includes('data-mobile-detail="true"') && css.includes('SettingsWorkspace_navigation')],
  ['forward slide comes from right', css.includes('translate3d(100%, 0, 0)')],
  ['reverse slide configured', css.includes('ficonter-mobile-page-back')],
  ['page stack css loaded globally', layout.includes('mobile-page-stack.css')],
  ['reduced motion respected', css.includes('prefers-reduced-motion')],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('Mobile Page Stack V1.8 failed:');
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}
console.log(`FICONTER Mobile Page Stack V1.8: ${checks.length}/${checks.length} checks passed.`);
