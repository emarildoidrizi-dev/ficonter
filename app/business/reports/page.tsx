import { redirect } from "next/navigation";
import { BusinessReports } from "@/components/BusinessReports";
import { getBusinessContext } from "@/lib/business/server";
import type { BusinessProfitabilityReport } from "@/lib/business/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function currentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = now;
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export default async function BusinessReportsPage() {
  const { supabase, user, business } = await getBusinessContext();
  if (!user) redirect("/login");
  if (!business) redirect("/business/setup");

  const { startDate, endDate } = currentMonthRange();
  const { data, error } = await supabase.rpc(
    "get_business_profitability_report",
    {
      p_business_id: business.id,
      p_start_date: startDate,
      p_end_date: endDate,
    },
  );

  return (
    <BusinessReports
      key={business.id}
      business={business}
      initialStartDate={startDate}
      initialEndDate={endDate}
      initialReport={(data as BusinessProfitabilityReport | null) ?? null}
      initialError={error?.message ?? ""}
    />
  );
}
