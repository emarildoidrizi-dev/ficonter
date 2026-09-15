"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Fingerprint, KeyRound, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";

import { isStandaloneDisplayMode } from "@/lib/pwaRuntimeRecovery";
import { createClient } from "@/lib/supabase/client";
import styles from "./PasskeySecuritySettings.module.css";

type PasskeyRecord = {
  id: string;
  friendly_name?: string | null;
  created_at?: string | null;
  last_used_at?: string | null;
};

function passkeysSupportedInBrowser(): boolean {
  return Boolean(
    typeof window !== "undefined" &&
      window.isSecureContext &&
      typeof PublicKeyCredential !== "undefined" &&
      navigator.credentials,
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function findAccountSecurityStack(): HTMLElement | null {
  if (typeof document === "undefined") return null;

  const panels = Array.from(
    document.querySelectorAll<HTMLElement>('[data-mobile-detail] > main'),
  );
  const panel =
    panels.find(
      (candidate) =>
        candidate.querySelector("header h2")?.textContent?.trim() ===
        "Account & security",
    ) ?? null;

  if (!panel) return null;

  const passwordHeading = Array.from(panel.querySelectorAll<HTMLHeadingElement>("h3")).find(
    (heading) => heading.textContent?.trim() === "Change password",
  );
  const passwordCard = passwordHeading?.closest("form");
  const stack = passwordCard?.parentElement;

  return stack instanceof HTMLElement ? stack : null;
}

export function PasskeySecuritySettings() {
  const supabase = useMemo(() => createClient(), []);
  const [appMode, setAppMode] = useState(false);
  const [modeResolved, setModeResolved] = useState(false);
  const [supported, setSupported] = useState(false);
  const [passkeys, setPasskeys] = useState<PasskeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [securityStack, setSecurityStack] = useState<HTMLElement | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadPasskeys = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.passkey.list();
      if (error) throw error;
      setPasskeys((data ?? []) as PasskeyRecord[]);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Passkeys could not be loaded.",
      });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const installedApp = isStandaloneDisplayMode();
    setAppMode(installedApp);
    setSupported(installedApp && passkeysSupportedInBrowser());
    setModeResolved(true);

    if (installedApp) {
      void loadPasskeys();
    } else {
      setLoading(false);
    }
  }, [loadPasskeys]);

  useEffect(() => {
    if (!modeResolved || !appMode || typeof document === "undefined") {
      setSecurityStack(null);
      return;
    }

    const synchronizeHost = () => {
      const next = findAccountSecurityStack();
      setSecurityStack((current) => (current === next ? current : next));
    };

    synchronizeHost();

    const observer = new MutationObserver(synchronizeHost);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [appMode, modeResolved]);

  async function registerPasskey() {
    if (!supported || registering) return;
    setRegistering(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.registerPasskey();
      if (error) throw error;
      await loadPasskeys();
      setMessage({
        type: "success",
        text: "Passkey added. On supported Apple devices, Face ID or Touch ID can now be used to sign in.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "The passkey could not be added.",
      });
    } finally {
      setRegistering(false);
    }
  }

  async function removePasskey(passkeyId: string) {
    if (!passkeyId || busyId) return;
    setBusyId(passkeyId);
    setMessage(null);
    try {
      const { error } = await supabase.auth.passkey.delete({ passkeyId });
      if (error) throw error;
      setPasskeys((current) => current.filter((item) => item.id !== passkeyId));
      setMessage({ type: "success", text: "Passkey removed from your FICONTER account." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "The passkey could not be removed.",
      });
    } finally {
      setBusyId(null);
    }
  }

  function startRename(passkey: PasskeyRecord) {
    setRenamingId(passkey.id);
    setRenameValue(passkey.friendly_name?.trim() || "My passkey");
    setMessage(null);
  }

  async function saveRename(passkeyId: string) {
    const friendlyName = renameValue.trim();
    if (!friendlyName || busyId) return;
    setBusyId(passkeyId);
    setMessage(null);
    try {
      const { error } = await supabase.auth.passkey.update({
        passkeyId,
        friendlyName,
      });
      if (error) throw error;
      setPasskeys((current) =>
        current.map((item) =>
          item.id === passkeyId ? { ...item, friendly_name: friendlyName } : item,
        ),
      );
      setRenamingId(null);
      setRenameValue("");
      setMessage({ type: "success", text: "Passkey name updated." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "The passkey name could not be updated.",
      });
    } finally {
      setBusyId(null);
    }
  }

  if (!modeResolved || !appMode || !securityStack) return null;

  return createPortal(
    <section className={styles.card} aria-labelledby="ficonter-passkeys-title">
      <div className={styles.heading}>
        <div className={styles.icon}><Fingerprint size={22} aria-hidden="true" /></div>
        <div>
          <div className={styles.eyebrow}>Sign-in & authentication</div>
          <h3 id="ficonter-passkeys-title">Passkeys & biometrics</h3>
          <p>
            Manage passkeys for the installed FICONTER app. On supported devices,
            Face ID, Touch ID, or the device authenticator can unlock your passkey.
            FICONTER never receives or stores your biometric data.
          </p>
        </div>
      </div>

      {!supported ? (
        <div className={styles.notice}>
          This device does not currently expose secure passkey authentication. Your password login remains available.
        </div>
      ) : null}

      <div className={styles.toolbar}>
        <div className={styles.securityNote}>
          <ShieldCheck size={16} aria-hidden="true" />
          Passkeys are phishing-resistant and stay protected by your device or password manager.
        </div>
        <button
          type="button"
          className={styles.primary}
          disabled={!supported || registering}
          onClick={() => void registerPasskey()}
        >
          <Plus size={16} aria-hidden="true" />
          {registering ? "Adding passkey…" : "Add passkey"}
        </button>
      </div>

      <div className={styles.list}>
        {loading ? <div className={styles.empty}>Loading passkeys…</div> : null}
        {!loading && passkeys.length === 0 ? (
          <div className={styles.empty}>
            <KeyRound size={18} aria-hidden="true" />
            No app passkeys are registered yet. Your password continues to work normally.
          </div>
        ) : null}

        {passkeys.map((passkey) => {
          const name = passkey.friendly_name?.trim() || "FICONTER app passkey";
          const created = formatDate(passkey.created_at);
          const lastUsed = formatDate(passkey.last_used_at);
          const isBusy = busyId === passkey.id;
          const isRenaming = renamingId === passkey.id;

          return (
            <div className={styles.passkeyRow} key={passkey.id}>
              <div className={styles.passkeyMain}>
                <div className={styles.passkeyIcon}><KeyRound size={17} aria-hidden="true" /></div>
                <div className={styles.passkeyText}>
                  {isRenaming ? (
                    <div className={styles.renameRow}>
                      <input
                        value={renameValue}
                        maxLength={120}
                        onChange={(event) => setRenameValue(event.target.value)}
                        aria-label="Passkey name"
                      />
                      <button
                        type="button"
                        disabled={isBusy || !renameValue.trim()}
                        onClick={() => void saveRename(passkey.id)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setRenamingId(null);
                          setRenameValue("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <strong>{name}</strong>
                      <span>
                        {created ? `Added ${created}` : "Registered passkey"}
                        {lastUsed ? ` · Last used ${lastUsed}` : ""}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {!isRenaming ? (
                <div className={styles.rowActions}>
                  <button type="button" disabled={isBusy} onClick={() => startRename(passkey)}>
                    <Pencil size={15} aria-hidden="true" /> Rename
                  </button>
                  <button
                    type="button"
                    className={styles.danger}
                    disabled={isBusy}
                    onClick={() => void removePasskey(passkey.id)}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    {isBusy ? "Removing…" : "Remove"}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {message ? (
        <div className={message.type === "error" ? styles.error : styles.success} role="status">
          {message.text}
        </div>
      ) : null}
    </section>,
    securityStack,
  );
}
