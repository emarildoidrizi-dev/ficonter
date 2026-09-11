"use client";

import { useMemo } from "react";

import {
  CommandPalette,
  type CommandPaletteSearchResult,
} from "@/components/CommandPalette";
import { useEncryptedBills } from "@/components/EncryptedBillProvider";
import { useEncryptedTransactions } from "@/components/EncryptedTransactionProvider";
import { useVault } from "@/components/VaultProvider";
import type { SubscriptionPlanCode } from "@/lib/subscriptionPlans";

type Props = {
  subscriptionPlanCode: SubscriptionPlanCode;
};

function compactAmount(amount: number, currency: string) {
  if (!Number.isFinite(amount)) return currency;
  return `${amount.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export function PersonalPlatformSearchPalette({
  subscriptionPlanCode,
}: Props) {
  const { status: vaultStatus } = useVault();
  const {
    transactions,
    loading: transactionsLoading,
  } = useEncryptedTransactions();
  const {
    bills,
    loading: billsLoading,
  } = useEncryptedBills();

  const privateResults = useMemo<CommandPaletteSearchResult[]>(() => {
    if (vaultStatus !== "unlocked") return [];

    const transactionResults = transactions.map((transaction) => ({
      id: `transaction:${transaction.id}`,
      label: transaction.description.trim() || "Transaction",
      description: [
        transaction.category || transaction.type,
        transaction.transaction_date,
        compactAmount(transaction.amount, transaction.currency),
      ].filter(Boolean).join(" · "),
      href: `/dashboard/transactions/${transaction.id}`,
      group: "Your transactions",
      keywords: [
        transaction.description,
        transaction.category,
        transaction.type,
        transaction.currency,
        transaction.transaction_date,
        transaction.occurred_at ?? "",
        String(transaction.amount),
        String(transaction.amount_eur),
      ].filter(Boolean),
    }));

    const billResults = bills.map((bill) => ({
      id: `bill:${bill.id}`,
      label: bill.name.trim() || "Bill",
      description: [
        bill.company,
        bill.category,
        bill.due_date,
        compactAmount(bill.amount, bill.currency),
      ].filter(Boolean).join(" · "),
      href: "/dashboard/bills",
      group: "Your bills",
      keywords: [
        bill.name,
        bill.company ?? "",
        bill.category,
        bill.currency,
        bill.due_date,
        bill.recurrence,
        bill.status,
        bill.payment_method ?? "",
        bill.notes ?? "",
        String(bill.amount),
        String(bill.amount_eur),
      ].filter(Boolean),
    }));

    return [...transactionResults, ...billResults];
  }, [bills, transactions, vaultStatus]);

  const privateSearchStatus =
    vaultStatus !== "unlocked"
      ? "locked"
      : transactionsLoading || billsLoading
        ? "loading"
        : "available";

  return (
    <CommandPalette
      subscriptionPlanCode={subscriptionPlanCode}
      privateResults={privateResults}
      privateSearchStatus={privateSearchStatus}
      browserOnly
    />
  );
}
