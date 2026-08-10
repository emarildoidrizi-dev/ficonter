"use client";

import type { ReactNode } from "react";
import {
  normalizeInterfaceLayout,
  type InterfaceLayoutPreference,
} from "@/lib/interfaceLayout";

type Props = {
  initialLayout: InterfaceLayoutPreference;
  allowInternalLayouts?: boolean;
  workspace?: "personal" | "business";
  sidebar: ReactNode;
  workspaceSwitcher: ReactNode;
  mobileDock: ReactNode;
  children: ReactNode;
};

/**
 * Stable compatibility shell after removal of the experimental V24-V27 layouts.
 * Only Classic and Horizon remain valid. This file can be physically deleted
 * once all stale imports/files have been removed from the repository.
 */
export function FiconterLayoutShell({
  initialLayout,
  sidebar,
  workspaceSwitcher,
  mobileDock,
  children,
}: Props) {
  const layout = normalizeInterfaceLayout(initialLayout);

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
