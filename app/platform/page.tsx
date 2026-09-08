import type { Metadata } from "next";
import {
  BarChart3,
  CalendarCheck2,
  CircleDollarSign,
  Gauge,
  Landmark,
  ListChecks,
  PiggyBank,
  ReceiptText,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import { PublicInfoPage } from "@/components/PublicInfoPage";

export const metadata: Metadata = {
  title: "Platform | FICONTER",
  description:
    "Explore the FICONTER Financial Control Center: transactions, planning, bills, savings, debt, goals, wealth and financial intelligence in one structured platform.",
  alternates: { canonical: "/platform" },
};

export default function PlatformPage() {
  return (
    <PublicInfoPage
      eyebrow="The FICONTER platform"
      title="One financial system. Every important decision in context."
      lead="FICONTER brings daily money movement, monthly planning, obligations, savings, debt, goals, wealth and financial intelligence into one considered control center. The aim is not to create more data—it is to make financial information easier to understand and act on."
      heroIcon={BarChart3}
      heroLabel="FINANCIAL CONTROL CENTER"
      heroStatement="See what happened, what is already committed, what remains available and what deserves attention next."
      highlights={[
        {
          icon: WalletCards,
          title: "Daily money control",
          copy: "Keep transactions, balances and monthly movement visible without losing the context around each number.",
        },
        {
          icon: CalendarCheck2,
          title: "Plan before you spend",
          copy: "Structure bills, commitments, reserves and goals before treating the remaining amount as truly available.",
        },
        {
          icon: TrendingUp,
          title: "Build long-term direction",
          copy: "Connect savings, debt, net worth and goals so short-term decisions support a broader financial direction.",
        },
        {
          icon: Sparkles,
          title: "Understand the signals",
          copy: "Financial intelligence turns activity into focused indicators, priorities and areas that may deserve attention.",
        },
      ]}
      sections={[
        {
          id: "planning",
          eyebrow: "Planning & money",
          title: "The everyday financial work stays connected."
          ,copy: "FICONTER is designed so the tools people use most often are not isolated from one another. Transactions affect cash flow. Bills affect what is available. Savings and debt affect the direction of the plan. Each module contributes to the same financial picture.",
          points: [
            {
              icon: ReceiptText,
              title: "Transactions",
              copy: "Record income and spending so daily financial movement has a reliable source of context.",
            },
            {
              icon: ListChecks,
              title: "Bills & commitments",
              copy: "Keep recurring and upcoming obligations visible before making decisions with the rest of the month.",
            },
            {
              icon: PiggyBank,
              title: "Savings & reserves",
              copy: "Track money set aside for resilience, planned purchases and longer-term priorities.",
            },
            {
              icon: Landmark,
              title: "Debt & credit",
              copy: "Keep repayment obligations alongside the rest of the plan instead of treating them as a separate financial world.",
            },
            {
              icon: Target,
              title: "Goals",
              copy: "Give savings and financial decisions a defined destination with visible progress over time.",
            },
            {
              icon: CircleDollarSign,
              title: "Available after planning",
              copy: "Understand what remains after obligations and planned allocations are accounted for, not merely what sits in an account.",
            },
          ],
        },
        {
          id: "intelligence",
          eyebrow: "Financial intelligence",
          title: "Numbers become useful when they explain what is happening."
          ,copy: "FICONTER's intelligence layer is designed to summarise the condition of the financial plan without creating unnecessary noise. It combines structured financial signals so a user can understand where things are stable, where progress is happening and what may require attention.",
          points: [
            {
              icon: Gauge,
              title: "Financial Health",
              copy: "A structured indicator that reflects multiple parts of the user's financial position rather than a single balance.",
            },
            {
              icon: BarChart3,
              title: "Cash Flow Intelligence",
              copy: "Shows how incoming and outgoing money interact across the month and whether the current pattern is sustainable.",
            },
            {
              icon: PiggyBank,
              title: "Emergency Fund",
              copy: "Measures reserve progress against the user's financial commitments and selected planning assumptions.",
            },
            {
              icon: TrendingUp,
              title: "Wealth direction",
              copy: "Connects net worth, savings and long-term progress so users can see movement beyond the current month.",
            },
          ],
        },
      ]}
      process={{
        eyebrow: "How the platform works",
        title: "From financial activity to a clearer next decision.",
        copy: "FICONTER keeps the path understandable so users know where information comes from and why a number matters.",
        steps: [
          { title: "Record", copy: "Add the financial activity, balances and obligations that matter to the plan." },
          { title: "Structure", copy: "FICONTER organises that information into the right financial modules and workspaces." },
          { title: "Understand", copy: "Dashboards and indicators turn separate figures into a usable financial picture." },
          { title: "Decide", copy: "Use that picture to plan spending, build reserves, reduce obligations or pursue goals with better context." },
        ],
      }}
      callout={{
        eyebrow: "The design principle",
        title: "Control should feel calmer than the financial life it is organising.",
        copy: "FICONTER is built around a clear hierarchy of information: the current position first, the commitments around it, the direction ahead and the signals that deserve attention. The platform is not intended to overwhelm users with dashboards for the sake of dashboards.",
      }}
    />
  );
}
