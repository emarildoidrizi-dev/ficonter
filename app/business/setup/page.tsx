import { redirect } from "next/navigation";
import { BusinessSetup } from "@/components/BusinessSetup";
import { getBusinessContext } from "@/lib/business/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessSetupPage(){
  const {user,business}=await getBusinessContext();
  if(!user)redirect("/login");
  if(business)redirect("/business/overview");
  return <BusinessSetup/>;
}
