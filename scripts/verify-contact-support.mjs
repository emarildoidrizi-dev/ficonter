import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(resolve(root, file), "utf8");

const checks = [
  ["components/Sidebar.tsx", "<span>Contact Us</span>"],
  ["components/Sidebar.tsx", 'openRoute("/dashboard/help")'],
  ["components/Sidebar.tsx", '"/dashboard/admin/support"'],
  ["components/ContactSupportModal.tsx", 'role="dialog"'],
  ["components/ContactSupportModal.tsx", 'aria-modal="true"'],
  ["components/ContactSupportModal.tsx", 'data-enter-confirm="true"'],
  ["components/ContactSupportModal.tsx", 'fetch("/api/support/requests"'],
  ["components/ContactSupportModal.tsx", "Never include passwords"],
  ["app/api/support/requests/route.ts", "isSameOriginRequest"],
  ["app/api/support/requests/route.ts", "MAX_REQUESTS_PER_HOUR"],
  ["app/api/support/requests/route.ts", '.from("support_requests")'],
  ["app/api/admin/support/route.ts", "requireAdmin"],
  ["app/api/admin/support/[id]/route.ts", "isSupportStatus"],
  ["app/api/admin/support/[id]/route.ts", "isSameOriginRequest"],
  ["app/dashboard/help/page.tsx", "HelpCenter"],
  ["app/dashboard/admin/support/page.tsx", "loadSupportRequests"],
  ["components/SupportInbox.tsx", "Reply by email"],
  ["components/SupportInbox.tsx", "Mark in progress"],
  ["components/SupportInbox.tsx", "Resolve"],
  ["supabase/contact_support_center.sql", "enable row level security"],
  ["supabase/contact_support_center.sql", "auth.uid() = user_id"],
  ["supabase/contact_support_center.sql", "revoke update, delete"],
  ["supabase/contact_support_center.sql", "handled_by"],
];

let passed = 0;
for (const [file, needle] of checks) {
  const source = read(file);
  if (!source.includes(needle)) {
    console.error(`FAIL ${file}: missing ${needle}`);
    process.exitCode = 1;
  } else {
    passed += 1;
  }
}

if (!process.exitCode) {
  console.log(`Contact support verification passed (${passed}/${checks.length}).`);
}
