import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const baselinePath = path.join(
  root,
  "supabase/migrations/20260805000000_live_production_baseline.sql",
);
const manifestPath = path.join(
  root,
  "supabase/migrations/production-schema-manifest.json",
);
const typesPath = path.join(root, "lib/supabase/database.types.ts");
const contractTypesPath = path.join(root, "lib/supabase/database.contract.ts");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if ([".git", ".next", "node_modules"].includes(entry.name)) return [];
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function collectSourceContracts() {
  const roots = ["app", "components", "lib"]
    .map((name) => path.join(root, name))
    .filter((directory) => fs.existsSync(directory));
  const files = roots
    .flatMap(walk)
    .filter((file) => /\.(?:ts|tsx|js|jsx|mjs)$/.test(file));
  const rpc = new Map();
  const relations = new Map();

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/\.rpc\(\s*["']([^"']+)["']/g)) {
      const list = rpc.get(match[1]) ?? [];
      list.push(relative(file));
      rpc.set(match[1], list);
    }
    for (const match of source.matchAll(/\.from\(\s*["']([^"']+)["']/g)) {
      const list = relations.get(match[1]) ?? [];
      list.push(relative(file));
      relations.set(match[1], list);
    }
  }

  return { rpc, relations };
}

function parseMigrationContract() {
  const migrationDir = path.join(root, "supabase/migrations");
  const sql = walk(migrationDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");

  const functions = new Set();
  const relations = new Set();

  for (const match of sql.matchAll(
    /create\s+(?:or\s+replace\s+)?function\s+(?:"public"\.|public\.)?(?:"([^".]+)"|([a-zA-Z0-9_]+))\s*\(/gi,
  )) {
    functions.add(match[1] ?? match[2]);
  }

  for (const match of sql.matchAll(
    /create\s+(?:table|(?:or\s+replace\s+)?view|materialized\s+view)\s+(?:if\s+not\s+exists\s+)?(?:"public"\.|public\.)?(?:"([^".]+)"|([a-zA-Z0-9_]+))/gi,
  )) {
    relations.add(match[1] ?? match[2]);
  }

  return { functions, relations };
}

const requiredFiles = [baselinePath, manifestPath, typesPath, contractTypesPath];
for (const file of requiredFiles) {
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
    throw new Error(`Missing database contract file: ${relative(file)}`);
  }
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const baselineBytes = fs.readFileSync(baselinePath);
const baselineText = baselineBytes
  .toString("utf8")
  .replace(/^\uFEFF/, "")
  .replace(/\r\n?/g, "\n");
const baselineHash = crypto
  .createHash("sha256")
  .update(baselineText, "utf8")
  .digest("hex");

if (baselineHash !== manifest.baseline_sha256) {
  throw new Error(
    `The committed Production baseline content has changed. Expected ${manifest.baseline_sha256}, received ${baselineHash}.`,
  );
}

const forbidden = ["postgresql://", "SUPABASE_DB_URL=", "sb_secret_"];
for (const token of forbidden) {
  if (baselineText.includes(token)) {
    throw new Error(`The database baseline contains a forbidden secret token: ${token}`);
  }
}

const source = collectSourceContracts();
const migration = parseMigrationContract();
const storageBuckets = new Set(["business-assets", "profile-photos"]);

const missingFunctions = [...source.rpc.keys()].filter(
  (name) => !migration.functions.has(name),
);
const missingRelations = [...source.relations.keys()].filter(
  (name) => !storageBuckets.has(name) && !migration.relations.has(name),
);

if (missingFunctions.length) {
  throw new Error(
    `Source RPCs missing from ordered migrations: ${missingFunctions.join(", ")}`,
  );
}
if (missingRelations.length) {
  throw new Error(
    `Source relations missing from ordered migrations: ${missingRelations.join(", ")}`,
  );
}

const types = `${fs.readFileSync(typesPath, "utf8")}
${fs.readFileSync(contractTypesPath, "utf8")}`;
const missingTypeNames = [
  ...source.rpc.keys(),
  ...[...source.relations.keys()].filter((name) => !storageBuckets.has(name)),
].filter((name) => !new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`).test(types));

if (missingTypeNames.length) {
  throw new Error(
    `Generated database types are missing source dependencies: ${[
      ...new Set(missingTypeNames),
    ].join(", ")}`,
  );
}

if (manifest.counts.functions < 100 || manifest.counts.tables < 45) {
  throw new Error("The Production baseline inventory is unexpectedly incomplete.");
}

console.log(
  `Database contract verified: ${source.rpc.size} RPCs, ${
    source.relations.size - [...source.relations.keys()].filter((name) => storageBuckets.has(name)).length
  } relations, ${manifest.counts.functions} baseline functions, ${
    manifest.counts.tables
  } tables and ${manifest.counts.views} view.`,
);
