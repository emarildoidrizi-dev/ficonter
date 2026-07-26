"use client";

import {
  CheckCircle2,
  ChevronRight,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MessageSquareText,
  X,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_LIMITS,
  type SupportCategory,
} from "@/lib/support";
import styles from "./ContactSupportModal.module.css";

type SubmissionReceipt = {
  reference: string;
  email: string;
};

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.offsetParent !== null);
}

export function ContactSupportModal({
  open,
  defaultEmail,
  onClose,
}: {
  open: boolean;
  defaultEmail: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [email, setEmail] = useState(defaultEmail);
  const [category, setCategory] = useState<SupportCategory>("technical_issue");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => {
      (receipt ? closeButtonRef.current : emailRef.current)?.focus();
    }, 40);

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, receipt]);

  useEffect(() => {
    if (!open) return;
    setEmail((current) => current || defaultEmail);
  }, [defaultEmail, open]);

  function resetForm() {
    setEmail(defaultEmail);
    setCategory("technical_issue");
    setSubject("");
    setMessage("");
    setError("");
    setReceipt(null);
  }

  function close() {
    if (submitting) return;
    onClose();
    window.setTimeout(resetForm, 180);
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = focusableElements(dialogRef.current);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/support/requests", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, category, subject, message }),
      });

      const data = (await response.json().catch(() => null)) as {
        reference?: string;
        email?: string;
        error?: string;
      } | null;

      if (!response.ok || !data?.reference || !data.email) {
        throw new Error(
          data?.error ?? "Your message could not be submitted. Please try again.",
        );
      }

      setReceipt({ reference: data.reference, email: data.email });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Your message could not be submitted. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !portalReady) return null;

  const modal = (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleDialogKeyDown}
      >
        <div className={styles.header}>
          <div className={styles.headerIcon} aria-hidden="true">
            <MessageSquareText size={22} />
          </div>
          <div>
            <span>FICONTER SUPPORT</span>
            <h2 id={titleId}>Contact Us</h2>
            <p id={descriptionId}>
              Tell us what happened and which email address we should use. We’ll
              get back to you as soon as we can.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            aria-label="Close Contact Us"
            onClick={close}
            disabled={submitting}
          >
            <X size={19} />
          </button>
        </div>

        {receipt ? (
          <div className={styles.successState} aria-live="polite">
            <span className={styles.successIcon} aria-hidden="true">
              <CheckCircle2 size={28} />
            </span>
            <span>MESSAGE RECEIVED</span>
            <h3>Thank you for contacting FICONTER.</h3>
            <p>
              Your concern is now in our secure support inbox. We’ll reply to
              <strong> {receipt.email}</strong> as soon as possible.
            </p>
            <div className={styles.referenceCard}>
              <small>Support reference</small>
              <strong>{receipt.reference}</strong>
            </div>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={close}
              data-primary-action="true"
            >
              Done <ChevronRight size={17} />
            </button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={submit}>
            {error ? (
              <div className={styles.error} role="alert">
                {error}
              </div>
            ) : null}

            <div className={styles.formGrid}>
              <label>
                <span>Email address</span>
                <div className={styles.inputWithIcon}>
                  <Mail size={16} aria-hidden="true" />
                  <input
                    ref={emailRef}
                    type="email"
                    name="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    maxLength={SUPPORT_LIMITS.email}
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </label>

              <label>
                <span>Concern category</span>
                <select
                  name="category"
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as SupportCategory)
                  }
                  required
                >
                  {SUPPORT_CATEGORIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              <span>Subject</span>
              <input
                type="text"
                name="subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                minLength={SUPPORT_LIMITS.subjectMin}
                maxLength={SUPPORT_LIMITS.subjectMax}
                placeholder="Briefly describe your concern"
                required
              />
              <small className={styles.counter}>
                {subject.length}/{SUPPORT_LIMITS.subjectMax}
              </small>
            </label>

            <label>
              <span>How can we help?</span>
              <textarea
                name="message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                minLength={SUPPORT_LIMITS.messageMin}
                maxLength={SUPPORT_LIMITS.messageMax}
                rows={7}
                placeholder="Describe what happened, what you expected, and any steps that may help us understand the issue."
                required
              />
              <small className={styles.counter}>
                {message.length}/{SUPPORT_LIMITS.messageMax.toLocaleString("en-US")}
              </small>
            </label>

            <div className={styles.privacyNote}>
              <LockKeyhole size={17} aria-hidden="true" />
              <p>
                This message is stored privately in FICONTER’s support inbox.
                Never include passwords, card numbers, API keys or other secret
                credentials.
              </p>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={close}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={submitting}
                data-enter-confirm="true"
              >
                {submitting ? (
                  <>
                    <LoaderCircle className={styles.spinning} size={17} />
                    Sending…
                  </>
                ) : (
                  <>
                    Send concern <ChevronRight size={17} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
