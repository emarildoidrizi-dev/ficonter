import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * One authenticated Supabase lookup per server render.
 *
 * Dashboard layouts and pages render in the same request. React cache keeps
 * them from each calling auth.getUser independently while never sharing the
 * result between different users or requests.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { supabase, user, error };
});
