"use client";

import {
  Download,
  Eye,
  FileText,
  FolderLock,
  HardDrive,
  LoaderCircle,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  DOCUMENT_BUCKET,
  DOCUMENT_CATEGORIES,
  MAX_DOCUMENT_BYTES,
  MAX_USER_DOCUMENT_BYTES,
  documentCategoryLabel,
  formatFileSize,
  hasValidDocumentSignature,
  type DocumentCategory,
  type FinancialDocument,
} from "@/lib/documentVault";
import { createClient } from "@/lib/supabase/client";
import styles from "./DocumentVault.module.css";

type DocumentForm = {
  displayName: string;
  category: DocumentCategory;
  documentDate: string;
  notes: string;
};

const EMPTY_FORM: DocumentForm = {
  displayName: "",
  category: "bank_statement",
  documentDate: "",
  notes: "",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function DocumentVault() {
  const [documents, setDocuments] = useState<FinancialDocument[]>([]);
  const [usedBytes, setUsedBytes] = useState(0);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | DocumentCategory>("all");
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialDocument | null>(null);
  const [deleting, setDeleting] = useState<FinancialDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(""), 5_000);
    return () => window.clearTimeout(timer);
  }, [success]);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/documents", { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } });
      const data = (await response.json().catch(() => null)) as { documents?: FinancialDocument[]; usedBytes?: number; error?: string } | null;
      if (!response.ok || !data?.documents) throw new Error(data?.error ?? "Your documents could not be loaded.");
      setDocuments(data.documents);
      setUsedBytes(data.usedBytes ?? 0);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Your documents could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return documents.filter((document) => {
      if (categoryFilter !== "all" && document.category !== categoryFilter) return false;
      if (!normalized) return true;
      return [document.displayName, document.originalName, document.notes ?? "", documentCategoryLabel(document.category)]
        .some((value) => value.toLowerCase().includes(normalized));
    });
  }, [categoryFilter, documents, query]);

  async function accessDocument(document: FinancialDocument, download: boolean) {
    setError("");
    const previewWindow = download ? null : window.open("", "_blank", "noopener,noreferrer");
    try {
      const response = await fetch(`/api/documents/${document.id}/access${download ? "?download=1" : ""}`, { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } });
      const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!response.ok || !data?.url) throw new Error(data?.error ?? "Secure document access could not be created.");
      if (download) {
        const anchor = window.document.createElement("a");
        anchor.href = data.url;
        anchor.download = document.originalName;
        anchor.rel = "noopener noreferrer";
        anchor.click();
      } else if (previewWindow) {
        previewWindow.location.href = data.url;
      } else {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } catch (accessError) {
      previewWindow?.close();
      setError(accessError instanceof Error ? accessError.message : "The document could not be opened.");
    }
  }

  async function deleteDocument() {
    if (!deleting || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/documents/${deleting.id}`, { method: "DELETE", credentials: "same-origin", headers: { Accept: "application/json" } });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "The document could not be deleted.");
      setDocuments((current) => current.filter((item) => item.id !== deleting.id));
      setUsedBytes((current) => Math.max(0, current - deleting.sizeBytes));
      setSuccess(`${deleting.displayName} was permanently deleted.`);
      setDeleting(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "The document could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span>PRIVATE FINANCIAL STORAGE</span>
          <h1>Document Vault</h1>
          <p>Keep statements, payslips and other financial documents organized inside your private FICONTER workspace.</p>
        </div>
        <button type="button" className={styles.uploadButton} onClick={() => setUploadOpen(true)}>
          <UploadCloud size={17} /> Upload document
        </button>
      </header>

      <div className={styles.metrics}>
        <article><FolderLock size={19} /><span>Documents</span><strong>{documents.length}</strong></article>
        <article><HardDrive size={19} /><span>Storage used</span><strong>{formatFileSize(usedBytes)}</strong><small>of {formatFileSize(MAX_USER_DOCUMENT_BYTES)}</small></article>
        <article><ShieldCheck size={19} /><span>Privacy</span><strong>Private</strong><small>Only your account can open files</small></article>
      </div>

      <div className={styles.usageTrack} aria-label={`${Math.round((usedBytes / MAX_USER_DOCUMENT_BYTES) * 100)}% of storage used`}>
        <span style={{ width: `${Math.min(100, (usedBytes / MAX_USER_DOCUMENT_BYTES) * 100)}%` }} />
      </div>

      <div className={styles.toolbar}>
        <label><Search size={16} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents" /></label>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as "all" | DocumentCategory)}>
          <option value="all">All categories</option>
          {DOCUMENT_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
        </select>
      </div>

      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      {success ? <div className={styles.success} role="status">{success}</div> : null}

      {loading ? (
        <div className={styles.empty}><LoaderCircle className={styles.spinning} size={26} /><strong>Loading your vault…</strong></div>
      ) : filtered.length ? (
        <div className={styles.grid}>
          {filtered.map((document) => (
            <article key={document.id} className={styles.card}>
              <div className={styles.fileIcon}><FileText size={23} /></div>
              <div className={styles.cardBody}>
                <span>{documentCategoryLabel(document.category)}</span>
                <h2>{document.displayName}</h2>
                <p>{document.originalName}</p>
                <dl>
                  <div><dt>File size</dt><dd>{formatFileSize(document.sizeBytes)}</dd></div>
                  <div><dt>Document date</dt><dd>{document.documentDate ? formatDate(document.documentDate) : "Not set"}</dd></div>
                  <div><dt>Saved</dt><dd>{formatDate(document.createdAt)}</dd></div>
                </dl>
                {document.notes ? <small>{document.notes}</small> : null}
              </div>
              <div className={styles.cardActions}>
                <button type="button" onClick={() => void accessDocument(document, false)}><Eye size={15} /> Preview</button>
                <button type="button" onClick={() => void accessDocument(document, true)}><Download size={15} /> Download</button>
                <button type="button" onClick={() => setEditing(document)}><Pencil size={15} /> Edit</button>
                <button type="button" className={styles.deleteButton} onClick={() => setDeleting(document)}><Trash2 size={15} /> Delete</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <FolderLock size={31} />
          <strong>{documents.length ? "No matching documents" : "Your private vault is empty"}</strong>
          <p>{documents.length ? "Change the search or category filter." : "Upload your first statement, payslip or financial document."}</p>
          {!documents.length ? <button type="button" onClick={() => setUploadOpen(true)}>Upload first document</button> : null}
        </div>
      )}

      {portalReady && uploadOpen ? createPortal(
        <DocumentEditor mode="upload" onClose={() => setUploadOpen(false)} onSaved={(document) => {
          setDocuments((current) => [document, ...current]);
          setUsedBytes((current) => current + document.sizeBytes);
          setUploadOpen(false);
          setSuccess(`${document.displayName} was saved privately.`);
        }} />,
        document.body,
      ) : null}

      {portalReady && editing ? createPortal(
        <DocumentEditor mode="edit" document={editing} onClose={() => setEditing(null)} onSaved={(document) => {
          setDocuments((current) => current.map((item) => item.id === document.id ? document : item));
          setEditing(null);
          setSuccess(`${document.displayName} was updated.`);
        }} />,
        document.body,
      ) : null}

      {portalReady && deleting ? createPortal(
        <div className={styles.modalBackdrop} role="presentation">
          <div className={styles.confirmDialog} role="dialog" aria-modal="true" aria-labelledby="delete-document-title">
            <span className={styles.dangerIcon}><Trash2 size={22} /></span>
            <h2 id="delete-document-title">Delete this document?</h2>
            <p><strong>{deleting.displayName}</strong> and its stored file will be permanently removed. This cannot be undone.</p>
            <div><button type="button" onClick={() => setDeleting(null)} disabled={busy}>Cancel</button><button type="button" className={styles.confirmDelete} onClick={() => void deleteDocument()} disabled={busy}>{busy ? <LoaderCircle className={styles.spinning} size={16} /> : <Trash2 size={16} />} Delete permanently</button></div>
          </div>
        </div>,
        document.body,
      ) : null}
    </section>
  );
}

function DocumentEditor({
  mode,
  document,
  onClose,
  onSaved,
}: {
  mode: "upload" | "edit";
  document?: FinancialDocument;
  onClose: () => void;
  onSaved: (document: FinancialDocument) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<DocumentForm>(document ? {
    displayName: document.displayName,
    category: document.category,
    documentDate: document.documentDate ?? "",
    notes: document.notes ?? "",
  } : EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    let pendingIntentId: string | null = null;
    try {
      let response: Response;
      if (mode === "upload") {
        if (!file) throw new Error("Choose a PDF or image document.");
        const signature = new Uint8Array(await file.slice(0, 16).arrayBuffer());
        if (!hasValidDocumentSignature(signature, file.type)) {
          throw new Error("The selected file does not match its PDF or image format.");
        }

        const intentResponse = await fetch("/api/documents/upload-intent", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            originalName: file.name,
            displayName: form.displayName,
            category: form.category,
            documentDate: form.documentDate,
            notes: form.notes,
            mimeType: file.type,
            sizeBytes: file.size,
          }),
        });
        const intent = (await intentResponse.json().catch(() => null)) as {
          intentId?: string;
          path?: string;
          token?: string;
          error?: string;
        } | null;
        if (!intentResponse.ok || !intent?.intentId || !intent.path || !intent.token) {
          throw new Error(intent?.error ?? "A secure upload could not be prepared.");
        }

        pendingIntentId = intent.intentId;
        const { error: uploadError } = await supabase.storage
          .from(DOCUMENT_BUCKET)
          .uploadToSignedUrl(intent.path, intent.token, file, {
            contentType: file.type,
            upsert: false,
          });
        if (uploadError) throw uploadError;

        response = await fetch("/api/documents/complete", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ intentId: intent.intentId }),
        });
      } else {
        response = await fetch(`/api/documents/${document?.id}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(form),
        });
      }
      const data = (await response.json().catch(() => null)) as { document?: FinancialDocument; error?: string } | null;
      if (!response.ok || !data?.document) throw new Error(data?.error ?? "The document could not be saved.");
      pendingIntentId = null;
      onSaved(data.document);
    } catch (saveError) {
      if (pendingIntentId) {
        await fetch(`/api/documents/upload-intent/${pendingIntentId}`, {
          method: "DELETE",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        }).catch(() => undefined);
      }
      setError(saveError instanceof Error ? saveError.message : "The document could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div className={styles.editorDialog} role="dialog" aria-modal="true" aria-labelledby="document-editor-title">
        <header>
          <div><span>PRIVATE DOCUMENT VAULT</span><h2 id="document-editor-title">{mode === "upload" ? "Upload document" : "Edit document"}</h2></div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close"><X size={19} /></button>
        </header>
        <form onSubmit={submit}>
          {error ? <div className={styles.error} role="alert">{error}</div> : null}
          {mode === "upload" ? (
            <label className={styles.fileDrop}>
              <UploadCloud size={25} />
              <strong>{file ? file.name : "Choose a PDF or image"}</strong>
              <small>PDF, JPG, PNG or WEBP · Maximum {formatFileSize(MAX_DOCUMENT_BYTES)}</small>
              <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required />
            </label>
          ) : null}
          <div className={styles.formGrid}>
            <label><span>Document title</span><input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} maxLength={160} required /></label>
            <label><span>Category</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as DocumentCategory })}>{DOCUMENT_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          </div>
          <label><span>Document date <small>optional</small></span><input type="date" value={form.documentDate} onChange={(event) => setForm({ ...form, documentDate: event.target.value })} /></label>
          <label><span>Private notes <small>optional</small></span><textarea rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} maxLength={1000} placeholder="Add a private note or reminder about this document." /></label>
          <div className={styles.privacyNote}><ShieldCheck size={17} /><span>This file is stored in a private bucket. It is not displayed to FICONTER administrators.</span></div>
          <footer><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" disabled={busy || !form.displayName.trim() || (mode === "upload" && !file)}>{busy ? <LoaderCircle className={styles.spinning} size={16} /> : <UploadCloud size={16} />}{mode === "upload" ? "Save document" : "Save changes"}</button></footer>
        </form>
      </div>
    </div>
  );
}
