"use client";

import type { ReactNode } from "react";

export type LayoutWorkspace = "personal" | "business";

type TopProps = {
  workspace: LayoutWorkspace;
  workspaceSwitcher?: ReactNode;
  compact?: boolean;
};

/** Stable no-op compatibility components retained only so stale imports build safely. */
export function FiconterTopNavigation({ workspaceSwitcher }: TopProps) {
  return workspaceSwitcher ? <>{workspaceSwitcher}</> : null;
}

export function FiconterSectionTabs() {
  return null;
}

export function FiconterRailNavigation() {
  return null;
}
