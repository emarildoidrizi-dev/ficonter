import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help | FICONTER",
  description:
    "Public help for FICONTER, including getting started, product guidance, privacy, account access and links to frequently asked questions.",
  alternates: { canonical: "/help" },
};

export default function HelpLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
