"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  KeyRound,
  Lock,
  ShieldCheck,
  Unlock,
} from "lucide-react";

import { useVault } from "@/components/VaultProvider";

export function VaultAccessPanel() {
  const {
    status,
    error,
    createVault,
    unlockVault,
    lockVault,
  } = useVault();

  const [recoveryInput, setRecoveryInput] = useState("");
  const [newRecoveryCode, setNewRecoveryCode] =
    useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localError, setLocalError] = useState("");

  async function handleCreateVault() {
    if (busy) return;

    setBusy(true);
    setLocalError("");
    setCopied(false);

    try {
      const recoveryCode = await createVault();
      setNewRecoveryCode(recoveryCode);
    } catch (caughtError) {
      setLocalError(
        caughtError instanceof Error
          ? caughtError.message
          : "The vault could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock() {
    if (busy) return;

    const code = recoveryInput.trim();

    if (!code) {
      setLocalError("Enter your recovery code.");
      return;
    }

    setBusy(true);
    setLocalError("");

    try {
      await unlockVault(code);
      setRecoveryInput("");
    } catch (caughtError) {
      setLocalError(
        caughtError instanceof Error
          ? caughtError.message
          : "The vault could not be unlocked.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyRecoveryCode() {
    if (!newRecoveryCode) return;

    try {
      await navigator.clipboard.writeText(newRecoveryCode);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2500);
    } catch {
      setLocalError(
        "Automatic copy was blocked. Select the recovery code and copy it manually.",
      );
    }
  }

  function confirmRecoverySaved() {
    setNewRecoveryCode(null);
    setCopied(false);
  }

  function handleLock() {
    lockVault();
    setRecoveryInput("");
    setNewRecoveryCode(null);
    setCopied(false);
    setLocalError("");
  }

  const message = localError || error;

  if (status === "loading") {
    return (
      <section className="rounded-2xl border border-white/10 bg-black/20 p-5 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5" />
          <div>
            <h2 className="font-semibold">
              Financial Vault
            </h2>

            <p className="text-sm opacity-70">
              Checking your encrypted vault…
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (status === "not_created") {
    return (
      <section className="rounded-2xl border border-white/10 bg-black/20 p-5 backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-white/10 p-2">
            <KeyRound className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">
              Create your Financial Vault
            </h2>

            <p className="mt-1 text-sm opacity-70">
              FICONTER will create a private encryption key
              inside this browser. The readable key is not
              stored in the database.
            </p>

            {message ? (
              <p className="mt-3 text-sm text-red-400">
                {message}
              </p>
            ) : null}

            <button
              type="button"
              disabled={busy}
              onClick={handleCreateVault}
              className="mt-4 rounded-xl border border-white/15 px-4 py-2 text-sm font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy
                ? "Creating vault…"
                : "Create secure vault"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (status === "locked") {
    return (
      <section className="rounded-2xl border border-white/10 bg-black/20 p-5 backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-white/10 p-2">
            <Lock className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">
              Financial Vault Locked
            </h2>

            <p className="mt-1 text-sm opacity-70">
              Enter your recovery code to unlock your
              encrypted financial data on this device.
            </p>

            <input
              type="password"
              value={recoveryInput}
              onChange={(event) =>
                setRecoveryInput(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleUnlock();
                }
              }}
              autoComplete="off"
              spellCheck={false}
              placeholder="FICONTER-RECOVERY-1.…"
              className="mt-4 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none transition focus:border-white/30"
            />

            {message ? (
              <p className="mt-3 text-sm text-red-400">
                {message}
              </p>
            ) : null}

            <button
              type="button"
              disabled={busy || !recoveryInput.trim()}
              onClick={handleUnlock}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Unlock className="h-4 w-4" />

              {busy
                ? "Unlocking…"
                : "Unlock vault"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (status === "unlocked") {
    return (
      <section className="rounded-2xl border border-white/10 bg-black/20 p-5 backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-white/10 p-2">
            <ShieldCheck className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">
              Financial Vault Unlocked
            </h2>

            <p className="mt-1 text-sm opacity-70">
              Your encryption key is available only inside
              this browser session.
            </p>

            {newRecoveryCode ? (
              <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
                <p className="font-medium">
                  Save your recovery code now
                </p>

                <p className="mt-1 text-sm opacity-70">
                  You may need this code to unlock your
                  financial vault on another device or after
                  losing browser access.
                </p>

                <div className="mt-4 break-all rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-sm">
                  {newRecoveryCode}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={copyRecoveryCode}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm transition hover:bg-white/10"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}

                    {copied ? "Copied" : "Copy code"}
                  </button>

                  <button
                    type="button"
                    onClick={confirmRecoverySaved}
                    className="rounded-xl border border-white/15 px-3 py-2 text-sm transition hover:bg-white/10"
                  >
                    I saved my recovery code
                  </button>
                </div>

                <p className="mt-3 text-xs opacity-60">
                  Keep it somewhere private. FICONTER
                  should not be able to recreate this code
                  for you.
                </p>
              </div>
            ) : null}

            {message ? (
              <p className="mt-3 text-sm text-red-400">
                {message}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleLock}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-medium transition hover:bg-white/10"
            >
              <Lock className="h-4 w-4" />
              Lock vault
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-red-400/30 bg-red-400/5 p-5">
      <h2 className="font-semibold">
        Financial Vault Error
      </h2>

      <p className="mt-2 text-sm">
        {message ||
          "FICONTER could not initialise the financial vault."}
      </p>
    </section>
  );
}