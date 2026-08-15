"use client";

import { LoaderCircle, Trash2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./SupportDeleteDialog.module.css";

type SupportDeleteDialogProps = {
  open: boolean;
  reference: string;
  subject: string;
  audience: "customer" | "admin";
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function SupportDeleteDialog({
  open,
  reference,
  subject,
  audience,
  busy,
  onCancel,
  onConfirm,
}: SupportDeleteDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => cancelRef.current?.focus(), 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [busy, onCancel, open]);

  if (!open || typeof document === "undefined") return null;

  const copy = audience === "admin"
    ? "This permanently removes the complete thread from both the customer and administrator inboxes, including every reply, internal note, unread counter and related notification."
    : "This permanently removes the complete thread from your inbox and the FICONTER Support inbox, including every reply and related notification.";

  return createPortal(
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onCancel();
    }}>
      <section
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="support-delete-title"
        aria-describedby="support-delete-description"
      >
        <button
          type="button"
          className={styles.closeButton}
          aria-label="Close delete confirmation"
          onClick={onCancel}
          disabled={busy}
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div className={styles.icon}><Trash2 size={22} aria-hidden="true" /></div>
        <span>PERMANENT ACTION</span>
        <h2 id="support-delete-title">Delete this conversation?</h2>
        <p id="support-delete-description">{copy} This action cannot be undone.</p>

        <div className={styles.threadSummary}>
          <small>{reference}</small>
          <strong>{subject}</strong>
        </div>

        <div className={styles.actions}>
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            type="button"
            className={styles.deleteButton}
            data-enter-confirm="true"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <LoaderCircle size={16} className={styles.spinning} aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}
            {busy ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
