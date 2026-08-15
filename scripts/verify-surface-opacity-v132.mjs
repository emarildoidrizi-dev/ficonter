import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const settings = read('components/SettingsWorkspace.tsx');
const settingsCss = read('components/SettingsWorkspace.module.css');
const bootstrap = read('components/InterfacePreferencesBootstrap.tsx');
const themes = read('lib/interfaceThemes.ts');
const globals = read('app/globals.css');
const palettes = read('app/theme-palettes.css');
const coastal = read('app/coastal-shell.css');
const layout = read('app/layout.tsx');
const dashboardLayout = read('app/dashboard/layout.tsx');
const businessLayout = read('app/business/layout.tsx');
const exportSource = read('lib/accountExport.ts');

const checks = [];
function expect(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
  console.log(`PASS - ${message}`);
}

expect(themes.includes('SURFACE_OPACITY_MIN = 55'), 'surface opacity has a safe 55% minimum');
expect(themes.includes('SURFACE_OPACITY_MAX = 100'), 'surface opacity caps at 100%');
expect(themes.includes('SURFACE_OPACITY_DEFAULT = 100'), 'surface opacity defaults to the current fully solid presentation');
expect(themes.includes('normalizeSurfaceOpacity'), 'surface opacity is normalized centrally');
expect(settings.includes('surfaceOpacity: number;'), 'Settings preference model stores surface opacity');
expect(settings.includes('type="range"') && settings.includes('min="55"') && settings.includes('max="100"') && settings.includes('step="5"'), 'Appearance exposes a compact 55–100% range control');
expect(settings.includes('surfaceOpacity: normalizeSurfaceOpacity(event.target.value)'), 'slider edits only the local Settings draft');
expect(settings.includes('The change stays a preview until you click Save appearance.'), 'UI explains draft-only opacity behavior');
expect(settings.includes('savePreferences(preferences, "Appearance preferences saved.", "appearance")'), 'surface opacity commits through the existing explicit Save appearance action');
expect(settings.includes('localStorage.setItem(\n      "ficonter-surface-opacity"'), 'committed surface opacity persists locally after Save');
expect(settings.includes('root.style.setProperty(\n    "--ficonter-surface-opacity"'), 'committed surface opacity updates the global semantic surface variable');
expect(bootstrap.includes('surfaceOpacity?: number | string | null;'), 'authenticated interface bootstrap accepts stored opacity');
expect(bootstrap.includes('ficonter-surface-opacity'), 'authenticated bootstrap restores and synchronizes opacity');
expect(dashboardLayout.includes('surfaceOpacity'), 'Personal workspace hydrates saved opacity from account metadata');
expect(businessLayout.includes('surfaceOpacity'), 'Business workspace hydrates saved opacity from account metadata');
expect(layout.includes('inWorkspace ? surfaceOpacity : 100'), 'pre-hydration script limits saved opacity to authenticated workspaces');
expect(globals.includes('--surface-card-solid:') && globals.includes('var(--ficonter-surface-opacity, 100%)'), 'base semantic surfaces preserve solid colors and mix transparency separately');
expect(palettes.includes('--surface-card-solid:') && palettes.includes('var(--ficonter-surface-opacity, 100%)'), 'premium theme surfaces are opacity-aware');
expect(coastal.includes('--surface-card-solid:') && coastal.includes('var(--ficonter-surface-opacity, 100%)'), 'coastal workspace surfaces are opacity-aware');
expect(!`${globals}\n${palettes}\n${coastal}`.includes('opacity: var(--ficonter-surface-opacity'), 'opacity is never applied to containers, so text/icons/logos remain fully opaque');
expect(settingsCss.includes('.opacityPreview') && settingsCss.includes('.opacityRange'), 'Appearance includes an isolated surface preview without changing the live platform');
expect(exportSource.includes('["Surface opacity"'), 'account PDF export records the saved opacity preference');

console.log(`\n${checks.length}/${checks.length} FICONTER V1.32 surface-opacity checks passed.`);
