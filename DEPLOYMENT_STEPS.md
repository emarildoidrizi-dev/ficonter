# FICONTER Support Conversation Deletion

## 1. Run the Supabase migration

Open:

`supabase/support_conversation_deletion.sql`

Paste the complete file into Supabase SQL Editor and run it once. The migration is idempotent.

It creates a database trigger that removes request-linked notifications in the same transaction when a support conversation is deleted. The existing foreign key automatically cascades deletion to all support messages.

## 2. Upload the code

Upload all files inside this `ficonter-main` folder to the matching GitHub paths.

Commit message:

`feat(support): add permanent conversation deletion`

## 3. Wait for Vercel

Wait until the newest production deployment shows `Ready`.

## 4. Test

Customer:
1. Open Inbox.
2. Select a conversation.
3. Select Delete.
4. Confirm that the in-platform warning appears above all dashboard content.
5. Confirm using the mouse and then test Enter on another disposable thread.
6. Confirm the thread disappears and unread counters update.

Administrator:
1. Open Admin → Support inbox.
2. Select a disposable conversation.
3. Select Delete.
4. Confirm it is removed from both admin and customer inboxes.
5. Confirm internal notes, replies and related notifications are removed.
6. Confirm the audit log records a `delete_support_conversation` event without message content.

The deletion is permanent and cannot be undone.
