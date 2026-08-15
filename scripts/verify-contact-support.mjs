import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];
let passed = 0;

function read(file) {
  const path = resolve(root, file);
  if (!existsSync(path)) {
    failures.push(`Missing ${file}`);
    return "";
  }
  return readFileSync(path, "utf8");
}

function check(label, condition) {
  if (condition) passed += 1;
  else failures.push(label);
}

const sidebar = read("components/Sidebar.tsx");
const mobileChrome = read("components/FiconterNativeAppChrome.tsx");
const modal = read("components/ContactSupportModal.tsx");
const modalCss = read("components/ContactSupportModal.module.css");
const supportRoute = read("app/api/support/requests/route.ts");
const adminRoute = read("app/api/admin/support/[id]/route.ts");
const adminMessages = read("app/api/admin/support/[id]/messages/route.ts");
const inbox = read("components/SupportInbox.tsx");
const sql = read("supabase/contact_support_center.sql");

check("Profile menu stays limited to account controls", !sidebar.includes("<span>Help</span>") && !sidebar.includes("<span>Contact Us</span>"));
check("Mobile More menu exposes in-app Messages", mobileChrome.includes('href: "/dashboard/inbox"') && mobileChrome.includes('label: "Messages"'));
check("Sidebar keeps the private contact modal bridge", sidebar.includes("ContactSupportModal") && sidebar.includes("OPEN_CONTACT_EVENT"));
check("Contact modal uses a document portal", modal.includes('createPortal(modal, document.body)'));
check("Contact modal is accessible", modal.includes('aria-modal="true"') && modal.includes('role="dialog"'));
check("Contact modal supports Enter confirmation", modal.includes('data-enter-confirm="true"'));
check("Contact modal creates support requests", modal.includes('fetch("/api/support/requests"'));
check("Contact modal opens the in-app inbox", modal.includes("Open inbox") && modal.includes("/dashboard/inbox?thread="));
check("Contact modal warns against secrets", modal.includes("Never include passwords"));
check("Modal overlay stays above dashboard content", modalCss.includes("z-index: 2147483000"));
check("Support request route enforces same origin", supportRoute.includes("isSameOriginRequest"));
check("Support request route rate limits creation", supportRoute.includes("MAX_REQUESTS_PER_HOUR"));
check("Support request creates the initial conversation message", supportRoute.includes('.from("support_messages")'));
check("Admin status changes require admin access", adminRoute.includes("requireAdmin") && adminRoute.includes("isSupportStatus"));
check("Admin can reply in-app", adminMessages.includes('.from("support_messages")') && adminMessages.includes("support_reply"));
check("Support Inbox contains a reply composer", inbox.includes("Send reply") && inbox.includes("Write a reply to the customer"));
check("Support Inbox has no mailto dependency", !inbox.includes("mailto:"));
check("Base support table remains RLS protected", sql.includes("enable row level security") && sql.includes("auth.uid() = user_id"));

if (failures.length) {
  console.error(`Contact support verification failed (${failures.length} issues):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Contact support verification passed (${passed} checks).`);
