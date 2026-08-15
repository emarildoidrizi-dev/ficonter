import type { Metadata } from "next";
import { HelpCenter } from "@/components/HelpCenter";

export const metadata: Metadata = {
  title: "Help Center",
};

export default function HelpPage() {
  return <HelpCenter />;
}
