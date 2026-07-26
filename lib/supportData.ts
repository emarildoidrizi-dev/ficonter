import "server-only";

import { createClient } from "@/lib/supabase/server";
import { supportReference, type SupportCategory, type SupportStatus } from "@/lib/support";
import type { SupportMessage, SupportThread } from "@/lib/supportMessaging";

type MessageRow = {
  id: string;
  request_id: string;
  sender_role: "customer" | "admin";
  body: string;
  internal_note: boolean;
  created_at: string;
};

type ThreadRow = {
  id: string;
  contact_email: string;
  category: SupportCategory;
  subject: string;
  status: SupportStatus;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  customer_last_read_at: string | null;
  admin_last_read_at: string | null;
  support_messages: MessageRow[] | null;
};

function mapMessage(row: MessageRow): SupportMessage {
  return {
    id: row.id,
    requestId: row.request_id,
    senderRole: row.sender_role,
    body: row.body,
    internalNote: row.internal_note,
    createdAt: row.created_at,
  };
}

export function mapSupportThread(row: ThreadRow): SupportThread {
  return {
    id: row.id,
    contactEmail: row.contact_email,
    category: row.category,
    subject: row.subject,
    status: row.status,
    reference: supportReference(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at,
    customerLastReadAt: row.customer_last_read_at,
    adminLastReadAt: row.admin_last_read_at,
    messages: (row.support_messages ?? [])
      .filter((message) => !message.internal_note)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(mapMessage),
  };
}

export async function loadCustomerSupportThreads(): Promise<SupportThread[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("support_requests")
    .select(
      "id,contact_email,category,subject,status,created_at,updated_at,last_message_at,customer_last_read_at,admin_last_read_at,support_messages(id,request_id,sender_role,body,internal_note,created_at)",
    )
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false });

  if (error) {
    console.error("Customer support threads load failed", {
      userId: user.id,
      code: error.code,
    });
    throw new Error("Your support inbox could not be loaded.");
  }

  return ((data ?? []) as unknown as ThreadRow[]).map(mapSupportThread);
}
