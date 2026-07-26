import type { Metadata } from "next";
import { DocumentVault } from "@/components/DocumentVault";

export const metadata: Metadata = { title: "Document Vault" };

export default function DocumentsPage() {
  return <DocumentVault />;
}
