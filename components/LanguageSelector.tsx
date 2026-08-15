"use client";

import { Check, ChevronDown, Globe2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LANGUAGE_OPTIONS, type FiconterLanguage } from "@/lib/i18n/config";
import { translateMessage } from "@/lib/i18n/messages";
import { useLanguage } from "./LanguageProvider";
import styles from "./LanguageSelector.module.css";

type Variant = "compact" | "settings" | "public";

export function LanguageSelector({
  variant = "compact",
  showDetails = false,
}: {
  variant?: Variant;
  showDetails?: boolean;
}) {
  const { language, changeLanguage, t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<null | { type: "success" | "error"; text: string }>(null);
  const latestSelectionRef = useRef(0);
  const current = LANGUAGE_OPTIONS.find((option) => option.code === language) ?? LANGUAGE_OPTIONS[0];

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  async function selectLanguage(nextLanguage: FiconterLanguage) {
    if (saving) return;
    if (nextLanguage === language) {
      setOpen(false);
      return;
    }

    const selectionId = latestSelectionRef.current + 1;
    latestSelectionRef.current = selectionId;
    setSaving(true);
    setOpen(false);
    setMessage(null);

    try {
      // Language is the deliberate exception to the platform-wide explicit-save rule:
      // choosing the option is the confirmation. The stable provider persists the
      // account preference first and applies the committed language immediately after.
      await changeLanguage(nextLanguage, true);
      if (latestSelectionRef.current !== selectionId) return;
      setMessage({
        type: "success",
        text: translateMessage(nextLanguage, "languageSaved"),
      });
      window.setTimeout(() => {
        if (latestSelectionRef.current === selectionId) setMessage(null);
      }, 1800);
    } catch {
      if (latestSelectionRef.current !== selectionId) return;
      setMessage({
        type: "error",
        text: translateMessage(language, "languageSaveFailed"),
      });
    } finally {
      if (latestSelectionRef.current === selectionId) setSaving(false);
    }
  }

  return (
    <div
      ref={containerRef}
      className={`${styles.root} ${styles[variant]}`}
      data-no-translate="true"
    >
      {variant === "settings" ? (
        <div className={styles.settingsHeading}>
          <span className={styles.iconWrap}><Globe2 size={22} /></span>
          <div>
            <span>{t("interfaceLanguage")}</span>
            <p>{t("languageDescription")}</p>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className={styles.trigger}
        aria-label={t("chooseLanguage")}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={saving}
        onClick={() => setOpen((value) => !value)}
      >
        <Globe2 size={16} />
        <span>{current.nativeName}</span>
        <ChevronDown size={15} className={open ? styles.chevronOpen : ""} />
      </button>

      {open ? (
        <div className={styles.menu} role="listbox" aria-label={t("chooseLanguage")}>
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.code === language}
              key={option.code}
              onClick={() => void selectLanguage(option.code)}
              lang={option.locale}
              dir={option.direction}
            >
              <span>
                <strong>{option.nativeName}</strong>
                <small>{option.englishName}</small>
              </span>
              {option.code === language ? <Check size={16} /> : null}
            </button>
          ))}
        </div>
      ) : null}

      {showDetails ? (
        <div className={styles.details}>
          <p>{t("englishFallback")}</p>
          <p>{t("rtlNotice")}</p>
        </div>
      ) : null}

      {message ? (
        <p className={message.type === "error" ? styles.error : styles.success} role="status">
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
