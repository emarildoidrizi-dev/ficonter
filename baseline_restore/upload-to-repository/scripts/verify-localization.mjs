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


function findCatalogRows(path, variableName) {
  const sf = sourceFile(path);
  const rows = new Map();
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(sf) === variableName &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const property of node.initializer.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const source = stringValue(property.name);
        if (!source) continue;

        const values = {};
        if (ts.isCallExpression(property.initializer)) {
          const args = property.initializer.arguments.map(stringValue);
          if (args.length === 7 && args.every((value) => value !== null)) {
            [values.de, values.es, values.sq, values.ar, values.pt, values.it, values.ru] = args;
          }
        } else if (ts.isObjectLiteralExpression(property.initializer)) {
          for (const entry of property.initializer.properties) {
            if (!ts.isPropertyAssignment(entry)) continue;
            const language = entry.name.getText(sf).replace(/["']/g, "");
            const value = stringValue(entry.initializer);
            if (value !== null) values[language] = value;
          }
        }

        rows.set(normalizeUiText(source), values);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return rows;
}

function humanRuntimeString(value) {
  const text = normalizeUiText(value);
  if (!hasHumanText(text)) return false;
  if (
    text.startsWith("@/") ||
    text.startsWith("./") ||
    text.startsWith("../") ||
    text.startsWith("/dashboard")
  ) return false;
  if (/^[a-z0-9_:@./?-]+$/i.test(text) && !text.includes(" ")) return false;
  if (/[{}<>]|=>|\$\{|\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|FROM|WHERE|JOIN)\b/i.test(text)) return false;
  return true;
}

function collectWealthRuntimeStrings() {
  const directory = join(ROOT, "lib/wealth");
  const results = new Map();

  for (const fullPath of walkSourceFiles(directory)) {
    const file = relative(ROOT, fullPath).replaceAll("\\", "/");
    const text = readFileSync(fullPath, "utf8");
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

    function visit(node) {
      if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        const source = normalizeUiText(node.text);
        if (humanRuntimeString(source)) {
          // Property names, imports, routes and internal ids are implementation data.
          if (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent)) return;
          if (ts.isPropertyAssignment(node.parent) && node.parent.name === node) return;
          if (ts.isElementAccessExpression(node.parent) && node.parent.argumentExpression === node) return;

          if (!results.has(source)) results.set(source, []);
          const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
          results.get(source).push({ file, line });
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sf);
  }

  return results;
}

const RUNTIME_UI_PROPERTY_NAMES = new Set([
  "label",
  "description",
  "title",
  "name",
  "text",
  "eyebrow",
  "message",
  "reason",
  "detail",
  "action",
  "summary",
  "headline",
  "subtitle",
  "body",
  "helper",
  "hint",
  "statusText",
  "emptyText",
]);

function templateSkeleton(node) {
  let value = node.head.text;
  node.templateSpans.forEach((span, index) => {
    value += `{${index}}${span.literal.text}`;
  });
  return normalizeUiText(value);
}

function templateIsUiFacing(node, sf, file) {
  if (file.startsWith("lib/wealth/")) return true;

  let current = node.parent;
  for (let depth = 0; current && depth < 8; depth += 1, current = current.parent) {
    if (ts.isJsxExpression(current)) {
      const parent = current.parent;
      if (ts.isJsxAttribute(parent)) {
        const attribute = parent.name.getText(sf);
        if (["className", "style", "key", "id", "href", "src"].includes(attribute) || attribute.startsWith("data-")) return false;
      }
      return true;
    }
    if (ts.isJsxAttribute(current)) {
      const attribute = current.name.getText(sf);
      if (UI_ATTRIBUTE_NAMES.has(attribute)) return true;
    }
    if (ts.isPropertyAssignment(current)) {
      const name = current.name.getText(sf).replace(/["']/g, "");
      if (RUNTIME_UI_PROPERTY_NAMES.has(name)) return true;
    }
    if (ts.isCallExpression(current) && UI_CALL_NAMES.has(expressionName(current.expression))) return true;
  }

  return false;
}

function runtimeTemplateIsImplementationId(source) {
  if (/^[a-z0-9-]+-\{\d+\}(?:-\{\d+\})?$/.test(source)) return true;
  if (source.includes("ficonter-scroll-region")) return true;
  if (source.includes("conic-gradient") || source.includes("rgb(")) return true;
  if (source.includes("#quick-add")) return true;
  if (source.startsWith("/")) return true;
  if (/^\{\d+\}(?:-\d+)?T\d{2}:\d{2}:\d{2}$/.test(source)) return true;
  if (/^\{\d+\} L \d+/.test(source)) return true;
  return false;
}


function humanRuntimeTemplateString(value) {
  const text = normalizeUiText(value);
  if (!hasHumanText(text)) return false;
  const withoutPlaceholders = text.replace(/\{\d+\}/g, "");
  if (/[<>]|=>|\$\{|\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|FROM|WHERE|JOIN)\b/i.test(withoutPlaceholders)) return false;
  return true;
}

function collectRuntimeUiTemplates() {
  const sources = [
    ...walkSourceFiles(join(ROOT, "app")),
    ...walkSourceFiles(join(ROOT, "components")),
    ...walkSourceFiles(join(ROOT, "lib/wealth")),
  ];
  const results = new Map();

  for (const fullPath of sources) {
    const file = relative(ROOT, fullPath).replaceAll("\\", "/");
    if (file === "app/layout.tsx") continue;
    const text = readFileSync(fullPath, "utf8");
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

    function visit(node) {
      if (ts.isTemplateExpression(node) && templateIsUiFacing(node, sf, file)) {
        const source = templateSkeleton(node);
        if (humanRuntimeTemplateString(source) && !runtimeTemplateIsImplementationId(source)) {
          if (!results.has(source)) results.set(source, []);
          const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
          results.get(source).push({ file, line });
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sf);
  }

  return results;
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
const wealthRows = findCatalogRows(
  "lib/i18n/wealthUiCatalog.ts",
  "WEALTH_UI_TRANSLATIONS",
);
const wealthTemplateRows = findCatalogRows(
  "lib/i18n/wealthRuntimeTemplates.ts",
  "WEALTH_RUNTIME_TEMPLATES",
);
const globalTemplateRows = findCatalogRows(
  "lib/i18n/globalRuntimeTemplates.ts",
  "GLOBAL_RUNTIME_TEMPLATES",
);

assert(fullRows.size >= 2400, `Full UI catalog is unexpectedly small (${fullRows.size}).`);
assert(wealthRows.size >= 188, `Wealth runtime catalog is unexpectedly small (${wealthRows.size}).`);
assert(wealthTemplateRows.size >= 60, `Wealth runtime template catalog is unexpectedly small (${wealthTemplateRows.size}).`);
assert(globalTemplateRows.size >= 75, `Global runtime template catalog is unexpectedly small (${globalTemplateRows.size}).`);
assert(runtimeTranslator.includes("WEALTH_UI_TRANSLATIONS[source]?.[language]"), "Wealth runtime catalog is not wired into runtime translation.");
assert(runtimeTranslator.includes("translateWealthTemplate"), "Wealth runtime templates are not wired into runtime translation.");
assert(runtimeTranslator.includes("translateGlobalTemplate"), "Global runtime templates are not wired into runtime translation.");

for (const catalog of [fullRows, wealthRows, wealthTemplateRows, globalTemplateRows]) {
  for (const [source, row] of catalog) {
    for (const language of NON_ENGLISH) {
      assert(
        typeof row[language] === "string" && row[language].trim().length > 0,
        `Missing ${language} translation for: ${source}`,
      );
    }
  }
}

const covered = new Set([
  ...collectStringPropertyKeys("lib/i18n/phrases.ts"),
  ...collectStringPropertyKeys("lib/i18n/runtimeTranslator.ts"),
  ...fullRows.keys(),
  ...wealthRows.keys(),
]);

function failCoverage(kind, uncovered) {
  if (!uncovered.length) return;
  if (process.env.LOCALIZATION_DEBUG === "1") {
    console.log(JSON.stringify({ kind, uncovered }, null, 2));
    process.exit(2);
  }
  const preview = uncovered.slice(0, 50).map(({ source, uses }) => {
    const use = uses[0];
    return `- ${JSON.stringify(source)} (${use.file}:${use.line})`;
  }).join("\n");
  throw new Error(`${kind} localization coverage failed: ${uncovered.length} interface strings/templates are not translated.\n${preview}`);
}

const uiStrings = collectStaticUiStrings();
const uncoveredStatic = [];
for (const [source, uses] of uiStrings) {
  if (!covered.has(source)) uncoveredStatic.push({ source, uses });
}
failCoverage("Static UI", uncoveredStatic);

// V33 closes the gap that V32 missed: human-readable strings emitted by the
// Wealth Engine business logic rather than written directly in JSX.
const wealthRuntimeStrings = collectWealthRuntimeStrings();
const uncoveredWealthRuntime = [];
for (const [source, uses] of wealthRuntimeStrings) {
  if (!covered.has(source)) uncoveredWealthRuntime.push({ source, uses });
}
failCoverage("Wealth Engine runtime", uncoveredWealthRuntime);

const runtimeTemplateCoverage = new Set([
  ...wealthTemplateRows.keys(),
  ...globalTemplateRows.keys(),
]);
const runtimeUiTemplates = collectRuntimeUiTemplates();
const uncoveredTemplates = [];
for (const [source, uses] of runtimeUiTemplates) {
  if (!runtimeTemplateCoverage.has(source)) uncoveredTemplates.push({ source, uses });
}
failCoverage("Dynamic UI template", uncoveredTemplates);

console.log(`Localization verification passed.`);
console.log(`- Languages: ${LANGUAGES.join(", ")}`);
console.log(`- Full static UI catalog entries: ${fullRows.size}`);
console.log(`- Wealth runtime catalog entries: ${wealthRows.size}`);
console.log(`- Runtime template entries: ${runtimeTemplateCoverage.size}`);
console.log(`- Static interface strings scanned: ${uiStrings.size}`);
console.log(`- Wealth Engine runtime strings scanned: ${wealthRuntimeStrings.size}`);
console.log(`- Dynamic interface templates scanned: ${runtimeUiTemplates.size}`);
console.log(`- Uncovered static interface strings: 0`);
console.log(`- Uncovered Wealth Engine runtime strings: 0`);
console.log(`- Uncovered dynamic interface templates: 0`);
console.log(`- Duplicate Settings language section: removed`);
console.log(`- Arabic RTL: configured`);
