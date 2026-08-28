import "server-only";

import { createServiceClient } from "@/lib/supabase/admin";

export async function getAdminSignedRecoveryConsent(recoveryRequestId: string) {
  const service = createServiceClient() as any;

  const { data: request, error: requestError } = await service
    .from("vault_recovery_requests")
    .select("id,reference,user_id,customer_email,customer_name,country_region,customer_city,customer_address_line1,customer_address_line2,customer_postal_code,created_at")
    .eq("id", recoveryRequestId)
    .single();
  if (requestError) throw new Error("Recovery request not found.");

  const { data: document, error: documentError } = await service
    .from("vault_recovery_documents")
    .select("id,document_id,generated_at,sent_to_customer_at,customer_signed_at,customer_signature,customer_signature_method")
    .eq("recovery_request_id", recoveryRequestId)
    .not("customer_signed_at", "is", null)
    .order("generated_at", { ascending: false })
    .limit(1)
    .single();
  if (documentError) throw new Error("No electronically signed consent document was found.");

  return { request, document };
}
