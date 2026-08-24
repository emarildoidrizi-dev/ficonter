import "server-only";

import { createServiceClient } from "@/lib/supabase/admin";

export async function sendRecoveryConsentToCustomer(input: {
  recoveryRequestId: string;
  actorId: string;
}) {
  const service = createServiceClient() as any;

  const { data: request, error: requestError } = await service
    .from("vault_recovery_requests")
    .select("id,reference,user_id,status,archived_at")
    .eq("id", input.recoveryRequestId)
    .single();
  if (requestError) throw requestError;
  if (request.archived_at) throw new Error("Restore the case before sending consent.");
  if (request.status !== "consent_pending") throw new Error("Generate the consent document before sending it.");

  const { data: document, error: documentError } = await service
    .from("vault_recovery_documents")
    .select("id,document_id,customer_signed_at")
    .eq("recovery_request_id", input.recoveryRequestId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (documentError) throw documentError;
  if (!document) throw new Error("Generate the consent document first.");
  if (document.customer_signed_at) throw new Error("This consent document is already signed.");

  const sentAt = new Date().toISOString();
  const { error: updateError } = await service
    .from("vault_recovery_documents")
    .update({ sent_to_customer_at: sentAt, sent_to_customer_by: input.actorId, status: "sent" })
    .eq("id", document.id);
  if (updateError) throw updateError;

  await service.from("user_notifications").insert({
    user_id: request.user_id,
    kind: "system",
    title: "Vault recovery consent requires your signature",
    body: `Recovery request ${request.reference} is ready for review and electronic signature.`,
    href: `/dashboard/inbox/vault-recovery/${request.id}`,
    metadata: { recovery_request_id: request.id, document_id: document.document_id },
  });

  await service.from("vault_recovery_case_audit").insert({
    recovery_request_id: request.id,
    action: "consent_document_sent_to_customer",
    actor_id: input.actorId,
    details: { document_id: document.document_id, sent_at: sentAt, delivery: "ficonter_inbox" },
  });

  return { sentAt, documentId: document.document_id };
}

export async function listCustomerRecoveryConsents(userId: string) {
  const service = createServiceClient() as any;
  const { data: requests, error } = await service
    .from("vault_recovery_requests")
    .select("id,reference,customer_name,customer_email")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const requestIds = (requests ?? []).map((item: any) => item.id);
  if (!requestIds.length) return [];

  const { data: documents, error: documentsError } = await service
    .from("vault_recovery_documents")
    .select("document_id,recovery_request_id,sent_to_customer_at,customer_signed_at")
    .in("recovery_request_id", requestIds)
    .not("sent_to_customer_at", "is", null)
    .order("generated_at", { ascending: false });
  if (documentsError) throw documentsError;

  const requestById = new Map<string, any>((requests ?? []).map((item: any) => [item.id, item]));
  const seen = new Set<string>();
  const result: any[] = [];

  for (const document of documents ?? []) {
    if (seen.has(document.recovery_request_id)) continue;
    const request = requestById.get(document.recovery_request_id);
    if (!request) continue;
    seen.add(document.recovery_request_id);
    result.push({
      requestId: request.id,
      requestReference: request.reference,
      documentId: document.document_id,
      sentAt: document.sent_to_customer_at,
      signedAt: document.customer_signed_at ?? null,
    });
  }

  return result;
}
