import { redirect } from "next/navigation";
import { BusinessTransactionLedger } from "@/components/BusinessTransactionLedger";
import { getBusinessContext } from "@/lib/business/server";
import type { BusinessTransaction } from "@/lib/business/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessTransactionsPage(){
  const {supabase,user,business}=await getBusinessContext();
  if(!user)redirect("/login");
  if(!business)redirect("/business/setup");
  const {data}=await supabase.from("business_transactions").select("id,business_id,created_by,description,counterparty,type,category,cost_nature,amount,currency,amount_base,exchange_rate_to_base,exchange_rate_date,exchange_rate_source,transaction_date,occurred_at,payment_method,reference,notes,created_at,updated_at").eq("business_id",business.id).order("occurred_at",{ascending:false}).limit(2500);
  return <BusinessTransactionLedger business={business} initialTransactions={(data??[]) as BusinessTransaction[]}/>;
}
