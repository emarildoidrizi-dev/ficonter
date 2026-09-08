import type { Metadata } from "next";
import {
  BriefcaseBusiness,
  Building2,
  FileChartColumnIncreasing,
  Layers3,
  Repeat2,
  ShieldCheck,
  ShoppingCart,
  Target,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react";

import { PublicInfoPage } from "@/components/PublicInfoPage";

export const metadata: Metadata = {
  title: "Personal & Business | FICONTER",
  description:
    "Manage personal and business finances through one FICONTER account while keeping each workspace, record set and financial context distinct.",
  alternates: { canonical: "/personal-business" },
};

export default function PersonalBusinessPage() {
  return (
    <PublicInfoPage
      eyebrow="Personal & business architecture"
      title="Two financial worlds. One control center."
      lead="Personal finances and business finances influence the same life, but they should not be mixed into the same operating context. FICONTER gives each one its own workspace while keeping both accessible through a single account."
      heroIcon={Layers3}
      heroLabel="ONE ACCOUNT · DISTINCT WORKSPACES"
      heroStatement="Move between household planning and business operations without rebuilding context or confusing the records that matter."
      highlights={[
        {
          icon: UserRound,
          title: "Personal workspace",
          copy: "Use a dedicated environment for household cash flow, bills, savings, debt, goals and personal financial health.",
        },
        {
          icon: BriefcaseBusiness,
          title: "Business workspace",
          copy: "Keep revenue, operating costs, inventory, suppliers and business reporting in their own financial context.",
        },
        {
          icon: Repeat2,
          title: "Instant context switching",
          copy: "Move between workspaces without logging into a separate product or rebuilding your working environment.",
        },
        {
          icon: ShieldCheck,
          title: "No unnecessary mixing",
          copy: "Personal activity does not need to distort business metrics, and business activity does not need to distort household planning.",
        },
      ]}
      sections={[
        {
          id: "personal",
          eyebrow: "Personal workspace",
          title: "A financial system for the life outside the business.",
          copy: "The personal workspace is designed around the decisions individuals and households make every month: what comes in, what is already committed, what can be saved, what must be repaid and what goals are moving forward.",
          points: [
            {
              icon: WalletCards,
              title: "Household cash flow",
              copy: "Keep income and spending visible across the month so everyday decisions have context.",
            },
            {
              icon: Target,
              title: "Goals & reserves",
              copy: "Structure savings around clear purposes, emergency resilience and long-term priorities.",
            },
            {
              icon: Users,
              title: "Personal financial health",
              copy: "View the broader condition of the personal plan rather than relying on a single account balance.",
            },
            {
              icon: ShieldCheck,
              title: "Private context",
              copy: "Personal records remain part of the authenticated personal workspace rather than being merged into business operating data.",
            },
          ],
        },
        {
          id: "business",
          eyebrow: "Business workspace",
          title: "Operational finance without losing the bigger picture.",
          copy: "The business workspace is designed for the financial activity that belongs to running an operation. Revenue, costs, inventory and supplier relationships can be understood on their own terms without being mixed into personal planning.",
          points: [
            {
              icon: Building2,
              title: "Revenue & operating costs",
              copy: "Follow the money entering and leaving the business so operating performance remains visible.",
            },
            {
              icon: ShoppingCart,
              title: "Inventory & suppliers",
              copy: "Keep commercially relevant records close to the financial picture instead of scattering them across unrelated tools.",
            },
            {
              icon: FileChartColumnIncreasing,
              title: "Business reporting",
              copy: "Review business-specific indicators without personal spending or household obligations distorting the interpretation.",
            },
            {
              icon: BriefcaseBusiness,
              title: "Dedicated operating context",
              copy: "Use the tools and records that belong to the business while maintaining the convenience of one FICONTER identity.",
            },
          ],
        },
        {
          id: "together",
          eyebrow: "How they work together",
          title: "Together where useful. Separate where necessary.",
          copy: "The value is not in combining every number into one ledger. The value is being able to manage both sides of your financial life without losing the distinction between them.",
          points: [
            {
              icon: Repeat2,
              title: "One identity",
              copy: "Access both financial contexts through the same FICONTER account rather than maintaining separate products and logins.",
            },
            {
              icon: Layers3,
              title: "Distinct records",
              copy: "Each workspace retains the financial records and metrics appropriate to its purpose.",
            },
            {
              icon: ShieldCheck,
              title: "Cleaner interpretation",
              copy: "Keep business performance and personal financial health understandable without cross-contamination of unrelated activity.",
            },
            {
              icon: Building2,
              title: "Room to grow",
              copy: "Start with personal finance and add business needs later, or manage both from the beginning as your financial life expands.",
            },
          ],
        },
      ]}
      process={{
        eyebrow: "Workspace flow",
        title: "The user always knows which financial context they are managing.",
        copy: "Workspace separation is useful only when switching stays simple. FICONTER keeps the transition deliberate and immediate.",
        steps: [
          { title: "Choose the context", copy: "Enter the personal or business workspace depending on the financial decision you are making." },
          { title: "Work with the right records", copy: "Use the modules and metrics that belong to that workspace instead of combining unrelated activity." },
          { title: "Switch when needed", copy: "Move to the other workspace through the same account without signing into another product." },
          { title: "Keep both understandable", copy: "Each workspace continues to reflect its own financial position, history and direction." },
        ],
      }}
      callout={{
        eyebrow: "Why it matters",
        title: "A business can be part of your life without becoming your household ledger.",
        copy: "FICONTER treats personal and business finance as connected responsibilities, not interchangeable records. That distinction keeps the information cleaner and makes the combined system more useful as financial complexity grows.",
      }}
    />
  );
}
