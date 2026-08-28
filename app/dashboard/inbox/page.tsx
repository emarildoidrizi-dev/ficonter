import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, FileSignature, KeyRound, TimerReset } from "lucide-react";
import { SupportConversations } from "@/components/SupportConversations";
import { loadCustomerSupportThreads } from "@/lib/supportData";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { listCustomerRecoveryConsents } from "@/lib/admin/vaultRecoveryInbox";
import { listCustomerVaultRecoveryAccesses } from "@/lib/vaultRecovery/customerAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const { user } = await getCurrentUser();
  if (!user) redirect("/login");

  const [threads, params, recoveryConsents, recoveryAccesses] = await Promise.all([
    loadCustomerSupportThreads(),
    searchParams,
    listCustomerRecoveryConsents(user.id).catch(() => []),
    listCustomerVaultRecoveryAccesses(user.id).catch(() => []),
  ]);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {recoveryAccesses.length ? (
        <section style={{ padding: "20px clamp(16px,3vw,28px) 0" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 750, letterSpacing: ".1em", opacity: .58 }}>SECURE RECOVERY</div>
              <h2 style={{ margin: "5px 0 0", fontSize: 20 }}>Recovery Access</h2>
            </div>

            {recoveryAccesses.map((item) => {
              const access = item.access!;
              const claimed = access.effectiveStatus === "claimed";
              const expired = access.effectiveStatus === "expired";
              return (
                <Link
                  key={access.id}
                  href={`/dashboard/inbox/vault-recovery/${item.requestId}/recover`}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    border: "1px solid rgba(31,90,76,.22)",
                    borderRadius: 15,
                    padding: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 14,
                    flexWrap: "wrap",
                    background: "rgba(255,255,255,.4)",
                  }}
                >
                  <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                    <span style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", border: "1px solid rgba(120,120,120,.2)" }}>
                      {expired ? <TimerReset size={18} /> : <KeyRound size={18} />}
                    </span>
                    <div>
                      <strong>{expired ? "Recovery Access expired" : claimed ? "Recovery Access claimed" : "Vault Recovery Access approved"}</strong>
                      <div style={{ marginTop: 3, fontSize: 13, opacity: .68 }}>{item.reference}</div>
                      <div style={{ marginTop: 3, fontSize: 12, opacity: .56 }}>Issued {formatDateTime(access.issuedAt)} · Expires {formatDateTime(access.expiresAt)}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 750 }}>{expired ? "View status" : claimed ? "Continue recovery" : "Begin secure recovery"}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {recoveryConsents.length ? (
        <section style={{ padding: "20px clamp(16px,3vw,28px) 0" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 750, letterSpacing: ".1em", opacity: .58 }}>SECURE RECOVERY</div>
              <h2 style={{ margin: "5px 0 0", fontSize: 20 }}>Vault recovery documents</h2>
            </div>

            {recoveryConsents.map((consent: any) => (
              <Link
                key={consent.requestId}
                href={`/dashboard/inbox/vault-recovery/${consent.requestId}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  border: "1px solid rgba(120,120,120,.18)",
                  borderRadius: 15,
                  padding: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 14,
                  flexWrap: "wrap",
                  background: "rgba(255,255,255,.35)",
                }}
              >
                <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                  <span style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", border: "1px solid rgba(120,120,120,.2)" }}>
                    {consent.signedAt ? <CheckCircle2 size={18} /> : <FileSignature size={18} />}
                  </span>
                  <div>
                    <strong>{consent.signedAt ? "Signed Vault recovery consent" : "Signature required: Vault recovery consent"}</strong>
                    <div style={{ marginTop: 3, fontSize: 13, opacity: .68 }}>{consent.requestReference} · {consent.documentId}</div>
                    <div style={{ marginTop: 3, fontSize: 12, opacity: .56 }}>
                      Sent {formatDateTime(consent.sentAt)}
                      {consent.signedAt ? ` · Signed ${formatDateTime(consent.signedAt)}` : ""}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 750 }}>{consent.signedAt ? "View document" : "Review & sign"}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <SupportConversations initialThreads={threads} initialSelectedId={params.thread} />
    </div>
  );
}
