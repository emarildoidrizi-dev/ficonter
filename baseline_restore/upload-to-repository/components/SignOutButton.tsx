"use client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton(){
  const router=useRouter();
  return <button className="side-link" style={{border:0,background:"transparent",width:"100%"}} onClick={async()=>{await createClient().auth.signOut();router.push("/");router.refresh();}}><LogOut size={18}/>Log out</button>
}
