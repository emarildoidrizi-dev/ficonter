import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
let passed = 0;

function read(relative) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    failures.push(`Missing ${relative}`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function check(name, condition) {
  if (condition) passed += 1;
  else failures.push(name);
}

const required = [
  "app/dashboard/inbox/page.tsx",
  "app/dashboard/documents/page.tsx",
  "app/api/support/threads/route.ts",
  "app/api/support/threads/[id]/messages/route.ts",
  "app/api/admin/support/[id]/messages/route.ts",
  "app/api/notifications/route.ts",
  "app/api/documents/upload-intent/route.ts",
  "app/api/documents/complete/route.ts",
  "app/api/documents/[id]/access/route.ts",
  "components/SupportConversations.tsx",
  "components/NotificationCenter.tsx",
  "components/DocumentVault.tsx",
  "lib/e2ee/documentVaultE2eeBoundary.ts",
  "supabase/support_messaging_notifications_document_vault.sql",
  "supabase/migrations/20260822175907_add_document_vault_e2ee_foundation.sql",
];
for (const file of required) check(`Required file exists: ${file}`, fs.existsSync(path.join(root, file)));

const sidebar = read("components/Sidebar.tsx");
const customerInbox = read("components/SupportConversations.tsx");
const adminInbox = read("components/SupportInbox.tsx");
const notifications = read("components/NotificationCenter.tsx");
const documentVault = read("components/DocumentVault.tsx");
const documentBoundary = read("lib/e2ee/documentVaultE2eeBoundary.ts");
const uploadIntent = read("app/api/documents/upload-intent/route.ts");
const completeUpload = read("app/api/documents/complete/route.ts");
const documentAccess = read("app/api/documents/[id]/access/route.ts");
const documentDelete = read("app/api/documents/[id]/route.ts");
const customerReply = read("app/api/support/threads/[id]/messages/route.ts");
const adminReply = read("app/api/admin/support/[id]/messages/route.ts");
const notificationRoute = read("app/api/notifications/route.ts");
const sql = read("supabase/support_messaging_notifications_document_vault.sql");
const e2eeDocumentSql = read("supabase/migrations/20260822175907_add_document_vault_e2ee_foundation.sql");
const accountDelete = read("app/api/account/delete/route.ts");
const adminDelete = read("app/api/admin/users/[id]/route.ts");
const settings = read("components/SettingsWorkspace.tsx");

check("Customer Inbox route remains available without a duplicate main-sidebar link", sidebar.includes("/dashboard/inbox") && !sidebar.includes('["/dashboard/inbox", InboxIcon, "Inbox"]'));
check("Sidebar exposes Document Vault", sidebar.includes('["/dashboard/documents", FileArchive, "Documents"]'));
check("Sidebar renders message and notification icons", sidebar.includes("NotificationCenter"));
check("Customer Inbox supports realtime updates", customerInbox.includes("postgres_changes") && customerInbox.includes("support_messages"));
check("Customer Inbox sends replies in-app", customerInbox.includes("Send message") && customerReply.includes('sender_role: "customer"'));
check("Customer reply rate limits cannot be bypassed by direct inserts", customerReply.includes("createServiceClient") && sql.includes("revoke insert, update, delete on public.support_messages from authenticated") && sql.includes("revoke insert on public.support_requests from authenticated"));
check("Resolved conversations reopen on customer reply", sql.includes("new.sender_role = 'customer' and status = 'resolved'"));
check("Admin Inbox sends direct platform replies", adminInbox.includes("Send reply") && adminReply.includes('sender_role: "admin"'));
check("Admin internal notes stay hidden", adminInbox.includes("Internal note") && adminReply.includes("internalNote"));
check("Admin reply creates customer notification", adminReply.includes('kind: "support_reply"'));
check("Notification center has unread counters", notifications.includes("unreadCount") && notifications.includes("adminSupportUnread"));
check("Notifications can be marked read", notificationRoute.includes("export async function PATCH") && notifications.includes("Mark all read"));
check("Notifications are realtime for customers", notifications.includes("user_notifications") && notifications.includes("postgres_changes"));
check("Document Vault accepts controlled formats", documentVault.includes("application/pdf,image/jpeg,image/png,image/webp"));
check("Document Vault validates plaintext signatures before encryption", documentVault.includes("hasValidDocumentSignature") && documentVault.includes("file.slice(0, 16)"));
check("Document Vault encrypts document bytes before storage upload", documentBoundary.includes("encryptDocumentFile") && documentBoundary.includes('contentType: "application/octet-stream"'));
check("Document upload completion validates the encrypted envelope", completeUpload.includes('new TextEncoder().encode("FICONTER-DOC-V1\\0")') && completeUpload.includes("hasEncryptedDocumentMagic"));
check("Document upload bypasses Vercel request payload limits", documentVault.includes("uploadToSignedUrl") && uploadIntent.includes("createSignedUploadUrl"));
check("Document upload reservations enforce atomic E2EE quota and pending limits", uploadIntent.includes('rpc("reserve_document_upload_e2ee"') && e2eeDocumentSql.includes("pg_advisory_xact_lock") && e2eeDocumentSql.includes("too_many_pending_document_uploads") && e2eeDocumentSql.includes("document_vault_quota_exceeded"));
check("Expired upload objects are cleaned before new reservations", uploadIntent.includes("removeExpiredUploadIntents") && uploadIntent.includes("storage.from(DOCUMENT_BUCKET).remove(paths)"));
check("Document upload completion re-verifies stored ciphertext length", completeUpload.includes(".download(intent.storage_path)") && completeUpload.includes("bytes.byteLength"));
check("Document files are accessed with short-lived signed URLs", documentAccess.includes("createSignedUrl") && documentAccess.includes(", 300"));
check("Document deletion checks ownership", documentDelete.includes('.eq("user_id", user.id)'));
check("Document bucket is private", sql.includes("'financial-documents'") && sql.includes("public = false"));
check("Document tables use RLS", sql.includes("alter table public.financial_documents enable row level security"));
check("Document object policies isolate the user folder", sql.includes("storage.foldername(name)") && sql.includes("auth.uid()::text"));
check("Document object uploads require an active reserved intent", sql.includes("has_active_document_upload_intent") && sql.includes("and public.has_active_document_upload_intent(name)"));
check("Document metadata mutations cannot bypass protected API routes", sql.includes("revoke insert, update, delete on public.financial_documents from authenticated") && sql.includes("grant select on public.financial_documents to authenticated"));
check("Document reads and deletes require server-issued access", sql.includes('drop policy if exists "Users read their own financial document files"') && !sql.includes('create policy "Users read their own financial document files"'));
check("Admins receive no document-content route", !adminInbox.includes("financial_documents") && !adminInbox.includes("financial-documents"));
check("Account deletion removes private document files", accountDelete.includes('"financial-documents"'));
check("Admin deletion removes private document files", adminDelete.includes('"financial-documents"'));
check("Account JSON export includes document metadata", settings.includes('"financial_documents"'));
check("Account JSON export includes support messages", settings.includes('"support_messages"'));
check("Support and notification tables use RLS", sql.includes("alter table public.support_messages enable row level security") && sql.includes("alter table public.user_notifications enable row level security"));
check("Realtime publication includes messaging and notifications", sql.includes("public.support_messages") && sql.includes("public.user_notifications"));
check("All mutation routes enforce same-origin requests", [customerReply, adminReply, uploadIntent, completeUpload, documentDelete].every((source) => source.includes("isSameOriginRequest")));

if (failures.length) {
  console.error(`Support messaging and Document Vault verification failed (${failures.length} issues):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Support messaging and Document Vault verification passed (${passed} checks).`);
