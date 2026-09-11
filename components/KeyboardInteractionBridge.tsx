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

const TRANSACTION_SUMMARY_LABELS = new Map<string, string>([
  ["Money received", "Total Cash Inflows"],
  ["Money spent", "Total Cash Outflows"],
  ["Net movement by currency", "Net Cash Flow"],
]);

function polishTransactionSummaryLabels() {
  // Do not depend on CSS-module class names here. Production builds may shorten
  // or transform those names. Match only the exact legacy labels and verify that
  // the span belongs to a summary card by checking for its sibling icon/value.
  document.querySelectorAll<HTMLElement>(".app-main span").forEach((label) => {
    const currentLabel = label.textContent?.trim() ?? "";
    const professionalLabel = TRANSACTION_SUMMARY_LABELS.get(currentLabel);
    if (!professionalLabel) return;

    const card = label.parentElement;
    if (!card) return;
    const hasValue = Boolean(card.querySelector(":scope > strong"));
    const hasIcon = Boolean(card.querySelector(":scope > svg"));
    if (!hasValue || !hasIcon) return;

    label.textContent = professionalLabel;
    label.setAttribute("data-ficonter-professional-summary", "true");
    card.setAttribute("data-ficonter-summary-card", "true");
  });
}

export function KeyboardInteractionBridge() {
  useEffect(() => {
    let deleteDialog: HTMLElement | null = null;
    let deleteBackdrop: HTMLElement | null = null;

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

    function clearSingleDeleteConnection() {
      deleteDialog = null;
      deleteBackdrop = null;
    }

    function findSingleDeleteDialog() {
      return (
        Array.from(document.querySelectorAll<HTMLElement>('[role="alertdialog"]')).find(
          isSingleTransactionDeleteDialog,
        ) ?? null
      );
    }

    function connectDeleteDialog() {
      if (!isNativeWorkspace()) return;

      if (deleteDialog && !deleteDialog.isConnected) {
        clearSingleDeleteConnection();
      }
      if (deleteDialog) return;

      const dialog = findSingleDeleteDialog();
      if (!dialog) return;

      const backdrop = dialog.closest<HTMLElement>('[class*="TransactionLedger_backdrop"]');
      if (!backdrop) return;

      // Placement is intentionally owned by CSS. Keeping JavaScript out of the
      // geometry prevents stale ledger/viewport coordinates from moving the
      // confirmation away from the requested bottom-sheet position.
      deleteDialog = dialog;
      deleteBackdrop = backdrop;
    }

    function handleDocumentClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element) || !isNativeWorkspace()) return;

      const deleteButton = target.closest<HTMLElement>(
        'button[aria-label="Delete transaction"]',
      );
      if (!deleteButton) return;

      // React mounts the confirmation after this click. Connect on the next
      // frame so background scroll locking is active as soon as it appears.
      window.requestAnimationFrame(connectDeleteDialog);
    }

    function preventBackgroundScroll(event: Event) {
      if (!deleteDialog || !deleteBackdrop) return;
      if (!deleteDialog.isConnected || !deleteBackdrop.isConnected) {
        clearSingleDeleteConnection();
        return;
      }

      const target = event.target;
      if (target instanceof Node && deleteDialog.contains(target)) return;
      event.preventDefault();
    }

    polishTransactionSummaryLabels();

    const observer = new MutationObserver(() => {
      polishTransactionSummaryLabels();
      if (deleteDialog && !deleteDialog.isConnected) {
        clearSingleDeleteConnection();
      }
      if (!deleteDialog) connectDeleteDialog();
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
      clearSingleDeleteConnection();
      observer.disconnect();
      document.removeEventListener("click", handleDocumentClick, true);
      document.removeEventListener("touchmove", preventBackgroundScroll, true);
      document.removeEventListener("wheel", preventBackgroundScroll, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}
