"use client";

import { useEffect, useState } from "react";

type StatusPayload = {
  exists?: boolean;
  userId?: string | null;
  email?: string;
  name?: string;
  password?: string;
  error?: string;
};

export function StagingTestCustomerManager() {
  const [state, setState] = useState<StatusPayload>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    const response = await fetch("/api/admin/test-customer", {
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as StatusPayload;
    if (!response.ok) throw new Error(data.error || "Could not load the test customer.");
    setState(data);
  }

  useEffect(() => {
    void refresh().catch((error) =>
      setMessage(error instanceof Error ? error.message : "Could not load the test customer."),
    );
  }, []);

  async function createCustomer() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/test-customer", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const data = (await response.json().catch(() => ({}))) as StatusPayload;
      if (!response.ok) throw new Error(data.error || "Could not create the test customer.");
      setState({ ...data, exists: true });
      setMessage("Test customer created. Save the password now; it is shown only in this browser response.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create the test customer.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/test-customer", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const data = (await response.json().catch(() => ({}))) as StatusPayload;
      if (!response.ok) throw new Error(data.error || "Could not reset the test password.");
      setState({ ...data, exists: true });
      setMessage("Test password reset. Use the new one-time password shown above.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not reset the test password.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCustomer() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/test-customer", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const data = (await response.json().catch(() => ({}))) as StatusPayload;
      if (!response.ok) throw new Error(data.error || "Could not delete the test customer.");
      setState({ exists: false, email: state.email, name: state.name });
      setMessage("Disposable staging customer deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete the test customer.");
    } finally {
      setBusy(false);
    }
  }

  const card = {
    border: "1px solid rgba(120,110,90,.22)",
    borderRadius: 18,
    padding: 24,
    background: "rgba(255,255,255,.72)",
    boxShadow: "0 16px 50px rgba(30,30,30,.06)",
  } as const;

  const button = {
    border: "1px solid rgba(120,110,90,.3)",
    borderRadius: 12,
    padding: "11px 16px",
    fontWeight: 800,
    cursor: busy ? "not-allowed" : "pointer",
    background: "rgba(255,255,255,.88)",
  } as const;

  return (
    <section style={{ maxWidth: 820, display: "grid", gap: 18 }}>
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".08em", opacity: .65 }}>
          STAGING ONLY
        </div>
        <h1 style={{ margin: "8px 0 6px" }}>Recovery test customer</h1>
        <p style={{ margin: 0, opacity: .72, lineHeight: 1.6 }}>
          Creates one disposable, email-confirmed customer account for the E2E assisted-recovery test. This utility is blocked outside the staging Supabase project and requires Owner or Super Admin access.
        </p>
      </div>

      <div style={card}>
        <div style={{ display: "grid", gap: 8 }}>
          <div><strong>Status:</strong> {state.exists ? "Customer exists" : "Not created"}</div>
          <div><strong>Name:</strong> {state.name || "Recovery Test Customer"}</div>
          <div><strong>Email:</strong> {state.email || "customer-recovery-test@ficonter.test"}</div>
          {state.userId ? <div><strong>User ID:</strong> {state.userId}</div> : null}
          {state.password ? (
            <div style={{ marginTop: 8, padding: 14, borderRadius: 12, background: "rgba(180,150,90,.12)" }}>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".06em" }}>ONE-TIME TEST PASSWORD</div>
              <code style={{ display: "block", marginTop: 7, fontSize: 15, overflowWrap: "anywhere" }}>{state.password}</code>
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
          {!state.exists ? (
            <button type="button" style={button} disabled={busy} onClick={() => void createCustomer()}>
              {busy ? "Creating…" : "Create test customer"}
            </button>
          ) : (
            <>
              <button type="button" style={button} disabled={busy} onClick={() => void resetPassword()}>
                {busy ? "Resetting…" : "Reset test password"}
              </button>
              <button
                type="button"
                style={{ ...button, borderColor: "rgba(180,50,50,.45)" }}
                disabled={busy}
                onClick={() => void deleteCustomer()}
              >
                {busy ? "Deleting…" : "Delete test customer"}
              </button>
            </>
          )}
          <button type="button" style={button} disabled={busy} onClick={() => void refresh()}>
            Refresh
          </button>
        </div>

        {message ? <p style={{ margin: "16px 0 0", fontWeight: 700 }}>{message}</p> : null}
      </div>
    </section>
  );
}
