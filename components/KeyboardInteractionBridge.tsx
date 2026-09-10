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
    let anchorRow: HTMLElement | null = null;
    let anchoredDialog: HTMLElement | null = null;
    let positionFrame = 0;

    function isNativeWorkspace() {
      return document.documentElement.dataset.ficonterNativeApp === "true";
    }

    function clearDialogPresentation(dialog: HTMLElement | null) {
      if (!dialog) return;
      dialog.removeAttribute("data-ficonter-transaction-anchor");
      dialog.style.removeProperty("--ficonter-anchor-left");
      dialog.style.removeProperty("--ficonter-anchor-top");
      dialog.style.removeProperty("visibility");
    }

    function releaseTransactionAnchor() {
      clearDialogPresentation(anchoredDialog);
      anchorRow = null;
      anchoredDialog = null;
    }

    function findTransactionDeleteDialog(): HTMLElement | null {
      const dialogs = Array.from(
        document.querySelectorAll<HTMLElement>('[role="alertdialog"]'),
      );

      return (
        dialogs.find((dialog) => {
          const confirm = dialog.querySelector<HTMLElement>(
            '[data-enter-confirm="true"]',
          );
          return confirm?.textContent?.trim() === "Delete transaction";
        }) ?? null
      );
    }

    function positionTransactionDialog() {
      positionFrame = 0;

      if (!isNativeWorkspace() || !anchorRow || !anchoredDialog) {
        return;
      }

      if (!anchorRow.isConnected || !anchoredDialog.isConnected) {
        releaseTransactionAnchor();
        return;
      }

      const visualViewport = window.visualViewport;
      const viewportLeft = visualViewport?.offsetLeft ?? 0;
      const viewportTop = visualViewport?.offsetTop ?? 0;
      const viewportWidth =
        visualViewport?.width ?? document.documentElement.clientWidth;
      const viewportHeight = visualViewport?.height ?? window.innerHeight;
      const viewportRight = viewportLeft + viewportWidth;
      const viewportBottom = viewportTop + viewportHeight;
      const edgeGap = 12;
      const rowGap = 10;
      const bottomChromeAllowance = 96;
      const usableBottom = Math.max(
        viewportTop + edgeGap,
        viewportBottom - bottomChromeAllowance,
      );

      const rowRect = anchorRow.getBoundingClientRect();

      // If the originating transaction has completely left the visible app
      // viewport, hide the confirmation with it instead of leaving a detached
      // dialog floating elsewhere on the screen. It reappears when the row is
      // scrolled back into view.
      if (
        rowRect.bottom < viewportTop ||
        rowRect.top > viewportBottom ||
        rowRect.right < viewportLeft ||
        rowRect.left > viewportRight
      ) {
        anchoredDialog.style.visibility = "hidden";
        return;
      }

      anchoredDialog.style.visibility = "visible";
      anchoredDialog.setAttribute("data-ficonter-transaction-anchor", "true");

      const dialogRect = anchoredDialog.getBoundingClientRect();
      const dialogWidth = Math.min(
        dialogRect.width || 420,
        Math.max(0, viewportWidth - edgeGap * 2),
      );
      const dialogHeight = Math.min(
        dialogRect.height || 300,
        Math.max(0, viewportHeight - edgeGap * 2),
      );

      const minLeft = viewportLeft + edgeGap;
      const maxLeft = Math.max(
        minLeft,
        viewportRight - edgeGap - dialogWidth,
      );
      const centeredLeft = rowRect.left + rowRect.width / 2 - dialogWidth / 2;
      const left = Math.min(maxLeft, Math.max(minLeft, centeredLeft));

      const belowTop = rowRect.bottom + rowGap;
      const aboveTop = rowRect.top - rowGap - dialogHeight;
      const canFitBelow = belowTop + dialogHeight <= usableBottom;
      const canFitAbove = aboveTop >= viewportTop + edgeGap;

      let top: number;
      if (canFitBelow) {
        top = belowTop;
      } else if (canFitAbove) {
        top = aboveTop;
      } else {
        // On short viewports keep the dialog as close as possible to the
        // transaction instead of snapping to a generic top/bottom position.
        const minTop = viewportTop + edgeGap;
        const maxTop = Math.max(
          minTop,
          usableBottom - dialogHeight,
        );
        const rowCenteredTop =
          rowRect.top + rowRect.height / 2 - dialogHeight / 2;
        top = Math.min(maxTop, Math.max(minTop, rowCenteredTop));
      }

      anchoredDialog.style.setProperty(
        "--ficonter-anchor-left",
        `${Math.round(left)}px`,
      );
      anchoredDialog.style.setProperty(
        "--ficonter-anchor-top",
        `${Math.round(top)}px`,
      );
    }

    function scheduleTransactionPosition() {
      if (!anchorRow || !anchoredDialog || positionFrame) return;
      positionFrame = window.requestAnimationFrame(positionTransactionDialog);
    }

    function connectTransactionDialog() {
      if (!anchorRow || anchoredDialog || !isNativeWorkspace()) return;
      const dialog = findTransactionDeleteDialog();
      if (!dialog) return;

      anchoredDialog = dialog;
      anchoredDialog.setAttribute("data-ficonter-transaction-anchor", "true");
      scheduleTransactionPosition();
      window.requestAnimationFrame(scheduleTransactionPosition);
    }

    function handleDocumentClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const deleteButton = target.closest<HTMLElement>(
        'button[aria-label="Delete transaction"]',
      );
      if (deleteButton && isNativeWorkspace()) {
        clearDialogPresentation(anchoredDialog);
        anchoredDialog = null;
        anchorRow =
          deleteButton.closest<HTMLElement>('[class*="TransactionLedger_row"]') ??
          deleteButton;
        window.requestAnimationFrame(connectTransactionDialog);
        return;
      }

      if (
        anchoredDialog &&
        (target.closest('[role="alertdialog"] button') ||
          target.closest('[class*="backdrop"]'))
      ) {
        window.requestAnimationFrame(() => {
          if (anchoredDialog && !anchoredDialog.isConnected) {
            releaseTransactionAnchor();
          }
        });
      }
    }

    const dialogObserver = new MutationObserver(() => {
      if (anchoredDialog && !anchoredDialog.isConnected) {
        releaseTransactionAnchor();
        return;
      }
      if (anchorRow && !anchoredDialog) connectTransactionDialog();
    });

    dialogObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    document.addEventListener("click", handleDocumentClick, true);
    document.addEventListener("scroll", scheduleTransactionPosition, true);
    window.addEventListener("resize", scheduleTransactionPosition);
    window.visualViewport?.addEventListener(
      "resize",
      scheduleTransactionPosition,
    );
    window.visualViewport?.addEventListener(
      "scroll",
      scheduleTransactionPosition,
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
      if (positionFrame) window.cancelAnimationFrame(positionFrame);
      releaseTransactionAnchor();
      dialogObserver.disconnect();
      document.removeEventListener("click", handleDocumentClick, true);
      document.removeEventListener("scroll", scheduleTransactionPosition, true);
      window.removeEventListener("resize", scheduleTransactionPosition);
      window.visualViewport?.removeEventListener(
        "resize",
        scheduleTransactionPosition,
      );
      window.visualViewport?.removeEventListener(
        "scroll",
        scheduleTransactionPosition,
      );
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}
