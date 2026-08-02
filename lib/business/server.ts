import "server-only";

import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/currentUser";
import type { Business } from "@/lib/business/types";

export const getBusinessContext = cache(async () => {
  const { supabase, user, error: authError } = await getCurrentUser();

  if (!user) {
    return {
      supabase,
      user: null,
      businesses: [] as Business[],
      business: null as Business | null,
      error: authError?.message ?? "Authentication is required.",
    };
  }

  const { data, error } = await supabase
    .from("businesses")
    .select(
      "id,owner_id,name,legal_name,business_type,country_code,base_currency,fiscal_year_start_month,created_at,updated_at",
    )
    .order("created_at", { ascending: true });

  const businesses = (data ?? []) as Business[];

  return {
    supabase,
    user,
    businesses,
    business: businesses[0] ?? null,
    error: error?.message ?? authError?.message ?? "",
  };
});
