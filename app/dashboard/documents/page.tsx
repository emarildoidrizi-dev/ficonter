import type { Metadata } from "next";
import { DocumentVault } from "@/components/DocumentVault";

import { requireSubscriptionFeature } from "@/lib/subscriptionRouteAccess";
export const metadata: Metadata = { title: "Document Vault" };

export default async function DocumentsPage() {
  await requireSubscriptionFeature("financial_documents");
  return <DocumentVault />;
}
