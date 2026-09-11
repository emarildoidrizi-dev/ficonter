"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { requestFiconterNavigationIntent } from "@/lib/navigationRuntime";
import { ArrowRight, Command, LockKeyhole, Search, X } from "lucide-react";
import { FICONTER_COMMANDS } from "@/lib/commandPalette";
import {
  getSubscriptionUpgradeHref,
  subscriptionFeatureForPersonalRoute,
} from "@/lib/subscriptionNavigation";
import {
  hasSubscriptionFeature,
  type SubscriptionPlanCode,
} from "@/lib/subscriptionPlans";
import styles from "./CommandPalette.module.css";

export type CommandPaletteSearchResult = {
  id: string;
  label: string;
  description: string;
  href: string;
  group: string;
  keywords: string[];
};

type Props = {
  subscriptionPlanCode?: SubscriptionPlanCode;
  privateResults?: CommandPaletteSearchResult[];
  privateSearchStatus?: "available" | "locked" | "loading";
  browserOnly?: boolean;
};

function isBrowserPlatform() {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.ficonterDisplayMode === "browser";
}

function matchesQuery(result: CommandPaletteSearchResult, normalized: string) {
  return [result.label, result.description, result.group, ...result.keywords]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function CommandPalette({
  subscriptionPlanCode,
  privateResults = [],
  privateSearchStatus = "available",
  browserOnly = false,
}: Props = {}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const commands: CommandPaletteSearchResult[] = FICONTER_COMMANDS;

    if (!normalized) return commands;

    const matchingCommands = commands.filter((command) =>
      matchesQuery(command, normalized),
    );

    if (normalized.length < 2) return matchingCommands;

    const matchingPrivate = privateResults
      .filter((result) => matchesQuery(result, normalized))
      .slice(0, 14);

    return [...matchingCommands, ...matchingPrivate];
  }, [privateResults, query]);

  useEffect(() => {
    function canOpen() {
      return !browserOnly || isBrowserPlatform();
    }

    function openPalette() {
      if (!canOpen()) return;
      setOpen(true);
    }

    function handleKeydown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        if (!canOpen()) return;
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
  }, [browserOnly]);

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

  function resolveTarget(result: CommandPaletteSearchResult) {
    if (!subscriptionPlanCode) return { href: result.href, locked: false };
    const feature = subscriptionFeatureForPersonalRoute(result.href);
    const locked = Boolean(
      feature && !hasSubscriptionFeature(subscriptionPlanCode, feature),
    );
    return {
      href: locked && feature ? getSubscriptionUpgradeHref(feature) : result.href,
      locked,
    };
  }

  function select(result: CommandPaletteSearchResult) {
    setOpen(false);
    const target = resolveTarget(result);
    const current = `${window.location.pathname}${window.location.search}`;
    if (!requestFiconterNavigationIntent(target.href, current)) return;
    router.push(target.href, { scroll: false });
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
      const result = filtered[activeIndex];
      if (result) select(result);
    }
  }

  if (!open) return null;

  const normalizedQuery = query.trim();
  const showPrivateStatus = Boolean(normalizedQuery.length >= 2 && privateResults.length === 0);

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={() => setOpen(false)}>
      <section
        className={styles.palette}
        role="dialog"
        aria-modal="true"
        aria-label="Search anything in FICONTER"
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
            placeholder="Search anything in FICONTER"
            aria-label="Search FICONTER"
          />
          <button type="button" onClick={() => setOpen(false)} aria-label="Close search">
            <X size={18} />
          </button>
        </header>

        <div className={styles.results} onKeyDown={handleListKeydown}>
          {filtered.length ? filtered.map((result, index) => {
            const previousGroup = index > 0 ? filtered[index - 1]?.group : null;
            const showGroup = result.group !== previousGroup;
            const target = resolveTarget(result);
            const isPrivateRecord = result.id.startsWith("transaction:") || result.id.startsWith("bill:");
            return (
              <div key={result.id}>
                {showGroup ? <p className={styles.group}>{result.group}</p> : null}
                <button
                  type="button"
                  className={`${styles.result} ${index === activeIndex ? styles.active : ""}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => select(result)}
                  aria-label={target.locked ? `${result.label} — upgrade required` : undefined}
                >
                  <span className={styles.commandIcon} data-private={isPrivateRecord ? "true" : "false"}>
                    {target.locked ? <LockKeyhole size={15} /> : <Command size={15} />}
                  </span>
                  <span>
                    <strong>{result.label}</strong>
                    <small>{result.description}</small>
                  </span>
                  {target.locked ? <LockKeyhole size={15} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
                </button>
              </div>
            );
          }) : (
            <div className={styles.empty}>No matching FICONTER result was found.</div>
          )}

          {showPrivateStatus && privateSearchStatus === "locked" ? (
            <div className={styles.privateNotice}>
              <LockKeyhole size={14} aria-hidden="true" />
              Unlock your Financial Vault to include private Transactions and Bills in this search.
            </div>
          ) : null}
          {showPrivateStatus && privateSearchStatus === "loading" ? (
            <div className={styles.privateNotice}>
              <Search size={14} aria-hidden="true" />
              Loading encrypted financial records for private search…
            </div>
          ) : null}
        </div>

        <footer className={styles.footer}>
          <span className={styles.scope}>FICONTER only · no web search</span>
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Open</span>
          <span><kbd>Esc</kbd> Close</span>
        </footer>
      </section>
    </div>
  );
}
