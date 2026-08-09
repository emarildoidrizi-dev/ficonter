"use client";

import { FormEvent, useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";

import styles from "./BetaDomainAccessGate.module.css";

type Props = {
  currentPlanCode: string;
};

export function BetaDomainAccessGate({ currentPlanCode }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<"activate" | "free" | null>(null);

  const isFree = currentPlanCode === "free";

  async function activateBeta(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading("activate");

    try {
      const response = await fetch("/api/beta/activate", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ code: code.trim() }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Beta access could not be activated.",
        );
      }

      window.location.reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Beta access could not be activated.",
      );
      setLoading(null);
    }
  }

  async function continueWithoutBeta() {
    setError("");
    setLoading("free");

    try {
      const response = await fetch("/api/beta/continue-free", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Your normal account could not be opened.",
        );
      }

      window.location.reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Your normal account could not be opened.",
      );
      setLoading(null);
    }
  }

  return (
    <main className={styles.screen}>
      <section
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="beta-access-title"
      >
        <div className={styles.icon} aria-hidden="true">
          <ShieldCheck size={28} />
        </div>
        <div className={styles.heading}>
          <span>Private Beta Access</span>
          <h1 id="beta-access-title">Invitation required</h1>
          <p>
            This FICONTER Beta address does not upgrade your account by itself.
            Enter a valid private invitation code to activate Beta access.
          </p>
        </div>

        <form className={styles.form} onSubmit={activateBeta}>
          <label htmlFor="ficonter-beta-code">Beta invitation code</label>
          <div className={styles.inputWrap}>
            <KeyRound size={18} aria-hidden="true" />
            <input
              id="ficonter-beta-code"
              type="password"
              autoComplete="off"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Enter invitation code"
              disabled={loading !== null}
              autoFocus
              required
            />
          </div>

          {error ? <div className={styles.error}>{error}</div> : null}

          <button
            className={styles.primary}
            type="submit"
            disabled={loading !== null || !code.trim()}
          >
            {loading === "activate"
              ? "Checking invitation…"
              : "Activate Beta access"}
          </button>
        </form>

        <div className={styles.divider}><span>or</span></div>

        <button
          className={styles.secondary}
          type="button"
          onClick={() => void continueWithoutBeta()}
          disabled={loading !== null}
        >
          {loading === "free"
            ? "Opening normal account…"
            : isFree
              ? "Continue with Free plan"
              : "Continue with current plan"}
        </button>

        <small className={styles.note}>
          Without a validated invitation, FICONTER will not grant Beta privileges.
        </small>
      </section>
    </main>
  );
}
