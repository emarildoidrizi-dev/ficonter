"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { createClient } from "@/lib/supabase/client";
import { useVault } from "@/components/VaultProvider";
import {
  decryptTransactionPayload,
  type DecryptedTransaction,
  type EncryptedTransactionRow,
} from "@/lib/e2ee/transactionPayload";
import {
  finalizePendingServerTransactions,
  migrateLegacyPlaintextTransactions,
} from "@/lib/e2ee/transactionMigration";
import {
  finalizePendingEncryptedBillTransactions,
} from "@/lib/e2ee/pendingBillTransactionFinalizer";

type EncryptedTransactionContextValue = {
  transactions: DecryptedTransaction[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};

const EncryptedTransactionContext =
  createContext<EncryptedTransactionContextValue | null>(null);

export function EncryptedTransactionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { status: vaultStatus, vaultKey } = useVault();

  const [transactions, setTransactions] =
    useState<DecryptedTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const refreshRunningRef = useRef(false);
  const refreshQueuedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (vaultStatus !== "unlocked" || !vaultKey) {
      setTransactions([]);
      setLoading(false);
      setError("");
      return;
    }

    if (refreshRunningRef.current) {
      refreshQueuedRef.current = true;
      return;
    }
    refreshRunningRef.current = true;
    setLoading(true);
    setError("");

    try {
      do {
        refreshQueuedRef.current = false;
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please log in again.");
      }

      await migrateLegacyPlaintextTransactions(
        supabase,
        vaultKey,
        user.id,
      );
      await finalizePendingEncryptedBillTransactions(
        supabase,
        vaultKey,
        user.id,
      );
      await finalizePendingServerTransactions(
        supabase,
        vaultKey,
        user.id,
      );

      const { data, error: queryError } = await supabase
        .from("transactions")
        .select(
          "id,user_id,encrypted_payload,encryption_version,created_at",
        )
        .eq("user_id", user.id)
        .eq("encryption_version", 1)
        .not("encrypted_payload", "is", null)
        .order("created_at", { ascending: false });

      if (queryError) throw queryError;

      const results = await Promise.allSettled(
        ((data ?? []) as EncryptedTransactionRow[]).map(
          (row) =>
            decryptTransactionPayload(
              vaultKey,
              user.id,
              row,
            ),
        ),
      );

      const decrypted = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );

      const failedCount = results.length - decrypted.length;
      if (failedCount > 0) {
        console.warn(
          `Skipped ${failedCount} encrypted transaction row(s) that could not be decrypted with the current vault key.`,
        );
      }

        setTransactions(decrypted);
      } while (refreshQueuedRef.current);
    } catch (caughtError) {
      setTransactions([]);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Encrypted transactions could not be opened.",
      );
    } finally {
      refreshRunningRef.current = false;
      setLoading(false);
    }
  }, [supabase, vaultKey, vaultStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (vaultStatus !== "unlocked") return;

    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function subscribe() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active || !user) return;

      channel = supabase
        .channel(`e2ee-transactions-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "transactions",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void refresh();
          },
        )
        .subscribe();
    }

    const handleCreated = () => {
      window.setTimeout(() => void refresh(), 80);
    };

    const transactionEvents = [
      "ficonter:transaction-created",
      "ficonter:transaction-upserted",
      "ficonter:transaction-deleted",
      "ficonter:data-changed",
    ] as const;
    transactionEvents.forEach((eventName) =>
      window.addEventListener(eventName, handleCreated),
    );

    void subscribe();

    return () => {
      active = false;
      transactionEvents.forEach((eventName) =>
        window.removeEventListener(eventName, handleCreated),
      );
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refresh, supabase, vaultStatus]);

  const value = useMemo(
    () => ({
      transactions,
      loading,
      error,
      refresh,
    }),
    [transactions, loading, error, refresh],
  );

  return (
    <EncryptedTransactionContext.Provider value={value}>
      {children}
    </EncryptedTransactionContext.Provider>
  );
}

export function useEncryptedTransactions() {
  const context = useContext(EncryptedTransactionContext);

  if (!context) {
    throw new Error(
      "useEncryptedTransactions must be used inside EncryptedTransactionProvider.",
    );
  }

  return context;
}
