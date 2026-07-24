import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GoalsManager } from "@/components/GoalsManager";

export const dynamic="force-dynamic";
export const revalidate=0;

export default async function GoalsPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const {data,error}=await supabase.from("goals").select("*").eq("user_id",user.id).order("created_at",{ascending:true});
  return <GoalsManager userId={user.id} initialGoals={data??[]} initialError={error?.message??""}/>;
}
