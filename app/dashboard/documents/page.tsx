import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EncryptedDocumentVaultWorkspace } from "@/components/EncryptedDocumentVaultWorkspace";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requireSubscriptionFeature } from "@/lib/subscriptionRouteAccess";

export const metadata: Metadata = { title: "Document Vault" };

export default async function DocumentsPage() {
  await requireSubscriptionFeature("financial_documents");
  const { user } = await getCurrentUser();
  if (!user) redirect("/login");
  return <EncryptedDocumentVaultWorkspace userId={user.id} />;
}
