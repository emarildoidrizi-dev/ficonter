"use client";

import { ChangeEvent, useMemo, useState } from "react";
import {
  CheckCircle2,
  Cloud,
  Download,
  FileKey2,
  FolderLock,
  HardDrive,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEncryptedTransactions } from "@/components/EncryptedTransactionProvider";
import { useVault } from "@/components/VaultProvider";
import type { AccountExportPayload, AccountExportTable } from "@/lib/accountExport";
import styles from "./BackupRecoverySettings.module.css";

type Props = {
  userId: string;
  email: string;
  metadata: Record<string, unknown>;
};

type Notice = { type: "success" | "error"; text: string } | null;

type BackupEnvelope = {
  format: "ficonter-encrypted-backup";
  version: 1;
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

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();
const PBKDF2_ITERATIONS = 310000;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
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
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptBackup(payload: AccountExportPayload, passphrase: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(passphrase, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    ENCODER.encode(JSON.stringify(payload)),
  );

  return {
    format: "ficonter-encrypted-backup",
    version: 1,
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
  } satisfies BackupEnvelope;
}

async function decryptBackup(envelope: BackupEnvelope, passphrase: string) {
  const salt = base64ToBytes(envelope.encryption.salt);
  const iv = base64ToBytes(envelope.encryption.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  const key = await deriveBackupKey(passphrase, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return JSON.parse(DECODER.decode(decrypted)) as AccountExportPayload;
}

function downloadBackup(filename: string, content: string) {
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

export function BackupRecoverySettings({ userId, email, metadata }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { transactions: decryptedTransactions } = useEncryptedTransactions();
  const { status: vaultStatus } = useVault();
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [verifyPassphrase, setVerifyPassphrase] = useState("");
  const [verifyFile, setVerifyFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function loadBackupPayload(): Promise<AccountExportPayload> {
    if (vaultStatus !== "unlocked") {
      throw new Error("Unlock your Financial Vault before creating a backup.");
    }

    type ExportQueryResult = {
      data: unknown[] | null;
      error: { message: string } | null;
    };

    async function collectUserRows(
      table: AccountExportTable,
      query: PromiseLike<ExportQueryResult>,
    ) {
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return [table, (data ?? []) as Record<string, unknown>[]] as const;
    }

    const results: Array<readonly [AccountExportTable, Record<string, unknown>[]]> =
      await Promise.all([
        Promise.resolve([
          "transactions",
          decryptedTransactions as unknown as Record<string, unknown>[],
        ] as const),
        collectUserRows("bills", supabase.from("bills").select("*").eq("user_id", userId)),
        collectUserRows("goals", supabase.from("goals").select("*").eq("user_id", userId)),
        collectUserRows(
          "goal_investments",
          supabase.from("goal_investments").select("*").eq("user_id", userId),
        ),
        collectUserRows("debts", supabase.from("debts").select("*").eq("user_id", userId)),
        collectUserRows(
          "debt_payments",
          supabase.from("debt_payments").select("*").eq("user_id", userId),
        ),
        collectUserRows(
          "credit_card_activities",
          supabase.from("credit_card_activities").select("*").eq("user_id", userId),
        ),
        collectUserRows(
          "credit_card_monthly_records",
          supabase.from("credit_card_monthly_records").select("*").eq("user_id", userId),
        ),
        collectUserRows(
          "monthly_budget_plans",
          supabase.from("monthly_budget_plans").select("*").eq("user_id", userId),
        ),
        collectUserRows(
          "monthly_budget_items",
          supabase.from("monthly_budget_items").select("*").eq("user_id", userId),
        ),
        collectUserRows(
          "financial_documents",
          supabase.from("financial_documents").select("*").eq("user_id", userId),
        ),
        collectUserRows(
          "support_requests",
          supabase.from("support_requests").select("*").eq("user_id", userId),
        ),
        collectUserRows(
          "user_notifications",
          supabase.from("user_notifications").select("*").eq("user_id", userId),
        ),
      ]);

    const { data: supportMessages, error: supportMessagesError } = await supabase
      .from("support_messages")
      .select("*");
    if (supportMessagesError) throw supportMessagesError;
    results.push([
      "support_messages",
      (supportMessages ?? []) as Record<string, unknown>[],
    ]);

    const fullName = String(metadata.full_name ?? metadata.name ?? "").trim();
    const displayName = String(
      metadata.display_name ?? metadata.full_name ?? metadata.name ?? "",
    ).trim();
    const preferences =
      metadata.ficonter_preferences && typeof metadata.ficonter_preferences === "object"
        ? (metadata.ficonter_preferences as Record<string, unknown>)
        : {};

    return {
      schema_version: "1.4",
      export_type: "ficonter-account-archive",
      exported_at: new Date().toISOString(),
      privacy: {
        owner_only: true,
        excludes_authentication_secrets: true,
      },
      account: {
        id: userId,
        email,
        full_name: fullName,
        display_name: displayName,
      },
      preferences,
      data: Object.fromEntries(results) as AccountExportPayload["data"],
    };
  }

  async function createDeviceBackup() {
    setNotice(null);
    if (passphrase.length < 12) {
      setNotice({
        type: "error",
        text: "Use a backup passphrase with at least 12 characters.",
      });
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setNotice({ type: "error", text: "The backup passphrases do not match." });
      return;
    }

    setBusy(true);
    try {
      const payload = await loadBackupPayload();
      const envelope = await encryptBackup(payload, passphrase);
      const date = envelope.created_at.slice(0, 10);
      downloadBackup(
        `ficonter-encrypted-backup-${date}.ficonter-backup`,
        JSON.stringify(envelope),
      );
      setPassphrase("");
      setConfirmPassphrase("");
      setNotice({
        type: "success",
        text: "Encrypted backup created. FICONTER did not keep a copy of the backup file or your backup passphrase.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "The backup could not be created.",
      });
    } finally {
      setBusy(false);
    }
  }

  function chooseVerifyFile(event: ChangeEvent<HTMLInputElement>) {
    setVerifyFile(event.target.files?.[0] ?? null);
    setNotice(null);
  }

  async function verifyExistingBackup() {
    setNotice(null);
    if (!verifyFile) {
      setNotice({ type: "error", text: "Choose a FICONTER backup file first." });
      return;
    }
    if (!verifyPassphrase) {
      setNotice({ type: "error", text: "Enter the backup passphrase." });
      return;
    }

    setBusy(true);
    try {
      const envelope = JSON.parse(await verifyFile.text()) as BackupEnvelope;
      if (
        envelope.format !== "ficonter-encrypted-backup" ||
        envelope.version !== 1 ||
        envelope.encryption?.algorithm !== "AES-GCM"
      ) {
        throw new Error("This is not a supported FICONTER encrypted backup file.");
      }
      const payload = await decryptBackup(envelope, verifyPassphrase);
      if (
        payload.export_type !== "ficonter-account-archive" ||
        payload.account?.id !== userId
      ) {
        throw new Error("This backup does not belong to the signed-in FICONTER account.");
      }
      setNotice({
        type: "success",
        text: `Backup verified successfully. Created ${new Date(envelope.created_at).toLocaleString()}.`,
      });
      setVerifyPassphrase("");
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "The backup could not be verified. Check the file and passphrase.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="backup-recovery-title">
      <div className={styles.heading}>
        <div className={styles.headingIcon}>
          <FolderLock size={22} />
        </div>
        <div>
          <span className={styles.eyebrow}>CUSTOMER-CONTROLLED STORAGE</span>
          <h2 id="backup-recovery-title">Backup & recovery</h2>
          <p>
            Your personal backup archive is stored where you choose. FICONTER does not host or retain a copy of your personal backup file.
          </p>
        </div>
      </div>

      {notice ? (
        <div
          className={`${styles.notice} ${notice.type === "error" ? styles.noticeError : styles.noticeSuccess}`}
          role="status"
        >
          {notice.type === "success" ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}
          <span>{notice.text}</span>
        </div>
      ) : null}

      <div className={styles.destinationGrid}>
        <article className={`${styles.destinationCard} ${styles.destinationCardActive}`}>
          <div className={styles.destinationTitle}>
            <HardDrive size={20} />
            <div>
              <strong>Download to device</strong>
              <span>Available now</span>
            </div>
          </div>
          <p>
            Create an encrypted backup file and save it to your computer, phone, external drive or any synced folder you control.
          </p>
        </article>

        <article className={styles.destinationCard}>
          <div className={styles.destinationTitle}>
            <Cloud size={20} />
            <div>
              <strong>Google Drive</strong>
              <span>Provider connection required</span>
            </div>
          </div>
          <p>Direct-to-Drive backup will be enabled only after the customer connects their own Google account.</p>
        </article>

        <article className={styles.destinationCard}>
          <div className={styles.destinationTitle}>
            <Cloud size={20} />
            <div>
              <strong>OneDrive / Dropbox</strong>
              <span>Provider connection required</span>
            </div>
          </div>
          <p>Backups will go directly to the customer's connected provider, not to FICONTER storage.</p>
        </article>

        <article className={styles.destinationCard}>
          <div className={styles.destinationTitle}>
            <FileKey2 size={20} />
            <div>
              <strong>Private cloud / S3</strong>
              <span>Business connector planned</span>
            </div>
          </div>
          <p>For advanced users who want to use their own object-storage account or company bucket.</p>
        </article>
      </div>

      <div className={styles.workspaceGrid}>
        <div className={styles.workspaceCard}>
          <div className={styles.workspaceTitle}>
            <Download size={20} />
            <div>
              <h3>Create encrypted backup</h3>
              <p>AES-256-GCM encryption is performed in your browser before the file is saved.</p>
            </div>
          </div>

          <label className={styles.field}>
            <span>Backup passphrase</span>
            <div className={styles.inputWrap}>
              <KeyRound size={17} />
              <input
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                autoComplete="new-password"
                placeholder="At least 12 characters"
              />
            </div>
          </label>

          <label className={styles.field}>
            <span>Confirm backup passphrase</span>
            <div className={styles.inputWrap}>
              <KeyRound size={17} />
              <input
                type="password"
                value={confirmPassphrase}
                onChange={(event) => setConfirmPassphrase(event.target.value)}
                autoComplete="new-password"
                placeholder="Repeat the passphrase"
              />
            </div>
          </label>

          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => void createDeviceBackup()}
            disabled={busy}
          >
            <Download size={17} />
            {busy ? "Preparing…" : "Create & download backup"}
          </button>

          <p className={styles.finePrint}>
            FICONTER cannot recover a forgotten backup passphrase. Keep it somewhere secure and separate from the backup file.
          </p>
        </div>

        <div className={styles.workspaceCard}>
          <div className={styles.workspaceTitle}>
            <ShieldCheck size={20} />
            <div>
              <h3>Verify a backup</h3>
              <p>Check that an encrypted backup is readable and belongs to your signed-in account.</p>
            </div>
          </div>

          <label className={styles.filePicker}>
            <span>{verifyFile ? verifyFile.name : "Choose backup file"}</span>
            <input
              type="file"
              accept=".ficonter-backup,application/json"
              onChange={chooseVerifyFile}
            />
          </label>

          <label className={styles.field}>
            <span>Backup passphrase</span>
            <div className={styles.inputWrap}>
              <KeyRound size={17} />
              <input
                type="password"
                value={verifyPassphrase}
                onChange={(event) => setVerifyPassphrase(event.target.value)}
                autoComplete="current-password"
                placeholder="Enter backup passphrase"
              />
            </div>
          </label>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void verifyExistingBackup()}
            disabled={busy}
          >
            <ShieldCheck size={17} />
            {busy ? "Checking…" : "Verify backup"}
          </button>

          <p className={styles.finePrint}>
            Verification decrypts the file locally in your browser. The backup file is not uploaded to FICONTER.
          </p>
        </div>
      </div>

      <div className={styles.boundaryNote}>
        <ShieldCheck size={18} />
        <p>
          <strong>Important:</strong> Customer backup storage is separate from FICONTER's internal platform-recovery systems. This feature does not make FICONTER the storage provider for personal backup archives.
        </p>
      </div>
    </section>
  );
}
