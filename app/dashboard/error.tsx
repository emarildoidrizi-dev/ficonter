"use client";

import { WorkspaceRouteError } from "@/components/WorkspaceRouteError";

export default function DashboardRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <WorkspaceRouteError
      error={error}
      reset={reset}
      overviewHref="/dashboard/overview"
    />
  );
}
