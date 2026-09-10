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
      if (deleteDialog) {
        deleteDialog.removeAttribute("data-ficonter-below-selection");
        deleteDialog.removeAttribute("data-ficonter-below-ledger-header");
      }
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

    function findTransactionLedgerHeader() {
      const header = document.querySelector<HTMLElement>(
        ".transaction-ledger-panel > .panel-head",
      );
      if (!header) return null;

      const rect = header.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 ? header : null;
    }

    function positionDeleteDialogBelowLedgerHeader() {
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
      const ledgerHeader = findTransactionLedgerHeader();
      if (!ledgerHeader) return;

      const ledgerHeaderRect = ledgerHeader.getBoundingClientRect();
      const backdropRect = deleteBackdrop.getBoundingClientRect();
      const edgeGap = 12;
      const sectionGap = 10;

      // New mobile rule: the single-transaction delete confirmation belongs
      // directly below the Transaction Ledger header, never below Select all visible.
      // When the header has already scrolled above the visible viewport, keep the
      // confirmation at the top of the currently visible ledger area so the user
      // never needs to scroll around to find it.
      const targetViewportTop = Math.max(
        ledgerHeaderRect.bottom + sectionGap,
        edgeGap,
      );
      const targetViewportCenterX =
        ledgerHeaderRect.left + ledgerHeaderRect.width / 2;

      // A transformed iOS app shell can scale the backdrop's local coordinate
      // system. Convert viewport pixels into that local coordinate system first.
      const scaleX =
        deleteBackdrop.offsetWidth > 0 && backdropRect.width > 0
          ? backdropRect.width / deleteBackdrop.offsetWidth
          : 1;
      const scaleY =
        deleteBackdrop.offsetHeight > 0 && backdropRect.height > 0
          ? backdropRect.height / deleteBackdrop.offsetHeight
          : 1;
      const safeScaleX = Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1;
      const safeScaleY = Number.isFinite(scaleY) && scaleY > 0 ? scaleY : 1;

      let localTop = (targetViewportTop - backdropRect.top) / safeScaleY;
      const localCenterX =
        (targetViewportCenterX - backdropRect.left) / safeScaleX;
      const availableViewportHeight = Math.max(
        72,
        viewportHeight - targetViewportTop - edgeGap,
      );
      const availableLocalHeight = availableViewportHeight / safeScaleY;

      deleteDialog.removeAttribute("data-ficonter-below-selection");
      deleteDialog.setAttribute("data-ficonter-below-ledger-header", "true");
      deleteDialog.style.setProperty("position", "absolute", "important");
      deleteDialog.style.setProperty("top", `${localTop}px`, "important");
      deleteDialog.style.setProperty("left", `${localCenterX}px`, "important");
      deleteDialog.style.setProperty("right", "auto", "important");
      deleteDialog.style.setProperty("bottom", "auto", "important");
      deleteDialog.style.setProperty("transform", "translateX(-50%)", "important");
      deleteDialog.style.setProperty("max-height", `${availableLocalHeight}px`, "important");
      deleteDialog.style.setProperty("overflow-y", "auto", "important");
      deleteDialog.style.setProperty("visibility", "visible", "important");
      deleteDialog.style.setProperty("opacity", "1", "important");
      deleteDialog.style.setProperty("pointer-events", "auto", "important");
      deleteDialog.style.setProperty("transition", "none", "important");

      // Verify the rendered result. If a transformed ancestor leaves the dialog
      // above the requested ledger-header position, push it downward until the
      // rule is satisfied. Never move it upward past the ledger-header anchor.
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const renderedDialogRect = deleteDialog.getBoundingClientRect();
        const shortfall = targetViewportTop - renderedDialogRect.top;
        if (!Number.isFinite(shortfall) || shortfall <= 0.5) break;

        localTop += shortfall / safeScaleY;
        deleteDialog.style.setProperty("top", `${localTop}px`, "important");
      }
    }

    function connectDeleteDialog() {
      if (!singleDeletePending || deleteDialog || !isNativeWorkspace()) return;
      const dialog = findSingleDeleteDialog();
      if (!dialog) return;

      const backdrop = dialog.closest<HTMLElement>('[class*="TransactionLedger_backdrop"]');
      if (!backdrop) return;

      deleteDialog = dialog;
      deleteBackdrop = backdrop;
      positionDeleteDialogBelowLedgerHeader();
      window.requestAnimationFrame(positionDeleteDialogBelowLedgerHeader);
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
      // MutationObserver connects as soon as it mounts and places it directly
      // below the Transaction Ledger header while the background stays locked.
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
    window.addEventListener("resize", positionDeleteDialogBelowLedgerHeader);
    window.visualViewport?.addEventListener(
      "resize",
      positionDeleteDialogBelowLedgerHeader,
    );

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
      window.removeEventListener("resize", positionDeleteDialogBelowLedgerHeader);
      window.visualViewport?.removeEventListener(
        "resize",
        positionDeleteDialogBelowLedgerHeader,
      );
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}
