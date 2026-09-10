"use client";

import { useEffect } from "react";

function isDisabled(element: HTMLElement): boolean {
  return (
    element.getAttribute("aria-disabled") === "true" ||
    ("disabled" in element && Boolean((element as HTMLButtonElement).disabled))
  );
}

function topmostDialog(): HTMLElement | null {
  const dialogs = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[role="alertdialog"], [role="dialog"][aria-modal="true"]',
    ),
  ).filter((dialog) => dialog.offsetParent !== null);

  return dialogs.at(-1) ?? null;
}

export function KeyboardInteractionBridge() {
  useEffect(() => {
    let singleDeletePending = false;
    let deleteDialog: HTMLElement | null = null;
    let deleteBackdrop: HTMLElement | null = null;
    let connectTimer = 0;

    function isNativeWorkspace() {
      return document.documentElement.dataset.ficonterNativeApp === "true";
    }

    function isSingleTransactionDeleteDialog(dialog: HTMLElement) {
      return (
        dialog.getAttribute("role") === "alertdialog" &&
        dialog.getAttribute("aria-labelledby") !== "bulk-delete-title" &&
        Boolean(dialog.closest('[class*="TransactionLedger_backdrop"]'))
      );
    }

    function clearSingleDeletePlacement() {
      singleDeletePending = false;
      deleteDialog = null;
      deleteBackdrop = null;
      if (connectTimer) {
        window.clearTimeout(connectTimer);
        connectTimer = 0;
      }
    }

    function findSingleDeleteDialog() {
      return (
        Array.from(document.querySelectorAll<HTMLElement>('[role="alertdialog"]')).find(
          isSingleTransactionDeleteDialog,
        ) ?? null
      );
    }

    function findVisibleSelectionBar(viewportHeight: number) {
      const bars = Array.from(
        document.querySelectorAll<HTMLElement>('[class*="TransactionLedger_selectionBar"]'),
      ).filter((bar) => {
        const rect = bar.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });

      return (
        bars.find((bar) => {
          const rect = bar.getBoundingClientRect();
          return rect.bottom > 0 && rect.top < viewportHeight;
        }) ??
        bars[0] ??
        null
      );
    }

    function positionDeleteDialogBelowSelection() {
      if (!isNativeWorkspace() || !deleteDialog || !deleteBackdrop) return;
      if (!deleteDialog.isConnected || !deleteBackdrop.isConnected) {
        clearSingleDeletePlacement();
        return;
      }

      const viewportHeight = Math.max(
        1,
        window.visualViewport?.height ??
          document.documentElement.clientHeight ??
          window.innerHeight,
      );
      const selectionBar = findVisibleSelectionBar(viewportHeight);
      if (!selectionBar) return;

      const selectionRect = selectionBar.getBoundingClientRect();
      const backdropRect = deleteBackdrop.getBoundingClientRect();
      const edgeGap = 12;
      const sectionGap = 8;

      // The backdrop may live inside an iOS/transformed app container. Position
      // the dialog in the backdrop's own coordinate space so its rendered top
      // edge is always the real bottom edge of Select all visible + the gap.
      const targetViewportTop = selectionRect.bottom + sectionGap;
      const targetViewportCenterX = selectionRect.left + selectionRect.width / 2;
      const localTop = targetViewportTop - backdropRect.top;
      const localCenterX = targetViewportCenterX - backdropRect.left;
      const availableHeight = Math.max(120, viewportHeight - targetViewportTop - edgeGap);

      deleteDialog.style.setProperty("position", "absolute", "important");
      deleteDialog.style.setProperty("top", `${Math.round(localTop)}px`, "important");
      deleteDialog.style.setProperty("left", `${Math.round(localCenterX)}px`, "important");
      deleteDialog.style.setProperty("right", "auto", "important");
      deleteDialog.style.setProperty("bottom", "auto", "important");
      deleteDialog.style.setProperty("transform", "translateX(-50%)", "important");
      deleteDialog.style.setProperty("max-height", `${Math.round(availableHeight)}px`, "important");
      deleteDialog.style.setProperty("overflow-y", "auto", "important");
      deleteDialog.style.setProperty("visibility", "visible", "important");
      deleteDialog.style.setProperty("opacity", "1", "important");
      deleteDialog.style.setProperty("pointer-events", "auto", "important");
      deleteDialog.style.setProperty("transition", "none", "important");
    }

    function connectDeleteDialog() {
      if (!singleDeletePending || deleteDialog || !isNativeWorkspace()) return;
      const dialog = findSingleDeleteDialog();
      if (!dialog) return;

      const backdrop = dialog.closest<HTMLElement>('[class*="TransactionLedger_backdrop"]');
      if (!backdrop) return;

      deleteDialog = dialog;
      deleteBackdrop = backdrop;
      positionDeleteDialogBelowSelection();
      window.requestAnimationFrame(positionDeleteDialogBelowSelection);
    }

    function handleDocumentClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element) || !isNativeWorkspace()) return;

      const deleteButton = target.closest<HTMLElement>(
        'button[aria-label="Delete transaction"]',
      );
      if (!deleteButton) return;

      clearSingleDeletePlacement();
      singleDeletePending = true;

      // React opens the existing delete confirmation from this same click. The
      // MutationObserver connects as soon as it mounts and places its top edge
      // directly below Select all visible before the next visual frame.
      window.requestAnimationFrame(connectDeleteDialog);
      connectTimer = window.setTimeout(() => {
        connectTimer = 0;
        if (!deleteDialog) clearSingleDeletePlacement();
      }, 1200);
    }

    function preventBackgroundScroll(event: Event) {
      if (!deleteDialog || !deleteBackdrop) return;
      const target = event.target;
      if (target instanceof Node && deleteDialog.contains(target)) return;
      event.preventDefault();
    }

    const observer = new MutationObserver(() => {
      if (deleteDialog && !deleteDialog.isConnected) {
        clearSingleDeletePlacement();
        return;
      }
      if (singleDeletePending && !deleteDialog) connectDeleteDialog();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", handleDocumentClick, true);
    document.addEventListener("touchmove", preventBackgroundScroll, {
      capture: true,
      passive: false,
    });
    document.addEventListener("wheel", preventBackgroundScroll, {
      capture: true,
      passive: false,
    });
    window.addEventListener("resize", positionDeleteDialogBelowSelection);
    window.visualViewport?.addEventListener("resize", positionDeleteDialogBelowSelection);

    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key !== "Enter" ||
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      if (
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        return;
      }

      // Native controls already implement Enter correctly. Leaving them alone
      // prevents duplicate submissions and preserves browser accessibility.
      if (
        target.closest(
          'button, a[href], select, summary, input[type="button"], input[type="submit"], input[type="reset"], input[type="checkbox"], input[type="radio"]',
        )
      ) {
        return;
      }

      const roleButton = target.closest<HTMLElement>('[role="button"]');
      if (roleButton && !isDisabled(roleButton)) {
        event.preventDefault();
        roleButton.click();
        return;
      }

      const form = target.closest<HTMLFormElement>("form");
      if (form) {
        // Browsers normally submit forms from single-line inputs. Only provide
        // a fallback when the form has no native submit control.
        const nativeSubmit = form.querySelector<HTMLElement>(
          'button[type="submit"], input[type="submit"], button:not([type])',
        );
        if (!nativeSubmit) {
          event.preventDefault();
          form.requestSubmit();
        }
        return;
      }

      const dialog =
        target.closest<HTMLElement>(
          '[role="alertdialog"], [role="dialog"][aria-modal="true"]',
        ) ?? topmostDialog();
      if (!dialog) return;

      const confirm = dialog.querySelector<HTMLElement>(
        '[data-enter-confirm="true"], button[type="submit"], [data-primary-action="true"]',
      );
      if (!confirm || isDisabled(confirm)) return;

      event.preventDefault();
      confirm.click();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      clearSingleDeletePlacement();
      observer.disconnect();
      document.removeEventListener("click", handleDocumentClick, true);
      document.removeEventListener("touchmove", preventBackgroundScroll, true);
      document.removeEventListener("wheel", preventBackgroundScroll, true);
      window.removeEventListener("resize", positionDeleteDialogBelowSelection);
      window.visualViewport?.removeEventListener("resize", positionDeleteDialogBelowSelection);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}
