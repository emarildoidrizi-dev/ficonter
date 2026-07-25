import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const passes = [];

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function assertCheck(condition, message) {
  if (condition) passes.push(message);
  else failures.push(message);
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else files.push(absolute);
  }
  return files;
}

const accountDelete = await source("app/api/account/delete/route.ts");
const adminUsers = await source("app/api/admin/users/route.ts");
const adminUserMutation = await source("app/api/admin/users/[id]/route.ts");
const adminHealth = await source("app/api/admin/health/route.ts");
const exchangeRate = await source("app/api/exchange-rate/route.ts");
const serviceClient = await source("lib/supabase/admin.ts");
const adminAccess = await source("lib/admin/access.ts");

assertCheck(
  accountDelete.includes("isSameOriginRequest") &&
    accountDelete.includes("auth.getUser") &&
    accountDelete.includes("isProtectedSuperAdminAccount"),
  "Account deletion requires same-origin, authentication, and super-admin protection.",
);
assertCheck(
  adminUsers.includes("requireAdmin"),
  "Admin directory endpoint requires an authenticated administrator.",
);
assertCheck(
  adminUserMutation.includes("isSameOriginRequest") &&
    adminUserMutation.includes("requireAdmin") &&
    adminUserMutation.includes("UUID_PATTERN"),
  "Admin mutation endpoint enforces origin, role, and identifier validation.",
);
assertCheck(
  adminHealth.includes("requireAdmin") && adminHealth.includes("loadPlatformHealth"),
  "Platform health details are restricted to administrators.",
);
assertCheck(
  exchangeRate.includes("auth.getUser") &&
    exchangeRate.includes("SUPPORTED_CODES") &&
    exchangeRate.includes("AbortSignal.timeout"),
  "Exchange-rate endpoint requires authentication, validates input, and times out upstream calls.",
);
assertCheck(
  serviceClient.includes('import "server-only"') &&
    serviceClient.includes("SUPABASE_SERVICE_ROLE_KEY") &&
    !serviceClient.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"),
  "Privileged Supabase client is server-only and does not use a public key name.",
);
assertCheck(
  adminAccess.includes("createServiceClient") &&
    !adminAccess.includes("@supabase/supabase-js"),
  "Admin role verification uses the centralized privileged client.",
);

const clientCandidates = [
  ...(await walk(path.join(root, "components"))),
  ...(await walk(path.join(root, "app"))),
];

for (const absolute of clientCandidates) {
  if (!/\.(ts|tsx|js|jsx)$/.test(absolute)) continue;
  const contents = await readFile(absolute, "utf8");
  if (!contents.trimStart().startsWith('"use client"')) continue;

  const relative = path.relative(root, absolute);
  assertCheck(
    !contents.includes("SUPABASE_SERVICE_ROLE_KEY") &&
      !contents.includes("SUPABASE_SECRET_KEY") &&
      !contents.includes("@/lib/supabase/admin"),
    `${relative} does not reference privileged Supabase credentials.`,
  );
}

console.log(`Phase 1 security verification: ${passes.length} checks passed.`);
for (const message of passes) console.log(`  PASS  ${message}`);

if (failures.length) {
  console.error(`\n${failures.length} security check(s) failed:`);
  for (const message of failures) console.error(`  FAIL  ${message}`);
  process.exit(1);
}
