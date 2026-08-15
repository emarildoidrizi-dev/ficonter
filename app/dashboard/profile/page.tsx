import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ProfilePage() {
  permanentRedirect("/dashboard/settings?section=profile");
}
