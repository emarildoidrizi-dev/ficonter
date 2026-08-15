import fs from 'node:fs';

const selector = fs.readFileSync('components/LanguageSelector.tsx', 'utf8');
const provider = fs.readFileSync('components/LanguageProvider.tsx', 'utf8');
const css = fs.readFileSync('components/LanguageSelector.module.css', 'utf8');

const checks = [
  ['language selector no longer blocks on saving state', !selector.includes('const [saving, setSaving]')],
  ['language trigger is not disabled during account persistence', !selector.includes('disabled={saving}')],
  ['language selection closes menu immediately', selector.includes('setOpen(false);')],
  ['account persistence runs without awaiting before UI response', selector.includes('void changeLanguage(nextLanguage, true)')],
  ['stale language-save messages are guarded', selector.includes('latestSelectionRef')],
  ['document translation is deferred to next frame', provider.includes('window.requestAnimationFrame')],
  ['account language persistence is serialized', provider.includes('accountPersistenceQueueRef')],
  ['language trigger uses manipulation touch action', css.includes('touch-action: manipulation')],
  ['expensive menu backdrop blur removed', !css.includes('backdrop-filter: blur(18px)')],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}`);
  if (!ok) failed += 1;
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed.`);
if (failed) process.exit(1);
