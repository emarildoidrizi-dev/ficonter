import fs from 'node:fs';

const chrome = fs.readFileSync('components/FiconterNativeAppChrome.tsx', 'utf8');
const css = fs.readFileSync('components/FiconterNativeAppChrome.module.css', 'utf8');
const personal = fs.readFileSync('app/dashboard/layout.tsx', 'utf8');
const business = fs.readFileSync('app/business/layout.tsx', 'utf8');

const checks = [
  ['avatar path prop exists', chrome.includes('avatarPath?: string;')],
  ['avatar signed URL loaded', chrome.includes('.from("profile-photos")') && chrome.includes('createSignedUrl(liveAvatarPath')],
  ['profile update event syncs avatar', chrome.includes('ficonter:profile-updated') && chrome.includes('setLiveAvatarPath')],
  ['real avatar rendered in top account control', chrome.includes('className={styles.workspaceAvatarImage}')],
  ['personal layout passes avatar path', personal.includes('avatarPath={String(user.user_metadata?.avatar_path ?? "")}')],
  ['business layout passes avatar path', business.includes('avatarPath={String(user.user_metadata?.avatar_path ?? "")}')],
  ['account popup retains logout', chrome.includes('Logging out…') && chrome.includes('Log out')],
  ['profile action removed from account popup', !chrome.includes('<span>Profile</span>')],
  ['old profile icon import removed', !chrome.includes('UserRound,')],
  ['header top bar transparent', css.includes(':global(html[data-ficonter-native-app="true"]) .header {\n  border-bottom: 0;\n  background: transparent;\n  box-shadow: none;')],
  ['top icon shadows removed', css.includes('.headerBrandMark,\n.menuBadge {\n  box-shadow: none;')],
  ['profile control shadow removed', css.includes('.workspaceBadge {\n  overflow: hidden;') && css.includes('box-shadow: none;')],
  ['avatar image cover styling present', css.includes('.workspaceAvatarImage {') && css.includes('object-fit: cover;')],
  ['business selector uses floating theme surface', css.includes('.businessProfileBar {') && css.includes('var(--mobile-surface-raised)')],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  for (const [name] of failed) console.error(`FAIL: ${name}`);
  process.exit(1);
}
console.log(`FICONTER mobile UI Phase 6.9: ${checks.length} clean-header/avatar checks passed.`);
