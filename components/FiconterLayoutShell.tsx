"use client";

import { useEffect, useMemo, useState } from "react";
import {
  normalizeInterfaceLayout,
  type InterfaceLayoutPreference,
} from "@/lib/interfaceLayout";
import {
  FiconterRailNavigation,
  FiconterSectionTabs,
  FiconterTopNavigation,
  type LayoutWorkspace,
} from "@/components/FiconterLayoutChrome";
import styles from "./FiconterLayoutShell.module.css";

type Props = {
  initialLayout: InterfaceLayoutPreference;
  allowInternalLayouts: boolean;
  workspace: LayoutWorkspace;
  sidebar: React.ReactNode;
  workspaceSwitcher: React.ReactNode;
  mobileDock: React.ReactNode;
  children: React.ReactNode;
};

const INTERNAL_LAYOUTS = new Set<InterfaceLayoutPreference>([
  "executive",
  "rail",
  "bento",
  "floating",
  "top-context",
  "adaptive",
  "horizontal",
  "card-stack",
  "split-analytics",
]);

function clampLayout(
  value: string | null | undefined,
  allowInternalLayouts: boolean,
): InterfaceLayoutPreference {
  const normalized = normalizeInterfaceLayout(value);
  if (allowInternalLayouts) return normalized;
  return normalized === "classic" || normalized === "horizon" ? normalized : "horizon";
}

export function FiconterLayoutShell({
  initialLayout,
  allowInternalLayouts,
  workspace,
  sidebar,
  workspaceSwitcher,
  mobileDock,
  children,
}: Props) {
  const [layout, setLayout] = useState<InterfaceLayoutPreference>(() =>
    clampLayout(initialLayout, allowInternalLayouts),
  );
  const [railDrawerOpen, setRailDrawerOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;

    const sync = () => {
      setLayout(clampLayout(root.dataset.layout, allowInternalLayouts));
    };

    sync();

    const observer = new MutationObserver((records) => {
      if (records.some((record) => record.attributeName === "data-layout")) sync();
    });

    observer.observe(root, { attributes: true, attributeFilter: ["data-layout"] });
    window.addEventListener("storage", sync);
    window.addEventListener("ficonter:preferences-updated", sync as EventListener);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", sync);
      window.removeEventListener("ficonter:preferences-updated", sync as EventListener);
    };
  }, [allowInternalLayouts]);

  const isInternal = INTERNAL_LAYOUTS.has(layout);
  const mainClassName = useMemo(
    () => `app-main ${styles.main} ${isInternal ? styles.experimentalMain : ""}`,
    [isInternal],
  );

  if (layout === "classic" || layout === "horizon") {
    return (
      <div className="app-shell" data-ficonter-layout-shell={layout}>
        {sidebar}
        <main className="app-main">
          {workspaceSwitcher}
          {children}
        </main>
        {mobileDock}
      </div>
    );
  }

  if (layout === "top-context") {
    return (
      <div className={`app-shell ${styles.shell} ${styles.topContextShell}`} data-ficonter-layout-shell={layout}>
        <FiconterTopNavigation workspace={workspace} workspaceSwitcher={workspaceSwitcher} />
        <div className={`${styles.sidebarSlot} ${styles.contextSidebarSlot}`}>{sidebar}</div>
        <main className={mainClassName}>{children}</main>
        {mobileDock}
      </div>
    );
  }

  if (layout === "adaptive") {
    return (
      <div className={`app-shell ${styles.shell} ${styles.adaptiveShell}`} data-ficonter-layout-shell={layout}>
        <div className={styles.sidebarSlot}>{sidebar}</div>
        <main className={mainClassName}>
          <FiconterTopNavigation workspace={workspace} workspaceSwitcher={workspaceSwitcher} compact />
          {children}
        </main>
        {mobileDock}
      </div>
    );
  }

  if (layout === "card-stack") {
    return (
      <div className={`app-shell ${styles.shell} ${styles.cardStackShell}`} data-ficonter-layout-shell={layout}>
        <div className={styles.sidebarSlot}>{sidebar}</div>
        <main className={mainClassName}>
          {workspaceSwitcher}
          <FiconterSectionTabs workspace={workspace} />
          <div className={styles.stackCanvas}>{children}</div>
        </main>
        {mobileDock}
      </div>
    );
  }

  if (layout === "rail" || layout === "horizontal") {
    return (
      <div
        className={`app-shell ${styles.shell} ${styles.railShell} ${layout === "horizontal" ? styles.horizontalShell : ""}`}
        data-ficonter-layout-shell={layout}
      >
        <FiconterRailNavigation
          workspace={workspace}
          drawerOpen={railDrawerOpen}
          onToggleDrawer={() => setRailDrawerOpen((current) => !current)}
        />
        <div
          className={`${styles.railDrawer} ${railDrawerOpen ? styles.railDrawerOpen : ""}`}
          aria-hidden={!railDrawerOpen}
        >
          {sidebar}
        </div>
        {railDrawerOpen ? (
          <button
            type="button"
            className={styles.railBackdrop}
            aria-label="Close navigation"
            onClick={() => setRailDrawerOpen(false)}
          />
        ) : null}
        <main className={mainClassName}>
          {workspaceSwitcher}
          {children}
        </main>
        {mobileDock}
      </div>
    );
  }

  if (layout === "floating") {
    return (
      <div className={`app-shell ${styles.shell} ${styles.floatingShell}`} data-ficonter-layout-shell={layout}>
        <div className={`${styles.sidebarSlot} ${styles.floatingSidebarSlot}`}>{sidebar}</div>
        <main className={`${mainClassName} ${styles.floatingMain}`}>
          {workspaceSwitcher}
          {children}
        </main>
        {mobileDock}
      </div>
    );
  }

  if (layout === "split-analytics") {
    return (
      <div className={`app-shell ${styles.shell} ${styles.splitAnalyticsShell}`} data-ficonter-layout-shell={layout}>
        <div className={styles.sidebarSlot}>{sidebar}</div>
        <main className={mainClassName}>
          {workspaceSwitcher}
          <div className={styles.analyticsCanvas}>{children}</div>
        </main>
        {mobileDock}
      </div>
    );
  }

  return (
    <div
      className={`app-shell ${styles.shell} ${layout === "bento" ? styles.bentoShell : styles.executiveShell}`}
      data-ficonter-layout-shell={layout}
    >
      <div className={styles.sidebarSlot}>{sidebar}</div>
      <main className={mainClassName}>
        {workspaceSwitcher}
        {children}
      </main>
      {mobileDock}
    </div>
  );
}
