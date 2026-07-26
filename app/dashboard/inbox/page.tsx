import { redirect } from "next/navigation";
import { SupportConversations } from "@/components/SupportConversations";
import { loadCustomerSupportThreads } from "@/lib/supportData";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [threads, params] = await Promise.all([loadCustomerSupportThreads(), searchParams]);
  return <SupportConversations initialThreads={threads} initialSelectedId={params.thread} />;
}
