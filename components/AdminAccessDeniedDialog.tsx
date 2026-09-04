"use client";

import { ShieldX } from "lucide-react";
import { useRouter } from "next/navigation";

export function AdminAccessDeniedDialog() {
  const router = useRouter();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background:
          "radial-gradient(circle at top, rgba(220,38,38,0.10), transparent 34%), var(--background, #0b0f14)",
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-access-denied-title"
        aria-describedby="admin-access-denied-description"
        style={{
          width: "min(100%, 460px)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "22px",
          padding: "28px",
          background: "rgba(18, 23, 31, 0.96)",
          boxShadow: "0 24px 70px rgba(0,0,0,0.36)",
          textAlign: "center",
          color: "#f8fafc",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "16px",
            display: "grid",
            placeItems: "center",
            margin: "0 auto 18px",
            background: "rgba(220,38,38,0.14)",
            border: "1px solid rgba(248,113,113,0.28)",
          }}
        >
          <ShieldX size={28} />
        </div>

        <p
          style={{
            margin: "0 0 8px",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            opacity: 0.72,
          }}
        >
          Restricted area
        </p>
        <h1
          id="admin-access-denied-title"
          style={{ margin: "0 0 10px", fontSize: "28px", lineHeight: 1.15 }}
        >
          Access denied
        </h1>
        <p
          id="admin-access-denied-description"
          style={{
            margin: "0 auto 24px",
            maxWidth: "360px",
            lineHeight: 1.6,
            color: "rgba(248,250,252,0.72)",
          }}
        >
          You do not have permission to access this FICONTER administration area.
        </p>

        <button
          type="button"
          onClick={goBack}
          autoFocus
          style={{
            minHeight: "46px",
            minWidth: "150px",
            border: 0,
            borderRadius: "12px",
            padding: "0 20px",
            fontWeight: 700,
            cursor: "pointer",
            background: "#f8fafc",
            color: "#111827",
          }}
        >
          Go back
        </button>
      </section>
    </main>
  );
}
