import {
  decryptVaultPayload,
  encryptVaultPayload,
  type VaultCiphertextEnvelopeV1,
} from "@/lib/e2ee/vault";
import { isDocumentCategory, type DocumentCategory } from "@/lib/documentVault";

const FILE_MAGIC = new TextEncoder().encode("FICONTER-DOC-V1\0");
const FILE_IV_BYTES = 12;

export type DocumentVaultPrivatePayloadV1 = {
  originalName: string;
  displayName: string;
  category: DocumentCategory;
  mimeType: string;
  originalSizeBytes: number;
  documentDate: string | null;
  notes: string | null;
};

export type EncryptedDocumentVaultRow = {
  id: string;
  user_id: string;
  encrypted_payload: VaultCiphertextEnvelopeV1 | null;
  encryption_version: number | null;
  file_encryption_version?: number | null;
  size_bytes?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function normalizeMetadata(payload: Record<string, unknown>): DocumentVaultPrivatePayloadV1 {
  const originalName = typeof payload.originalName === "string" ? payload.originalName.trim() : "";
  const displayName = typeof payload.displayName === "string" ? payload.displayName.trim() : "";
  const mimeType = typeof payload.mimeType === "string" ? payload.mimeType.trim() : "";
  const originalSizeBytes = Number(payload.originalSizeBytes);
  const documentDate = typeof payload.documentDate === "string" && payload.documentDate
    ? payload.documentDate
    : null;
  const notes = typeof payload.notes === "string" && payload.notes.trim()
    ? payload.notes.trim()
    : null;

  if (!originalName || originalName.length > 255 || !displayName || displayName.length > 160) {
    throw new Error("Document names are invalid.");
  }
  if (!isDocumentCategory(payload.category)) {
    throw new Error("Document category is invalid.");
  }
  if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    throw new Error("Document type is invalid.");
  }
  if (!Number.isFinite(originalSizeBytes) || originalSizeBytes <= 0) {
    throw new Error("Document size is invalid.");
  }
  if (documentDate && !/^\d{4}-\d{2}-\d{2}$/.test(documentDate)) {
    throw new Error("Document date is invalid.");
  }
  if ((notes?.length ?? 0) > 1000) {
    throw new Error("Document notes are too long.");
  }

  return {
    originalName,
    displayName,
    category: payload.category,
    mimeType,
    originalSizeBytes,
    documentDate,
    notes,
  };
}

function fileAdditionalData(userId: string, documentId: string) {
  return new TextEncoder().encode(`ficonter:document-file:${userId}:${documentId}:v1`);
}

export async function encryptDocumentMetadata(
  vaultKey: CryptoKey,
  userId: string,
  documentId: string,
  payload: DocumentVaultPrivatePayloadV1,
): Promise<VaultCiphertextEnvelopeV1> {
  return encryptVaultPayload(
    vaultKey,
    userId,
    "financial-document",
    documentId,
    normalizeMetadata(payload as unknown as Record<string, unknown>),
  );
}

export async function decryptDocumentMetadata(
  vaultKey: CryptoKey,
  userId: string,
  row: EncryptedDocumentVaultRow,
): Promise<DocumentVaultPrivatePayloadV1> {
  if (row.user_id !== userId) throw new Error("Document does not belong to the active user.");
  if (row.encryption_version !== 1 || !row.encrypted_payload) {
    throw new Error("Document metadata is not encrypted v1 data.");
  }
  return normalizeMetadata(
    await decryptVaultPayload(
      vaultKey,
      userId,
      "financial-document",
      row.id,
      row.encrypted_payload,
    ),
  );
}

export async function encryptDocumentFile(
  vaultKey: CryptoKey,
  userId: string,
  documentId: string,
  plaintext: ArrayBuffer,
): Promise<Blob> {
  const iv = crypto.getRandomValues(new Uint8Array(FILE_IV_BYTES));
  const source = new Uint8Array(plaintext);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
        additionalData: toArrayBuffer(fileAdditionalData(userId, documentId)),
      },
      vaultKey,
      toArrayBuffer(source),
    ),
  );

  const output = new Uint8Array(FILE_MAGIC.length + iv.length + ciphertext.length);
  output.set(FILE_MAGIC, 0);
  output.set(iv, FILE_MAGIC.length);
  output.set(ciphertext, FILE_MAGIC.length + iv.length);
  return new Blob([output], { type: "application/octet-stream" });
}

export async function decryptDocumentFile(
  vaultKey: CryptoKey,
  userId: string,
  documentId: string,
  encrypted: ArrayBuffer,
): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(encrypted);
  const minimum = FILE_MAGIC.length + FILE_IV_BYTES + 16;
  if (bytes.byteLength < minimum) throw new Error("Encrypted document is incomplete.");
  for (let index = 0; index < FILE_MAGIC.length; index += 1) {
    if (bytes[index] !== FILE_MAGIC[index]) throw new Error("Unsupported encrypted document format.");
  }

  const iv = bytes.slice(FILE_MAGIC.length, FILE_MAGIC.length + FILE_IV_BYTES);
  const ciphertext = bytes.slice(FILE_MAGIC.length + FILE_IV_BYTES);
  return crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
      additionalData: toArrayBuffer(fileAdditionalData(userId, documentId)),
    },
    vaultKey,
    toArrayBuffer(ciphertext),
  );
}
