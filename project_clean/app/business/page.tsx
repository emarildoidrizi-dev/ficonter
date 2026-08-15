import { redirect } from "next/navigation";
import { getBusinessContext } from "@/lib/business/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessPage() {
  const { user, businesses, business } = await getBusinessContext();

  if (!user) redirect("/login");
  if (business) redirect("/business/overview");
  if (businesses.length) redirect("/business/manage");
  redirect("/business/setup");
}
