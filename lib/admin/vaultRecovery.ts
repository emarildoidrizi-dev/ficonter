import "server-only";

import { createServiceClient } from "@/lib/supabase/admin";

export type VaultRecoveryCase = {
  id: string;
  reference: string;
  userId: string;
  customerEmail: string;
  customerName: string;
  countryRegion: string;
  internalNotes: string;
  status: string;
  createdAt: string;
  archivedAt: string | null;
  documents: VaultRecoveryDocument[];
};

export type VaultRecoveryDocument = {
  id: string;
  documentId: string;
  generatedAt: string;
  status: string;
};

export type RecoveryCustomer = {
  id: string;
  email: string;
};

const ALLOWED_RECOVERY_TRANSITIONS: Record<string, readonly string[]> = {
  opened: ["verification_pending", "rejected", "cancelled"],
  verification_pending: ["consent_pending", "rejected", "cancelled"],
  consent_pending: ["consent_signed", "rejected", "cancelled"],
  consent_signed: ["approved", "rejected", "cancelled"],
  approved: ["cancelled"],
  recovery_issued: ["completed", "cancelled"],
  completed: [],
  rejected: [],
  cancelled: [],
};

export async function listRecoveryCustomers(): Promise<RecoveryCustomer[]> {
  const service = createServiceClient();
  const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (error) throw error;
  return data.users
    .filter((user) => Boolean(user.email))
    .map((user) => ({ id: user.id, email: user.email ?? "" }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export async function listVaultRecoveryCases(): Promise<VaultRecoveryCase[]> {
  const service = createServiceClient() as any;
  const { data: requests, error } = await service
    .from("vault_recovery_requests")
    .select("id,reference,user_id,customer_email,customer_name,country_region,internal_notes,status,created_at,archived_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const requestIds = (requests ?? []).map((request: any) => request.id);
  const documentsByRequest = new Map<string, VaultRecoveryDocument[]>();

  if (requestIds.length) {
    const { data: documents, error: documentError } = await service
      .from("vault_recovery_documents")
      .select("id,document_id,recovery_request_id,generated_at,status")
      .in("recovery_request_id", requestIds)
      .order("generated_at", { ascending: false });
    if (documentError) throw documentError;
    for (const document of documents ?? []) {
      const list = documentsByRequest.get(document.recovery_request_id) ?? [];
      list.push({ id: document.id, documentId: document.document_id, generatedAt: document.generated_at, status: document.status });
      documentsByRequest.set(document.recovery_request_id, list);
    }
  }

  return (requests ?? []).map((request: any) => ({
    id: request.id,
    reference: request.reference,
    userId: request.user_id,
    customerEmail: request.customer_email,
    customerName: request.customer_name ?? "",
    countryRegion: request.country_region ?? "",
    internalNotes: request.internal_notes ?? "",
    status: request.status,
    createdAt: request.created_at,
    archivedAt: request.archived_at ?? null,
    documents: documentsByRequest.get(request.id) ?? [],
  }));
}

export async function createVaultRecoveryCase(input: { userId: string; customerEmail: string; createdBy: string }) {
  const service = createServiceClient() as any;
  const { data, error } = await service
    .from("vault_recovery_requests")
    .insert({ user_id: input.userId, customer_email: input.customerEmail, created_by: input.createdBy })
    .select("id,reference,user_id,customer_email,status,created_at")
    .single();
  if (error) throw error;
  await service.from("vault_recovery_case_audit").insert({ recovery_request_id: data.id, action: "created", actor_id: input.createdBy });
  return data;
}

export async function updateVaultRecoveryCase(input: {
  recoveryRequestId: string;
  actorId: string;
  customerEmail?: string;
  customerName?: string;
  countryRegion?: string;
  internalNotes?: string;
}) {
  const service = createServiceClient() as any;
  const customerEmail = input.customerEmail?.trim().toLowerCase() ?? "";
  if (!customerEmail || !customerEmail.includes("@")) {
    throw new Error("A valid recovery contact email is required.");
  }

  const patch = {
    customer_email: customerEmail,
    customer_name: input.customerName?.trim() || null,
    country_region: input.countryRegion?.trim() || null,
    internal_notes: input.internalNotes?.trim() || null,
    updated_by: input.actorId,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await service.from("vault_recovery_requests").update(patch).eq("id", input.recoveryRequestId).select("id").single();
  if (error) throw error;
  await service.from("vault_recovery_case_audit").insert({
    recovery_request_id: data.id,
    action: "updated",
    actor_id: input.actorId,
    details: { fields: ["customer_email", "customer_name", "country_region", "internal_notes"] },
  });
  return data;
}

export async function setVaultRecoveryCaseArchived(input: { recoveryRequestId: string; actorId: string; archived: boolean }) {
  const service = createServiceClient() as any;
  const now = new Date().toISOString();
  const { data, error } = await service
    .from("vault_recovery_requests")
    .update({ archived_at: input.archived ? now : null, archived_by: input.archived ? input.actorId : null, updated_by: input.actorId, updated_at: now })
    .eq("id", input.recoveryRequestId)
    .select("id")
    .single();
  if (error) throw error;
  await service.from("vault_recovery_case_audit").insert({ recovery_request_id: data.id, action: input.archived ? "archived" : "restored", actor_id: input.actorId });
  return data;
}

export async function setVaultRecoveryCaseStatus(input: {
  recoveryRequestId: string;
  actorId: string;
  status: "verification_pending" | "consent_signed" | "approved" | "rejected" | "cancelled";
}) {
  const service = createServiceClient() as any;
  const { data: current, error: currentError } = await service
    .from("vault_recovery_requests")
    .select("id,status,archived_at")
    .eq("id", input.recoveryRequestId)
    .single();
  if (currentError) throw currentError;
  if (current.archived_at) throw new Error("Restore the case before changing its workflow status.");

  const allowed = ALLOWED_RECOVERY_TRANSITIONS[current.status] ?? [];
  if (!allowed.includes(input.status)) {
    throw new Error(`Cannot move recovery case from ${current.status} to ${input.status}.`);
  }

  const now = new Date().toISOString();
  const { data, error } = await service
    .from("vault_recovery_requests")
    .update({ status: input.status, updated_by: input.actorId, updated_at: now })
    .eq("id", input.recoveryRequestId)
    .select("id")
    .single();
  if (error) throw error;

  await service.from("vault_recovery_case_audit").insert({
    recovery_request_id: data.id,
    action: `status_${input.status}`,
    actor_id: input.actorId,
    details: { from: current.status, to: input.status },
  });

  return data;
}

export async function generateVaultRecoveryConsentDocument(input: { recoveryRequestId: string; generatedBy: string }) {
  const service = createServiceClient() as any;
  const { data: request, error: requestError } = await service
    .from("vault_recovery_requests")
    .select("id,status,archived_at")
    .eq("id", input.recoveryRequestId)
    .single();
  if (requestError) throw requestError;
  if (request.archived_at) throw new Error("Restore the case before generating a consent document.");
  if (!["verification_pending", "consent_pending"].includes(request.status)) {
    throw new Error("Identity verification must be started before generating the consent document.");
  }

  const { data: document, error } = await service
    .from("vault_recovery_documents")
    .insert({ recovery_request_id: request.id, generated_by: input.generatedBy })
    .select("id,document_id,recovery_request_id,generated_at,status")
    .single();
  if (error) throw error;

  await service
    .from("vault_recovery_requests")
    .update({ status: "consent_pending", updated_at: new Date().toISOString() })
    .eq("id", request.id);

  await service.from("vault_recovery_case_audit").insert({
    recovery_request_id: request.id,
    action: "consent_document_generated",
    actor_id: input.generatedBy,
    details: { document_id: document.document_id },
  });

  return document;
}

export async function getVaultRecoveryConsentDocument(recoveryRequestId: string) {
  const service = createServiceClient() as any;
  const [{ data: request, error: requestError }, { data: document, error: documentError }] = await Promise.all([
    service
      .from("vault_recovery_requests")
      .select("id,reference,user_id,customer_email,customer_name,country_region,status,created_at")
      .eq("id", recoveryRequestId)
      .single(),
    service
      .from("vault_recovery_documents")
      .select("id,document_id,recovery_request_id,generated_at,status")
      .eq("recovery_request_id", recoveryRequestId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (requestError) throw requestError;
  if (documentError) throw documentError;
  return { request, document };
}
