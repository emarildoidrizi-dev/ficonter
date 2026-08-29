"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Lock, ShieldCheck, Unlock, X } from "lucide-react";

import { useVault } from "@/components/VaultProvider";
import { createClient } from "@/lib/supabase/client";
import {
  clearVaultQuickUnlock,
  hasVaultQuickUnlock,
  recoverCodeWithVaultPin,
  saveVaultQuickUnlock,
} from "@/lib/e2ee/vaultQuickUnlock";
import styles from "./VaultHeaderControl.module.css";

export function VaultHeaderControl({ hidden = false }: { hidden?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const { status, error, createVault, unlockVault, lockVault } = useVault();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [recoveryInput, setRecoveryInput] = useState("");
  const [newRecoveryCode, setNewRecoveryCode] = useState<string | null>(null);
  const [pendingRecoveryCode, setPendingRecoveryCode] = useState<string | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const [quickUnlockEnabled, setQuickUnlockEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const id = data.user?.id ?? "";
      setUserId(id);
      setQuickUnlockEnabled(Boolean(id && hasVaultQuickUnlock(id)));
    });
    return () => { active = false; };
  }, [supabase]);

  useEffect(() => {
    if (!open) {
      setPin("");
      setRecoveryInput("");
      setShowRecovery(false);
      setLocalError("");
      setPendingRecoveryCode(null);
    }
  }, [open]);

  if (hidden) return null;

  const message = localError || error;
  const unlocked = status === "unlocked";
  const label = status === "not_created" ? "Vault setup" : unlocked ? "Vault unlocked" : "Vault locked";

  async function handleCreateVault() {
    if (busy) return;
    setBusy(true);
    setLocalError("");
    try {
      const recoveryCode = await createVault();
      setNewRecoveryCode(recoveryCode);
      setPendingRecoveryCode(recoveryCode);
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "The vault could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRecoveryUnlock() {
    const code = recoveryInput.trim();
    if (!code || busy) return;
    setBusy(true);
    setLocalError("");
    try {
      await unlockVault(code);
      setPendingRecoveryCode(code);
      setRecoveryInput("");
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "The vault could not be unlocked.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePinUnlock() {
    if (!userId || pin.length !== 6 || busy) return;
    setBusy(true);
    setLocalError("");
    try {
      const recoveryCode = await recoverCodeWithVaultPin(userId, pin);
      await unlockVault(recoveryCode);
      setPin("");
      setOpen(false);
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "Quick unlock failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEnablePin() {
    if (!userId || pin.length !== 6 || !pendingRecoveryCode || busy) return;
    setBusy(true);
    setLocalError("");
    try {
      await saveVaultQuickUnlock(userId, pin, pendingRecoveryCode);
      setQuickUnlockEnabled(true);
      setPin("");
      setPendingRecoveryCode(null);
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "Quick unlock could not be enabled.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyRecoveryCode() {
    if (!newRecoveryCode) return;
    try {
      await navigator.clipboard.writeText(newRecoveryCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setLocalError("Copy was blocked. Select the recovery code and copy it manually.");
    }
  }

  function handleDisableQuickUnlock() {
    if (!userId) return;
    clearVaultQuickUnlock(userId);
    setQuickUnlockEnabled(false);
    setPin("");
  }

  function handleLock() {
    lockVault();
    setOpen(false);
  }

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={`${styles.trigger}${open ? ` ${styles.triggerOpen}` : ""}`}
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
      >
        {unlocked ? <Unlock size={15} /> : <Lock size={15} />}
        <span>Vault</span>
        <span className={`${styles.statusDot}${unlocked ? ` ${styles.statusDotUnlocked}` : ""}`} aria-hidden="true" />
      </button>

      {open ? (
        <div className={styles.overlay} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-label="Financial Vault">
            <div className={styles.header}>
              <div className={styles.titleRow}>
                <div className={styles.iconBox}>
                  {unlocked ? <ShieldCheck size={20} /> : <Lock size={20} />}
                </div>
                <div>
                  <h2 className={styles.title}>Financial Vault</h2>
                  <p className={styles.subtitle}>
                    {status === "not_created"
                      ? "Create your private encrypted vault."
                      : unlocked
                        ? "Your encrypted financial data is available on this device."
                        : "Unlock your encrypted financial data."}
                  </p>
                </div>
              </div>
              <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {status === "loading" ? (
              <div className={styles.notice}>Checking your encrypted vault…</div>
            ) : null}

            {status === "not_created" ? (
              <>
                <div className={styles.notice}>
                  FICONTER creates the encryption key inside your browser. The readable vault key is never stored in the database.
                </div>
                <button type="button" className={styles.primary} disabled={busy} onClick={handleCreateVault}>
                  {busy ? "Creating vault…" : "Create secure vault"}
                </button>
              </>
            ) : null}

            {status === "locked" && quickUnlockEnabled && !showRecovery ? (
              <div className={styles.pinWrap}>
                <div className={styles.pinLabel}>Enter your 6-digit FICONTER PIN</div>
                <input
                  autoFocus
                  className={styles.pinInput}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(event) => { if (event.key === "Enter") void handlePinUnlock(); }}
                  aria-label="6-digit FICONTER PIN"
                />
                <button type="button" className={styles.primary} disabled={busy || pin.length !== 6} onClick={handlePinUnlock}>
                  {busy ? "Unlocking…" : "Unlock vault"}
                </button>
                <button type="button" className={styles.textButton} onClick={() => { setShowRecovery(true); setPin(""); setLocalError(""); }}>
                  Forgot PIN? Use recovery code
                </button>
              </div>
            ) : null}

            {status === "locked" && (!quickUnlockEnabled || showRecovery) ? (
              <>
                <div className={styles.notice}>
                  Use your recovery code on a new device, after forgetting your PIN, or when Quick Unlock is unavailable.
                </div>
                <input
                  className={styles.field}
                  type="password"
                  value={recoveryInput}
                  onChange={(event) => setRecoveryInput(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") void handleRecoveryUnlock(); }}
                  placeholder="FICONTER-RECOVERY-1.…"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button type="button" className={styles.primary} disabled={busy || !recoveryInput.trim()} onClick={handleRecoveryUnlock}>
                  {busy ? "Unlocking…" : "Unlock with recovery code"}
                </button>
                {quickUnlockEnabled ? (
                  <button type="button" className={styles.textButton} onClick={() => { setShowRecovery(false); setLocalError(""); }}>
                    Back to PIN
                  </button>
                ) : null}
              </>
            ) : null}

            {unlocked ? (
              <>
                <div className={styles.unlockedCard}>
                  <div className={styles.unlockedTitle}><Check size={17} /> Vault unlocked</div>
                  <p className={styles.unlockedText}>Your active encryption key remains inside this browser session.</p>
                </div>

                {newRecoveryCode ? (
                  <div className={styles.notice}>
                    <strong>Save your recovery code now.</strong> You may need it on another device or if Quick Unlock is unavailable.
                    <div className={styles.recoveryCode}>{newRecoveryCode}</div>
                    <div className={styles.actions}>
                      <button type="button" className={styles.secondary} onClick={handleCopyRecoveryCode}>
                        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy code"}
                      </button>
                      <button type="button" className={styles.secondary} onClick={() => setNewRecoveryCode(null)}>I saved it</button>
                    </div>
                  </div>
                ) : null}

                {!quickUnlockEnabled ? (
                  <div className={styles.pinWrap}>
                    <div className={styles.pinLabel}>Set a 6-digit Quick Unlock PIN for this device</div>
                    {pendingRecoveryCode ? (
                      <>
                        <input
                          className={styles.pinInput}
                          inputMode="numeric"
                          autoComplete="new-password"
                          maxLength={6}
                          value={pin}
                          onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                          aria-label="Create 6-digit FICONTER PIN"
                        />
                        <button type="button" className={styles.primary} disabled={busy || pin.length !== 6} onClick={handleEnablePin}>
                          {busy ? "Saving…" : "Enable Quick Unlock"}
                        </button>
                      </>
                    ) : (
                      <p className={styles.unlockedText}>To enable Quick Unlock, lock the vault and unlock once with your recovery code.</p>
                    )}
                  </div>
                ) : (
                  <button type="button" className={styles.secondary} onClick={handleDisableQuickUnlock}>
                    Remove Quick Unlock from this device
                  </button>
                )}

                <button type="button" className={styles.secondary} onClick={handleLock}>Lock vault now</button>
              </>
            ) : null}

            {message ? <p className={styles.error}>{message}</p> : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
