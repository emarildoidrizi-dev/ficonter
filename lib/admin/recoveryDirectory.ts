import "server-only";

import { createServiceClient } from "@/lib/supabase/admin";

export type RecoveryDirectoryCustomer = {
  id: string;
  email: string;
  fullName: string;
  birthDate: string;
  country: string;
  city: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function listRecoveryDirectoryCustomers(): Promise<RecoveryDirectoryCustomer[]> {
  const service = createServiceClient() as any;
  const authUsers: any[] = [];
  let page = 1;

  while (page <= 1000) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    authUsers.push(...data.users.filter((user: any) => Boolean(user.email)));
    if (!data.nextPage) break;
    page = data.nextPage;
  }

  const ids = authUsers.map((user) => user.id);
  const profilesById = new Map<string, any>();

  for (let index = 0; index < ids.length; index += 500) {
    const chunk = ids.slice(index, index + 500);
    if (!chunk.length) continue;
    const { data, error } = await service
      .from("profiles")
      .select("id,full_name,birth_date,country,city,address_line1,address_line2,postal_code")
      .in("id", chunk);
    if (error) throw error;
    for (const profile of data ?? []) profilesById.set(profile.id, profile);
  }

  return authUsers
    .map((user) => {
      const profile = profilesById.get(user.id) ?? {};
      const metadata = user.user_metadata ?? {};
      return {
        id: user.id,
        email: user.email ?? "",
        fullName: text(profile.full_name) || text(metadata.full_name) || text(metadata.name),
        birthDate: text(profile.birth_date),
        country: text(profile.country),
        city: text(profile.city),
        addressLine1: text(profile.address_line1),
        addressLine2: text(profile.address_line2),
        postalCode: text(profile.postal_code),
      } satisfies RecoveryDirectoryCustomer;
    })
    .sort((a, b) => (a.fullName || a.email).localeCompare(b.fullName || b.email, undefined, { sensitivity: "base" }));
}

export async function getRecoveryDirectoryCustomer(userId: string): Promise<RecoveryDirectoryCustomer> {
  const service = createServiceClient() as any;
  const [{ data: authData, error: authError }, { data: profile, error: profileError }] = await Promise.all([
    service.auth.admin.getUserById(userId),
    service
      .from("profiles")
      .select("id,full_name,birth_date,country,city,address_line1,address_line2,postal_code")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  if (authError || !authData.user?.email) throw new Error("Customer account could not be found.");
  if (profileError) throw profileError;

  const metadata = authData.user.user_metadata ?? {};
  return {
    id: authData.user.id,
    email: authData.user.email,
    fullName: text(profile?.full_name) || text(metadata.full_name) || text(metadata.name),
    birthDate: text(profile?.birth_date),
    country: text(profile?.country),
    city: text(profile?.city),
    addressLine1: text(profile?.address_line1),
    addressLine2: text(profile?.address_line2),
    postalCode: text(profile?.postal_code),
  };
}

export async function snapshotRecoveryIdentity(input: {
  recoveryRequestId: string;
  actorId: string;
  customer: RecoveryDirectoryCustomer;
}) {
  const service = createServiceClient() as any;
  const now = new Date().toISOString();
  const { error } = await service
    .from("vault_recovery_requests")
    .update({
      customer_email: input.customer.email,
      customer_name: input.customer.fullName || null,
      customer_birth_date: input.customer.birthDate || null,
      country_region: input.customer.country || null,
      customer_city: input.customer.city || null,
      customer_address_line1: input.customer.addressLine1 || null,
      customer_address_line2: input.customer.addressLine2 || null,
      customer_postal_code: input.customer.postalCode || null,
      updated_by: input.actorId,
      updated_at: now,
    })
    .eq("id", input.recoveryRequestId);
  if (error) throw error;
}

export async function getRecoveryConsentView(recoveryRequestId: string) {
  const service = createServiceClient() as any;
  const [{ data: request, error: requestError }, { data: document, error: documentError }] = await Promise.all([
    service
      .from("vault_recovery_requests")
      .select("id,reference,user_id,customer_email,customer_name,customer_birth_date,country_region,customer_city,customer_address_line1,customer_address_line2,customer_postal_code,status,created_at")
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
