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

export async function getCustomerRecoveryConsent(input: {
  recoveryRequestId: string;
  userId: string;
}) {
  const service = createServiceClient() as any;

  const { data: request, error: requestError } = await service
    .from("vault_recovery_requests")
    .select("id,reference,user_id,customer_email,customer_name,customer_birth_date,country_region,customer_city,customer_address_line1,customer_address_line2,customer_postal_code,created_at,status,archived_at")
    .eq("id", input.recoveryRequestId)
    .eq("user_id", input.userId)
    .single();
  if (requestError) throw new Error("Recovery request not found.");
  if (request.archived_at) throw new Error("This recovery request is no longer active.");

  const { data: document, error: documentError } = await service
    .from("vault_recovery_documents")
    .select("id,document_id,generated_at,sent_to_customer_at,customer_signed_at,customer_signature,customer_signature_method")
    .eq("recovery_request_id", input.recoveryRequestId)
    .not("sent_to_customer_at", "is", null)
    .order("generated_at", { ascending: false })
    .limit(1)
    .single();
  if (documentError) throw new Error("No consent document has been sent to this account.");

  return { request, document };
}

export async function submitCustomerRecoveryConsent(input: {
  recoveryRequestId: string;
  userId: string;
  signature: string;
}) {
  const signature = input.signature.trim();
  if (signature.length < 2 || signature.length > 500) {
    throw new Error("Add your electronic signature before submitting the document.");
  }

  const service = createServiceClient() as any;
  const { data: request, error: requestError } = await service
    .from("vault_recovery_requests")
    .select("id,reference,user_id,status,archived_at")
    .eq("id", input.recoveryRequestId)
    .eq("user_id", input.userId)
    .single();
  if (requestError) throw new Error("Recovery request not found.");
  if (request.archived_at) throw new Error("This recovery request is no longer active.");
  if (request.status !== "consent_pending") throw new Error("This recovery request is not awaiting consent.");

  const { data: document, error: documentError } = await service
    .from("vault_recovery_documents")
    .select("id,document_id,sent_to_customer_at,customer_signed_at")
    .eq("recovery_request_id", input.recoveryRequestId)
    .not("sent_to_customer_at", "is", null)
    .order("generated_at", { ascending: false })
    .limit(1)
    .single();
  if (documentError) throw new Error("No consent document has been sent to this account.");
  if (document.customer_signed_at) throw new Error("This consent document has already been signed.");

  const signedAt = new Date().toISOString();
  const { error: documentUpdateError } = await service
    .from("vault_recovery_documents")
    .update({
      status: "signed",
      customer_signed_at: signedAt,
      customer_signed_by: input.userId,
      customer_signature: signature,
      customer_signature_method: "authenticated_electronic_signature",
      signed_at: signedAt,
    })
    .eq("id", document.id);
  if (documentUpdateError) throw documentUpdateError;

  const { error: requestUpdateError } = await service
    .from("vault_recovery_requests")
    .update({ status: "consent_signed", updated_by: input.userId, updated_at: signedAt })
    .eq("id", input.recoveryRequestId);
  if (requestUpdateError) throw requestUpdateError;

  await service.from("vault_recovery_case_audit").insert({
    recovery_request_id: input.recoveryRequestId,
    action: "customer_electronic_consent_signed",
    actor_id: input.userId,
    details: {
      document_id: document.document_id,
      sent_at: document.sent_to_customer_at,
      signed_at: signedAt,
      signature_method: "authenticated_electronic_signature",
    },
  });

  await service.from("user_notifications").insert({
    user_id: input.userId,
    kind: "system",
    title: "Vault recovery consent submitted",
    body: `Your signed consent for ${request.reference} was received by FICONTER.`,
    href: `/dashboard/inbox/vault-recovery/${input.recoveryRequestId}`,
    metadata: { recovery_request_id: input.recoveryRequestId, document_id: document.document_id },
  });

  return { signedAt, documentId: document.document_id };
}
