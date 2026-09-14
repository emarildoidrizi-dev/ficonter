import fs from 'node:fs';

const settings = fs.readFileSync('components/SettingsWorkspace.tsx', 'utf8');
const pwaSettings = fs.readFileSync('components/InstalledPwaSettingsWorkspace.tsx', 'utf8');
const supplemental = fs.readFileSync('components/SettingsSupplementalModules.tsx', 'utf8');
const settingsPage = fs.readFileSync('app/dashboard/settings/page.tsx', 'utf8');
const settingsPageCss = fs.readFileSync('app/dashboard/settings/SettingsPage.module.css', 'utf8');
const stack = fs.readFileSync('app/mobile-page-stack.css', 'utf8');

const checks = [
  ['Browser/tablet Settings still reads client search params', settings.includes('useSearchParams')],
  ['Installed PWA uses a dedicated Settings state owner', settingsPage.includes('<InstalledPwaSettingsWorkspace')],
  ['Installed PWA detects standalone phone runtime', pwaSettings.includes('ficonterDisplayMode')],
  ['Installed PWA section list excludes Profile', !pwaSettings.includes('id: "profile"') && !pwaSettings.includes('label: "Profile"')],
  ['Installed PWA opens a section with a synchronous React commit', pwaSettings.includes('flushSync(() => {') && pwaSettings.includes('setActive(id);') && pwaSettings.includes('setDetailOpen(true);')],
  ['Installed PWA uses local native history instead of router navigation', pwaSettings.includes('window.history.pushState') && !pwaSettings.includes('router.push')],
  ['Installed PWA completes taps directly on pointerup', pwaSettings.includes('onPointerUp={(event) => completeTap(event, id)}')],
  ['Installed PWA rejects scroll gestures', pwaSettings.includes('TAP_MOVE_TOLERANCE') && pwaSettings.includes('tap.moved = true;')],
  ['Back paints the Settings menu synchronously', pwaSettings.includes('flushSync(() => setDetailOpen(false));')],
  ['Back preserves the active section', pwaSettings.includes('Back to the Settings menu deliberately keeps the last active row.')],
  ['Back reverses native section history', pwaSettings.includes('window.history.back();')],
  ['Installed PWA intercepts only detail Back', pwaSettings.includes('if (!installedPhone || !detailOpen) return;')],
  ['Settings page rejects legacy Profile detail rendering', settingsPage.includes('if (section === "profile")') && settingsPage.includes('redirect("/dashboard/profile")')],
  ['Settings supplemental modules do not mount Profile', !supplemental.includes('ProfileIdentityDetailsForm') && !supplemental.includes('section === "profile"')],
  ['Heavy supplemental Settings modules remain lazy-loaded', supplemental.includes('dynamic(') && supplemental.includes('{ ssr: false, loading: () => null }')],
  ['Installed-phone Settings route animation remains disabled', stack.includes('.app-main > .ficonter-settings-page') && stack.includes('animation: none !important;')],
  ['Installed-phone Settings row transitions remain disabled', stack.includes('[class*="SettingsWorkspace_sectionButton"]') && stack.includes('transition: none !important;')],
  ['Phone Settings taps retain manipulation touch action', stack.includes('touch-action: manipulation;')],
  ['Tablet Settings contract remains present', stack.includes('V1.13 — Tablet/iPad contract.')],
  ['Settings independent server reads execute in parallel', settingsPage.includes('await Promise.all([') && settingsPage.includes('verifiedAccessPromise')],
  ['Browser fallback hides Profile row', settingsPageCss.includes('button:first-child') && settingsPageCss.includes('display: none !important;')],
  ['Settings page no longer advertises Profile as a Settings option', !settingsPage.includes('Manage your profile, account security')],
];

for (const [label, ok] of checks) {
  if (!ok) throw new Error(`FAIL - ${label}`);
  console.log(`PASS - ${label}`);
}

console.log(`\n${checks.length}/${checks.length} checks passed.`);
