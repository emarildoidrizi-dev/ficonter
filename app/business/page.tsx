import { redirect } from "next/navigation";
import { getBusinessContext } from "@/lib/business/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessPage(){
  const {user,business}=await getBusinessContext();
  if(!user)redirect("/login");
  redirect(business?"/business/overview":"/business/setup");
}
