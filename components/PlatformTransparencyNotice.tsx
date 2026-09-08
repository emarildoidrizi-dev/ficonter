"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck, Sparkles, X } from "lucide-react";

import styles from "./PlatformTransparencyNotice.module.css";

const NOTICE_KEY = "ficonter:platform-transparency-notice:2026-09-v1";
const AUTO_CLOSE_MS = 15_000;

export function PlatformTransparencyNotice() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    try {
      window.sessionStorage.setItem(NOTICE_KEY, "dismissed");
    } catch {
      // Storage can be unavailable in hardened/private browser modes.
    }
    setOpen(false);
  }, []);

  useEffect(() => {
    setMounted(true);

    try {
      if (window.sessionStorage.getItem(NOTICE_KEY) === "dismissed") {
        return;
      }
    } catch {
      // If session storage is unavailable, still show the notice for this visit.
    }

    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 50);
    const autoCloseTimer = window.setTimeout(close, AUTO_CLOSE_MS);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.clearTimeout(autoCloseTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [close, open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className={styles.backdrop}>
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ficonter-transparency-title"
        aria-describedby="ficonter-transparency-description"
      >
        <div className={styles.topAccent} aria-hidden="true" />

        <button
          ref={closeButtonRef}
          type="button"
          className={styles.closeButton}
          onClick={close}
          aria-label="Close platform notice"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div className={styles.content}>
          <div className={styles.identityRow} aria-label="FICONTER Financial Control Center">
            <img
              className={styles.mark}
              src="/ficonter-mark.svg"
              alt=""
              width="44"
              height="44"
              aria-hidden="true"
            />
            <div className={styles.identityText}>
              <span className={styles.brandName}>FICONTER</span>
              <span className={styles.brandDescriptor}>Financial Control Center</span>
            </div>
          </div>

          <div className={styles.eyebrow}>
            <Sparkles size={14} aria-hidden="true" />
            Platform transparency notice
          </div>

          <h2 id="ficonter-transparency-title" className={styles.title}>
            FICONTER is ready for use.
          </h2>

          <p id="ficonter-transparency-description" className={styles.lead}>
            FICONTER is fully available for everyday use. As part of our commitment
            to providing a reliable, intuitive and continuously improving experience,
            we will continue refining selected areas of the platform.
          </p>

          <div className={styles.assurance}>
            <div className={styles.assuranceIcon} aria-hidden="true">
              <ShieldCheck size={19} />
            </div>
            <div>
              <strong>Your financial data remains protected.</strong>
              <p>
                Ongoing interface, performance and experience improvements are designed
                not to alter, remove or interfere with the financial data you add to
                your FICONTER account. Your information remains associated with your
                account while these improvements are introduced.
              </p>
            </div>
          </div>

          <div className={styles.bodyCopy}>
            <p>
              Transparency is an important part of how we operate. As FICONTER
              continues to evolve, we will keep our users informed of meaningful
              changes that may affect their experience.
            </p>
            <p>
              If a future change materially affects how financial information is
              handled, we will communicate that change clearly rather than introducing
              it without notice.
            </p>
          </div>

          <div className={styles.thanks}>
            <strong>Thank you for being part of FICONTER.</strong>
            <span className={styles.autoClose}>This notice closes automatically after 15 seconds.</span>
          </div>
        </div>

        <div className={styles.progressTrack} aria-hidden="true">
          <span className={styles.progressBar} />
        </div>
      </section>
    </div>,
    document.body,
  );
}
