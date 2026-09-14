import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const speed = read('components/NavigationSpeedBoost.tsx');
const settings = read('components/SettingsWorkspace.tsx');
const pwaSettings = read('components/InstalledPwaSettingsWorkspace.tsx');
const settingsPage = read('app/dashboard/settings/page.tsx');
const settingsCss = read('app/dashboard/settings/SettingsPage.module.css');
const pageStack = read('app/mobile-page-stack.css');
const profilePage = read('app/dashboard/profile/page.tsx');

const checks = [
  ['route animation requires native phone device class', speed.includes('root.dataset.ficonterDevice === "phone"')],
  ['browser/tablet Settings workspace remains available', settings.includes('Tablet/iPad/desktop-class Settings switches locally') && settings.includes('setActive(id);')],
  ['phone replacement CSS is device-class scoped', pageStack.includes('data-ficonter-device="phone"') && pageStack.includes('data-mobile-detail="true"')],
  ['tablet keeps settings navigation visible', pageStack.includes('data-ficonter-device="tablet"') && pageStack.includes('SettingsWorkspace_navigation') && pageStack.includes('display: grid !important;')],
  ['tablet keeps settings detail panel visible', pageStack.includes('data-ficonter-device="tablet"') && pageStack.includes('SettingsWorkspace_panel') && pageStack.includes('display: block !important;')],
  ['legacy second transition stylesheet stays unloaded', !read('app/layout.tsx').includes('mobile-screen-stack.css')],
  ['installed PWA Settings has no Profile section', !pwaSettings.includes('id: "profile"') && !pwaSettings.includes('label: "Profile"')],
  ['browser Settings hides the retired Profile row', settingsCss.includes('SettingsWorkspace_sectionList') && settingsCss.includes('button:first-child') && settingsCss.includes('display: none !important;')],
  ['Settings defaults to Account & security when no section is requested', settings.includes(': "security",') && settings.includes('? "security"')],
  ['old Settings Profile URL redirects to dedicated Profile', settingsPage.includes('if (section === "profile")') && settingsPage.includes('redirect("/dashboard/profile")')],
  ['Settings landing copy does not advertise Profile', !settingsPage.includes('Manage your profile, account security')],
  ['Profile is a real page and no longer redirects into Settings', profilePage.includes('<ProfileWorkspace') && !profilePage.includes('permanentRedirect')],
  ['installed PWA Settings owns its local section history', pwaSettings.includes('window.history.pushState') && pwaSettings.includes('window.history.back()')],
  ['installed PWA Back preserves active selection', pwaSettings.includes('setDetailOpen(false);') && pwaSettings.includes('Back to the Settings menu deliberately keeps the last active row.')],
];

let passed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}`);
  if (ok) passed += 1;
}
console.log(`\n${passed}/${checks.length} checks passed.`);
if (passed !== checks.length) process.exit(1);
