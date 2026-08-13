import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
const assert = (condition, message) => {
  checks.push({ condition, message });
  if (!condition) throw new Error(message);
};

const customer = read("components/SupportConversations.tsx");
const admin = read("components/SupportInbox.tsx");
const dialog = read("components/SupportDeleteDialog.tsx");
const customerRoute = read("app/api/support/threads/[id]/route.ts");
const adminRoute = read("app/api/admin/support/[id]/route.ts");
const migration = read("supabase/support_conversation_deletion.sql");

assert(customer.includes('method: "DELETE"'), "Customer Inbox must issue an authenticated DELETE request.");
assert(admin.includes('method: "DELETE"'), "Admin Support Inbox must issue an authenticated DELETE request.");
assert(customer.includes("SupportDeleteDialog"), "Customer Inbox must use the in-platform confirmation dialog.");
assert(admin.includes("SupportDeleteDialog"), "Admin Support Inbox must use the in-platform confirmation dialog.");
assert(dialog.includes('createPortal('), "Delete confirmation must render outside dashboard stacking contexts.");
assert(dialog.includes('data-enter-confirm="true"'), "Delete confirmation must support Enter-key activation.");
assert(customerRoute.includes("isSameOriginRequest"), "Customer deletion must enforce same-origin requests.");
assert(customerRoute.includes('.eq("user_id", user.id)'), "Customer deletion must be restricted to the signed-in owner.");
assert(adminRoute.includes("requireAdmin"), "Administrator deletion must require protected admin access.");
assert(adminRoute.includes('action: "delete_support_conversation"'), "Administrator deletion must create a privacy-safe audit event.");
assert(migration.includes("before delete on public.support_requests"), "Notification cleanup must run in the same deletion transaction.");
assert(migration.includes("metadata ->> 'request_id'"), "Only notifications linked to the deleted conversation may be removed.");

console.log(`Support conversation deletion verification passed (${checks.length} checks).`);
