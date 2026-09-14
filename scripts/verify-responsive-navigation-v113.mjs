import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const speed = read('components/NavigationSpeedBoost.tsx');
const settings = read('components/SettingsWorkspace.tsx');
const settingsPage = read('app/dashboard/settings/page.tsx');
const settingsCss = read('app/dashboard/settings/SettingsPage.module.css');
const pageStack = read('app/mobile-page-stack.css');
const profilePage = read('app/dashboard/profile/page.tsx');
const chrome = read('components/FiconterNativeAppChrome.tsx');

const sectionBlock = settings.slice(settings.indexOf('const sections = ['), settings.indexOf('] as const;', settings.indexOf('const sections = [')) + 11);
const sectionIdBlock = settings.slice(settings.indexOf('function isSectionId'), settings.indexOf('const sections = ['));

const checks = [
  ['route animation requires native phone device class', speed.includes('root.dataset.ficonterDevice === "phone"')],
  ['settings route-driven drilldown requires phone', settings.includes('root.dataset.ficonterDevice === "phone"') && settings.includes('if (isNativePhone)')],
  ['tablet settings uses local state instead of route navigation', settings.includes('Tablet/iPad/desktop-class Settings switches locally') && settings.includes('setActive(id);')],
  ['phone replacement CSS is device-class scoped', pageStack.includes('data-ficonter-device="phone"') && pageStack.includes('data-mobile-detail="true"')],
  ['tablet keeps settings navigation visible', pageStack.includes('data-ficonter-device="tablet"') && pageStack.includes('SettingsWorkspace_navigation') && pageStack.includes('display: grid !important;')],
  ['tablet keeps settings detail panel visible', pageStack.includes('data-ficonter-device="tablet"') && pageStack.includes('SettingsWorkspace_panel') && pageStack.includes('display: block !important;')],
  ['legacy second transition stylesheet stays unloaded', !read('app/layout.tsx').includes('mobile-screen-stack.css')],
  ['Profile remains an internal Settings section for the dedicated Profile route', sectionBlock.includes('id: "profile"') && sectionBlock.indexOf('id: "profile"') < sectionBlock.indexOf('id: "security"')],
  ['Profile remains accepted as an internal section id', sectionIdBlock.includes('"profile"')],
  ['Profile is hidden from the Settings menu', settingsCss.includes('SettingsWorkspace_sectionButton') && settingsCss.includes(':first-child') && settingsCss.includes('display: none !important;')],
  ['Settings defaults to Account & security when no section is requested', settings.includes(': "security",') && settings.includes('? "security"')],
  ['Dedicated Profile entry still targets its private Profile section', chrome.includes('href: "/dashboard/settings?section=profile"')],
  ['Settings landing copy no longer advertises Profile as a Settings option', !settingsPage.includes('Manage your profile, account security')],
  ['Legacy Profile route permanently redirects into the dedicated Profile section', profilePage.includes('permanentRedirect("/dashboard/settings?section=profile")') && !profilePage.includes('fui-profile-card')],
];

let passed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}`);
  if (ok) passed += 1;
}
console.log(`\n${passed}/${checks.length} checks passed.`);
if (passed !== checks.length) process.exit(1);
