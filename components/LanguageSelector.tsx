"use client";

import { Check, ChevronDown, Globe2 } from "lucide-react";
import { createPortal } from "react-dom";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { LANGUAGE_OPTIONS, type FiconterLanguage } from "@/lib/i18n/config";
import { translateMessage } from "@/lib/i18n/messages";
import { useLanguage } from "./LanguageProvider";
import styles from "./LanguageSelector.module.css";

type Variant = "compact" | "settings" | "public";

type AdaptiveMenuStyle = CSSProperties & {
  "--ficonter-language-menu-top": string;
  "--ficonter-language-menu-left": string;
  "--ficonter-language-menu-width": string;
  "--ficonter-language-menu-max-height": string;
};

function isAdaptiveWorkspaceMenu(variant: Variant, open: boolean) {
  if (!open || variant !== "compact" || typeof document === "undefined") {
    return false;
  }

  const root = document.documentElement;
  return (
    root.dataset.ficonterNativeApp === "true" &&
    (root.dataset.ficonterDevice === "phone" ||
      root.dataset.ficonterDevice === "tablet")
  );
}

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
  const [adaptiveMenuStyle, setAdaptiveMenuStyle] =
    useState<AdaptiveMenuStyle | null>(null);
  const [message, setMessage] = useState<null | { type: "success" | "error"; text: string }>(null);
  const latestSelectionRef = useRef(0);
  const current = LANGUAGE_OPTIONS.find((option) => option.code === language) ?? LANGUAGE_OPTIONS[0];
  const useAdaptiveMenu = isAdaptiveWorkspaceMenu(variant, open);

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
    if (!useAdaptiveMenu) return;

    const trigger = triggerRef.current;
    if (!trigger) return;

    function updateMenuGeometry() {
      const triggerElement = triggerRef.current;
      if (!triggerElement) return;

      const rect = triggerElement.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportWidth = Math.max(
        1,
        viewport?.width ?? window.innerWidth ?? document.documentElement.clientWidth,
      );
      const viewportHeight = Math.max(
        1,
        viewport?.height ?? window.innerHeight ?? document.documentElement.clientHeight,
      );
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const edgeGap = Math.max(10, Math.min(18, viewportWidth * 0.035));
      const usableWidth = Math.max(1, viewportWidth - edgeGap * 2);
      const menuWidth = Math.min(
        260,
        Math.max(200, viewportWidth * 0.58),
        usableWidth,
      );
      const triggerCenter = rect.left + rect.width / 2;
      const minimumLeft = viewportLeft + edgeGap;
      const maximumLeft = viewportLeft + viewportWidth - menuWidth - edgeGap;
      const menuLeft = Math.max(
        minimumLeft,
        Math.min(triggerCenter - menuWidth / 2, maximumLeft),
      );

      const verticalGap = 7;
      const viewportBottom = viewportTop + viewportHeight;
      const preferredTop = rect.bottom + verticalGap;
      const spaceBelow = Math.max(0, viewportBottom - preferredTop - edgeGap);
      const spaceAbove = Math.max(0, rect.top - viewportTop - edgeGap - verticalGap);
      const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
      const availableHeight = openAbove ? spaceAbove : spaceBelow;
      const menuMaxHeight = Math.max(80, Math.min(344, availableHeight));
      const menuTop = openAbove
        ? Math.max(viewportTop + edgeGap, rect.top - verticalGap - menuMaxHeight)
        : Math.max(viewportTop + edgeGap, preferredTop);

      setAdaptiveMenuStyle({
        "--ficonter-language-menu-top": `${Math.round(menuTop)}px`,
        "--ficonter-language-menu-left": `${Math.round(menuLeft)}px`,
        "--ficonter-language-menu-width": `${Math.round(menuWidth)}px`,
        "--ficonter-language-menu-max-height": `${Math.round(menuMaxHeight)}px`,
      });
    }

    updateMenuGeometry();

    const viewport = window.visualViewport;
    window.addEventListener("resize", updateMenuGeometry, { passive: true });
    window.addEventListener("orientationchange", updateMenuGeometry, { passive: true });
    viewport?.addEventListener("resize", updateMenuGeometry, { passive: true });
    viewport?.addEventListener("scroll", updateMenuGeometry, { passive: true });

    return () => {
      window.removeEventListener("resize", updateMenuGeometry);
      window.removeEventListener("orientationchange", updateMenuGeometry);
      viewport?.removeEventListener("resize", updateMenuGeometry);
      viewport?.removeEventListener("scroll", updateMenuGeometry);
    };
  }, [useAdaptiveMenu]);

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

  const menu =
    open && (!useAdaptiveMenu || adaptiveMenuStyle) ? (
      <div
        ref={menuRef}
        className={styles.menu}
        role="listbox"
        aria-label={t("chooseLanguage")}
        data-adaptive-language-menu={useAdaptiveMenu ? "true" : undefined}
        style={useAdaptiveMenu ? adaptiveMenuStyle ?? undefined : undefined}
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
        onClick={() => setOpen((value) => !value)}
      >
        <Globe2 size={16} />
        <span>{current.nativeName}</span>
        <ChevronDown size={15} className={open ? styles.chevronOpen : ""} />
      </button>

      {useAdaptiveMenu && menu && typeof document !== "undefined"
        ? createPortal(menu, document.body)
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
