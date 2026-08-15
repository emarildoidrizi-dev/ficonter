import "server-only";

import { createServiceClient } from "@/lib/supabase/admin";
import { supportReference, type SupportCategory, type SupportStatus } from "@/lib/support";
import type { SupportMessage } from "@/lib/supportMessaging";

export type AdminSupportRequest = {
  id: string;
  userId: string;
  contactEmail: string;
  category: SupportCategory;
  subject: string;
  message: string;
  status: SupportStatus;
  handledBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  customerLastReadAt: string | null;
  adminLastReadAt: string | null;
  reference: string;
  messages: SupportMessage[];
  unreadCustomerMessages: number;
};

type MessageRow = {
  id: string;
  request_id: string;
  sender_role: "customer" | "admin";
  body: string;
  internal_note: boolean;
  created_at: string;
};

type SupportRow = {
  id: string;
  user_id: string;
  contact_email: string;
  category: SupportCategory;
  subject: string;
  message: string;
  status: SupportStatus;
  handled_by: string | null;
  resolved_at: string | null;
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

function mapSupportRow(row: SupportRow): AdminSupportRequest {
  const messages = (row.support_messages ?? [])
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(mapMessage);
  const adminReadAt = row.admin_last_read_at
    ? new Date(row.admin_last_read_at).getTime()
    : 0;

  return {
    id: row.id,
    userId: row.user_id,
    contactEmail: row.contact_email,
    category: row.category,
    subject: row.subject,
    message: row.message,
    status: row.status,
    handledBy: row.handled_by,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at,
    customerLastReadAt: row.customer_last_read_at,
    adminLastReadAt: row.admin_last_read_at,
    reference: supportReference(row.id),
    messages,
    unreadCustomerMessages: messages.filter(
      (message) =>
        message.senderRole === "customer" &&
        new Date(message.createdAt).getTime() > adminReadAt,
    ).length,
  };
}

const SELECT =
  "id,user_id,contact_email,category,subject,message,status,handled_by,resolved_at,created_at,updated_at,last_message_at,customer_last_read_at,admin_last_read_at,support_messages(id,request_id,sender_role,body,internal_note,created_at)";

export async function loadSupportRequests(limit = 200): Promise<AdminSupportRequest[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("support_requests")
    .select(SELECT)
    .order("last_message_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 500)));

  if (error) {
    console.error("Support inbox load failed", { code: error.code });
    throw new Error("The support inbox could not be loaded.");
  }

  return ((data ?? []) as unknown as SupportRow[]).map(mapSupportRow);
}

export async function loadSupportRequest(requestId: string): Promise<AdminSupportRequest | null> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("support_requests")
    .select(SELECT)
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    console.error("Support request load failed", { requestId, code: error.code });
    throw new Error("The support request could not be loaded.");
  }

  return data ? mapSupportRow(data as unknown as SupportRow) : null;
}

export async function updateSupportRequestStatus({
  requestId,
  status,
  adminUserId,
}: {
  requestId: string;
  status: SupportStatus;
  adminUserId: string;
}): Promise<AdminSupportRequest | null> {
  const service = createServiceClient();
  const { error } = await service
    .from("support_requests")
    .update({ status, handled_by: adminUserId })
    .eq("id", requestId);

  if (error) {
    console.error("Support request status update failed", { requestId, code: error.code });
    throw new Error("The support request could not be updated.");
  }

  return loadSupportRequest(requestId);
}
