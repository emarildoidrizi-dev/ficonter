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
    let anchoredDialog: HTMLElement | null = null;
    let connectTimeout = 0;
    let scrollLocked = false;

    function isNativeWorkspace() {
      return document.documentElement.dataset.ficonterNativeApp === "true";
    }

    function lockTransactionDeleteScroll() {
      if (scrollLocked || !isNativeWorkspace()) return;
      document.documentElement.dataset.ficonterTransactionDeleteLocked = "true";
      scrollLocked = true;
    }

    function unlockTransactionDeleteScroll() {
      if (!scrollLocked) return;
      delete document.documentElement.dataset.ficonterTransactionDeleteLocked;
      scrollLocked = false;
    }

    function clearDialogPresentation(dialog: HTMLElement | null) {
      if (!dialog) return;
      dialog.removeAttribute("data-ficonter-transaction-anchor");
      dialog.style.removeProperty("--ficonter-anchor-left");
      dialog.style.removeProperty("--ficonter-anchor-top");
      dialog.style.removeProperty("visibility");
      dialog.style.removeProperty("opacity");
    }

    function releaseTransactionDelete() {
      if (connectTimeout) {
        window.clearTimeout(connectTimeout);
        connectTimeout = 0;
      }
      clearDialogPresentation(anchoredDialog);
      anchoredDialog = null;
      deleteAnchor = null;
      unlockTransactionDeleteScroll();
    }

    function findTransactionDeleteDialog(): HTMLElement | null {
      const dialogs = Array.from(
        document.querySelectorAll<HTMLElement>('[role="alertdialog"]'),
      );

      return (
        dialogs.find((dialog) => {
          if (dialog.getAttribute("aria-labelledby") === "bulk-delete-title") {
            return false;
          }
          const confirm = dialog.querySelector<HTMLElement>(
            '[data-enter-confirm="true"]',
          );
          return confirm?.textContent?.trim() === "Delete transaction";
        }) ?? null
      );
    }

    function positionTransactionDeleteDialog() {
      if (!isNativeWorkspace() || !deleteAnchor || !anchoredDialog) return;
      if (!anchoredDialog.isConnected) {
        releaseTransactionDelete();
        return;
      }

      const viewportWidth = Math.max(
        1,
        window.visualViewport?.width ??
          window.innerWidth ??
          document.documentElement.clientWidth,
      );
      const viewportHeight = Math.max(
        1,
        window.visualViewport?.height ??
          window.innerHeight ??
          document.documentElement.clientHeight,
      );
      const edgeGap = 12;
      const bottomChromeAllowance = 92;

      anchoredDialog.setAttribute("data-ficonter-transaction-anchor", "true");
      anchoredDialog.style.visibility = "visible";
      anchoredDialog.style.opacity = "1";

      const dialogRect = anchoredDialog.getBoundingClientRect();
      const dialogWidth = Math.min(
        dialogRect.width || 420,
        Math.max(1, viewportWidth - edgeGap * 2),
      );
      const dialogHeight = Math.min(
        dialogRect.height || 300,
        Math.max(1, viewportHeight - edgeGap * 2),
      );
      const halfWidth = dialogWidth / 2;
      const halfHeight = dialogHeight / 2;

      const minX = edgeGap + halfWidth;
      const maxX = Math.max(minX, viewportWidth - edgeGap - halfWidth);
      const minY = edgeGap + halfHeight;
      const maxY = Math.max(
        minY,
        viewportHeight - bottomChromeAllowance - halfHeight,
      );

      const left = Math.min(maxX, Math.max(minX, deleteAnchor.x));
      const top = Math.min(maxY, Math.max(minY, deleteAnchor.y));

      anchoredDialog.style.setProperty(
        "--ficonter-anchor-left",
        `${Math.round(left)}px`,
      );
      anchoredDialog.style.setProperty(
        "--ficonter-anchor-top",
        `${Math.round(top)}px`,
      );
    }

    function connectTransactionDeleteDialog() {
      if (!deleteAnchor || anchoredDialog || !isNativeWorkspace()) return;
      const dialog = findTransactionDeleteDialog();
      if (!dialog) return;

      // React has now rendered the confirmation. Only at this point do we
      // freeze the workspace. Locking earlier during the originating click can
      // interrupt iOS click dispatch and prevent the dialog from rendering.
      anchoredDialog = dialog;
      positionTransactionDeleteDialog();
      lockTransactionDeleteScroll();

      // Re-measure once after the modal lock has been applied so any small
      // viewport/layout adjustment cannot move the confirmation off its source.
      window.requestAnimationFrame(positionTransactionDeleteDialog);
    }

    function scheduleTransactionDeleteConnect() {
      window.requestAnimationFrame(() => {
        connectTransactionDeleteDialog();
        if (!anchoredDialog) {
          window.requestAnimationFrame(connectTransactionDeleteDialog);
        }
      });

      if (connectTimeout) window.clearTimeout(connectTimeout);
      connectTimeout = window.setTimeout(() => {
        connectTimeout = 0;
        // Never hide a confirmation if anchoring fails. The base CSS keeps the
        // dialog centered as a safe fallback; only discard the pending anchor.
        if (!anchoredDialog) deleteAnchor = null;
      }, 1500);
    }

    function handleDocumentClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const deleteButton = target.closest<HTMLElement>(
        'button[aria-label="Delete transaction"]',
      );
      if (deleteButton && isNativeWorkspace()) {
        const row =
          deleteButton.closest<HTMLElement>('[class*="TransactionLedger_row"]') ??
          deleteButton.closest<HTMLElement>("article") ??
          deleteButton;
        const rect = row.getBoundingClientRect();

        clearDialogPresentation(anchoredDialog);
        anchoredDialog = null;
        deleteAnchor = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };

        // Important: do not lock scrolling here. This listener runs in the
        // capture phase, before TransactionLedger's React onClick. We only
        // capture the position and allow the React click to open the dialog.
        scheduleTransactionDeleteConnect();
        return;
      }

      if (anchoredDialog && anchoredDialog.contains(target)) {
        window.requestAnimationFrame(() => {
          if (anchoredDialog && !anchoredDialog.isConnected) {
            releaseTransactionDelete();
          }
        });
      }
    }

    function preventBackgroundScroll(event: Event) {
      if (!scrollLocked) return;
      const target = event.target;
      if (
        anchoredDialog &&
        target instanceof Node &&
        anchoredDialog.contains(target)
      ) {
        return;
      }
      event.preventDefault();
    }

    const dialogObserver = new MutationObserver(() => {
      if (anchoredDialog && !anchoredDialog.isConnected) {
        releaseTransactionDelete();
        return;
      }
      if (deleteAnchor && !anchoredDialog) connectTransactionDeleteDialog();
    });

    dialogObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    document.addEventListener("click", handleDocumentClick, true);
    document.addEventListener("touchmove", preventBackgroundScroll, {
      capture: true,
      passive: false,
    });
    document.addEventListener("wheel", preventBackgroundScroll, {
      capture: true,
      passive: false,
    });
    window.addEventListener("resize", positionTransactionDeleteDialog);
    window.visualViewport?.addEventListener(
      "resize",
      positionTransactionDeleteDialog,
    );

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;

      if (
        scrollLocked &&
        ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key) &&
        (!(target instanceof Node) || !anchoredDialog?.contains(target))
      ) {
        event.preventDefault();
        return;
      }

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

      if (!(target instanceof HTMLElement)) return;

      if (
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        return;
      }

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
      releaseTransactionDelete();
      dialogObserver.disconnect();
      document.removeEventListener("click", handleDocumentClick, true);
      document.removeEventListener("touchmove", preventBackgroundScroll, true);
      document.removeEventListener("wheel", preventBackgroundScroll, true);
      window.removeEventListener("resize", positionTransactionDeleteDialog);
      window.visualViewport?.removeEventListener(
        "resize",
        positionTransactionDeleteDialog,
      );
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}
