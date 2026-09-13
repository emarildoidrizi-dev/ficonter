import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Frequently Asked Questions | FICONTER",
  description:
    "Clear answers about FICONTER, including how the platform works, financial intelligence, business use, privacy and security.",
  alternates: { canonical: "/faq" },
};

export default function FaqLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
