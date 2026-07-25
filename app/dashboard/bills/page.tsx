import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BillsManager } from "@/components/BillsManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BillsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: bills, error } = await supabase
    .from("bills")
    .select("*")
    .eq("user_id", user.id)
    .order("due_date", { ascending: true });

  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Bills command center</h1>
          <p>
            Organize recurring obligations, upcoming payments and paid history
            in one private workspace.
          </p>
        </div>
      </div>

      <BillsManager
        userId={user.id}
        initialBills={bills ?? []}
        initialError={error?.message ?? ""}
      />
    </section>
  );
}
