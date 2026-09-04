import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function check(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

const access = read("lib/admin/access.ts");
const adminMutation = read("app/api/admin/users/[id]/route.ts");
const ownerRestoreRoute = read("app/api/owner/backup/authorize-restore/route.ts");
const browserClient = read("lib/supabase/client.ts");
const migration = read("supabase/migrations/20260904213000_role_boundary_hardening.sql");

check(
  access.includes("isOwnerEmail") && access.includes("requireAdmin"),
  "Central Owner/Admin authorization helpers remain present.",
);
check(
  adminMutation.includes("targetIsOwner") &&
    adminMutation.includes("Only the Owner can assign or remove Super Admin authority") &&
    adminMutation.includes("id === auth.user.id"),
  "Admin mutation route protects Owner, Super Admin authority and self-mutation.",
);
check(
  ownerRestoreRoute.includes("isSameOriginRequest") &&
    ownerRestoreRoute.includes("isOwnerEmail(user.email)") &&
    ownerRestoreRoute.includes("owner_backup_restore_authorizations"),
  "Backup restore authorization requires same-origin authenticated Owner authority.",
);
check(
  migration.includes("revoke all on function public.restore_portable_backup_v2(jsonb) from public, anon, authenticated") &&
    migration.includes("restore_portable_backup_v2_owner") &&
    migration.includes("expires_at > now()"),
  "Direct backup restore is revoked and guarded by a short-lived one-time authorization.",
);
check(
  browserClient.includes("/api/owner/backup/authorize-restore") &&
    browserClient.includes("restore_portable_backup_v2_owner"),
  "Browser restore path obtains trusted Owner authorization before guarded RPC execution.",
);
check(
  migration.includes("alter policy") && migration.includes("to authenticated"),
  "Private customer-data policies are narrowed from public to authenticated sessions.",
);

if (process.exitCode) {
  console.error("FICONTER role-boundary verification failed.");
} else {
  console.log("FICONTER role-boundary verification passed.");
}
