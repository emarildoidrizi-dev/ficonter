"use client";

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  async function signOut() {
    const { error } = await createClient().auth.signOut();
    if (error) return;
    window.location.replace("/login");
  }

  return (
    <button
      className="side-link"
      style={{ border: 0, background: "transparent", width: "100%" }}
      onClick={() => void signOut()}
    >
      <LogOut size={18} />
      Log out
    </button>
  );
}
