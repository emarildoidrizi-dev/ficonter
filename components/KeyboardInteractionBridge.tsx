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
      dialog.style.removeProperty("--ficonter-anchor-shift-x");
      dialog.style.removeProperty("--ficonter-anchor-shift-y");
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
        document.querySelectorAll<HTMLElement>(
          '[role="alertdialog"][class*="TransactionLedger_modal"]',
        ),
      );

      return (
        dialogs.find(
          (dialog) => dialog.getAttribute("aria-labelledby") !== "bulk-delete-title",
        ) ?? null
      );
    }

    function positionTransactionDeleteDialog() {
      if (!isNativeWorkspace() || !deleteAnchor || !anchoredDialog) return;
      if (!anchoredDialog.isConnected) {
        releaseTransactionDelete();
        return;
      }

      // Keep the confirmation inside the backdrop's normal centered grid and
      // translate it toward the clicked transaction. This avoids iOS WebView
      // fixed-position coordinate drift while still placing the dialog over
      // the transaction that triggered it.
      const viewportWidth = Math.max(
        1,
        document.documentElement.clientWidth || window.innerWidth,
      );
      const viewportHeight = Math.max(
        1,
        window.innerHeight || document.documentElement.clientHeight,
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

      const viewportCenterX = viewportWidth / 2;
      const viewportCenterY = viewportHeight / 2;
      const desiredShiftX = deleteAnchor.x - viewportCenterX;
      const desiredShiftY = deleteAnchor.y - viewportCenterY;

      const minShiftX = edgeGap + dialogWidth / 2 - viewportCenterX;
      const maxShiftX = Math.max(
        minShiftX,
        viewportWidth - edgeGap - dialogWidth / 2 - viewportCenterX,
      );
      const minShiftY = edgeGap + dialogHeight / 2 - viewportCenterY;
      const maxShiftY = Math.max(
        minShiftY,
        viewportHeight - bottomChromeAllowance - dialogHeight / 2 - viewportCenterY,
      );

      const shiftX = Math.min(maxShiftX, Math.max(minShiftX, desiredShiftX));
      const shiftY = Math.min(maxShiftY, Math.max(minShiftY, desiredShiftY));

      anchoredDialog.style.setProperty(
        "--ficonter-anchor-shift-x",
        `${Math.round(shiftX)}px`,
      );
      anchoredDialog.style.setProperty(
        "--ficonter-anchor-shift-y",
        `${Math.round(shiftY)}px`,
      );
    }

    function connectTransactionDeleteDialog() {
      if (!deleteAnchor || anchoredDialog || !isNativeWorkspace()) return;
      const dialog = findTransactionDeleteDialog();
      if (!dialog) return;

      anchoredDialog = dialog;
      positionTransactionDeleteDialog();
      lockTransactionDeleteScroll();
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
        // If contextual anchoring cannot connect, leave the normal centered
        // confirmation untouched rather than hiding or freezing anything.
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

        // Let TransactionLedger's React onClick render the confirmation first.
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
      releaseTransactionDelete();
      dialogObserver.disconnect();
      document.removeEventListener("click", handleDocumentClick, true);
      document.removeEventListener("touchmove", preventBackgroundScroll, true);
      document.removeEventListener("wheel", preventBackgroundScroll, true);
      window.removeEventListener("resize", positionTransactionDeleteDialog);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}
