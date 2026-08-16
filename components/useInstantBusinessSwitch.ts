"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchActiveBusinessAction } from "@/app/business/actions";

const ACTIVE_BUSINESS_UI_EVENT = "ficonter:active-business-ui";

export type BusinessSwitchUiStatus = "switching" | "committed" | "rollback";

export type BusinessSwitchUiDetail = {
  businessId: string;
  status: BusinessSwitchUiStatus;
  error?: string;
};

export function broadcastInstantBusinessSwitch(detail: BusinessSwitchUiDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<BusinessSwitchUiDetail>(ACTIVE_BUSINESS_UI_EVENT, {
      detail,
    }),
  );
}

function setBusinessSwitchingDocumentState(active: boolean) {
  if (typeof document === "undefined") return;
  if (active) {
    document.documentElement.dataset.ficonterBusinessSwitching = "true";
  } else {
    delete document.documentElement.dataset.ficonterBusinessSwitching;
  }
}

/**
 * Immediate Business-profile switching for every client shell.
 *
 * The selected profile is reflected optimistically across desktop/mobile UI,
 * persisted through the guarded server action, rolled back on failure, then
 * reconciled with server-rendered Business data via a client-side RSC refresh.
 */
export function useInstantBusinessSwitch(
  activeBusinessId: string | null,
  enabled = true,
) {
  const router = useRouter();
  const [optimisticBusinessId, setOptimisticBusinessId] = useState(
    activeBusinessId ?? "",
  );
  const [persisting, setPersisting] = useState(false);
  const [externalSwitchPending, setExternalSwitchPending] = useState(false);
  const [error, setError] = useState("");
  const [refreshPending, startRefreshTransition] = useTransition();

  useEffect(() => {
    setOptimisticBusinessId(activeBusinessId ?? "");
    setExternalSwitchPending(false);
    setError("");
    setBusinessSwitchingDocumentState(false);
  }, [activeBusinessId]);

  useEffect(() => {
    function handleBusinessSwitch(event: Event) {
      const detail = (event as CustomEvent<BusinessSwitchUiDetail>).detail;
      if (!detail || typeof detail.businessId !== "string") return;

      setOptimisticBusinessId(detail.businessId);
      const transitionStillPending = detail.status !== "rollback";
      setExternalSwitchPending(transitionStillPending);
      setBusinessSwitchingDocumentState(transitionStillPending);

      if (detail.status === "rollback") {
        setError(detail.error || "The active business could not be changed.");
      } else {
        setError("");
      }
    }

    window.addEventListener(ACTIVE_BUSINESS_UI_EVENT, handleBusinessSwitch);
    return () =>
      window.removeEventListener(ACTIVE_BUSINESS_UI_EVENT, handleBusinessSwitch);
  }, []);

  const switchBusiness = useCallback(
    async (nextBusinessId: string) => {
      const previousBusinessId = optimisticBusinessId || activeBusinessId || "";

      if (
        !enabled ||
        !nextBusinessId ||
        nextBusinessId === previousBusinessId ||
        persisting ||
        externalSwitchPending ||
        refreshPending
      ) {
        return;
      }

      // Selecting the profile is the confirmation. Reflect it everywhere now.
      setError("");
      setOptimisticBusinessId(nextBusinessId);
      setPersisting(true);
      broadcastInstantBusinessSwitch({
        businessId: nextBusinessId,
        status: "switching",
      });

      try {
        const result = await switchActiveBusinessAction(nextBusinessId);

        if (!result.ok) {
          const message = result.error || "The active business could not be changed.";
          setOptimisticBusinessId(previousBusinessId);
          setError(message);
          broadcastInstantBusinessSwitch({
            businessId: previousBusinessId,
            status: "rollback",
            error: message,
          });
          return;
        }

        broadcastInstantBusinessSwitch({
          businessId: nextBusinessId,
          status: "committed",
        });

        // RSC reconciliation is client-side; it does not reload the browser page.
        startRefreshTransition(() => {
          router.refresh();
        });
      } catch (switchError) {
        const message =
          switchError instanceof Error && switchError.message
            ? switchError.message
            : "The active business could not be changed.";

        setOptimisticBusinessId(previousBusinessId);
        setError(message);
        broadcastInstantBusinessSwitch({
          businessId: previousBusinessId,
          status: "rollback",
          error: message,
        });
      } finally {
        setPersisting(false);
      }
    },
    [
      activeBusinessId,
      enabled,
      externalSwitchPending,
      optimisticBusinessId,
      persisting,
      refreshPending,
      router,
    ],
  );

  return {
    businessId: optimisticBusinessId,
    switchBusiness,
    switching: persisting || externalSwitchPending || refreshPending,
    error,
  };
}
