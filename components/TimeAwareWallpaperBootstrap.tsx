"use client";

import { useLayoutEffect } from "react";
import {
  daypartForDate,
  millisecondsUntilNextDaypart,
} from "@/lib/daypart";

type Props = {
  enabled: boolean;
  accessEnabled?: boolean;
};

/**
 * Keeps the photographic background on the same local-time boundaries as the
 * dashboard greeting. Paid plans can receive the fixed/automatic wallpaper;
 * Free receives no photographic wallpaper at all.
 */
export function TimeAwareWallpaperBootstrap({
  enabled,
  accessEnabled = true,
}: Props) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    let timer: number | null = null;

    const apply = () => {
      const daypart = daypartForDate();

      if (!accessEnabled) {
        delete root.dataset.wallpaperSchedule;
        delete root.dataset.wallpaperDaypart;
        root.dataset.backgroundMotion = "off";
      } else {
        root.dataset.wallpaperSchedule = enabled ? "automatic" : "fixed";
        root.dataset.wallpaperDaypart = enabled ? daypart : "fixed";
        root.dataset.backgroundMotion = "static";
      }

      window.dispatchEvent(
        new CustomEvent("ficonter:daypart-updated", {
          detail: { daypart },
        }),
      );

      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(apply, millisecondsUntilNextDaypart());
    };

    apply();
    const handlePreferencesUpdated = () => apply();
    document.addEventListener("visibilitychange", apply);
    window.addEventListener("focus", apply);
    window.addEventListener(
      "ficonter:preferences-updated",
      handlePreferencesUpdated,
    );

    return () => {
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", apply);
      window.removeEventListener("focus", apply);
      window.removeEventListener(
        "ficonter:preferences-updated",
        handlePreferencesUpdated,
      );
    };
  }, [accessEnabled, enabled]);

  return null;
}
