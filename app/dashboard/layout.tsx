import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { RealtimeRefreshBridge } from "@/components/RealtimeRefreshBridge";
import { InterfacePreferencesBootstrap } from "@/components/InterfacePreferencesBootstrap";
import { requireAdmin } from "@/lib/admin/access";

type StoredPreferences = {
  appearance?: string;
  density?: string;
};

function readInterfacePreferences(metadata: unknown): StoredPreferences {
  if (!metadata || typeof metadata !== "object") return {};
  const preferences = (metadata as Record<string, unknown>).ficonter_preferences;
  if (!preferences || typeof preferences !== "object") return {};

  const value = preferences as Record<string, unknown>;
  return {
    appearance: typeof value.appearance === "string" ? value.appearance : undefined,
    density: typeof value.density === "string" ? value.density : undefined,
  };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, admin } = await requireAdmin();

  if (!user) redirect("/login");

  const interfacePreferences = readInterfacePreferences(user.user_metadata);

  return (
    <div className="app-shell">
      <InterfacePreferencesBootstrap
        appearance={interfacePreferences.appearance}
        density={interfacePreferences.density}
      />
      <RealtimeRefreshBridge />
      <Sidebar isAdmin={Boolean(admin)} />
      <main className="app-main">{children}</main>
    </div>
  );
}
