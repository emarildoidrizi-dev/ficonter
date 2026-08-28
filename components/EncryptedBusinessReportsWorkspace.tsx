"use client";

import { useEffect, useMemo, useState } from "react";
import { BusinessReports } from "@/components/BusinessReports";
import { useBusinessVault } from "@/components/BusinessVaultProvider";
import { loadBusinessProfitabilityReport } from "@/lib/e2ee/businessProfitabilitySource";
import { createClient } from "@/lib/supabase/client";
import type { Business, BusinessProfitabilityReport } from "@/lib/business/types";

export function EncryptedBusinessReportsWorkspace({
  business,
  startDate,
  endDate,
}: {
  business: Business;
  startDate: string;
  endDate: string;
}) {
  const client = useMemo(() => createClient(), []);
  const { status, error: vaultError } = useBusinessVault();
  const [report, setReport] = useState<BusinessProfitabilityReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (status !== "unlocked") {
      setLoading(status === "loading");
      return;
    }
    setLoading(true);
    setError("");
    void loadBusinessProfitabilityReport(client, business.id, startDate, endDate)
      .then((next) => {
        if (cancelled) return;
        setReport(next);
        setLoading(false);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Business report could not be opened.");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [business.id, client, endDate, startDate, status]);

  if (status === "locked") return <div className="panel"><div className="alert">Unlock your Financial Vault to open encrypted Business Reports.</div></div>;
  if (status === "unavailable") return <div className="panel"><div className="alert">This Business Vault has not been shared with your account yet.</div></div>;
  if (status === "error") return <div className="panel"><div className="alert">{vaultError || "Business Vault could not be opened."}</div></div>;
  if (loading || status === "loading") return <div className="panel"><div className="alert">Building encrypted Business report…</div></div>;

  return (
    <BusinessReports
      key={business.id}
      business={business}
      initialStartDate={startDate}
      initialEndDate={endDate}
      initialReport={report}
      initialError={error}
    />
  );
}
