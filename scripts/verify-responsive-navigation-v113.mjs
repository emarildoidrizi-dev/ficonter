import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const speed = read('components/NavigationSpeedBoost.tsx');
const settings = read('components/SettingsWorkspace.tsx');
const settingsPage = read('app/dashboard/settings/page.tsx');
const pageStack = read('app/mobile-page-stack.css');
const screenStack = read('app/mobile-screen-stack.css');
const profilePage = read('app/dashboard/profile/page.tsx');

const sectionBlock = settings.slice(settings.indexOf('const sections = ['), settings.indexOf('] as const;', settings.indexOf('const sections = [')) + 11);
const sectionIdBlock = settings.slice(settings.indexOf('function isSectionId'), settings.indexOf('const sections = ['));

const checks = [
  ['route animation requires native phone device class', speed.includes('root.dataset.ficonterDevice === "phone"')],
  ['settings route-driven drilldown requires phone', settings.includes('root.dataset.ficonterDevice === "phone"') && settings.includes('if (isNativePhone)')],
  ['tablet settings uses local state instead of route navigation', settings.includes('Tablet/iPad/desktop-class Settings switches locally') && settings.includes('setActive(id);')],
  ['phone replacement CSS is device-class scoped', pageStack.includes('data-ficonter-device="phone"') && pageStack.includes('data-mobile-detail="true"')],
  ['tablet keeps settings navigation visible', pageStack.includes('data-ficonter-device="tablet"') && pageStack.includes('SettingsWorkspace_navigation') && pageStack.includes('display: grid !important;')],
  ['tablet keeps settings detail panel visible', pageStack.includes('data-ficonter-device="tablet"') && pageStack.includes('SettingsWorkspace_panel') && pageStack.includes('display: block !important;')],
  ['legacy screen-stack animations are phone-only if loaded', screenStack.includes('data-ficonter-device="phone"][data-ficonter-nav-transition="active"]')],
  ['Profile is removed from Settings section list', !sectionBlock.includes('id: "profile"')],
  ['Profile is not accepted as a Settings section id', !sectionIdBlock.includes('"profile"')],
  ['Settings defaults to Account & security', settings.includes(': "security",') && settings.includes('? "security"')],
  ['legacy Settings profile URL redirects to dedicated Profile page', settingsPage.includes('if (section === "profile")') && settingsPage.includes('redirect("/dashboard/profile")')],
  ['Settings copy no longer advertises profile management', settingsPage.includes('Manage account security and Ficonter preferences') && !settingsPage.includes('Manage your profile, account security')],
  ['Profile page links to account Settings without claiming Settings owns Profile', profilePage.includes('Open account settings') && !profilePage.includes('Edit profile & account settings')],
];

let passed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}`);
  if (ok) passed += 1;
}
console.log(`\n${passed}/${checks.length} checks passed.`);
if (passed !== checks.length) process.exit(1);
