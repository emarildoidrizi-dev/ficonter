export const DOCUMENT_BUCKET = "financial-documents";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_USER_DOCUMENT_BYTES = 100 * 1024 * 1024;
export const MAX_PENDING_DOCUMENT_UPLOADS = 5;

export const DOCUMENT_CATEGORIES = [
  { value: "bank_statement", label: "Bank statement" },
  { value: "payslip", label: "Payslip" },
  { value: "tax_document", label: "Tax document" },
  { value: "invoice_receipt", label: "Invoice or receipt" },
  { value: "insurance", label: "Insurance" },
  { value: "contract", label: "Contract" },
  { value: "loan_document", label: "Loan document" },
  { value: "pension_record", label: "Pension record" },
  { value: "other", label: "Other financial document" },
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]["value"];

export type FinancialDocument = {
  id: string;
  originalName: string;
  displayName: string;
  category: DocumentCategory;
  mimeType: string;
  sizeBytes: number;
  documentDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function hasValidDocumentSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "application/pdf") {
    return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  }
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= 8 && signature.every((value, index) => bytes[index] === value);
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

export function isDocumentCategory(value: unknown): value is DocumentCategory {
  return DOCUMENT_CATEGORIES.some((item) => item.value === value);
}

export function documentCategoryLabel(value: DocumentCategory): string {
  return DOCUMENT_CATEGORIES.find((item) => item.value === value)?.label ?? "Other financial document";
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function safeFileName(name: string): string {
  const extension = name.includes(".") ? `.${name.split(".").pop()?.toLowerCase()}` : "";
  const base = name
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "document";
  return `${base}${extension}`;
}
