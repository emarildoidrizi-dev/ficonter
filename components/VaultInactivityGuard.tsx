"use client";

import { useEffect, useRef } from "react";
import { useVault } from "@/components/VaultProvider";

const VAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export function VaultInactivityGuard() {
  const { status, lockVault } = useVault();
  const lastActivityAt = useRef(Date.now());

  useEffect(() => {
    if (status !== "unlocked") return;

    lastActivityAt.current = Date.now();
    let timer: number | null = null;

    const clearTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const scheduleLock = () => {
      clearTimer();
      const elapsed = Date.now() - lastActivityAt.current;
      const remaining = Math.max(0, VAULT_IDLE_TIMEOUT_MS - elapsed);
      timer = window.setTimeout(() => {
        const idleFor = Date.now() - lastActivityAt.current;
        if (idleFor >= VAULT_IDLE_TIMEOUT_MS) {
          lockVault();
          return;
        }
        scheduleLock();
      }, remaining);
    };

    const recordActivity = () => {
      lastActivityAt.current = Date.now();
      scheduleLock();
    };

    const checkVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const idleFor = Date.now() - lastActivityAt.current;
      if (idleFor >= VAULT_IDLE_TIMEOUT_MS) {
        lockVault();
        return;
      }
      scheduleLock();
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, recordActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", checkVisibility);
    scheduleLock();

    return () => {
      clearTimer();
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, recordActivity);
      });
      document.removeEventListener("visibilitychange", checkVisibility);
    };
  }, [lockVault, status]);

  return null;
}
