import fs from 'node:fs';

const settings = fs.readFileSync('components/SettingsWorkspace.tsx', 'utf8');
const interactionLock = fs.readFileSync('components/InstalledPwaSettingsInteractionLock.tsx', 'utf8');
const supplemental = fs.readFileSync('components/SettingsSupplementalModules.tsx', 'utf8');
const settingsPage = fs.readFileSync('app/dashboard/settings/page.tsx', 'utf8');
const settingsPageCss = fs.readFileSync('app/dashboard/settings/SettingsPage.module.css', 'utf8');
const navigationRuntime = fs.readFileSync('lib/navigationRuntime.ts', 'utf8');
const sidebar = fs.readFileSync('components/Sidebar.tsx', 'utf8');
const stack = fs.readFileSync('app/mobile-page-stack.css', 'utf8');

const checks = [
  ['Settings reads client search params', settings.includes('useSearchParams')],
  ['Phone Settings switches active content locally', settings.includes('setActive(id);') && settings.includes('setMobileDetailOpen(true);')],
  ['Phone Settings uses native client history', settings.includes('window.history.pushState(null, "", target);')],
  ['Settings no longer calls router.push for section changes', !settings.includes('router.push(target, { scroll: false });')],
  ['Settings synchronizes Back/history URL into local state', settings.includes('const sectionFromUrl = searchParams.get("section")')],
  ['Back to the Settings parent preserves the last active section', settings.includes('if (nextSection) {\n      setActive(nextSection);\n      setMobileDetailOpen(true);\n      return;\n    }\n\n    setMobileDetailOpen(false);')],
  ['Installed PWA tap lock is standalone-phone only', interactionLock.includes('root.dataset.ficonterDisplayMode === "standalone"') && interactionLock.includes('root.dataset.ficonterDevice === "phone"')],
  ['Installed PWA completes section taps on pointerup', interactionLock.includes('const handlePointerUp = (event: PointerEvent) =>') && interactionLock.includes('tap.button.click();')],
  ['Installed PWA suppresses the later duplicate native click', interactionLock.includes('NATIVE_CLICK_SUPPRESSION_MS') && interactionLock.includes('event.stopImmediatePropagation();')],
  ['Installed PWA rejects scroll gestures before opening a section', interactionLock.includes('TAP_MOVE_TOLERANCE_PX') && interactionLock.includes('pendingTap.moved = true;')],
  ['Settings page mounts the interaction lock', settingsPage.includes('<InstalledPwaSettingsInteractionLock />')],
  ['Installed-phone local Back is standalone-only', navigationRuntime.includes('root.dataset.ficonterDisplayMode !== "standalone"')],
  ['Installed-phone local Back is phone-only', navigationRuntime.includes('root.dataset.ficonterDevice !== "phone"')],
  ['Installed-phone Back paints parent before history reconciliation', navigationRuntime.includes('projectSettingsParentImmediately();') && navigationRuntime.includes('workspace.dataset.mobileDetail = "false";')],
  ['Installed-phone Settings Back reverses native history', navigationRuntime.includes('window.history.back();')],
  ['Standalone-launch fallback removes only section query', navigationRuntime.includes('localParentUrl.searchParams.delete("section");')],
  ['Installed-phone Settings detail Back blocks router continuation', navigationRuntime.includes('if (consumeInstalledPhoneSettingsBack(target, current, root))') && navigationRuntime.includes('return false;')],
  ['Local Back is scoped to the Settings parent destination', navigationRuntime.includes('targetUrl.pathname !== "/dashboard/settings"') && navigationRuntime.includes('targetUrl.searchParams.has("section")')],
  ['Same-path Sidebar Back uses browser history', sidebar.includes('window.history.back();')],
  ['Cross-path Sidebar Back still uses client router', sidebar.includes('router.push(target, { scroll: false });')],
  ['Global phone forward transition remains 220ms outside Settings', stack.includes('ficonter-mobile-page-forward 220ms')],
  ['Global phone back transition remains 200ms outside Settings', stack.includes('ficonter-mobile-page-back 200ms')],
  ['Installed-phone Settings route animation is disabled', stack.includes('.app-main > .ficonter-settings-page') && stack.includes('animation: none !important;')],
  ['Installed-phone Settings row transitions are disabled', stack.includes('[class*="SettingsWorkspace_sectionButton"]') && stack.includes('transition: none !important;')],
  ['Phone Settings taps keep manipulation touch action', stack.includes('touch-action: manipulation;')],
  ['Tablet Settings contract remains present', stack.includes('V1.13 — Tablet/iPad contract.')],
  ['Settings independent server reads execute in parallel', settingsPage.includes('await Promise.all([') && settingsPage.includes('verifiedAccessPromise')],
  ['Installed-phone supplemental modules are section-gated', supplemental.includes('runtimeMode === "installed-phone"') && supplemental.includes('section === "security"') && supplemental.includes('section === "profile"') && supplemental.includes('section === "privacy"')],
  ['Heavy supplemental Settings modules are lazy-loaded', supplemental.includes('dynamic(') && supplemental.includes('{ ssr: false, loading: () => null }')],
  ['Profile remains the first internal section so the separation rule is deterministic', settings.includes('const sections = [\n  { id: "profile"')],
  ['Profile is hidden from the Settings menu everywhere', settingsPageCss.includes('SettingsWorkspace_sectionButton') && settingsPageCss.includes(':first-child') && settingsPageCss.includes('display: none !important;')],
  ['Settings page no longer advertises Profile as a Settings option', !settingsPage.includes('Manage your profile, account security')],
];

for (const [label, ok] of checks) {
  if (!ok) throw new Error(`FAIL - ${label}`);
  console.log(`PASS - ${label}`);
}

console.log(`\n${checks.length}/${checks.length} checks passed.`);
