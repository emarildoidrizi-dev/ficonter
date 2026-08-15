"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requireSubscriptionFeature } from "@/lib/subscriptionRouteAccess";

export type SwitchActiveBusinessResult =
  | { ok: true }
  | { ok: false; error: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function switchActiveBusinessAction(
  businessId: string,
): Promise<SwitchActiveBusinessResult> {
  await requireSubscriptionFeature("business_workspace");

  if (!UUID_PATTERN.test(businessId)) {
    return {
      ok: false,
      error: "The selected business is invalid.",
    };
  }

  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return {
      ok: false,
      error: "Authentication is required.",
    };
  }

  const { error } = await supabase.rpc(
    "set_active_business_workspace",
    {
      p_business_id: businessId,
    },
  );

  if (error) {
    return {
      ok: false,
      error: error.message,
    };
  }

  revalidatePath("/business", "layout");

  return { ok: true };
}
