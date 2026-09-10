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

    function clearSingleDeletePlacement() {
      singleDeletePending = false;
      deleteDialog = null;
      deleteBackdrop = null;
      backdropShiftX = 0;
      backdropShiftY = 0;
      delete document.documentElement.dataset.ficonterTransactionDeleteSelectionAnchor;
      document.documentElement.style.removeProperty("--ficonter-delete-panel-x");
      document.documentElement.style.removeProperty("--ficonter-delete-panel-top");
      document.documentElement.style.removeProperty("--ficonter-delete-panel-max-height");
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

    function positionDeleteDialogBelowSelection() {
      if (!isNativeWorkspace() || !deleteDialog || !deleteBackdrop) return;
      if (!deleteDialog.isConnected || !deleteBackdrop.isConnected) {
        clearSingleDeletePlacement();
        return;
      }

      const selectionBar = document.querySelector<HTMLElement>(
        '[class*="TransactionLedger_selectionBar"]',
      );
      if (!selectionBar) return;

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

      // Native iOS app-shell transforms can create a fixed containing block.
      // Keep the confirmation veil aligned to the currently visible viewport.
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

      const selectionRect = selectionBar.getBoundingClientRect();
      const dialogRect = deleteDialog.getBoundingClientRect();
      const edgeGap = 12;
      const sectionGap = 8;
      const dialogWidth = Math.min(
        dialogRect.width || 420,
        Math.max(1, viewportWidth - edgeGap * 2),
      );
      const halfWidth = dialogWidth / 2;

      const x = Math.min(
        Math.max(selectionRect.left + selectionRect.width / 2, edgeGap + halfWidth),
        Math.max(edgeGap + halfWidth, viewportWidth - edgeGap - halfWidth),
      );

      // The top edge of the delete confirmation starts immediately beneath the
      // Select all visible bar. The dialog itself may scroll internally if a
      // short viewport cannot display all of its content, but the page cannot.
      const requestedTop = selectionRect.bottom + sectionGap;
      const top = Math.min(
        Math.max(requestedTop, edgeGap),
        Math.max(edgeGap, viewportHeight - edgeGap - 120),
      );
      const maxHeight = Math.max(120, viewportHeight - top - edgeGap);

      document.documentElement.style.setProperty(
        "--ficonter-delete-panel-x",
        `${Math.round(x)}px`,
      );
      document.documentElement.style.setProperty(
        "--ficonter-delete-panel-top",
        `${Math.round(top)}px`,
      );
      document.documentElement.style.setProperty(
        "--ficonter-delete-panel-max-height",
        `${Math.round(maxHeight)}px`,
      );
    }

    function connectDeleteDialog() {
      if (!singleDeletePending || deleteDialog || !isNativeWorkspace()) return;
      const dialog = findSingleDeleteDialog();
      if (!dialog) return;

      const backdrop = dialog.closest<HTMLElement>('[class*="TransactionLedger_backdrop"]');
      if (!backdrop) return;

      deleteDialog = dialog;
      deleteBackdrop = backdrop;
      document.documentElement.dataset.ficonterTransactionDeleteSelectionAnchor = "true";
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
      document.documentElement.dataset.ficonterTransactionDeleteSelectionAnchor = "true";

      // React opens the existing delete confirmation from this same click. Once
      // mounted, place it directly below Select all visible and freeze the page.
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
