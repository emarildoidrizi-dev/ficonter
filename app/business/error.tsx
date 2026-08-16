"use client";

import { WorkspaceRouteError } from "@/components/WorkspaceRouteError";

export default function BusinessRouteError({
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
      overviewHref="/business/overview"
    />
  );
}
