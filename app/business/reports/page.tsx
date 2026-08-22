import { redirect } from "next/navigation";
import { BusinessReports } from "@/components/BusinessReports";
import { getBusinessContext } from "@/lib/business/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function currentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: now.toISOString().slice(0, 10),
  };
}

export default async function BusinessReportsPage() {
  const { user, business } = await getBusinessContext();
  if (!user) redirect("/login");
  if (!business) redirect("/business/setup");

  const { startDate, endDate } = currentMonthRange();
  return (
    <BusinessReports
      key={business.id}
      business={business}
      initialStartDate={startDate}
      initialEndDate={endDate}
      initialReport={null}
      initialError=""
    />
  );
}
