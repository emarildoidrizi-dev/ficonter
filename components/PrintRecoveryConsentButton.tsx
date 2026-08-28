"use client";

import { Printer } from "lucide-react";

export function PrintRecoveryConsentButton() {
  return <button type="button" onClick={() => window.print()} style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 10, padding: "10px 14px", fontWeight: 700 }}><Printer size={16}/> Print / Save PDF</button>;
}
