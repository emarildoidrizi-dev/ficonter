"use client";

import { useEffect, useState } from "react";

type Notice = {
  tone: "error" | "success" | "info";
  title: string;
  body: string;
};

export function EmailChangeResultNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.location.hash) return;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errorCode = params.get("error_code");
    const description = params.get("error_description");

    if (errorCode === "otp_expired" || description?.toLowerCase().includes("expired")) {
      setNotice({
        tone: "error",
        title: "Email change link expired or is no longer valid",
        body:
          "Your login email was not changed by this link. Log in with your current email, open Settings → Profile → Login email, and choose Resend link. If Secure Email Change is enabled, Supabase requires approval from both your current email address and your new email address before the change is completed.",
      });
      return;
    }

    if (params.get("error")) {
      setNotice({
        tone: "error",
        title: "Email confirmation could not be completed",
        body:
          "Log in with your current email, open Settings → Profile → Login email, and resend the confirmation. Your current login email stays active until all required confirmations are accepted.",
      });
    }
  }, []);

  if (!notice) return null;

  const border = notice.tone === "error" ? "rgba(166,54,54,.35)" : "rgba(45,120,90,.32)";
  const background = notice.tone === "error" ? "rgba(166,54,54,.08)" : "rgba(45,120,90,.08)";

  return (
    <div
      role="alert"
      style={{
        border: `1px solid ${border}`,
        background,
        borderRadius: 14,
        padding: "14px 16px",
        marginBottom: 18,
        lineHeight: 1.5,
      }}
    >
      <strong style={{ display: "block", marginBottom: 6 }}>{notice.title}</strong>
      <span style={{ fontSize: 14 }}>{notice.body}</span>
    </div>
  );
}
