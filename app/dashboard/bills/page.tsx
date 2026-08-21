import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { BillsManager } from "@/components/BillsManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BillsPage() {
  const { user } = await getCurrentUser();

  if (!user) redirect("/login");

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
        initialBills={[]}
        initialError=""
      />
    </section>
  );
}