"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Save, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FICONTER_COUNTRIES } from "@/lib/countries";

type ProfileIdentityDetails = {
  birthDate: string;
  country: string;
  city: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
};

type Props = {
  userId: string;
  initialValues: ProfileIdentityDetails;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 48,
  borderRadius: 12,
  border: "1px solid rgba(120,120,120,.22)",
  padding: "0 13px",
  background: "rgba(255,255,255,.72)",
  color: "inherit",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  fontSize: 13,
  fontWeight: 650,
};

export function ProfileIdentityDetailsForm({ userId, initialValues }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let host: HTMLDivElement | null = null;

    const placeForm = () => {
      const fullNameInput = document.querySelector<HTMLInputElement>('input[autocomplete="name"]');
      const profileForm = fullNameInput?.closest("form");
      const profileStack = profileForm?.parentElement;
      if (!profileForm || !profileStack) return false;

      host = document.createElement("div");
      host.dataset.ficonterIdentityDetails = "true";
      host.style.marginTop = "16px";
      profileStack.insertBefore(host, profileForm.nextSibling);
      setPortalHost(host);
      return true;
    };

    if (!placeForm()) {
      const observer = new MutationObserver(() => {
        if (placeForm()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return () => observer.disconnect();
    }

    return () => {
      host?.remove();
    };
  }, []);

  function update<K extends keyof ProfileIdentityDetails>(key: K, value: ProfileIdentityDetails[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFeedback(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFeedback(null);

    try {
      const profiles = supabase.from("profiles") as any;
      const { error } = await profiles
        .update({
          birth_date: values.birthDate || null,
          country: values.country.trim() || null,
          city: values.city.trim() || null,
          address_line1: values.addressLine1.trim() || null,
          address_line2: values.addressLine2.trim() || null,
          postal_code: values.postalCode.trim() || null,
        })
        .eq("id", userId);

      if (error) throw error;

      setFeedback({ type: "success", text: "Personal details saved." });
      window.dispatchEvent(new CustomEvent("ficonter:profile-details-updated", { detail: values }));
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Personal details could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  }

  const form = (
    <form
      onSubmit={save}
      style={{
        border: "1px solid rgba(120,120,120,.16)",
        borderRadius: 18,
        padding: 20,
        display: "grid",
        gap: 18,
        background: "rgba(255,255,255,.38)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <ShieldCheck size={19} style={{ marginTop: 2 }} />
        <div>
          <h3 style={{ margin: 0, fontSize: 17 }}>Personal identity & address</h3>
          <p style={{ margin: "5px 0 0", opacity: .7, fontSize: 13 }}>
            These details are used for customer identification and authorized Vault recovery records.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
        <label style={labelStyle}>
          <span>Birthdate</span>
          <input type="date" value={values.birthDate} onChange={(event) => update("birthDate", event.target.value)} autoComplete="bday" style={inputStyle} />
        </label>

        <label style={labelStyle}>
          <span>Country / region</span>
          <select value={values.country} onChange={(event) => update("country", event.target.value)} autoComplete="country-name" style={inputStyle}>
            <option value="">Select country / region</option>
            {FICONTER_COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
          </select>
        </label>

        <label style={labelStyle}>
          <span>City</span>
          <input value={values.city} onChange={(event) => update("city", event.target.value)} autoComplete="address-level2" maxLength={120} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          <span>Postal code</span>
          <input value={values.postalCode} onChange={(event) => update("postalCode", event.target.value)} autoComplete="postal-code" maxLength={32} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          <span>Street address</span>
          <input value={values.addressLine1} onChange={(event) => update("addressLine1", event.target.value)} autoComplete="address-line1" maxLength={180} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          <span>Address line 2</span>
          <input value={values.addressLine2} onChange={(event) => update("addressLine2", event.target.value)} autoComplete="address-line2" maxLength={180} placeholder="Apartment, unit, floor (optional)" style={inputStyle} />
        </label>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {feedback ? (
          <span role="status" style={{ fontSize: 13, display: "inline-flex", gap: 6, alignItems: "center" }}>
            {feedback.type === "success" ? <Check size={15} /> : null}
            {feedback.text}
          </span>
        ) : null}
        <button type="submit" disabled={saving} style={{ minHeight: 42, borderRadius: 10, padding: "0 15px", border: "1px solid currentColor", display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
          <Save size={16} />{saving ? "Saving…" : "Save personal details"}
        </button>
      </div>
    </form>
  );

  if (!portalHost) return null;
  return createPortal(form, portalHost);
}
