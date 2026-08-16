import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

const desktop = read('components/BusinessSidebar.tsx');
const mobile = read('components/FiconterNativeAppChrome.tsx');
const manager = read('components/BusinessManager.tsx');
const hook = read('components/useInstantBusinessSwitch.ts');
const action = read('app/business/actions.ts');
const desktopCss = read('components/BusinessSidebar.module.css');
const mobileCss = read('components/FiconterNativeAppChrome.module.css');
const businessInterfaceCss = read('app/business-interface.css');

const checks = [
  ['Desktop selector switches on selection', desktop.includes('onChange={(event) => void switchBusiness(event.target.value)}')],
  ['Desktop old selectedBusinessId draft removed', !desktop.includes('selectedBusinessId')],
  ['Desktop old pendingBusinessId draft removed', !desktop.includes('pendingBusinessId')],
  ['Desktop Apply workflow removed', !desktop.includes('applyBusinessSwitch') && !desktop.includes('applyBusinessButton') && !desktopCss.includes('applyBusinessButton')],
  ['Desktop hard browser reload fallback removed', !desktop.includes('window.location.replace(window.location.href)')],
  ['Mobile selectors switch on selection', (mobile.match(/onChange=\{\(event\) => void switchBusiness\(event\.target\.value\)\}/g) ?? []).length >= 2],
  ['Mobile old selectedBusinessId draft removed', !mobile.includes('selectedBusinessId')],
  ['Mobile Apply workflow removed', !mobile.includes('applyBusinessProfile') && !mobile.includes('businessProfileApply') && !mobile.includes('drawerBusinessApply') && !mobileCss.includes('businessProfileApply') && !mobileCss.includes('drawerBusinessApply')],
  ['Shared switch is optimistic', hook.includes('setOptimisticBusinessId(nextBusinessId)') && hook.includes('status: "switching"')],
  ['Shared switch rolls back on server/action failure', hook.includes('setOptimisticBusinessId(previousBusinessId)') && hook.includes('status: "rollback"')],
  ['Shared switch synchronizes desktop/mobile shells', hook.includes('ficonter:active-business-ui') && hook.includes('CustomEvent<BusinessSwitchUiDetail>')],
  ['Shared switch reconciles Business server data client-side', hook.includes('startRefreshTransition') && hook.includes('router.refresh()')],
  ['Stale Business module interaction is blocked during reconciliation', hook.includes('ficonterBusinessSwitching') && businessInterfaceCss.includes('html[data-ficonter-business-switching="true"] .app-main.business-interface') && businessInterfaceCss.includes('pointer-events: none')],
  ['Switch errors are presented as small live status messages', desktop.includes('aria-live="polite"') && mobile.includes('businessProfileError') && mobile.includes('businessSwitchToast')],
  ['Manage-business card path uses guarded server action', manager.includes('switchActiveBusinessAction(businessId)') && !manager.includes('supabase.rpc(\n      "set_active_business_workspace"')],
  ['Manage-business card path broadcasts optimistic + rollback state', manager.includes('broadcastInstantBusinessSwitch') && manager.includes('status: "rollback"')],
  ['Server action keeps subscription guard', action.includes('requireSubscriptionFeature("business_workspace")')],
  ['Server action revalidates Business layout after persistence', action.includes('revalidatePath("/business", "layout")')],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}`);
  if (!ok) failed += 1;
}

console.log(`\n${checks.length - failed}/${checks.length} instant-business-switching checks passed.`);
if (failed) process.exit(1);
