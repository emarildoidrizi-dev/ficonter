import type { CurrencySourceData } from "@/lib/finance/baseCurrencyReconciliation";
import {
  DOCUMENT_BUCKET,
  type FinancialDocument,
  type DocumentCategory,
} from "@/lib/documentVault";
import {
  decryptDocumentFile,
  decryptDocumentMetadata,
  encryptDocumentFile,
  encryptDocumentMetadata,
  type DocumentVaultPrivatePayloadV1,
  type EncryptedDocumentVaultRow,
} from "@/lib/e2ee/documentVaultPayload";
import { extractFinancialDocumentDraft } from "@/lib/financialDocumentExtraction";
import { groupPdfTextItemsIntoLines, type PdfTextItem } from "@/lib/pdfFinancialImport";

type CachedDocument = {
  row: EncryptedDocumentVaultRow & {
    e2ee_revision?: number | null;
    created_at?: string | null;
    updated_at?: string | null;
  };
  metadata: DocumentVaultPrivatePayloadV1;
  publicDocument: FinancialDocument;
};

type BoundaryState = {
  client: any;
  vaultKey: CryptoKey;
  userId: string;
  getSource: () => CurrencySourceData;
  getBaseCurrency: () => string;
  documents: Map<string, CachedDocument>;
  pendingByPath: Map<string, { documentId: string; metadata: DocumentVaultPrivatePayloadV1 }>;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

async function requestBodyText(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof init?.body === "string") return init.body;
  if (typeof Request !== "undefined" && input instanceof Request) return input.clone().text();
  return "";
}

function localPath(url: string) {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin ? `${parsed.pathname}${parsed.search}` : null;
  } catch {
    return null;
  }
}

function metadataFromUpload(payload: any, fileSize: number): DocumentVaultPrivatePayloadV1 {
  return {
    originalName: String(payload.originalName ?? "").trim(),
    displayName: String(payload.displayName ?? "").trim(),
    category: payload.category as DocumentCategory,
    mimeType: String(payload.mimeType ?? ""),
    originalSizeBytes: fileSize,
    documentDate: typeof payload.documentDate === "string" && payload.documentDate ? payload.documentDate : null,
    notes: typeof payload.notes === "string" && payload.notes.trim() ? payload.notes.trim() : null,
  };
}

function asFinancialDocument(row: CachedDocument["row"], metadata: DocumentVaultPrivatePayloadV1): FinancialDocument {
  return {
    id: row.id,
    originalName: metadata.originalName,
    displayName: metadata.displayName,
    category: metadata.category,
    mimeType: metadata.mimeType,
    sizeBytes: metadata.originalSizeBytes,
    documentDate: metadata.documentDate,
    notes: metadata.notes,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
}

async function cacheRow(state: BoundaryState, raw: any) {
  const row = raw as CachedDocument["row"];
  const metadata = await decryptDocumentMetadata(state.vaultKey, state.userId, row);
  const publicDocument = asFinancialDocument(row, metadata);
  const cached = { row, metadata, publicDocument };
  state.documents.set(row.id, cached);
  return cached;
}

async function getSignedCiphertextUrl(state: BoundaryState, documentId: string, originalFetch: typeof window.fetch) {
  const result = await originalFetch(`/api/documents/${documentId}/access`, {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const body = await result.json().catch(() => null) as { url?: string; error?: string } | null;
  if (!result.ok || !body?.url) throw new Error(body?.error ?? "Encrypted document access could not be created.");
  return body.url;
}

async function decryptStoredFile(state: BoundaryState, documentId: string, originalFetch: typeof window.fetch) {
  const signedUrl = await getSignedCiphertextUrl(state, documentId, originalFetch);
  const encryptedResponse = await originalFetch(signedUrl, { cache: "no-store" });
  if (!encryptedResponse.ok) throw new Error("The encrypted document could not be downloaded.");
  return decryptDocumentFile(
    state.vaultKey,
    state.userId,
    documentId,
    await encryptedResponse.arrayBuffer(),
  );
}

async function browserExtract(state: BoundaryState, documentId: string, originalFetch: typeof window.fetch) {
  const cached = state.documents.get(documentId);
  if (!cached) throw new Error("The encrypted document metadata is not available. Reload Document Vault and try again.");
  if (cached.metadata.mimeType !== "application/pdf") {
    throw new Error("Searchable PDF extraction is available for PDF documents only.");
  }

  const bytes = new Uint8Array(await decryptStoredFile(state, documentId, originalFetch));
  const { extractText, extractTextItems, getDocumentProxy } = await import("unpdf");
  let pdf: any = null;
  try {
    pdf = await getDocumentProxy(bytes, {
      maxImageSize: 16_777_216,
      disableAutoFetch: true,
      disableStream: true,
    });
    if (pdf.numPages > 80) throw new Error("Import a PDF with no more than 80 pages at a time.");

    const positioned = await extractTextItems(pdf);
    const lines: string[] = [];
    for (const pageItems of positioned.items as Array<Array<{ str: string; x: number; y: number; width: number }>>) {
      const compatible: PdfTextItem[] = pageItems.map((item) => ({
        str: item.str,
        transform: [1, 0, 0, 1, item.x, item.y],
        width: item.width,
      }));
      lines.push(...groupPdfTextItemsIntoLines(compatible));
    }

    if (!lines.length) {
      const plain = await extractText(pdf, { mergePages: false });
      const pages = Array.isArray(plain.text) ? plain.text : [plain.text];
      lines.push(...pages.flatMap((page) => String(page).split(/\r?\n/).map((line) => line.trim()).filter(Boolean)));
    }
    if (!lines.length) throw new Error("No readable text was found. Image-only scans require browser OCR support.");

    const source = state.getSource();
    const extraction = extractFinancialDocumentDraft({
      documentId,
      fileName: cached.metadata.originalName,
      displayName: cached.metadata.displayName,
      category: cached.metadata.category,
      documentDate: cached.metadata.documentDate,
      lines,
      baseCurrency: state.getBaseCurrency() || "EUR",
      rules: [],
      existingTransactions: source.transactions.map((row: any) => ({
        transaction_date: row.transaction_date,
        description: String(row.description ?? ""),
        amount: Number(row.amount ?? 0),
        currency: String(row.currency ?? "EUR"),
        type: String(row.type ?? "expense"),
      })),
    });
    return { extraction, pageCount: Number(pdf.numPages || 0) };
  } finally {
    try {
      if (typeof pdf?.destroy === "function") await pdf.destroy();
      else if (typeof pdf?.cleanup === "function") await pdf.cleanup();
    } catch {
      // Browser PDF cleanup must not mask a successful extraction.
    }
  }
}

export function installDocumentVaultE2eeBoundary(
  client: any,
  vaultKey: CryptoKey,
  userId: string,
  getSource: () => CurrencySourceData,
  getBaseCurrency: () => string,
) {
  const globalStateKey = "__ficonterDocumentVaultE2eeBoundary";
  const globalObject = window as any;
  const existing = globalObject[globalStateKey] as BoundaryState | undefined;
  if (existing) {
    existing.client = client;
    existing.vaultKey = vaultKey;
    existing.userId = userId;
    existing.getSource = getSource;
    existing.getBaseCurrency = getBaseCurrency;
    return;
  }

  const state: BoundaryState = {
    client,
    vaultKey,
    userId,
    getSource,
    getBaseCurrency,
    documents: new Map(),
    pendingByPath: new Map(),
  };
  globalObject[globalStateKey] = state;

  const originalFetch = window.fetch.bind(window);
  const originalStorageFrom = client.storage.from.bind(client.storage);

  client.storage.from = (bucket: string) => {
    const storage = originalStorageFrom(bucket);
    if (bucket !== DOCUMENT_BUCKET) return storage;
    return new Proxy(storage, {
      get(target, property, receiver) {
        const original = Reflect.get(target, property, receiver);
        if (property !== "uploadToSignedUrl" || typeof original !== "function") {
          return typeof original === "function" ? original.bind(target) : original;
        }
        return async (path: string, token: string, file: Blob, options?: Record<string, unknown>) => {
          const pending = state.pendingByPath.get(path);
          if (!pending) throw new Error("The encrypted document upload session is missing.");
          const plaintext = await file.arrayBuffer();
          const encrypted = await encryptDocumentFile(state.vaultKey, state.userId, pending.documentId, plaintext);
          return original.call(target, path, token, encrypted, {
            ...(options ?? {}),
            contentType: "application/octet-stream",
            upsert: false,
          });
        };
      },
    });
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    const path = localPath(url);
    const method = requestMethod(input, init);
    if (!path?.startsWith("/api/documents")) return originalFetch(input, init);

    if (path === "/api/documents" && method === "GET") {
      const rawResponse = await originalFetch(input, init);
      const body = await rawResponse.json().catch(() => null) as { documents?: any[]; usedBytes?: number; limitBytes?: number; error?: string } | null;
      if (!rawResponse.ok || !Array.isArray(body?.documents)) return jsonResponse(body, rawResponse.status);
      const opened = await Promise.all(body.documents.map((row) => cacheRow(state, row)));
      return jsonResponse({
        documents: opened.map((item) => item.publicDocument),
        usedBytes: opened.reduce((sum, item) => sum + item.metadata.originalSizeBytes, 0),
        limitBytes: body.limitBytes,
      });
    }

    if (path === "/api/documents/upload-intent" && method === "POST") {
      const plaintextBody = JSON.parse((await requestBodyText(input, init)) || "{}") as any;
      const documentId = crypto.randomUUID();
      const metadata = metadataFromUpload(plaintextBody, Number(plaintextBody.sizeBytes));
      const encryptedPayload = await encryptDocumentMetadata(state.vaultKey, state.userId, documentId, metadata);
      const encryptedSizeBytes = Number(plaintextBody.sizeBytes) + 44;
      const forwarded = await originalFetch(url, {
        ...(init ?? {}),
        method: "POST",
        headers: { ...(init?.headers as Record<string, string> ?? {}), "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ documentId, sizeBytes: encryptedSizeBytes, encryptedPayload }),
      });
      const body = await forwarded.json().catch(() => null) as { intentId?: string; path?: string; token?: string; error?: string } | null;
      if (forwarded.ok && body?.path) {
        state.pendingByPath.set(body.path, { documentId, metadata });
      }
      return jsonResponse(body, forwarded.status);
    }

    if (path === "/api/documents/complete" && method === "POST") {
      const completed = await originalFetch(input, init);
      const body = await completed.json().catch(() => null) as { document?: any; error?: string } | null;
      if (!completed.ok || !body?.document) return jsonResponse(body, completed.status);
      const cached = await cacheRow(state, body.document);
      for (const [storagePath, pending] of state.pendingByPath) {
        if (pending.documentId === cached.row.id) state.pendingByPath.delete(storagePath);
      }
      return jsonResponse({ document: cached.publicDocument }, completed.status);
    }

    const documentMatch = path.match(/^\/api\/documents\/([0-9a-f-]{36})(?:\/(access|extract|import))?(?:\?.*)?$/i);
    if (!documentMatch) return originalFetch(input, init);
    const documentId = documentMatch[1];
    const action = documentMatch[2] ?? "record";

    if (action === "access" && method === "GET") {
      try {
        const cached = state.documents.get(documentId);
        if (!cached) throw new Error("The encrypted document metadata is not available.");
        const plaintext = await decryptStoredFile(state, documentId, originalFetch);
        const blobUrl = URL.createObjectURL(new Blob([plaintext], { type: cached.metadata.mimeType }));
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
        return jsonResponse({ url: blobUrl, mimeType: cached.metadata.mimeType, expiresIn: 120 });
      } catch (error) {
        return jsonResponse({ error: error instanceof Error ? error.message : "The document could not be opened." }, 500);
      }
    }

    if (action === "extract" && method === "GET") {
      try {
        return jsonResponse(await browserExtract(state, documentId, originalFetch));
      } catch (error) {
        return jsonResponse({ error: error instanceof Error ? error.message : "FICONTER could not extract this encrypted PDF." }, 422);
      }
    }

    if (action === "record" && method === "PATCH") {
      const cached = state.documents.get(documentId);
      if (!cached) return jsonResponse({ error: "Reload Document Vault before editing this document." }, 409);
      const patch = JSON.parse((await requestBodyText(input, init)) || "{}") as any;
      const metadata: DocumentVaultPrivatePayloadV1 = {
        ...cached.metadata,
        displayName: String(patch.displayName ?? cached.metadata.displayName).trim(),
        category: (patch.category ?? cached.metadata.category) as DocumentCategory,
        documentDate: typeof patch.documentDate === "string" && patch.documentDate ? patch.documentDate : null,
        notes: typeof patch.notes === "string" && patch.notes.trim() ? patch.notes.trim() : null,
      };
      const encryptedPayload = await encryptDocumentMetadata(state.vaultKey, state.userId, documentId, metadata);
      const forwarded = await originalFetch(url, {
        ...(init ?? {}),
        method: "PATCH",
        headers: { ...(init?.headers as Record<string, string> ?? {}), "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          encryptedPayload,
          expectedRevision: Number(cached.row.e2ee_revision ?? 0),
        }),
      });
      const body = await forwarded.json().catch(() => null) as { document?: any; error?: string } | null;
      if (!forwarded.ok || !body?.document) return jsonResponse(body, forwarded.status);
      const opened = await cacheRow(state, body.document);
      return jsonResponse({ document: opened.publicDocument }, forwarded.status);
    }

    if (action === "record" && method === "DELETE") {
      const result = await originalFetch(input, init);
      if (result.ok) state.documents.delete(documentId);
      return result;
    }

    return originalFetch(input, init);
  };
}
