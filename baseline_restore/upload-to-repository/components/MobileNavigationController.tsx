"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./MobileNavigationController.module.css";

type Props = {
  workspace: "personal" | "business";
};

export function MobileNavigationController({ workspace }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const root = document.documentElement;

    if (open) {
      root.dataset.mobileNavOpen = "true";
    } else {
      delete root.dataset.mobileNavOpen;
    }

    return () => {
      delete root.dataset.mobileNavOpen;
    };
  }, [open]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function handleViewportChange(event: MediaQueryListEvent) {
      if (event.matches) setOpen(false);
    }

    const desktopQuery = window.matchMedia("(min-width: 901px)");
    document.addEventListener("keydown", handleKeyDown);
    desktopQuery.addEventListener("change", handleViewportChange);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      desktopQuery.removeEventListener("change", handleViewportChange);
    };
  }, []);

  const workspaceLabel = workspace === "business" ? "Business" : "Personal";

  return (
    <>
      <header className={styles.mobileBar}>
        <button
          type="button"
          className={styles.menuButton}
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}
          <span>Menu</span>
        </button>
        <strong className={styles.brand}>Ficonter</strong>
        <span className={styles.workspace}>{workspaceLabel}</span>
      </header>

      {open ? (
        <>
          <button
            type="button"
            className={styles.overlay}
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
          <button
            type="button"
            className={styles.drawerClose}
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </>
      ) : null}
    </>
  );
}
