"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Cloud,
  Download,
  FileKey2,
  FolderLock,
  HardDrive,
  KeyRound,
  RefreshCcw,
  ShieldCheck,
  Upload,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useVault } from "@/components/VaultProvider";
import { decryptTransactionPayload, encryptTransactionPayload } from "@/lib/e2ee/transactionPayload";
import { decryptBillPayload, encryptBillPayload } from "@/lib/e2ee/billPayload";
import { decryptGoalPayload, encryptGoalPayload } from "@/lib/e2ee/goalPayload";
import { decryptGoalInvestmentPayload, encryptGoalInvestmentPayload } from "@/lib/e2ee/goalInvestmentPayload";
import { decryptDebtPayload, encryptDebtPayload } from "@/lib/e2ee/debtPayload";
import { decryptDebtPaymentPayload, encryptDebtPaymentPayload } from "@/lib/e2ee/debtPaymentPayload";
import { decryptCreditCardPayload, encryptCreditCardPayload } from "@/lib/e2ee/creditCardPayload";
import { decryptCreditCardActivityPayload, encryptCreditCardActivityPayload } from "@/lib/e2ee/creditCardActivityPayload";
import { decryptCreditCardMonthlyRecordPayload, encryptCreditCardMonthlyRecordPayload } from "@/lib/e2ee/creditCardMonthlyRecordPayload";
import { decryptMonthlyPlanPayload, encryptMonthlyPlanPayload } from "@/lib/e2ee/monthlyPlanPayload";
import { decryptMonthlyPlanItemPayload, encryptMonthlyPlanItemPayload } from "@/lib/e2ee/monthlyPlanItemPayload";
import { notifyFiconterDataChange } from "@/lib/ficonterRealtime";
import styles from "./BackupRecoverySettings.module.css";

type Props = {
  userId: string;
  email: string;
  metadata: Record<string, unknown>;
};

type Notice = { type: "success" | "error" | "info"; text: string } | null;
type PortableRow = Record<string, unknown> & { source_id: string };

type PortableData = {
  transactions: PortableRow[];
  bills: PortableRow[];
  goals: PortableRow[];
  goal_investments: PortableRow[];
  debts: PortableRow[];
  debt_payments: PortableRow[];
  credit_card_activities: PortableRow[];
  credit_card_monthly_records: PortableRow[];
  monthly_budget_plans: PortableRow[];
  monthly_budget_items: PortableRow[];
};

type PortableBackupPayload = {
  schema_version: "2.0";
  export_type: "ficonter-portable-account-backup";
  exported_at: string;
  source_account: {
    id: string;
    email: string;
    full_name: string;
    display_name: string;
  };
  privacy: {
    portable_cross_account_restore: true;
    excludes_authentication_secrets: true;
    excludes_subscription_state: true;
    excludes_support_history: true;
    excludes_document_file_bytes: true;
  };
  data: PortableData;
};

type BackupEnvelopeV2 = {
  format: "ficonter-portable-backup";
  version: 2;
  created_at: string;
  destination: "device";
  encryption: {
    algorithm: "AES-GCM";
    key_derivation: "PBKDF2-SHA256";
    iterations: 310000;
    salt: string;
    iv: string;
  };
  ciphertext: string;
};

type LegacyEnvelopeV1 = {
  format: "ficonter-encrypted-backup";
  version: 1;
  created_at: string;
  encryption: BackupEnvelopeV2["encryption"];
  ciphertext: string;
};

type InspectedBackup = {
  envelope: BackupEnvelopeV2;
  payload: PortableBackupPayload;
};

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();
const PBKDF2_ITERATIONS = 310000;
const TABLES = [
  "transactions",
  "bills",
  "goals",
  "goal_investments",
  "debts",
  "debt_payments",
  "credit_card_activities",
  "credit_card_monthly_records",
  "monthly_budget_plans",
  "monthly_budget_items",
] as const;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function deriveBackupKey(passphrase: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptPortableBackup(payload: PortableBackupPayload, passphrase: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(passphrase, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    ENCODER.encode(JSON.stringify(payload)),
  );
  return {
    format: "ficonter-portable-backup",
    version: 2,
    created_at: new Date().toISOString(),
    destination: "device",
    encryption: {
      algorithm: "AES-GCM",
      key_derivation: "PBKDF2-SHA256",
      iterations: PBKDF2_ITERATIONS,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
    },
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  } satisfies BackupEnvelopeV2;
}

async function decryptOuterEnvelope(
  envelope: BackupEnvelopeV2 | LegacyEnvelopeV1,
  passphrase: string,
): Promise<Record<string, unknown>> {
  if (
    envelope.encryption?.algorithm !== "AES-GCM" ||
    envelope.encryption?.key_derivation !== "PBKDF2-SHA256" ||
    envelope.encryption?.iterations !== PBKDF2_ITERATIONS
  ) {
    throw new Error("This backup uses an unsupported encryption format.");
  }
  const salt = base64ToBytes(envelope.encryption.salt);
  const iv = base64ToBytes(envelope.encryption.iv);
  const key = await deriveBackupKey(passphrase, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    base64ToBytes(envelope.ciphertext),
  );
  return JSON.parse(DECODER.decode(decrypted)) as Record<string, unknown>;
}

function triggerBackupDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function toPortableRow(row: Record<string, unknown>, privatePayload?: Record<string, unknown>) {
  const merged = { ...row, ...(privatePayload ?? {}) };
  const sourceId = String(merged.id ?? "");
  if (!sourceId) throw new Error("A backup record is missing its source ID.");
  const portable: Record<string, unknown> = { ...merged, source_id: sourceId };
  delete portable.id;
  delete portable.user_id;
  delete portable.encrypted_payload;
  delete portable.encryption_version;
  delete portable.e2ee_revision;
  return portable as PortableRow;
}

function value(row: Record<string, unknown>, key: string) {
  return row[key];
}

function text(row: Record<string, unknown>, key: string, fallback = "") {
  const current = value(row, key);
  return typeof current === "string" ? current : fallback;
}

function number(row: Record<string, unknown>, key: string, fallback = 0) {
  const parsed = Number(value(row, key));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableText(row: Record<string, unknown>, key: string) {
  const current = value(row, key);
  return typeof current === "string" && current.trim() ? current : null;
}

function backupCounts(payload: PortableBackupPayload) {
  return TABLES.reduce((sum, table) => sum + payload.data[table].length, 0);
}

export function PortableBackupRecoverySettings({ userId, email, metadata }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { status: vaultStatus, vaultKey } = useVault();
  const createCardRef = useRef<HTMLDivElement | null>(null);
  const restoreCardRef = useRef<HTMLDivElement | null>(null);

  const [backupPassphrase, setBackupPassphrase] = useState("");
  const [backupPassphraseConfirm, setBackupPassphraseConfirm] = useState("");
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [restoreConfirmation, setRestoreConfirmation] = useState("");
  const [inspected, setInspected] = useState<InspectedBackup | null>(null);
  const [busy, setBusy] = useState<"create" | "inspect" | "restore" | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  function requireUnlockedVault() {
    if (vaultStatus !== "unlocked" || !vaultKey) {
      throw new Error("Unlock your Financial Vault before creating or restoring a portable backup.");
    }
    return vaultKey;
  }

  async function collectPortableData(): Promise<PortableData> {
    const activeVaultKey = requireUnlockedVault();
    const results = await Promise.all(
      TABLES.map(async (table) => {
        const result = await (supabase.from(table) as any).select("*").eq("user_id", userId);
        if (result.error) throw result.error;
        return [table, (result.data ?? []) as Record<string, unknown>[]] as const;
      }),
    );
    const raw = Object.fromEntries(results) as Record<(typeof TABLES)[number], Record<string, unknown>[]>;

    const transactions = await Promise.all(raw.transactions.map(async (row) => {
      const opened = row.encryption_version === 1 && row.encrypted_payload
        ? await decryptTransactionPayload(activeVaultKey, userId, row as any)
        : row;
      return toPortableRow(row, opened as unknown as Record<string, unknown>);
    }));

    const bills = await Promise.all(raw.bills.map(async (row) =>
      toPortableRow(
        row,
        row.encryption_version === 1 && row.encrypted_payload
          ? await decryptBillPayload(activeVaultKey, userId, row as any) as unknown as Record<string, unknown>
          : undefined,
      ),
    ));

    const goals = await Promise.all(raw.goals.map(async (row) =>
      toPortableRow(
        row,
        row.encryption_version === 1 && row.encrypted_payload
          ? await decryptGoalPayload(activeVaultKey, userId, row as any) as unknown as Record<string, unknown>
          : undefined,
      ),
    ));

    const goalInvestments = await Promise.all(raw.goal_investments.map(async (row) =>
      toPortableRow(
        row,
        row.encryption_version === 1 && row.encrypted_payload
          ? await decryptGoalInvestmentPayload(activeVaultKey, userId, row as any) as unknown as Record<string, unknown>
          : undefined,
      ),
    ));

    const debts = await Promise.all(raw.debts.map(async (row) => {
      let opened: Record<string, unknown> | undefined;
      if (row.encryption_version === 1 && row.encrypted_payload) {
        opened = (row.debt_kind === "credit_card"
          ? await decryptCreditCardPayload(activeVaultKey, userId, row as any)
          : await decryptDebtPayload(activeVaultKey, userId, row as any)) as unknown as Record<string, unknown>;
      }
      return toPortableRow(row, opened);
    }));

    const debtPayments = await Promise.all(raw.debt_payments.map(async (row) =>
      toPortableRow(
        row,
        row.encryption_version === 1 && row.encrypted_payload
          ? await decryptDebtPaymentPayload(activeVaultKey, userId, row as any) as unknown as Record<string, unknown>
          : undefined,
      ),
    ));

    const activities = await Promise.all(raw.credit_card_activities.map(async (row) =>
      toPortableRow(
        row,
        row.encryption_version === 1 && row.encrypted_payload
          ? await decryptCreditCardActivityPayload(activeVaultKey, userId, row as any) as unknown as Record<string, unknown>
          : undefined,
      ),
    ));

    const monthlyRecords = await Promise.all(raw.credit_card_monthly_records.map(async (row) =>
      toPortableRow(
        row,
        row.encryption_version === 1 && row.encrypted_payload
          ? await decryptCreditCardMonthlyRecordPayload(activeVaultKey, userId, row as any) as unknown as Record<string, unknown>
          : undefined,
      ),
    ));

    const plans = await Promise.all(raw.monthly_budget_plans.map(async (row) =>
      toPortableRow(
        row,
        row.encryption_version === 1 && row.encrypted_payload
          ? await decryptMonthlyPlanPayload(activeVaultKey, userId, row as any) as unknown as Record<string, unknown>
          : undefined,
      ),
    ));

    const items = await Promise.all(raw.monthly_budget_items.map(async (row) =>
      toPortableRow(
        row,
        row.encryption_version === 1 && row.encrypted_payload
          ? await decryptMonthlyPlanItemPayload(activeVaultKey, userId, row as any) as unknown as Record<string, unknown>
          : undefined,
      ),
    ));

    return {
      transactions,
      bills,
      goals,
      goal_investments: goalInvestments,
      debts,
      debt_payments: debtPayments,
      credit_card_activities: activities,
      credit_card_monthly_records: monthlyRecords,
      monthly_budget_plans: plans,
      monthly_budget_items: items,
    };
  }

  async function createPortableBackup() {
    setNotice(null);
    if (backupPassphrase.length < 12) {
      setNotice({ type: "error", text: "Use a backup passphrase with at least 12 characters." });
      return;
    }
    if (backupPassphrase !== backupPassphraseConfirm) {
      setNotice({ type: "error", text: "The backup passphrases do not match." });
      return;
    }

    setBusy("create");
    try {
      const data = await collectPortableData();
      const fullName = String(metadata.full_name ?? metadata.name ?? "").trim();
      const displayName = String(metadata.display_name ?? metadata.full_name ?? metadata.name ?? "").trim();
      const payload: PortableBackupPayload = {
        schema_version: "2.0",
        export_type: "ficonter-portable-account-backup",
        exported_at: new Date().toISOString(),
        source_account: { id: userId, email, full_name: fullName, display_name: displayName },
        privacy: {
          portable_cross_account_restore: true,
          excludes_authentication_secrets: true,
          excludes_subscription_state: true,
          excludes_support_history: true,
          excludes_document_file_bytes: true,
        },
        data,
      };
      const envelope = await encryptPortableBackup(payload, backupPassphrase);
      triggerBackupDownload(
        `ficonter-portable-backup-${envelope.created_at.slice(0, 10)}.ficonter-backup`,
        JSON.stringify(envelope),
      );
      setBackupPassphrase("");
      setBackupPassphraseConfirm("");
      setNotice({
        type: "success",
        text: `Portable encrypted backup created with ${backupCounts(payload)} financial records. FICONTER did not keep the file or passphrase.`,
      });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "The backup could not be created." });
    } finally {
      setBusy(null);
    }
  }

  function chooseRestoreFile(event: ChangeEvent<HTMLInputElement>) {
    setRestoreFile(event.target.files?.[0] ?? null);
    setInspected(null);
    setRestoreConfirmation("");
    setNotice(null);
  }

  async function inspectBackup() {
    setNotice(null);
    setInspected(null);
    if (!restoreFile) {
      setNotice({ type: "error", text: "Choose a FICONTER backup file first." });
      return;
    }
    if (!restorePassphrase) {
      setNotice({ type: "error", text: "Enter the backup passphrase." });
      return;
    }

    setBusy("inspect");
    try {
      const parsed = JSON.parse(await restoreFile.text()) as BackupEnvelopeV2 | LegacyEnvelopeV1;
      if (parsed.format === "ficonter-encrypted-backup" && parsed.version === 1) {
        await decryptOuterEnvelope(parsed, restorePassphrase);
        setNotice({
          type: "info",
          text: "This is a valid legacy v1 backup. It can be verified, but it is not safe for cross-account migration because some inner financial records may still be encrypted for the old account. Sign in to the old account, unlock its Vault, and create a new Portable Backup v2.",
        });
        return;
      }
      if (parsed.format !== "ficonter-portable-backup" || parsed.version !== 2) {
        throw new Error("This is not a supported FICONTER portable backup file.");
      }
      const decrypted = await decryptOuterEnvelope(parsed, restorePassphrase);
      if (
        decrypted.schema_version !== "2.0" ||
        decrypted.export_type !== "ficonter-portable-account-backup" ||
        typeof decrypted.data !== "object" ||
        !decrypted.data
      ) {
        throw new Error("The portable backup payload is invalid or unsupported.");
      }
      const payload = decrypted as unknown as PortableBackupPayload;
      for (const table of TABLES) {
        if (!Array.isArray(payload.data[table])) throw new Error(`Backup section ${table} is invalid.`);
      }
      setInspected({ envelope: parsed, payload });
      setNotice({
        type: "success",
        text: `Backup verified. ${backupCounts(payload)} financial records are ready for a controlled restore into this account.`,
      });
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error
          ? error.message
          : "The backup could not be opened. Check the file and passphrase.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function prepareAtomicRestorePayload(payload: PortableBackupPayload) {
    const activeVaultKey = requireUnlockedVault();
    const maps = Object.fromEntries(
      TABLES.map((table) => [
        table,
        new Map(payload.data[table].map((row) => [row.source_id, crypto.randomUUID()])),
      ]),
    ) as Record<(typeof TABLES)[number], Map<string, string>>;

    const txId = (source: unknown, required = false) => {
      if (!source) {
        if (required) throw new Error("A required linked transaction is missing from the backup.");
        return null;
      }
      const mapped = maps.transactions.get(String(source));
      if (!mapped && required) throw new Error("A required linked transaction could not be mapped.");
      return mapped ?? null;
    };
    const goalId = (source: unknown) => {
      const mapped = maps.goals.get(String(source ?? ""));
      if (!mapped) throw new Error("A Goal investment references a Goal that is not present in the backup.");
      return mapped;
    };
    const debtId = (source: unknown) => {
      const mapped = maps.debts.get(String(source ?? ""));
      if (!mapped) throw new Error("A Debt or credit-card record has a missing parent record.");
      return mapped;
    };

    const transactions = await Promise.all(payload.data.transactions.map(async (row) => ({
      id: maps.transactions.get(row.source_id),
      encrypted_payload: await encryptTransactionPayload(activeVaultKey, userId, {
        description: text(row, "description"),
        amount: number(row, "amount"),
        currency: text(row, "currency", "EUR"),
        amount_eur: number(row, "amount_eur"),
        exchange_rate_to_eur: number(row, "exchange_rate_to_eur", 1),
        exchange_rate_date: nullableText(row, "exchange_rate_date"),
        exchange_rate_source: nullableText(row, "exchange_rate_source"),
        type: text(row, "type", "expense"),
        category: text(row, "category"),
        transaction_date: text(row, "transaction_date"),
        occurred_at: nullableText(row, "occurred_at"),
      }),
      created_at: nullableText(row, "created_at"),
    })));

    const goals = await Promise.all(payload.data.goals.map(async (row) => {
      const id = maps.goals.get(row.source_id)!;
      return {
        id,
        encrypted_payload: await encryptGoalPayload(activeVaultKey, userId, id, {
          name: text(row, "name", "Goal"),
          target_amount: number(row, "target_amount"),
          current_amount: number(row, "current_amount"),
          target_date: nullableText(row, "target_date"),
          status: text(row, "status", "active") as "active" | "completed" | "paused",
        }),
        created_at: nullableText(row, "created_at"),
        updated_at: nullableText(row, "updated_at"),
      };
    }));

    const debts = await Promise.all(payload.data.debts.map(async (row) => {
      const id = maps.debts.get(row.source_id)!;
      const isCard = text(row, "debt_kind") === "credit_card";
      const encryptedPayload = isCard
        ? await encryptCreditCardPayload(activeVaultKey, userId, id, {
            name: text(row, "name", "Credit card"),
            lender: nullableText(row, "lender"),
            description: nullableText(row, "description"),
            card_last_four: nullableText(row, "card_last_four"),
            currency: text(row, "currency", "EUR"),
            original_balance: number(row, "original_balance"),
            current_balance: number(row, "current_balance"),
            original_balance_eur: number(row, "original_balance_eur"),
            current_balance_eur: number(row, "current_balance_eur"),
            exchange_rate_to_eur: number(row, "exchange_rate_to_eur", 1),
            annual_interest_rate: number(row, "annual_interest_rate"),
            credit_limit: number(row, "credit_limit"),
            credit_limit_eur: number(row, "credit_limit_eur"),
            statement_balance: value(row, "statement_balance") == null ? null : number(row, "statement_balance"),
            statement_balance_eur: value(row, "statement_balance_eur") == null ? null : number(row, "statement_balance_eur"),
            minimum_payment: number(row, "minimum_payment"),
            minimum_payment_eur: number(row, "minimum_payment_eur"),
            statement_date: nullableText(row, "statement_date"),
            payment_due_date: nullableText(row, "payment_due_date"),
            interest_charged: number(row, "interest_charged"),
            interest_charged_eur: number(row, "interest_charged_eur"),
          })
        : await encryptDebtPayload(activeVaultKey, userId, id, {
            name: text(row, "name", "Debt"),
            lender: nullableText(row, "lender"),
            description: nullableText(row, "description"),
            category: text(row, "category", "Other"),
            original_balance: number(row, "original_balance"),
            current_balance: number(row, "current_balance"),
            currency: text(row, "currency", "EUR"),
            original_balance_eur: number(row, "original_balance_eur"),
            current_balance_eur: number(row, "current_balance_eur"),
            exchange_rate_to_eur: number(row, "exchange_rate_to_eur", 1),
            annual_interest_rate: number(row, "annual_interest_rate"),
            minimum_payment: number(row, "minimum_payment"),
            minimum_payment_eur: number(row, "minimum_payment_eur"),
          });
      return {
        id,
        debt_kind: isCard ? "credit_card" : "standard",
        encrypted_payload: encryptedPayload,
        payment_due_day: value(row, "payment_due_day"),
        start_date: nullableText(row, "start_date"),
        maturity_date: nullableText(row, "maturity_date"),
        status: text(row, "status", "active"),
        autopay: Boolean(value(row, "autopay")),
        autopay_record_time: nullableText(row, "autopay_record_time"),
        autopay_timezone: nullableText(row, "autopay_timezone"),
        autopay_enabled_at: nullableText(row, "autopay_enabled_at"),
        statement_date: isCard ? nullableText(row, "statement_date") : null,
        payment_due_date: isCard ? nullableText(row, "payment_due_date") : null,
        created_at: nullableText(row, "created_at"),
        updated_at: nullableText(row, "updated_at"),
      };
    }));

    const bills = await Promise.all(payload.data.bills.map(async (row) => {
      const id = maps.bills.get(row.source_id)!;
      return {
        id,
        encrypted_payload: await encryptBillPayload(activeVaultKey, userId, id, {
          name: text(row, "name", "Bill"),
          company: nullableText(row, "company"),
          category: text(row, "category", "Other"),
          amount: number(row, "amount"),
          currency: text(row, "currency", "EUR"),
          amount_eur: number(row, "amount_eur"),
          exchange_rate_to_eur: number(row, "exchange_rate_to_eur", 1),
          payment_method: nullableText(row, "payment_method"),
          notes: nullableText(row, "notes"),
        }),
        due_date: text(row, "due_date"),
        recurrence: text(row, "recurrence", "none"),
        autopay: Boolean(value(row, "autopay")),
        reminder_days: number(row, "reminder_days", 3),
        status: text(row, "status", "pending"),
        paid_at: nullableText(row, "paid_at"),
        transaction_id: txId(value(row, "transaction_id")),
        autopay_record_time: nullableText(row, "autopay_record_time"),
        autopay_timezone: nullableText(row, "autopay_timezone"),
        autopay_enabled_at: nullableText(row, "autopay_enabled_at"),
        recurrence_anchor_day: value(row, "recurrence_anchor_day"),
        recurrence_anchor_month_end: Boolean(value(row, "recurrence_anchor_month_end")),
        created_at: nullableText(row, "created_at"),
        updated_at: nullableText(row, "updated_at"),
      };
    }));

    const goalInvestments = await Promise.all(payload.data.goal_investments.map(async (row) => {
      const id = maps.goal_investments.get(row.source_id)!;
      return {
        id,
        goal_id: goalId(value(row, "goal_id")),
        transaction_id: txId(value(row, "transaction_id"), true),
        invested_at: text(row, "invested_at"),
        encrypted_payload: await encryptGoalInvestmentPayload(activeVaultKey, userId, id, {
          amount: number(row, "amount"),
          original_amount: number(row, "original_amount"),
          currency: text(row, "currency", "EUR"),
          exchange_rate_to_eur: number(row, "exchange_rate_to_eur", 1),
          exchange_rate_date: nullableText(row, "exchange_rate_date"),
          notes: nullableText(row, "notes"),
        }),
        created_at: nullableText(row, "created_at"),
      };
    }));

    const debtPayments = await Promise.all(payload.data.debt_payments.map(async (row) => {
      const id = maps.debt_payments.get(row.source_id)!;
      return {
        id,
        debt_id: debtId(value(row, "debt_id")),
        transaction_id: txId(value(row, "transaction_id")),
        paid_at: text(row, "paid_at"),
        encrypted_payload: await encryptDebtPaymentPayload(activeVaultKey, userId, id, {
          amount: number(row, "amount"),
          currency: text(row, "currency", "EUR"),
          amount_eur: number(row, "amount_eur"),
          exchange_rate_to_eur: number(row, "exchange_rate_to_eur", 1),
          notes: nullableText(row, "notes"),
        }),
        created_at: nullableText(row, "created_at"),
      };
    }));

    const activities = await Promise.all(payload.data.credit_card_activities.map(async (row) => {
      const id = maps.credit_card_activities.get(row.source_id)!;
      return {
        id,
        debt_id: debtId(value(row, "debt_id")),
        occurred_at: text(row, "occurred_at"),
        encrypted_payload: await encryptCreditCardActivityPayload(activeVaultKey, userId, id, {
          activity_type: text(row, "activity_type") as any,
          description: text(row, "description"),
          amount: number(row, "amount"),
          currency: text(row, "currency", "EUR"),
          amount_eur: number(row, "amount_eur"),
          exchange_rate_to_eur: number(row, "exchange_rate_to_eur", 1),
          balance_effect: number(row, "balance_effect"),
          balance_effect_eur: number(row, "balance_effect_eur"),
          notes: nullableText(row, "notes"),
        }),
        created_at: nullableText(row, "created_at"),
      };
    }));

    const monthlyRecords = await Promise.all(payload.data.credit_card_monthly_records.map(async (row) => {
      const id = maps.credit_card_monthly_records.get(row.source_id)!;
      const statementDate = text(row, "statement_date");
      const paymentDueDate = text(row, "payment_due_date");
      return {
        id,
        debt_id: debtId(value(row, "debt_id")),
        month_start: text(row, "month_start", `${statementDate.slice(0, 7)}-01`),
        statement_date: statementDate,
        payment_due_date: paymentDueDate,
        encrypted_payload: await encryptCreditCardMonthlyRecordPayload(activeVaultKey, userId, id, {
          currency: text(row, "currency", "EUR"),
          statement_balance: number(row, "statement_balance"),
          statement_balance_eur: number(row, "statement_balance_eur"),
          minimum_payment: number(row, "minimum_payment"),
          minimum_payment_eur: number(row, "minimum_payment_eur"),
          interest_charged: number(row, "interest_charged"),
          interest_charged_eur: number(row, "interest_charged_eur"),
          statement_date: statementDate,
          payment_due_date: paymentDueDate,
        }),
        created_at: nullableText(row, "created_at"),
        updated_at: nullableText(row, "updated_at"),
      };
    }));

    const plans = await Promise.all(payload.data.monthly_budget_plans.map(async (row) => {
      const id = maps.monthly_budget_plans.get(row.source_id)!;
      return {
        id,
        month: text(row, "month"),
        encrypted_payload: await encryptMonthlyPlanPayload(activeVaultKey, userId, id, {
          start_balance: number(row, "start_balance"),
          spending_budget: number(row, "spending_budget"),
        }),
        created_at: nullableText(row, "created_at"),
        updated_at: nullableText(row, "updated_at"),
      };
    }));

    const items = await Promise.all(payload.data.monthly_budget_items.map(async (row) => {
      const id = maps.monthly_budget_items.get(row.source_id)!;
      return {
        id,
        month: text(row, "month"),
        position: number(row, "position"),
        encrypted_payload: await encryptMonthlyPlanItemPayload(activeVaultKey, userId, id, {
          section: text(row, "section") as any,
          label: text(row, "label"),
          planned_amount: number(row, "planned_amount"),
        }),
        created_at: nullableText(row, "created_at"),
        updated_at: nullableText(row, "updated_at"),
      };
    }));

    return {
      transactions,
      bills,
      goals,
      goal_investments: goalInvestments,
      debts,
      debt_payments: debtPayments,
      credit_card_activities: activities,
      credit_card_monthly_records: monthlyRecords,
      monthly_budget_plans: plans,
      monthly_budget_items: items,
    };
  }

  async function restoreIntoCurrentAccount() {
    if (!inspected) {
      setNotice({ type: "error", text: "Verify the backup before restoring it." });
      return;
    }
    if (restoreConfirmation !== "RESTORE") {
      setNotice({ type: "error", text: "Type RESTORE exactly to confirm the migration." });
      return;
    }

    setBusy("restore");
    setNotice(null);
    try {
      const atomicPayload = await prepareAtomicRestorePayload(inspected.payload);
      const result = await (supabase as any).rpc("restore_portable_backup_v2", {
        p_payload: atomicPayload,
      });
      if (result.error) throw result.error;
      notifyFiconterDataChange("all");
      setNotice({
        type: "success",
        text: `Restore completed successfully. ${backupCounts(inspected.payload)} financial records were migrated into this account and re-encrypted for its Financial Vault.`,
      });
      setRestoreConfirmation("");
      setRestorePassphrase("");
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "The restore could not be completed. No partial restore should be kept.",
      });
    } finally {
      setBusy(null);
    }
  }

  function destinationNotice(provider: string) {
    setNotice({
      type: "info",
      text: `${provider} requires the customer to connect their own storage provider. FICONTER will not become the destination for personal backup files.`,
    });
  }

  return (
    <section className={styles.panel} aria-labelledby="portable-backup-title">
      <div className={styles.heading}>
        <div className={styles.headingIcon}><FolderLock size={22} /></div>
        <div>
          <span className={styles.eyebrow}>PORTABLE CUSTOMER BACKUP</span>
          <h2 id="portable-backup-title">Backup & recovery</h2>
          <p>
            Create an encrypted portable archive that can be restored into a new FICONTER account. The archive is decrypted and re-encrypted in your browser; FICONTER does not retain the backup file or passphrase.
          </p>
        </div>
      </div>

      {notice ? (
        <div className={`${styles.notice} ${notice.type === "error" ? styles.noticeError : styles.noticeSuccess}`} role="status">
          {notice.type === "success" ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}
          <span>{notice.text}</span>
        </div>
      ) : null}

      <div className={styles.destinationGrid}>
        <button
          type="button"
          className={`${styles.destinationCard} ${styles.destinationCardActive} ${styles.destinationButton}`}
          onClick={() => createCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
        >
          <div className={styles.destinationTitle}><HardDrive size={20} /><div><strong>Download to device</strong><span>Available now</span></div></div>
          <p>Create a portable encrypted archive for a computer, phone, external drive, or synced folder you control.</p>
        </button>
        <button type="button" className={`${styles.destinationCard} ${styles.destinationButton}`} onClick={() => destinationNotice("Google Drive")}>
          <div className={styles.destinationTitle}><Cloud size={20} /><div><strong>Google Drive</strong><span>Provider connection required</span></div></div>
          <p>Direct backup will be enabled only after the customer connects their own Google account.</p>
        </button>
        <button type="button" className={`${styles.destinationCard} ${styles.destinationButton}`} onClick={() => destinationNotice("OneDrive / Dropbox")}>
          <div className={styles.destinationTitle}><Cloud size={20} /><div><strong>OneDrive / Dropbox</strong><span>Provider connection required</span></div></div>
          <p>The encrypted archive will go to the customer's connected provider, not FICONTER storage.</p>
        </button>
        <button type="button" className={`${styles.destinationCard} ${styles.destinationButton}`} onClick={() => destinationNotice("Private cloud / S3")}>
          <div className={styles.destinationTitle}><FileKey2 size={20} /><div><strong>Private cloud / S3</strong><span>Business connector planned</span></div></div>
          <p>For customers who want to use their own object-storage account or company bucket.</p>
        </button>
      </div>

      <div className={styles.workspaceGrid}>
        <div className={styles.workspaceCard} ref={createCardRef}>
          <div className={styles.workspaceTitle}>
            <Download size={20} />
            <div><h3>Create portable backup</h3><p>Financial records are opened with your current Vault, then protected by the backup passphrase.</p></div>
          </div>
          <label className={styles.field}>
            <span>Backup passphrase</span>
            <div className={styles.inputWrap}><KeyRound size={17} /><input type="password" value={backupPassphrase} onChange={(event) => setBackupPassphrase(event.target.value)} autoComplete="new-password" placeholder="At least 12 characters" /></div>
          </label>
          <label className={styles.field}>
            <span>Confirm backup passphrase</span>
            <div className={styles.inputWrap}><KeyRound size={17} /><input type="password" value={backupPassphraseConfirm} onChange={(event) => setBackupPassphraseConfirm(event.target.value)} autoComplete="new-password" placeholder="Repeat the passphrase" /></div>
          </label>
          <button type="button" className={styles.primaryButton} onClick={() => void createPortableBackup()} disabled={busy !== null}>
            <Download size={17} />{busy === "create" ? "Preparing portable backup…" : "Create & download backup"}
          </button>
          <p className={styles.finePrint}>Your Financial Vault must be unlocked. FICONTER cannot recover a forgotten backup passphrase.</p>
        </div>

        <div className={styles.workspaceCard} ref={restoreCardRef}>
          <div className={styles.workspaceTitle}>
            <Upload size={20} />
            <div><h3>Restore into this account</h3><p>Use a Portable Backup v2 from a previous account. The target financial workspace must be empty.</p></div>
          </div>
          <label className={styles.filePicker}>
            <span>{restoreFile ? restoreFile.name : "Choose .ficonter-backup file"}</span>
            <input type="file" accept=".ficonter-backup,application/json" onChange={chooseRestoreFile} />
          </label>
          <label className={styles.field}>
            <span>Backup passphrase</span>
            <div className={styles.inputWrap}><KeyRound size={17} /><input type="password" value={restorePassphrase} onChange={(event) => { setRestorePassphrase(event.target.value); setInspected(null); setRestoreConfirmation(""); }} autoComplete="current-password" placeholder="Enter backup passphrase" /></div>
          </label>
          <button type="button" className={styles.secondaryButton} onClick={() => void inspectBackup()} disabled={busy !== null}>
            <ShieldCheck size={17} />{busy === "inspect" ? "Checking backup…" : "Verify & preview backup"}
          </button>

          {inspected ? (
            <div className={styles.boundaryNote}>
              <RefreshCcw size={18} />
              <p>
                <strong>Ready to migrate:</strong> {backupCounts(inspected.payload)} records from {inspected.payload.source_account.email || "the previous account"}. Backup created {new Date(inspected.envelope.created_at).toLocaleString()}. The new account keeps its own login, subscription, and Financial Vault.
              </p>
            </div>
          ) : null}

          {inspected ? (
            <>
              <label className={styles.field}>
                <span>Type RESTORE to confirm</span>
                <div className={styles.inputWrap}><ShieldCheck size={17} /><input value={restoreConfirmation} onChange={(event) => setRestoreConfirmation(event.target.value.toUpperCase())} autoComplete="off" placeholder="RESTORE" /></div>
              </label>
              <button type="button" className={styles.primaryButton} onClick={() => void restoreIntoCurrentAccount()} disabled={busy !== null || restoreConfirmation !== "RESTORE"}>
                <Upload size={17} />{busy === "restore" ? "Restoring securely…" : "Restore into this account"}
              </button>
            </>
          ) : null}
          <p className={styles.finePrint}>Restore is atomic: if validation or insertion fails, the database operation is rolled back. Existing financial workspaces are not merged automatically.</p>
        </div>
      </div>

      <div className={styles.boundaryNote}>
        <ShieldCheck size={18} />
        <p>
          <strong>Security boundary:</strong> Authentication credentials, passwords, subscriptions, admin roles, support history, and Financial Vault keys are never migrated. Uploaded document file bytes are not included yet; the portable backup currently covers the supported financial database records shown above.
        </p>
      </div>
    </section>
  );
}
