"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { ficonterRealtimeKeys } from "@/lib/ficonterRealtime";

export function RealtimeRefreshBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    function refreshSoon() {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        router.refresh();
        timerRef.current = null;
      }, 120);
    }

    function onCustomEvent() {
      refreshSoon();
    }

    function onStorage(event: StorageEvent) {
      if (event.key === ficonterRealtimeKeys.storage) refreshSoon();
    }

    function onVisibility() {
      if (document.visibilityState === "visible") refreshSoon();
    }

    window.addEventListener("ficonter:data-changed", onCustomEvent);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refreshSoon);
    document.addEventListener("visibilitychange", onVisibility);

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(ficonterRealtimeKeys.channel);
      channel.addEventListener("message", refreshSoon);
    } catch {
      channel = null;
    }

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      window.removeEventListener("ficonter:data-changed", onCustomEvent);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refreshSoon);
      document.removeEventListener("visibilitychange", onVisibility);
      channel?.removeEventListener("message", refreshSoon);
      channel?.close();
    };
  }, [router, pathname]);

  return null;
}
