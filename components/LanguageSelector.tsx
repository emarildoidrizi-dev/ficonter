"use client";

import { Check, ChevronDown, Globe2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LANGUAGE_OPTIONS, type FiconterLanguage } from "@/lib/i18n/config";
import { translateMessage } from "@/lib/i18n/messages";
import { useLanguage } from "./LanguageProvider";
import styles from "./LanguageSelector.module.css";

type Variant = "compact" | "settings" | "public";
type PopoverPosition = { top: number; left: number; width: number };

export function LanguageSelector({
  variant = "compact",
  showDetails = false,
}: {
  variant?: Variant;
  showDetails?: boolean;
}) {
  const { language, changeLanguage, t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);
  const [message, setMessage] = useState<null | { type: "success" | "error"; text: string }>(null);
  const latestSelectionRef = useRef(0);
  const current = LANGUAGE_OPTIONS.find((option) => option.code === language) ?? LANGUAGE_OPTIONS[0];

  function isNativePhonePopover() {
    return (
      variant === "compact" &&
      typeof document !== "undefined" &&
      document.documentElement.dataset.ficonterNativeApp === "true" &&
      document.documentElement.dataset.ficonterDevice === "phone"
    );
  }

  function positionMobilePopover() {
    if (!isNativePhonePopover() || !triggerRef.current || typeof window === "undefined") return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const horizontalMargin = 12;
    const preferredWidth = 232;
    const width = Math.min(preferredWidth, Math.max(196, viewportWidth - horizontalMargin * 2));
    const centeredLeft = rect.left + rect.width / 2 - width / 2;
    const left = Math.min(
      Math.max(horizontalMargin, centeredLeft),
      Math.max(horizontalMargin, viewportWidth - width - horizontalMargin),
    );

    setPopoverPosition({
      top: Math.round(rect.bottom + 8),
      left: Math.round(left),
      width: Math.round(width),
    });
  }

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
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

  useEffect(() => {
    if (!open || !isNativePhonePopover()) return;

    positionMobilePopover();
    const visualViewport = window.visualViewport;
    const reposition = () => positionMobilePopover();

    window.addEventListener("resize", reposition);
    window.addEventListener("orientationchange", reposition);
    visualViewport?.addEventListener("resize", reposition);
    visualViewport?.addEventListener("scroll", reposition);

    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("orientationchange", reposition);
      visualViewport?.removeEventListener("resize", reposition);
      visualViewport?.removeEventListener("scroll", reposition);
    };
  }, [open, variant]);

  function toggleMenu() {
    if (!open && isNativePhonePopover()) positionMobilePopover();
    setOpen((value) => !value);
  }

  function selectLanguage(nextLanguage: FiconterLanguage) {
    setOpen(false);

    if (nextLanguage === language) return;

    const selectionId = latestSelectionRef.current + 1;
    latestSelectionRef.current = selectionId;
    setMessage(null);

    // The interface changes immediately. If a signed-in account is available,
    // its preference is synchronized in the background without blocking the UI.
    void changeLanguage(nextLanguage, true)
      .then(() => {
        if (latestSelectionRef.current !== selectionId) return;
        setMessage({
          type: "success",
          text: translateMessage(nextLanguage, "languageSaved"),
        });
        window.setTimeout(() => {
          if (latestSelectionRef.current === selectionId) setMessage(null);
        }, 1800);
      })
      .catch(() => {
        if (latestSelectionRef.current !== selectionId) return;
        setMessage({
          type: "error",
          text: translateMessage(nextLanguage, "languageSaveFailed"),
        });
      });
  }

  const useMobilePopover = open && isNativePhonePopover();
  const menu = open ? (
    <div
      ref={menuRef}
      className={`${styles.menu} ${useMobilePopover ? styles.mobilePopoverMenu : ""}`}
      role="listbox"
      aria-label={t("chooseLanguage")}
      style={useMobilePopover && popoverPosition ? popoverPosition : undefined}
    >
      {LANGUAGE_OPTIONS.map((option) => (
        <button
          type="button"
          role="option"
          aria-selected={option.code === language}
          key={option.code}
          onClick={() => selectLanguage(option.code)}
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
  ) : null;

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
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={t("chooseLanguage")}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleMenu}
      >
        <Globe2 size={16} />
        <span>{current.nativeName}</span>
        <ChevronDown size={15} className={open ? styles.chevronOpen : ""} />
      </button>

      {useMobilePopover
        ? popoverPosition && menu
          ? createPortal(menu, document.body)
          : null
        : menu}

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
