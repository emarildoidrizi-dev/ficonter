"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Fingerprint, Lock, ShieldCheck, Unlock, X } from "lucide-react";

import { useVault } from "@/components/VaultProvider";
import { createClient } from "@/lib/supabase/client";
import {
  clearVaultQuickUnlock,
  hasVaultQuickUnlock,
  recoverCodeWithVaultPin,
  saveVaultQuickUnlock,
} from "@/lib/e2ee/vaultQuickUnlock";
import {
  clearVaultPasskeyUnlock,
  hasVaultPasskeyUnlock,
  recoverCodeWithVaultPasskey,
  saveVaultPasskeyUnlock,
} from "@/lib/e2ee/vaultPasskeyUnlock";
import styles from "./VaultHeaderControl.module.css";

type SetupTarget = "pin" | "passkey" | null;

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
  const [showPinFallback, setShowPinFallback] = useState(false);
  const [setupTarget, setSetupTarget] = useState<SetupTarget>(null);
  const [quickUnlockEnabled, setQuickUnlockEnabled] = useState(false);
  const [passkeyUnlockEnabled, setPasskeyUnlockEnabled] = useState(false);
  const [passkeyCapable, setPasskeyCapable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPasskeyCapable(
      Boolean(
        typeof window !== "undefined" &&
          window.isSecureContext &&
          typeof PublicKeyCredential !== "undefined" &&
          navigator.credentials,
      ),
    );

    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const id = data.user?.id ?? "";
      setUserId(id);
      setQuickUnlockEnabled(Boolean(id && hasVaultQuickUnlock(id)));
      setPasskeyUnlockEnabled(Boolean(id && hasVaultPasskeyUnlock(id)));
    });
    return () => { active = false; };
  }, [supabase]);

  useEffect(() => {
    if (!open) {
      setPin("");
      setRecoveryInput("");
      setShowRecovery(false);
      setShowPinFallback(false);
      setSetupTarget(null);
      setLocalError("");
      setPendingRecoveryCode(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
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
      setSetupTarget(null);
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
      setRecoveryInput("");
      setPendingRecoveryCode(code);
      setPin("");

      if (!setupTarget && (quickUnlockEnabled || passkeyUnlockEnabled)) {
        setOpen(false);
      }
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "The vault could not be unlocked.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePasskeyUnlock() {
    if (!userId || busy) return;
    setBusy(true);
    setLocalError("");
    try {
      const { data, error: passkeyError } = await supabase.auth.signInWithPasskey();
      if (passkeyError) throw passkeyError;
      if (!data.user || data.user.id !== userId) {
        throw new Error("The verified passkey belongs to a different FICONTER account.");
      }

      const recoveryCode = await recoverCodeWithVaultPasskey(userId);
      await unlockVault(recoveryCode);
      setOpen(false);
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "Passkey vault unlock failed.");
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

  async function handleEnablePasskeyUnlock() {
    if (!userId || !pendingRecoveryCode || busy) return;
    setBusy(true);
    setLocalError("");
    try {
      const { data: passkeys, error: passkeyError } = await supabase.auth.passkey.list();
      if (passkeyError) throw passkeyError;
      if (!passkeys?.length) {
        throw new Error(
          "Add a passkey in Settings → Account & security first, then return here to enable Face ID / passkey vault unlock.",
        );
      }

      await saveVaultPasskeyUnlock(userId, pendingRecoveryCode);
      setPasskeyUnlockEnabled(true);
      setPendingRecoveryCode(null);
      setSetupTarget(null);
      setOpen(false);
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "Passkey vault unlock could not be enabled.");
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
      setSetupTarget(null);
      setOpen(false);
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

  async function handleDisablePasskeyUnlock() {
    if (!userId || busy) return;
    setBusy(true);
    setLocalError("");
    try {
      await clearVaultPasskeyUnlock(userId);
      setPasskeyUnlockEnabled(false);
    } finally {
      setBusy(false);
    }
  }

  function handleStartPinSetup() {
    setSetupTarget("pin");
    lockVault();
    setShowRecovery(true);
    setShowPinFallback(false);
    setLocalError("");
    setPin("");
    setRecoveryInput("");
  }

  function handleStartPasskeySetup() {
    setSetupTarget("passkey");
    lockVault();
    setShowRecovery(true);
    setShowPinFallback(false);
    setLocalError("");
    setPin("");
    setRecoveryInput("");
  }

  function handleLock() {
    lockVault();
    setOpen(false);
  }

  const dialog = open && typeof document !== "undefined" ? createPortal(
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

        {status === "locked" && passkeyUnlockEnabled && !showRecovery && !showPinFallback ? (
          <div className={styles.pinWrap}>
            <div className={styles.biometricIcon}><Fingerprint size={26} aria-hidden="true" /></div>
            <div className={styles.pinLabel}>Unlock with Face ID / passkey</div>
            <p className={styles.unlockedText}>
              Your device verifies you. FICONTER never receives your fingerprint or face data.
            </p>
            <button type="button" className={styles.primary} disabled={busy} onClick={() => void handlePasskeyUnlock()}>
              <Fingerprint size={16} aria-hidden="true" />
              {busy ? "Verifying…" : "Unlock with Face ID / passkey"}
            </button>
            {quickUnlockEnabled ? (
              <button type="button" className={styles.textButton} onClick={() => { setShowPinFallback(true); setLocalError(""); }}>
                Use 6-digit PIN instead
              </button>
            ) : null}
            <button type="button" className={styles.textButton} onClick={() => { setShowRecovery(true); setLocalError(""); }}>
              Use recovery code
            </button>
          </div>
        ) : null}

        {status === "locked" && quickUnlockEnabled && !showRecovery && (!passkeyUnlockEnabled || showPinFallback) ? (
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
            {passkeyUnlockEnabled ? (
              <button type="button" className={styles.textButton} onClick={() => { setShowPinFallback(false); setPin(""); setLocalError(""); }}>
                Back to Face ID / passkey
              </button>
            ) : null}
            <button type="button" className={styles.textButton} onClick={() => { setShowRecovery(true); setPin(""); setLocalError(""); }}>
              Forgot PIN? Use recovery code
            </button>
          </div>
        ) : null}

        {status === "locked" && (showRecovery || (!quickUnlockEnabled && !passkeyUnlockEnabled)) ? (
          <>
            <div className={styles.notice}>
              <strong>Your recovery code stays exactly the same.</strong> Enter it to unlock the Vault or to authorize a secure shortcut on this device.
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
              {busy ? "Verifying…" : "Verify recovery code"}
            </button>
            {passkeyUnlockEnabled ? (
              <button type="button" className={styles.textButton} onClick={() => { setShowRecovery(false); setShowPinFallback(false); setLocalError(""); }}>
                Back to Face ID / passkey
              </button>
            ) : quickUnlockEnabled ? (
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
                <strong>Save your recovery code now.</strong> You may need it on another device or whenever passkey/PIN unlock is unavailable.
                <div className={styles.recoveryCode}>{newRecoveryCode}</div>
                <div className={styles.actions}>
                  <button type="button" className={styles.secondary} onClick={handleCopyRecoveryCode}>
                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy code"}
                  </button>
                  <button type="button" className={styles.secondary} onClick={() => setNewRecoveryCode(null)}>I saved it</button>
                </div>
              </div>
            ) : null}

            {passkeyCapable && !passkeyUnlockEnabled ? (
              <div className={styles.pinWrap}>
                <div className={styles.biometricIcon}><Fingerprint size={24} aria-hidden="true" /></div>
                <div className={styles.pinLabel}>Face ID / passkey Vault Unlock</div>
                {pendingRecoveryCode && setupTarget !== "pin" ? (
                  <>
                    <p className={styles.unlockedText}>
                      Protect a device-only Vault shortcut behind your registered FICONTER passkey. Your recovery code is encrypted locally and never sent to FICONTER.
                    </p>
                    <button type="button" className={styles.primary} disabled={busy} onClick={() => void handleEnablePasskeyUnlock()}>
                      <Fingerprint size={16} aria-hidden="true" />
                      {busy ? "Enabling…" : "Enable Face ID / passkey unlock"}
                    </button>
                  </>
                ) : (
                  <>
                    <p className={styles.unlockedText}>
                      Verify your recovery code once to authorize passkey-protected Vault unlock on this device.
                    </p>
                    <button type="button" className={styles.primary} onClick={handleStartPasskeySetup}>
                      Set up Face ID / passkey unlock
                    </button>
                  </>
                )}
              </div>
            ) : passkeyUnlockEnabled ? (
              <button type="button" className={styles.secondary} disabled={busy} onClick={() => void handleDisablePasskeyUnlock()}>
                Remove Face ID / passkey Vault Unlock from this device
              </button>
            ) : null}

            {!quickUnlockEnabled ? (
              <div className={styles.pinWrap}>
                <div className={styles.pinLabel}>Set a 6-digit Quick Unlock PIN for this device</div>
                {pendingRecoveryCode && setupTarget !== "passkey" ? (
                  <>
                    <p className={styles.unlockedText}>This PIN is an extra device shortcut. It does not replace, reset, or modify your recovery code.</p>
                    <input
                      className={styles.pinInput}
                      inputMode="numeric"
                      autoComplete="new-password"
                      maxLength={6}
                      value={pin}
                      onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      onKeyDown={(event) => { if (event.key === "Enter") void handleEnablePin(); }}
                      aria-label="Create 6-digit FICONTER PIN"
                    />
                    <button type="button" className={styles.primary} disabled={busy || pin.length !== 6} onClick={handleEnablePin}>
                      {busy ? "Saving…" : "Create 6-digit PIN"}
                    </button>
                  </>
                ) : (
                  <>
                    <p className={styles.unlockedText}>Your recovery code will remain unchanged. Verify it once to authorize Quick Unlock on this device.</p>
                    <button type="button" className={styles.primary} onClick={handleStartPinSetup}>Set up 6-digit PIN</button>
                  </>
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
    </div>,
    document.body,
  ) : null;

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
      {dialog}
    </div>
  );
}
