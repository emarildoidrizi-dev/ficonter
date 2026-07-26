import "server-only";

import { createServiceClient } from "@/lib/supabase/admin";
import type { SupportCategory, SupportStatus } from "@/lib/support";

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
};

function mapSupportRow(row: SupportRow): AdminSupportRequest {
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
  };
}

export async function loadSupportRequests(
  limit = 200,
): Promise<AdminSupportRequest[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("support_requests")
    .select(
      "id,user_id,contact_email,category,subject,message,status,handled_by,resolved_at,created_at,updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 500)));

  if (error) {
    console.error("Support inbox load failed", { code: error.code });
    throw new Error("The support inbox could not be loaded.");
  }

  return ((data ?? []) as SupportRow[]).map(mapSupportRow);
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
  const { data, error } = await service
    .from("support_requests")
    .update({ status, handled_by: adminUserId })
    .eq("id", requestId)
    .select(
      "id,user_id,contact_email,category,subject,message,status,handled_by,resolved_at,created_at,updated_at",
    )
    .maybeSingle();

  if (error) {
    console.error("Support request status update failed", {
      requestId,
      code: error.code,
    });
    throw new Error("The support request could not be updated.");
  }

  return data ? mapSupportRow(data as SupportRow) : null;
}
