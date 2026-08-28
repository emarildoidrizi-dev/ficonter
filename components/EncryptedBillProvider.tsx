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
  decryptBillPayload,
  type BillPrivatePayloadV1,
  type EncryptedBillRow,
} from "@/lib/e2ee/billPayload";
import {
  migrateLegacyPlaintextBills,
} from "@/lib/e2ee/billMigration";
import { subscribeFiconterDataChanges } from "@/lib/ficonterRealtime";

type BillOperationalRow = EncryptedBillRow & {
  due_date: string;
  recurrence: string;
  autopay: boolean;
  autopay_record_time: string;
  autopay_timezone: string;
  autopay_enabled_at: string | null;
  recurrence_anchor_day: number | null;
  recurrence_anchor_month_end: boolean;
  reminder_days: number;
  status: string;
  paid_at: string | null;
  transaction_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DecryptedBill =
  BillOperationalRow &
  BillPrivatePayloadV1;

type ContextValue = {
  bills: DecryptedBill[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};

const EncryptedBillContext =
  createContext<ContextValue | null>(null);

export function EncryptedBillProvider({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const {
    status: vaultStatus,
    vaultKey,
  } = useVault();

  const [bills, setBills] =
    useState<DecryptedBill[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const refreshRunningRef = useRef(false);
  const refreshQueuedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (
      vaultStatus !== "unlocked" ||
      !vaultKey
    ) {
      setBills([]);
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
          throw new Error(
            "Please log in again.",
          );
        }

        await migrateLegacyPlaintextBills(
          supabase,
          vaultKey,
          user.id,
        );

        const billsTable =
          supabase.from("bills") as any;

        const {
          data,
          error: queryError,
        } = await billsTable
          .select(
            "id,user_id,encrypted_payload,encryption_version,due_date,recurrence,autopay,autopay_record_time,autopay_timezone,autopay_enabled_at,recurrence_anchor_day,recurrence_anchor_month_end,reminder_days,status,paid_at,transaction_id,created_at,updated_at",
          )
          .eq("user_id", user.id)
          .eq("encryption_version", 1)
          .not(
            "encrypted_payload",
            "is",
            null,
          )
          .order("due_date", {
            ascending: true,
          });

        if (queryError) {
          throw queryError;
        }

        const rows =
          (data ?? []) as BillOperationalRow[];

        const decrypted =
          await Promise.all(
            rows.map(async (row) => ({
              ...row,
              ...(await decryptBillPayload(
                vaultKey,
                user.id,
                row,
              )),
            })),
          );

        setBills(decrypted);
      } while (refreshQueuedRef.current);
    } catch (caughtError) {
      setBills([]);

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Encrypted Bills could not be opened.",
      );
    } finally {
      refreshRunningRef.current = false;
      setLoading(false);
    }
  }, [
    supabase,
    vaultKey,
    vaultStatus,
  ]);

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
        .channel(`e2ee-bills-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "bills",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void refresh();
          },
        )
        .subscribe();
    }

    const unsubscribe = subscribeFiconterDataChanges((change) => {
      if (change.scope === "bills" || change.scope === "all") {
        void refresh();
      }
    });

    void subscribe();

    return () => {
      active = false;
      unsubscribe();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refresh, supabase, vaultStatus]);

  const value = useMemo(
    () => ({
      bills,
      loading,
      error,
      refresh,
    }),
    [
      bills,
      loading,
      error,
      refresh,
    ],
  );

  return (
    <EncryptedBillContext.Provider
      value={value}
    >
      {children}
    </EncryptedBillContext.Provider>
  );
}

export function useEncryptedBills() {
  const context =
    useContext(EncryptedBillContext);

  if (!context) {
    throw new Error(
      "useEncryptedBills must be used inside EncryptedBillProvider.",
    );
  }

  return context;
}
