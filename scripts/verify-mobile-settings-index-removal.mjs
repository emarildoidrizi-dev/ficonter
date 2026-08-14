import fs from 'node:fs';

const css = fs.readFileSync('components/SettingsWorkspace.module.css', 'utf8');
const checks = [
  ['mobile index is hidden', /@media\(max-width:1050px\)[\s\S]*?\.workspace\[data-settings-view="index"\]\{display:none!important\}/],
  ['detail still hides old navigation', /\.workspace\[data-settings-view="detail"\] \.navigation\{display:none!important\}/],
  ['detail panel still slides in', /\.workspace\[data-settings-view="detail"\] \.panel\{display:block!important;animation:settings-section-slide-in/],
  ['desktop navigation base rule remains', /\.navigation\{position:sticky;top:34px;padding:16px\}/],
];
let passed = 0;
for (const [name, pattern] of checks) {
  const ok = pattern.test(css);
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
  if (ok) passed++;
}
console.log(`\n${passed}/${checks.length} checks passed.`);
if (passed !== checks.length) process.exit(1);
