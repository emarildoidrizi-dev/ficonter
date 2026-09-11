"use client";

import { Music2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import styles from "./OwnerMusicAppLauncher.module.css";

type Position = { x: number; y: number };
type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

const STORAGE_KEY = "ficonter:owner-music-floating-position";
const SIZE = 50;
const EDGE = 10;
const TOP_GUARD = 86;
const BOTTOM_GUARD = 104;
const DRAG_THRESHOLD = 6;

function isInstalledApp() {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  return (
    root.dataset.ficonterDisplayMode === "standalone" &&
    root.dataset.ficonterNativeApp === "true"
  );
}

function bounds() {
  const width = Math.max(1, window.visualViewport?.width ?? window.innerWidth);
  const height = Math.max(1, window.visualViewport?.height ?? window.innerHeight);
  return {
    minX: EDGE,
    maxX: Math.max(EDGE, width - SIZE - EDGE),
    minY: TOP_GUARD,
    maxY: Math.max(TOP_GUARD, height - SIZE - BOTTOM_GUARD),
  };
}

function clamp(position: Position): Position {
  const limit = bounds();
  return {
    x: Math.min(limit.maxX, Math.max(limit.minX, position.x)),
    y: Math.min(limit.maxY, Math.max(limit.minY, position.y)),
  };
}

function defaultPosition(): Position {
  const limit = bounds();
  return {
    x: limit.maxX,
    y: Math.min(limit.maxY, Math.max(limit.minY, window.innerHeight * 0.56)),
  };
}

function readStoredPosition(): Position | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Position>;
    if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return null;
    return clamp({ x: Number(parsed.x), y: Number(parsed.y) });
  } catch {
    return null;
  }
}

function persistPosition(position: Position) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  } catch {
    // Position persistence is optional; the launcher remains fully usable.
  }
}

export function OwnerMusicAppLauncher() {
  const [appMode, setAppMode] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const synchronizeMode = useCallback(() => {
    const installed = isInstalledApp();
    setAppMode(installed);
    if (installed) {
      setPosition((current) => clamp(current ?? readStoredPosition() ?? defaultPosition()));
    }
  }, []);

  useEffect(() => {
    synchronizeMode();
    const root = document.documentElement;
    const observer = new MutationObserver(synchronizeMode);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-ficonter-display-mode", "data-ficonter-native-app", "data-ficonter-device"],
    });
    window.addEventListener("resize", synchronizeMode);
    window.addEventListener("orientationchange", synchronizeMode);
    window.visualViewport?.addEventListener("resize", synchronizeMode);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", synchronizeMode);
      window.removeEventListener("orientationchange", synchronizeMode);
      window.visualViewport?.removeEventListener("resize", synchronizeMode);
    };
  }, [synchronizeMode]);

  function openMusic() {
    window.dispatchEvent(new Event("ficonter:owner-music-open"));
  }

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (!position) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD) drag.moved = true;
    if (!drag.moved) return;
    event.preventDefault();
    setPosition(clamp({ x: drag.originX + dx, y: drag.originY + dy }));
  }

  function finishPointer(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (buttonRef.current?.hasPointerCapture(event.pointerId)) {
      buttonRef.current.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    if (drag.moved) {
      if (position) persistPosition(position);
      return;
    }
    openMusic();
  }

  if (!appMode || !position) return null;

  return (
    <button
      ref={buttonRef}
      type="button"
      className={styles.launcher}
      style={{ left: position.x, top: position.y }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={(event) => {
        const drag = dragRef.current;
        if (drag?.pointerId === event.pointerId) dragRef.current = null;
      }}
      aria-label="Open Owner Music. Drag to move."
      title="Owner Music · drag to move"
    >
      <Music2 size={21} aria-hidden="true" />
      <span className={styles.dragDot} aria-hidden="true" />
    </button>
  );
}
