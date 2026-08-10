import { redirect } from "next/navigation";

export default function RemovedUiLabPage() {
  redirect("/dashboard/settings");
}
