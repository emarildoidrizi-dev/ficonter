import fs from 'node:fs';

const chrome = fs.readFileSync('components/FiconterNativeAppChrome.tsx', 'utf8');
const css = fs.readFileSync('components/FiconterNativeAppChrome.module.css', 'utf8');
const mobileCss = fs.readFileSync('app/mobile-module-layouts.css', 'utf8');
const dashboardLayout = fs.readFileSync('app/dashboard/layout.tsx', 'utf8');

const checks = [
  ['native chrome accepts avatar path', chrome.includes('avatarPath?: string')],
  ['dashboard passes saved avatar path', dashboardLayout.includes('avatarPath={String(user.user_metadata?.avatar_path ?? "")}')],
  ['top profile control renders photo', chrome.includes('workspaceAvatarImage') && chrome.includes('src={avatarUrl}')],
  ['profile update event refreshes avatar', chrome.includes('ficonter:profile-updated') && chrome.includes('setAvatarPhotoPath(detail.profilePhotoPath)')],
  ['profile photo signed url is loaded', chrome.includes('.from("profile-photos")') && chrome.includes('.createSignedUrl(avatarPhotoPath, 60 * 60)')],
  ['avatar remains initials fallback', chrome.includes('<span>{accountInitial}</span>')],
  ['home dock is a button action', chrome.includes('aria-label="Open Home instantly"') && chrome.includes('onClick={goHomeInstant}')],
  ['home prefetch starts on pointer down', chrome.includes('onPointerDown={() => router.prefetch("/dashboard")}')],
  ['home uses history fast path', chrome.includes('previousPathRef.current === "/dashboard"') && chrome.includes('router.back()')],
  ['home fallback is client router navigation', chrome.includes('router.push("/dashboard", { scroll: false })')],
  ['home suppresses route loading chrome', chrome.includes('removeAttribute("data-ficonter-route-loading")')],
  ['mobile settings index card is removed', mobileCss.includes('[data-settings-view="index"] [class*="SettingsWorkspace_navigation"] {\n  display: none !important;')],
  ['avatar image styling exists', css.includes('.workspaceAvatarImage') && css.includes('object-fit: cover')],
];

let passed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (ok) passed += 1;
}
console.log(`\n${passed}/${checks.length} checks passed.`);
if (passed !== checks.length) process.exit(1);
