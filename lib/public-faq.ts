export type FaqCategoryId =
  | "about"
  | "how-it-works"
  | "intelligence"
  | "savings-debt-credit"
  | "business"
  | "privacy-security"
  | "access-support";

export type FaqCategory = {
  id: FaqCategoryId;
  label: string;
  description: string;
};

export type FaqItem = {
  id: string;
  category: FaqCategoryId;
  question: string;
  answer: string;
};

export const faqCategories = [
  {
    id: "about",
    label: "About FICONTER",
    description: "What FICONTER is, who it is for and how it is positioned.",
  },
  {
    id: "how-it-works",
    label: "How it works",
    description: "Bank connections, user control, monthly planning and core financial records.",
  },
  {
    id: "intelligence",
    label: "Financial intelligence",
    description: "Financial Health, Smart Insights and decision-support features.",
  },
  {
    id: "savings-debt-credit",
    label: "Savings, debt & credit",
    description: "Goals, debt management and credit-card tracking.",
  },
  {
    id: "business",
    label: "Business",
    description: "Business workspaces, separation of records and accounting boundaries.",
  },
  {
    id: "privacy-security",
    label: "Privacy & security",
    description: "Data control, account boundaries and trust.",
  },
  {
    id: "access-support",
    label: "Access & support",
    description: "Devices, currencies, languages, product development and support.",
  },
] as const satisfies readonly FaqCategory[];

export const faqItems = [
  {
    id: "what-is-ficonter",
    category: "about",
    question: "What is FICONTER?",
    answer:
      "FICONTER stands for Financial Control Center. It is a financial management platform designed to help individuals and businesses organise, understand and manage their finances from one central place. FICONTER brings together areas such as transactions, bills, savings, debt, financial goals, credit cards, monthly planning, cash flow, financial health and financial insights.",
  },
  {
    id: "just-budgeting",
    category: "about",
    question: "Is FICONTER just a budgeting app?",
    answer:
      "No. Budgeting is one part of FICONTER. The platform is designed as a broader financial control system that connects different areas of your finances so you can understand not only what you spent, but also your obligations, savings, debt, cash flow, financial position and progress over time.",
  },
  {
    id: "who-is-it-for",
    category: "about",
    question: "Who is FICONTER designed for?",
    answer:
      "FICONTER is designed for people who want greater visibility and control over their finances. This can include individuals, couples and households, freelancers, entrepreneurs, small businesses and growing businesses. The platform is intended for users who want to actively understand and manage their finances rather than simply view a list of transactions.",
  },
  {
    id: "what-makes-it-different",
    category: "about",
    question: "What makes FICONTER different from other finance apps?",
    answer:
      "FICONTER is built around financial control rather than passive financial monitoring. Many finance applications focus primarily on automatically importing banking transactions. FICONTER takes a different approach by bringing financial planning, savings, debt, bills, credit cards, cash flow, goals and financial intelligence together within one structured environment. The objective is not simply to show what happened with your money, but to help you understand your wider financial position.",
  },
  {
    id: "why-use-ficonter",
    category: "about",
    question: "Why should I use FICONTER when other finance apps already exist?",
    answer:
      "Different financial tools solve different problems. Some products are primarily budgeting apps, while others are accounting systems or bank-account aggregators. FICONTER is built around a broader question: do you actually understand your financial position? The platform focuses on financial clarity, structure, planning and control rather than simply displaying banking activity.",
  },
  {
    id: "bank-connection",
    category: "how-it-works",
    question: "Does FICONTER connect directly to my bank account?",
    answer:
      "FICONTER is designed around a user-controlled financial model and does not require users to provide direct bank-account access in order to use the platform. You decide which financial information you want to manage inside your FICONTER workspace.",
  },
  {
    id: "why-no-bank-connection",
    category: "how-it-works",
    question: "Why doesn't FICONTER require bank connections?",
    answer:
      "Direct bank synchronisation is not the only way to manage finances. FICONTER's approach gives users greater control over the information that enters their financial workspace. Instead of another service continuously observing your banking activity, you decide what information you want FICONTER to work with.",
  },
  {
    id: "manual-vs-automatic",
    category: "how-it-works",
    question: "Isn't manually managing financial information less convenient than automatic bank synchronisation?",
    answer:
      "In some situations, yes. Automatic synchronisation can be convenient. FICONTER deliberately balances convenience with awareness and user control. Actively managing financial information can make spending, obligations, debt and savings more visible instead of allowing financial activity to disappear into the background. Automation can be introduced where it improves the experience without compromising that principle.",
  },
  {
    id: "what-can-i-manage",
    category: "how-it-works",
    question: "What can I manage inside FICONTER?",
    answer:
      "Depending on the features available within your account, FICONTER can help you organise transactions, income and expenses, bills, monthly planning, savings, financial goals, debt, credit cards, cash flow, emergency funds, financial health, wealth-related indicators and financial insights. These areas are designed to work together rather than exist as disconnected tools.",
  },
  {
    id: "monthly-planner",
    category: "how-it-works",
    question: "What is the Monthly Planner?",
    answer:
      "The Monthly Planner provides a structured view of your financial month. It helps you understand how income relates to expenses, bills, savings, debt payments and other commitments. Instead of looking at these areas independently, you can see how they affect your overall monthly position.",
  },
  {
    id: "financial-health-score",
    category: "intelligence",
    question: "What is the FICONTER Financial Health Score?",
    answer:
      "The Financial Health Score is designed to provide a simplified indication of your overall financial condition. It considers relevant financial information available within your FICONTER workspace rather than relying on a single factor such as income or account balance. Its purpose is to help you identify both financial strengths and areas that may require attention.",
  },
  {
    id: "health-score-change",
    category: "intelligence",
    question: "Why can my Financial Health Score change even when all my bills are paid?",
    answer:
      "Paying your bills is only one part of financial health. Your wider position can also involve cash flow, savings, debt, emergency reserves, financial commitments and available financial flexibility. You can therefore have every current bill paid while still having areas of your finances that could be strengthened.",
  },
  {
    id: "smart-insights",
    category: "intelligence",
    question: "What are FICONTER Smart Insights?",
    answer:
      "Smart Insights are designed to highlight meaningful patterns or information based on the financial data available within your FICONTER workspace. Rather than forcing you to analyse every number manually, FICONTER can surface information that may deserve attention.",
  },
  {
    id: "major-purchase",
    category: "intelligence",
    question: "Can FICONTER help me understand whether I can afford a major purchase?",
    answer:
      "FICONTER can help you evaluate your financial position by considering information such as income, expenses, obligations, savings, debt and available cash flow. That can provide useful context when considering a major purchase. FICONTER does not make the final decision for you and cannot guarantee that a particular purchase is appropriate.",
  },
  {
    id: "financial-advice",
    category: "intelligence",
    question: "Does FICONTER give financial advice?",
    answer:
      "FICONTER provides financial information, calculations, indicators and insights. It is not a bank, investment adviser, accountant, tax adviser or other regulated financial professional. FICONTER should therefore be used as a financial management and decision-support tool rather than as a substitute for professional advice where such advice is required.",
  },
  {
    id: "savings-goals",
    category: "savings-debt-credit",
    question: "Can I track savings and financial goals?",
    answer:
      "Yes. FICONTER allows savings and financial goals to become part of your wider financial picture. This helps you track progress while understanding how those goals interact with your income, expenses, debt and other obligations.",
  },
  {
    id: "debt-management",
    category: "savings-debt-credit",
    question: "Can I manage debt in FICONTER?",
    answer:
      "Yes. FICONTER includes debt-management functionality designed to help you track outstanding obligations, payments and progress. Debt is integrated into the broader financial system so you can understand how it affects your overall financial position.",
  },
  {
    id: "credit-cards",
    category: "savings-debt-credit",
    question: "Can I manage credit cards in FICONTER?",
    answer:
      "Yes. FICONTER includes dedicated credit-card management functionality for areas such as balances, amounts remaining to be paid, statements, minimum-payment calculations and payment history. This keeps credit-card obligations visible within your wider financial picture.",
  },
  {
    id: "business-use",
    category: "business",
    question: "Can businesses use FICONTER?",
    answer:
      "Yes. FICONTER includes a dedicated Business Workspace designed to help businesses organise and understand their financial activity separately from personal finances.",
  },
  {
    id: "personal-business-separation",
    category: "business",
    question: "Can I keep my personal and business finances separate?",
    answer:
      "Yes. Personal and business financial environments are designed to remain separate while still being accessible within the FICONTER ecosystem. This allows you to move between different financial contexts without mixing the underlying records.",
  },
  {
    id: "replace-accounting-software",
    category: "business",
    question: "Can FICONTER replace accounting software?",
    answer:
      "Not necessarily. FICONTER focuses on financial organisation, visibility, planning, financial control and financial intelligence. Traditional accounting software may also provide statutory bookkeeping, tax reporting, payroll, invoicing and jurisdiction-specific accounting functions. A business may therefore use FICONTER alongside its accounting systems where appropriate.",
  },
  {
    id: "why-business-use-it",
    category: "business",
    question: "Why should a business use FICONTER instead of established accounting software?",
    answer:
      "FICONTER and traditional accounting software do not necessarily solve the same problem. Accounting software is primarily concerned with correctly recording and reporting financial activity. FICONTER focuses more heavily on helping users understand and control the financial position behind those records. For many businesses, the two systems can complement each other rather than directly compete.",
  },
  {
    id: "data-safety",
    category: "privacy-security",
    question: "Is my financial information safe with FICONTER?",
    answer:
      "FICONTER is built with authenticated accounts, workspace access controls and data-protection measures intended to keep financial records separated and protected. Security is treated as an ongoing part of the platform rather than a one-time feature. Users should also protect their accounts with strong, unique credentials and standard security practices.",
  },
  {
    id: "bank-visibility",
    category: "privacy-security",
    question: "Can FICONTER see everything happening in my bank account?",
    answer:
      "No. Because FICONTER does not require continuous direct access to your banking activity, it does not automatically receive a complete live history of everything happening inside your bank account. You control the information you provide to your FICONTER workspace.",
  },
  {
    id: "who-can-see-data",
    category: "privacy-security",
    question: "Who can see my financial information?",
    answer:
      "Your financial workspace is associated with your authenticated FICONTER account and the permissions applicable to that account or workspace. FICONTER does not make private financial information publicly visible. Business accounts may provide access to authorised members according to their assigned permissions.",
  },
  {
    id: "sell-data",
    category: "privacy-security",
    question: "Does FICONTER sell my personal financial data?",
    answer:
      "FICONTER is not designed around selling users' private financial information. For the formal details on how personal data is collected, processed, retained and protected, always refer to the current FICONTER Privacy Policy.",
  },
  {
    id: "trust-newer-platform",
    category: "privacy-security",
    question: "Why should I trust a newer financial platform with sensitive information?",
    answer:
      "Trust should not depend only on how long a company has existed. It should also depend on how a platform is designed, how transparent it is about its limitations, how seriously it treats privacy and security, and how much control it gives its users. FICONTER is being built around those principles and aims to be clear about both what it does and what it does not do.",
  },
  {
    id: "devices",
    category: "access-support",
    question: "Can I use FICONTER on different devices?",
    answer:
      "FICONTER is designed to work across modern desktop, laptop, tablet and mobile environments. The interface adapts to different screen sizes so you can access your financial workspace from the device that is most convenient for you.",
  },
  {
    id: "currencies-languages",
    category: "access-support",
    question: "Does FICONTER support different currencies and languages?",
    answer:
      "Yes. FICONTER has been designed as a multi-currency and multilingual platform. Users can configure supported financial and language preferences according to their needs, and supported options can continue expanding as the platform develops.",
  },
  {
    id: "still-developed",
    category: "access-support",
    question: "Is FICONTER still being developed?",
    answer:
      "Yes. FICONTER is an actively evolving financial platform. New capabilities, usability improvements, security enhancements, financial intelligence and business functionality may continue to be introduced as the platform grows and receives real-world user feedback.",
  },
  {
    id: "contact-support",
    category: "access-support",
    question: "How can I contact FICONTER if I need help?",
    answer:
      "Use the official support channels provided inside FICONTER or on the FICONTER website. When reporting a problem, provide enough information to explain the issue clearly, but never send your password, authentication credentials or other sensitive security information.",
  },
] as const satisfies readonly FaqItem[];
