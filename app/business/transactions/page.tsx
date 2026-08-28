import { redirect } from "next/navigation";
import { EncryptedBusinessTransactionsWorkspace } from "@/components/EncryptedBusinessTransactionsWorkspace";
import { getBusinessContext } from "@/lib/business/server";

type BusinessTransactionsPageProps = {
  searchParams?: Promise<{
    add?: string | string[];
  }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessTransactionsPage({ searchParams }: BusinessTransactionsPageProps) {
  const { user, business } = await getBusinessContext();
  if (!user) redirect("/login");
  if (!business) redirect("/business/setup");

  const query = await searchParams;
  const addValue = Array.isArray(query?.add) ? query.add[0] : query?.add;

  return (
    <EncryptedBusinessTransactionsWorkspace
      userId={user.id}
      business={business}
      initialAdd={addValue === "1"}
    />
  );
}
