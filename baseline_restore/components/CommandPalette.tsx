"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Command, Search, X } from "lucide-react";
import { FICONTER_COMMANDS } from "@/lib/commandPalette";
import styles from "./CommandPalette.module.css";

export function CommandPalette() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return FICONTER_COMMANDS;
    return FICONTER_COMMANDS.filter((command) =>
      [command.label, command.description, command.group, ...command.keywords]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [query]);

  useEffect(() => {
    function openPalette() {
      setOpen(true);
    }

    function handleKeydown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("ficonter:open-command-palette", openPalette);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("ficonter:open-command-palette", openPalette);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(0);
  }, [activeIndex, filtered.length]);

  function select(href: string) {
    setOpen(false);
    router.push(href);
  }

  function handleListKeydown(event: ReactKeyboardEvent<HTMLElement>) {
    if (!filtered.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % filtered.length);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + filtered.length) % filtered.length);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      select(filtered[activeIndex]?.href ?? "/dashboard");
    }
  }

  if (!open) return null;

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={() => setOpen(false)}>
      <section
        className={styles.palette}
        role="dialog"
        aria-modal="true"
        aria-label="FICONTER command search"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <Search size={19} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleListKeydown}
            placeholder="Search FICONTER or choose an action"
            aria-label="Search commands"
          />
          <button type="button" onClick={() => setOpen(false)} aria-label="Close command palette">
            <X size={18} />
          </button>
        </header>

        <div className={styles.results} onKeyDown={handleListKeydown}>
          {filtered.length ? filtered.map((command, index) => {
            const previousGroup = index > 0 ? filtered[index - 1]?.group : null;
            const showGroup = command.group !== previousGroup;
            return (
              <div key={command.id}>
                {showGroup ? <p className={styles.group}>{command.group}</p> : null}
                <button
                  type="button"
                  className={`${styles.result} ${index === activeIndex ? styles.active : ""}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => select(command.href)}
                >
                  <span className={styles.commandIcon}><Command size={15} /></span>
                  <span>
                    <strong>{command.label}</strong>
                    <small>{command.description}</small>
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            );
          }) : (
            <div className={styles.empty}>No matching FICONTER action was found.</div>
          )}
        </div>

        <footer className={styles.footer}>
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Open</span>
          <span><kbd>Esc</kbd> Close</span>
        </footer>
      </section>
    </div>
  );
}
