"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Pencil, Plus, Save, ShieldCheck, X } from "lucide-react";
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
  initialFullName: string;
  initialDisplayName: string;
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

function hasAnyDetails(fullName: string, displayName: string, values: ProfileIdentityDetails) {
  return Boolean(
    fullName.trim() ||
      displayName.trim() ||
      Object.values(values).some((value) => value.trim().length > 0),
  );
}

function detailRows(
  fullName: string,
  displayName: string,
  values: ProfileIdentityDetails,
) {
  return [
    ["Full name", fullName],
    ["Display name", displayName],
    ["Birthdate", values.birthDate],
    ["Country / region", values.country],
    ["City", values.city],
    ["Postal code", values.postalCode],
    ["Street address", values.addressLine1],
    ["Address line 2", values.addressLine2],
  ] as const;
}

function syncHiddenIdentityInput(selector: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(selector);
  if (!input) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export function ProfileIdentityDetailsForm({
  userId,
  initialFullName,
  initialDisplayName,
  initialValues,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [savedValues, setSavedValues] = useState(initialValues);
  const [draftValues, setDraftValues] = useState(initialValues);
  const [identityNames, setIdentityNames] = useState({
    fullName: initialFullName,
    displayName: initialDisplayName,
  });
  const [draftNames, setDraftNames] = useState({
    fullName: initialFullName,
    displayName: initialDisplayName,
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let host: HTMLDivElement | null = null;
    let hiddenNameGrid: HTMLElement | null = null;
    let buttonObserver: MutationObserver | null = null;

    const placeCard = () => {
      const fullNameInput = document.querySelector<HTMLInputElement>('input[autocomplete="name"]');
      const profileForm = fullNameInput?.closest("form");
      const profileStack = profileForm?.parentElement;
      if (!fullNameInput || !profileForm || !profileStack) return false;

      const displayNameInput = profileForm.querySelector<HTMLInputElement>('input[autocomplete="nickname"]');
      const fullNameLabel = fullNameInput.closest("label");
      const displayNameLabel = displayNameInput?.closest("label");
      const sharedGrid = fullNameLabel?.parentElement;

      if (sharedGrid && displayNameLabel && sharedGrid.contains(displayNameLabel)) {
        hiddenNameGrid = sharedGrid;
        hiddenNameGrid.style.display = "none";
      }

      const keepPhotoButtonLabel = () => {
        const submitButton = profileForm.querySelector<HTMLButtonElement>('button:not([type="button"])');
        if (!submitButton) return;
        const text = submitButton.textContent?.trim() ?? "";
        if (text === "Save profile") {
          submitButton.textContent = "Save photo";
          submitButton.setAttribute("aria-label", "Save profile photo");
          submitButton.dataset.photoOnlySave = "true";
        }
      };

      keepPhotoButtonLabel();
      buttonObserver = new MutationObserver(keepPhotoButtonLabel);
      buttonObserver.observe(profileForm, { childList: true, subtree: true, characterData: true });

      host = document.createElement("div");
      host.dataset.ficonterIdentityDetails = "true";
      host.style.marginTop = "16px";
      profileStack.insertBefore(host, profileForm.nextSibling);
      setPortalHost(host);
      return true;
    };

    if (!placeCard()) {
      const observer = new MutationObserver(() => {
        if (placeCard()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return () => observer.disconnect();
    }

    return () => {
      buttonObserver?.disconnect();
      if (hiddenNameGrid) hiddenNameGrid.style.display = "";
      host?.remove();
    };
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, saving]);

  function openEditor() {
    setDraftValues(savedValues);
    setDraftNames(identityNames);
    setFeedback(null);
    setModalOpen(true);
  }

  function update<K extends keyof ProfileIdentityDetails>(key: K, value: ProfileIdentityDetails[K]) {
    setDraftValues((current) => ({ ...current, [key]: value }));
    setFeedback(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFeedback(null);

    try {
      const normalizedNames = {
        fullName: draftNames.fullName.trim(),
        displayName: draftNames.displayName.trim(),
      };

      const { data: authData, error: authReadError } = await supabase.auth.getUser();
      if (authReadError) throw authReadError;
      const currentMetadata = authData.user?.user_metadata ?? {};

      const { error: authUpdateError } = await supabase.auth.updateUser({
        data: {
          ...currentMetadata,
          full_name: normalizedNames.fullName,
          display_name: normalizedNames.displayName,
        },
      });
      if (authUpdateError) throw authUpdateError;

      const profiles = supabase.from("profiles") as any;
      const { error } = await profiles
        .update({
          full_name: normalizedNames.fullName || null,
          birth_date: draftValues.birthDate || null,
          country: draftValues.country.trim() || null,
          city: draftValues.city.trim() || null,
          address_line1: draftValues.addressLine1.trim() || null,
          address_line2: draftValues.addressLine2.trim() || null,
          postal_code: draftValues.postalCode.trim() || null,
        })
        .eq("id", userId);

      if (error) throw error;

      const normalized: ProfileIdentityDetails = {
        birthDate: draftValues.birthDate,
        country: draftValues.country.trim(),
        city: draftValues.city.trim(),
        addressLine1: draftValues.addressLine1.trim(),
        addressLine2: draftValues.addressLine2.trim(),
        postalCode: draftValues.postalCode.trim(),
      };

      setIdentityNames(normalizedNames);
      setDraftNames(normalizedNames);
      setSavedValues(normalized);
      setDraftValues(normalized);
      setFeedback({ type: "success", text: "Personal details saved." });

      syncHiddenIdentityInput('input[autocomplete="name"]', normalizedNames.fullName);
      syncHiddenIdentityInput('input[autocomplete="nickname"]', normalizedNames.displayName);

      window.dispatchEvent(
        new CustomEvent("ficonter:profile-updated", {
          detail: {
            fullName: normalizedNames.fullName,
            displayName: normalizedNames.displayName,
          },
        }),
      );
      window.dispatchEvent(new CustomEvent("ficonter:profile-details-updated", { detail: normalized }));
      setModalOpen(false);
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Personal details could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  }

  const detailsExist = hasAnyDetails(identityNames.fullName, identityNames.displayName, savedValues);

  const detailsCard = (
    <section
      style={{
        border: "1px solid rgba(120,120,120,.16)",
        borderRadius: 18,
        padding: 20,
        display: "grid",
        gap: 18,
        background: "rgba(255,255,255,.34)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <ShieldCheck size={19} style={{ marginTop: 2 }} />
          <div>
            <h3 style={{ margin: 0, fontSize: 17 }}>Personal identity & address</h3>
            <p style={{ margin: "5px 0 0", opacity: .7, fontSize: 13 }}>
              These details are used for customer identification and authorized Vault recovery records.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openEditor}
          style={{
            minHeight: 40,
            borderRadius: 10,
            padding: "0 14px",
            border: "1px solid currentColor",
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontWeight: 700,
            cursor: "pointer",
            background: "rgba(255,255,255,.58)",
            color: "inherit",
          }}
        >
          {detailsExist ? <Pencil size={15} /> : <Plus size={15} />}
          {detailsExist ? "Edit details" : "Add details"}
        </button>
      </div>

      {detailsExist ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "0 28px" }}>
          {detailRows(identityNames.fullName, identityNames.displayName, savedValues).map(([label, value]) => (
            <div key={label} style={{ padding: "12px 0", borderBottom: "1px solid rgba(120,120,120,.14)" }}>
              <div style={{ fontSize: 11, fontWeight: 750, opacity: .58, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
              <div style={{ marginTop: 5, fontSize: 14, fontWeight: 600 }}>{value || "Not provided"}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: "8px 0", fontSize: 14, opacity: .68 }}>
          No personal identity or address details have been added yet.
        </div>
      )}
    </section>
  );

  const editorModal = modalOpen && typeof document !== "undefined"
    ? createPortal(
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setModalOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            display: "grid",
            placeItems: "center",
            padding: 18,
            background: "rgba(15,24,26,.42)",
            backdropFilter: "blur(8px)",
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Edit personal identity and address"
            onSubmit={save}
            style={{
              width: "min(900px, 100%)",
              maxHeight: "calc(100vh - 36px)",
              overflowY: "auto",
              borderRadius: 22,
              padding: 24,
              display: "grid",
              gap: 20,
              background: "rgba(248,248,246,.98)",
              color: "#17272a",
              boxShadow: "0 24px 70px rgba(0,0,0,.24)",
              border: "1px solid rgba(120,120,120,.18)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 20 }}>Personal identity & address</h3>
                <p style={{ margin: "6px 0 0", opacity: .68, fontSize: 13 }}>Update the details used for account identification and authorized recovery records.</p>
              </div>
              <button
                type="button"
                aria-label="Close"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid rgba(120,120,120,.2)", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer" }}
              >
                <X size={17} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
              <label style={labelStyle}>
                <span>Full name</span>
                <input
                  value={draftNames.fullName}
                  onChange={(event) => {
                    setDraftNames((current) => ({ ...current, fullName: event.target.value }));
                    setFeedback(null);
                  }}
                  autoComplete="name"
                  maxLength={120}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                <span>Display name</span>
                <input
                  value={draftNames.displayName}
                  onChange={(event) => {
                    setDraftNames((current) => ({ ...current, displayName: event.target.value }));
                    setFeedback(null);
                  }}
                  autoComplete="nickname"
                  maxLength={80}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}><span>Birthdate</span><input type="date" value={draftValues.birthDate} onChange={(event) => update("birthDate", event.target.value)} autoComplete="bday" style={inputStyle} /></label>
              <label style={labelStyle}><span>Country / region</span><select value={draftValues.country} onChange={(event) => update("country", event.target.value)} autoComplete="country-name" style={inputStyle}><option value="">Select country / region</option>{FICONTER_COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}</select></label>
              <label style={labelStyle}><span>City</span><input value={draftValues.city} onChange={(event) => update("city", event.target.value)} autoComplete="address-level2" maxLength={120} style={inputStyle} /></label>
              <label style={labelStyle}><span>Postal code</span><input value={draftValues.postalCode} onChange={(event) => update("postalCode", event.target.value)} autoComplete="postal-code" maxLength={32} style={inputStyle} /></label>
              <label style={labelStyle}><span>Street address</span><input value={draftValues.addressLine1} onChange={(event) => update("addressLine1", event.target.value)} autoComplete="address-line1" maxLength={180} style={inputStyle} /></label>
              <label style={labelStyle}><span>Address line 2</span><input value={draftValues.addressLine2} onChange={(event) => update("addressLine2", event.target.value)} autoComplete="address-line2" maxLength={180} placeholder="Apartment, unit, floor (optional)" style={inputStyle} /></label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, flexWrap: "wrap", paddingTop: 4 }}>
              {feedback ? <span role="status" style={{ marginRight: "auto", fontSize: 13, display: "inline-flex", gap: 6, alignItems: "center" }}>{feedback.type === "success" ? <Check size={15} /> : null}{feedback.text}</span> : null}
              <button type="button" disabled={saving} onClick={() => setModalOpen(false)} style={{ minHeight: 42, borderRadius: 10, padding: "0 15px", border: "1px solid rgba(120,120,120,.24)", background: "transparent", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ minHeight: 42, borderRadius: 10, padding: "0 15px", border: "1px solid currentColor", display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 700, cursor: saving ? "wait" : "pointer", background: "#fff" }}><Save size={16} />{saving ? "Saving…" : "Save details"}</button>
            </div>
          </form>
        </div>,
        document.body,
      )
    : null;

  if (!portalHost) return editorModal;
  return (
    <>
      {createPortal(detailsCard, portalHost)}
      {editorModal}
    </>
  );
}
