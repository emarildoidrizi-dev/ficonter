import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const ROOT = resolve(new URL("..", import.meta.url).pathname);
const LANGUAGES = ["en", "de", "es", "sq", "ar", "pt", "it", "ru"];
const NON_ENGLISH = LANGUAGES.filter((language) => language !== "en");

function read(path) {
  return readFileSync(join(ROOT, path), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sourceFile(path) {
  const fullPath = join(ROOT, path);
  return ts.createSourceFile(
    path,
    readFileSync(fullPath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function normalizeUiText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function hasHumanText(value) {
  const text = normalizeUiText(value);
  if (!text || text.length < 2) return false;
  if (!/\p{L}/u.test(text)) return false;
  if (/^(https?:|mailto:|tel:|data:)/i.test(text)) return false;
  return true;
}

function stringValue(node) {
  if (!node) return null;
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

function collectStringPropertyKeys(path) {
  const sf = sourceFile(path);
  const keys = new Set();
  function visit(node) {
    if (ts.isPropertyAssignment(node)) {
      const name = stringValue(node.name);
      if (name) keys.add(normalizeUiText(name));
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return keys;
}

function findFullCatalogRows() {
  const sf = sourceFile("lib/i18n/fullUiCatalog.ts");
  const rows = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(sf) === "FULL_UI_TRANSLATIONS" && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      for (const property of node.initializer.properties) {
        if (!ts.isPropertyAssignment(property) || !ts.isObjectLiteralExpression(property.initializer)) continue;
        const source = stringValue(property.name);
        if (!source) continue;
        const values = {};
        for (const entry of property.initializer.properties) {
          if (!ts.isPropertyAssignment(entry)) continue;
          const language = entry.name.getText(sf).replace(/["']/g, "");
          const value = stringValue(entry.initializer);
          if (value !== null) values[language] = value;
        }
        rows.set(normalizeUiText(source), values);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return rows;
}

function walkSourceFiles(directory, output = []) {
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    const rel = relative(ROOT, full).replaceAll("\\", "/");
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (rel === "lib/i18n" || rel.startsWith("lib/i18n/")) continue;
      walkSourceFiles(full, output);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      output.push(full);
    }
  }
  return output;
}

const UI_PROPERTY_NAMES = new Set([
  "label",
  "description",
  "title",
  "name",
  "text",
  "eyebrow",
  "message",
  "reason",
]);
const UI_ATTRIBUTE_NAMES = new Set([
  "aria-label",
  "aria-description",
  "placeholder",
  "title",
  "alt",
]);
const UI_CALL_NAMES = new Set([
  "setError",
  "setMessage",
  "showToast",
]);

function expressionName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return "";
}

function conditionalIsUiFacing(node, sf) {
  let current = node.parent;
  for (let depth = 0; current && depth < 6; depth += 1, current = current.parent) {
    if (ts.isJsxExpression(current)) {
      const parent = current.parent;
      if (ts.isJsxAttribute(parent)) {
        const attribute = parent.name.getText(sf);
        if (["className", "style", "key", "id", "href", "src"].includes(attribute) || attribute.startsWith("data-")) return false;
      }
      return true;
    }
    if (ts.isPropertyAssignment(current)) {
      const name = current.name.getText(sf).replace(/["']/g, "");
      if (UI_PROPERTY_NAMES.has(name)) return true;
    }
    if (ts.isCallExpression(current) && UI_CALL_NAMES.has(expressionName(current.expression))) return true;
  }
  return false;
}

const NON_LOCALIZABLE_VISIBLE = new Set([
  "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "EUR", "SKU", "COGS", "APR", "you@example.com",
]);

function collectStaticUiStrings() {
  const sources = [
    ...walkSourceFiles(join(ROOT, "app")),
    ...walkSourceFiles(join(ROOT, "components")),
    ...walkSourceFiles(join(ROOT, "lib")),
  ];
  const results = new Map();

  function add(value, file, node, kind, context = "") {
    const text = normalizeUiText(value);
    if (!hasHumanText(text) || NON_LOCALIZABLE_VISIBLE.has(text)) return;
    if (!results.has(text)) results.set(text, []);
    const sf = node.getSourceFile();
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    results.get(text).push({ file, line, kind, context });
  }

  for (const fullPath of sources) {
    const file = relative(ROOT, fullPath).replaceAll("\\", "/");
    if (file === "app/layout.tsx") {
      // Inline bootstrap scripts are implementation code, not rendered interface copy.
    }
    const text = readFileSync(fullPath, "utf8");
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

    function visit(node) {
      if (ts.isJsxText(node)) add(node.text, file, node, "jsx");

      if (ts.isJsxAttribute(node)) {
        const name = node.name.getText(sf);
        if (UI_ATTRIBUTE_NAMES.has(name) && node.initializer && ts.isStringLiteral(node.initializer)) {
          add(node.initializer.text, file, node.initializer, "attr", name);
        }
      }

      if (ts.isPropertyAssignment(node)) {
        const name = node.name.getText(sf).replace(/["']/g, "");
        if (UI_PROPERTY_NAMES.has(name)) {
          const value = stringValue(node.initializer);
          if (value !== null) add(value, file, node.initializer, "prop", name);
        }
      }

      if (ts.isCallExpression(node) && UI_CALL_NAMES.has(expressionName(node.expression))) {
        const first = node.arguments[0];
        const value = stringValue(first);
        if (value !== null) add(value, file, first, "call", expressionName(node.expression));
      }

      if (ts.isConditionalExpression(node) && conditionalIsUiFacing(node, sf)) {
        for (const branch of [node.whenTrue, node.whenFalse]) {
          const value = stringValue(branch);
          if (value !== null) add(value, file, branch, "conditional");
        }
      }

      ts.forEachChild(node, visit);
    }
    visit(sf);
  }
  return results;
}

const config = read("lib/i18n/config.ts");
const rootLayout = read("app/layout.tsx");
const dashboardLayout = read("app/dashboard/layout.tsx");
const businessLayout = read("app/business/layout.tsx");
const workspaceSwitcher = read("components/WorkspaceSwitcher.tsx");
const settings = read("components/SettingsWorkspace.tsx");
const provider = read("components/LanguageProvider.tsx");
const runtimeTranslator = read("lib/i18n/runtimeTranslator.ts");

for (const language of LANGUAGES) {
  assert(config.includes(`"${language}"`), `Missing supported language: ${language}`);
}
assert(config.includes('direction: "rtl"'), "Arabic RTL configuration is missing.");
assert(rootLayout.includes("<LanguageProvider"), "Root layout is missing LanguageProvider.");
assert(rootLayout.includes("<GlobalLanguageControl"), "Global language selector is missing.");
assert(workspaceSwitcher.includes("<LanguageSelector"), "Workspace top-bar language selector is missing.");
assert(!settings.includes('active === "language"'), "Duplicate Settings language section still exists.");
assert(!settings.includes('id: "language"'), "Duplicate Settings language navigation item still exists.");
assert(!rootLayout.includes("SettingsLanguageCleanup"), "Runtime Settings language cleanup hack should be removed.");
assert(dashboardLayout.includes("AuthenticatedLanguageBootstrap"), "Personal account language bootstrap is missing.");
assert(businessLayout.includes("AuthenticatedLanguageBootstrap"), "Business account language bootstrap is missing.");
assert(provider.includes("supabase.auth.updateUser"), "Account language persistence is missing.");
assert(provider.includes("MutationObserver"), "Instant full-page localization bridge is missing.");
assert(provider.includes("root.dir = option.direction"), "Runtime RTL document direction is missing.");
assert(runtimeTranslator.includes("FULL_UI_TRANSLATIONS[source]?.[language]"), "Full interface catalog is not wired into runtime translation.");
assert(!runtimeTranslator.includes("composedTranslation("), "Mixed-language composed translation fallback must not exist.");

const fullRows = findFullCatalogRows();
assert(fullRows.size >= 2400, `Full UI catalog is unexpectedly small (${fullRows.size}).`);
for (const [source, row] of fullRows) {
  for (const language of NON_ENGLISH) {
    assert(typeof row[language] === "string" && row[language].trim().length > 0, `Missing ${language} translation for: ${source}`);
  }
}

const covered = new Set([
  ...collectStringPropertyKeys("lib/i18n/phrases.ts"),
  ...collectStringPropertyKeys("lib/i18n/runtimeTranslator.ts"),
  ...fullRows.keys(),
]);
const uiStrings = collectStaticUiStrings();
const uncovered = [];
for (const [source, uses] of uiStrings) {
  if (!covered.has(source)) uncovered.push({ source, uses });
}

if (uncovered.length) {
  if (process.env.LOCALIZATION_DEBUG === "1") {
    console.log(JSON.stringify(uncovered, null, 2));
    process.exit(2);
  }
  const preview = uncovered.slice(0, 40).map(({ source, uses }) => {
    const use = uses[0];
    return `- ${JSON.stringify(source)} (${use.file}:${use.line}, ${use.kind}${use.context ? `:${use.context}` : ""})`;
  }).join("\n");
  throw new Error(`Localization coverage failed: ${uncovered.length} static interface strings are not translated.\n${preview}`);
}

console.log(`Localization verification passed.`);
console.log(`- Languages: ${LANGUAGES.join(", ")}`);
console.log(`- Full UI catalog entries: ${fullRows.size}`);
console.log(`- Static interface strings scanned: ${uiStrings.size}`);
console.log(`- Uncovered static interface strings: 0`);
console.log(`- Duplicate Settings language section: removed`);
console.log(`- Arabic RTL: configured`);
