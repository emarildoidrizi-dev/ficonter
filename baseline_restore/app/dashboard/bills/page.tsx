import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { BillsManager } from "@/components/BillsManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BillsPage() {
  const { supabase, user } = await getCurrentUser();

  if (!user) redirect("/login");

  const { data: bills, error } = await supabase
    .from("bills")
    .select("id,user_id,name,company,category,amount,currency,amount_eur,exchange_rate_to_eur,due_date,recurrence,payment_method,autopay,autopay_record_time,autopay_timezone,autopay_enabled_at,recurrence_anchor_day,recurrence_anchor_month_end,reminder_days,status,notes,paid_at,transaction_id,created_at,updated_at")
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
