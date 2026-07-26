# FICONTER Support Messaging, Notifications and Document Vault

## 1. Supabase migration

The original Help and Contact Us migration (`supabase/contact_support_center.sql`) must already be installed. It was deployed with the previous Support Center release.

Run only this new migration now:

`supabase/support_messaging_notifications_document_vault.sql`

Open Supabase → SQL Editor → New query, paste the complete file, and run it once. The migration is idempotent.

It creates or extends:
- Two-way support conversations
- Customer notifications
- Customer/admin unread tracking
- Private financial document metadata
- Temporary upload reservations
- Private `financial-documents` Storage bucket
- RLS and Storage isolation policies
- Realtime publication registration

## 2. GitHub

Upload every file and folder inside this `ficonter-main` directory to the matching location in the current GitHub `main` branch.

Recommended commit:

`feat(platform): add support messaging notifications and document vault`

## 3. Vercel

No new environment variables are required. Wait for the production deployment to show `Ready`.

## 4. Live acceptance

### Support messaging
1. Submit a new concern through Contact Us.
2. Confirm FICONTER opens the customer Inbox thread.
3. Reply from Admin → Support inbox.
4. Confirm the customer receives the reply and unread notification in realtime.
5. Reply as the customer and confirm the admin unread counter updates.
6. Confirm internal admin notes are never visible to the customer.
7. Test Open, In progress, Resolved, and customer reopening.

### Notifications
1. Confirm message and bell icons appear near the profile section.
2. Confirm unread badges are accurate.
3. Mark one notification read, then mark all read.
4. Confirm a notification opens the correct conversation or document page.

### Document Vault
1. Upload one valid PDF and one valid JPG/PNG/WEBP.
2. Preview and download each file.
3. Edit title, category, date, and notes.
4. Delete one file and confirm permanent removal.
5. Confirm files larger than 10 MB and unsupported or disguised files are rejected.
6. Confirm the development quota displays 100 MB per customer.
7. Confirm one customer cannot access another customer’s metadata or files.
8. Confirm administrators cannot view customer document contents.

### Interface
Test desktop, mobile, dark mode, Tab navigation, Enter submission, Escape dismissal, focus handling, and realtime refresh.
