import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

const settings = read('components/SettingsWorkspace.tsx');
const languageSelector = read('components/LanguageSelector.tsx');
const languageProvider = read('components/LanguageProvider.tsx');
const planner = read('components/MonthlyPlanner.tsx');
const entry = read('components/EffortlessEntryWorkspace.tsx');
const support = read('components/SupportInbox.tsx');
const businessSidebar = read('components/BusinessSidebar.tsx');
const mobileChrome = read('components/FiconterNativeAppChrome.tsx');
const instantBusinessSwitch = read('components/useInstantBusinessSwitch.ts');

const checks = [
  ['Settings keeps committed preference snapshot', settings.includes('savedPreferences') && settings.includes('setSavedPreferences(next)')],
  ['Settings discards drafts when section changes', settings.includes('Moving to another section discards any unconfirmed changes') && settings.includes('setPreferences(savedPreferences)')],
  ['Theme selection previews immediately without persistence', settings.includes('applyInterfacePreview(next);') && settings.includes('Preview deliberately does not touch localStorage or Supabase')],
  ['Density selection no longer applies globally before Save', !settings.includes('setPreferences(next);\n                        applyInterface(next);')],
  ['Remember-device toggle is draft only', settings.includes('onChange={setRememberDevice}')],
  ['Remember-device preference has explicit Save', settings.includes('Save device preference') && settings.includes('saveTrustedDevicePreference(rememberDevice)')],
  ['Language is the deliberate immediate-confirm exception', languageSelector.includes('choosing the option is the confirmation') && !languageSelector.includes('draftLanguage')],
  ['Language picker has no separate Save action', !languageSelector.includes('t("saveLanguage")') && !languageSelector.includes('saveLanguage()')],
  ['Language selection persists through the stable provider', languageSelector.includes('await changeLanguage(nextLanguage, true)') && languageProvider.includes('await supabase.auth.getUser()')],
  ['Language is applied only after successful persistence', languageProvider.includes('applyCommittedLanguage();') && languageProvider.indexOf('await supabase.auth.getUser()') < languageProvider.lastIndexOf('applyCommittedLanguage();')],
  ['Monthly Planner start balance has explicit Save', planner.includes('Save start balance')],
  ['Monthly Planner no longer saves start balance on blur', !planner.includes('onBlur={e=>saveStartBalance')],
  ['Planner breakdown view is not auto-persisted', !planner.includes('ficonter:planner-breakdown-view')],
  ['Effortless Entry mode uses draft mode', entry.includes('draftMode') && entry.includes('savedMode')],
  ['Effortless Entry mode has explicit Save', entry.includes('Save entry style') && entry.includes('async function saveMode()')],
  ['Support status uses draft select', support.includes('value={statusDraft}') && support.includes('setStatusDraft(event.target.value as SupportStatus)')],
  ['Support status requires explicit Save', support.includes('Save status') && support.includes('updateStatus(statusDraft)')],
  ['Business switching is the deliberate immediate-action exception', instantBusinessSwitch.includes('Selecting the profile is the confirmation') && instantBusinessSwitch.includes('switchActiveBusinessAction(nextBusinessId)')],
  ['Desktop business selector switches directly with no Apply draft', businessSidebar.includes('onChange={(event) => void switchBusiness(event.target.value)}') && !businessSidebar.includes('applyBusinessSwitch') && !businessSidebar.includes('selectedBusinessId')],
  ['Mobile business selectors switch directly with no Apply draft', mobileChrome.includes('onChange={(event) => void switchBusiness(event.target.value)}') && !mobileChrome.includes('applyBusinessProfile') && !mobileChrome.includes('selectedBusinessId')],
  ['Business switch failure rolls the UI back', instantBusinessSwitch.includes('status: "rollback"') && instantBusinessSwitch.includes('setOptimisticBusinessId(previousBusinessId)')],
  ['Business switch uses client-side RSC reconciliation, not browser reload', instantBusinessSwitch.includes('router.refresh()') && !businessSidebar.includes('window.location.replace(window.location.href)')],
  ['No direct support status persistence from select change', !support.includes('onChange={(event) => void updateStatus')],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}`);
  if (!ok) failed += 1;
}

console.log(`\n${checks.length - failed}/${checks.length} explicit-save governance checks passed.`);
if (failed) process.exit(1);
