"use client";

import { FormEvent, useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";

import styles from "./BetaDomainAccessGate.module.css";

export function BetaDomainAccessGate() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function activateBeta(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

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
      setLoading(false);
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
          <span>FICONTER Private Beta</span>
          <h1 id="beta-access-title">Beta invitation required</h1>
          <p>
            Access to this Beta address is blocked for normal customer accounts
            until a valid invitation code is verified. Changing the URL to Beta
            never grants access.
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
              disabled={loading}
              autoFocus
              required
            />
          </div>

          {error ? <div className={styles.error}>{error}</div> : null}

          <button
            className={styles.primary}
            type="submit"
            disabled={loading || !code.trim()}
          >
            {loading ? "Checking invitation…" : "Verify and enter Beta"}
          </button>
        </form>

        <small className={styles.note}>
          Without a valid invitation, your customer account remains on its normal
          plan — Free by default — and this Beta dashboard stays blocked.
        </small>
      </section>
    </main>
  );
}
