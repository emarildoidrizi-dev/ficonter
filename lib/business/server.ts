import "server-only";

import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/currentUser";
import type { Business } from "@/lib/business/types";

const BUSINESS_SELECT =
  "id,owner_id,name,legal_name,business_type,country_code,base_currency,fiscal_year_start_month,status,archived_at,timezone,tax_id,contact_email,contact_phone,website,address_line1,address_line2,city,postal_code,logo_path,cover_image_path,created_at,updated_at";

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

  const [
    { data: businessData, error: businessError },
    { data: preferenceData, error: preferenceError },
  ] = await Promise.all([
    supabase
      .from("businesses")
      .select(BUSINESS_SELECT)
      .order("created_at", { ascending: true }),
    supabase
      .from("business_user_preferences")
      .select("active_business_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const businesses = (businessData ?? []) as Business[];
  const activeBusinesses = businesses.filter(
    (item) => item.status !== "archived",
  );
  const preferredBusinessId =
    typeof preferenceData?.active_business_id === "string"
      ? preferenceData.active_business_id
      : null;

  const business =
    activeBusinesses.find((item) => item.id === preferredBusinessId) ??
    activeBusinesses[0] ??
    null;

  return {
    supabase,
    user,
    businesses,
    business,
    error:
      businessError?.message ??
      preferenceError?.message ??
      authError?.message ??
      "",
  };
});
