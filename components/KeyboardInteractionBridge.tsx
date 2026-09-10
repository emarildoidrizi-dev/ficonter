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

type DeleteAnchor = {
  x: number;
  y: number;
};

export function KeyboardInteractionBridge() {
  useEffect(() => {
    let deleteAnchor: DeleteAnchor | null = null;
    let deleteDialog: HTMLElement | null = null;
    let deleteBackdrop: HTMLElement | null = null;
    let connectTimer = 0;
    let backdropShiftX = 0;
    let backdropShiftY = 0;

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

    function clearDeleteAnchor() {
      deleteAnchor = null;
      deleteDialog = null;
      deleteBackdrop = null;
      backdropShiftX = 0;
      backdropShiftY = 0;
      delete document.documentElement.dataset.ficonterTransactionDeleteAnchor;
      document.documentElement.style.removeProperty("--ficonter-delete-anchor-x");
      document.documentElement.style.removeProperty("--ficonter-delete-anchor-y");
      document.documentElement.style.removeProperty("--ficonter-delete-backdrop-shift-x");
      document.documentElement.style.removeProperty("--ficonter-delete-backdrop-shift-y");
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

    function positionDeleteDialog() {
      if (!isNativeWorkspace() || !deleteAnchor || !deleteDialog || !deleteBackdrop) {
        return;
      }
      if (!deleteDialog.isConnected || !deleteBackdrop.isConnected) {
        clearDeleteAnchor();
        return;
      }

      const viewportWidth = Math.max(
        1,
        window.visualViewport?.width ??
          document.documentElement.clientWidth ??
          window.innerWidth,
      );
      const viewportHeight = Math.max(
        1,
        window.visualViewport?.height ??
          document.documentElement.clientHeight ??
          window.innerHeight,
      );

      // A fixed element can still be scoped by a transformed app ancestor on iOS.
      // Preserve the accumulated compensation instead of recomputing from a
      // backdrop that has already been shifted into place on a later frame.
      const backdropRect = deleteBackdrop.getBoundingClientRect();
      backdropShiftX -= backdropRect.left;
      backdropShiftY -= backdropRect.top;

      document.documentElement.style.setProperty(
        "--ficonter-delete-backdrop-shift-x",
        `${Math.round(backdropShiftX)}px`,
      );
      document.documentElement.style.setProperty(
        "--ficonter-delete-backdrop-shift-y",
        `${Math.round(backdropShiftY)}px`,
      );

      const dialogRect = deleteDialog.getBoundingClientRect();
      const dialogWidth = Math.min(
        dialogRect.width || 420,
        Math.max(1, viewportWidth - 24),
      );
      const dialogHeight = Math.min(
        dialogRect.height || 300,
        Math.max(1, viewportHeight - 24),
      );
      const edgeGap = 12;
      const halfWidth = dialogWidth / 2;
      const halfHeight = dialogHeight / 2;

      // Keep the entire confirmation visible, but otherwise put its centre on
      // the transaction row the user just acted on. This guarantees the dialog
      // covers that transaction instead of appearing somewhere else on the page.
      const x = Math.min(
        Math.max(deleteAnchor.x, edgeGap + halfWidth),
        Math.max(edgeGap + halfWidth, viewportWidth - edgeGap - halfWidth),
      );
      const y = Math.min(
        Math.max(deleteAnchor.y, edgeGap + halfHeight),
        Math.max(edgeGap + halfHeight, viewportHeight - edgeGap - halfHeight),
      );

      document.documentElement.style.setProperty(
        "--ficonter-delete-anchor-x",
        `${Math.round(x)}px`,
      );
      document.documentElement.style.setProperty(
        "--ficonter-delete-anchor-y",
        `${Math.round(y)}px`,
      );
    }

    function connectDeleteDialog() {
      if (!deleteAnchor || deleteDialog || !isNativeWorkspace()) return;
      const dialog = findSingleDeleteDialog();
      if (!dialog) return;

      const backdrop = dialog.closest<HTMLElement>('[class*="TransactionLedger_backdrop"]');
      if (!backdrop) return;

      deleteDialog = dialog;
      deleteBackdrop = backdrop;
      document.documentElement.dataset.ficonterTransactionDeleteAnchor = "true";
      positionDeleteDialog();
      window.requestAnimationFrame(positionDeleteDialog);
    }

    function handleDocumentClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element) || !isNativeWorkspace()) return;

      const deleteButton = target.closest<HTMLElement>(
        'button[aria-label="Delete transaction"]',
      );
      if (deleteButton) {
        const row =
          deleteButton.closest<HTMLElement>('[class*="TransactionLedger_row"]') ??
          deleteButton.closest<HTMLElement>("article") ??
          deleteButton;
        const rect = row.getBoundingClientRect();

        clearDeleteAnchor();
        deleteAnchor = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };

        // Seed the exact visible row position before React mounts the dialog.
        // The MutationObserver below then measures/clamps it before paint.
        document.documentElement.style.setProperty(
          "--ficonter-delete-anchor-x",
          `${Math.round(deleteAnchor.x)}px`,
        );
        document.documentElement.style.setProperty(
          "--ficonter-delete-anchor-y",
          `${Math.round(deleteAnchor.y)}px`,
        );
        document.documentElement.dataset.ficonterTransactionDeleteAnchor = "true";

        window.requestAnimationFrame(connectDeleteDialog);
        connectTimer = window.setTimeout(() => {
          connectTimer = 0;
          if (!deleteDialog) clearDeleteAnchor();
        }, 1200);
      }
    }

    function preventBackgroundScroll(event: Event) {
      if (!deleteDialog || !deleteBackdrop) return;
      const target = event.target;
      if (target instanceof Node && deleteDialog.contains(target)) return;
      event.preventDefault();
    }

    const observer = new MutationObserver(() => {
      if (deleteDialog && !deleteDialog.isConnected) {
        clearDeleteAnchor();
        return;
      }
      if (deleteAnchor && !deleteDialog) connectDeleteDialog();
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
    window.addEventListener("resize", positionDeleteDialog);
    window.visualViewport?.addEventListener("resize", positionDeleteDialog);

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
      clearDeleteAnchor();
      observer.disconnect();
      document.removeEventListener("click", handleDocumentClick, true);
      document.removeEventListener("touchmove", preventBackgroundScroll, true);
      document.removeEventListener("wheel", preventBackgroundScroll, true);
      window.removeEventListener("resize", positionDeleteDialog);
      window.visualViewport?.removeEventListener("resize", positionDeleteDialog);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}
