export type FlowDirection = "inflow" | "outflow" | "neutral";

export type TransactionTypeOption = {
  value: string;
  label: string;
  group: string;
  direction: FlowDirection;
};

export const TRANSACTION_TYPES: TransactionTypeOption[] = [
  {
    value: "expense",
    label: "General Expenses",
    group: "Transaction type",
    direction: "outflow",
  },
  {
    value: "income",
    label: "General Income",
    group: "Transaction type",
    direction: "inflow",
  },
  {
    value: "saving",
    label: "General Saving",
    group: "Transaction type",
    direction: "outflow",
  },
];

export const TYPE_BY_VALUE = Object.fromEntries(
  TRANSACTION_TYPES.map((option) => [option.value, option]),
) as Record<string, TransactionTypeOption>;

export type CategoryGroup = { group: string; items: string[] };

export const CATEGORY_GROUPS: CategoryGroup[] = [
  { group: "Income and earnings", items: ["Salary", "Wages", "Overtime", "Bonus", "Commission", "Tips", "Freelance", "Consulting", "Business revenue", "Rental income", "Interest", "Dividends", "Capital gains", "Royalties", "Pension", "Government benefits", "Child benefit", "Unemployment benefit", "Scholarship", "Alimony received", "Child support received", "Gift received", "Inheritance", "Refund", "Reimbursement", "Cashback", "Insurance payout", "Other income"] },
  { group: "Home and housing", items: ["Rent", "Mortgage", "Property tax", "Home insurance", "Home repairs", "Home maintenance", "Furniture", "Home appliances", "Home improvement", "Cleaning supplies", "Cleaning service", "Garden", "Security system", "Storage", "HOA / service charges", "Moving costs"] },
  { group: "Utilities and communications", items: ["Electricity", "Gas", "Water", "Heating", "Waste / recycling", "Internet", "Mobile phone", "Landline", "TV licence", "Cable / satellite", "Cloud storage", "Postage"] },
  { group: "Food and drink", items: ["Groceries", "Restaurants", "Takeaway / delivery", "Coffee", "Work meals", "Snacks", "Alcohol", "Meal subscriptions", "Specialty food"] },
  { group: "Transport and mobility", items: ["Public transport", "Fuel", "Car payment", "Car insurance", "Car maintenance", "Car repairs", "Parking", "Tolls", "Taxi / rideshare", "Bicycle", "Scooter", "Vehicle registration", "Driving licence", "Car wash", "Rental car", "Flights", "Rail travel"] },
  { group: "Health and wellbeing", items: ["Health insurance", "Doctor", "Dentist", "Hospital", "Pharmacy", "Medication", "Therapy", "Optician", "Physiotherapy", "Medical devices", "Gym", "Fitness classes", "Sports", "Wellness", "Supplements", "Personal trainer"] },
  { group: "Personal care and clothing", items: ["Clothing", "Shoes", "Accessories", "Haircut", "Beauty", "Cosmetics", "Skincare", "Toiletries", "Laundry / dry cleaning", "Jewellery", "Tailoring"] },
  { group: "Family and children", items: ["Childcare", "School fees", "School supplies", "Children's clothing", "Baby supplies", "Toys", "Activities", "Pocket money", "Child support paid", "Alimony paid", "Elder care", "Family support"] },
  { group: "Education and professional", items: ["Tuition", "Courses", "Books", "Software", "Professional membership", "Certification", "Conference", "Work equipment", "Office supplies", "Coworking", "Career coaching", "Language learning"] },
  { group: "Entertainment and lifestyle", items: ["Streaming", "Music", "Cinema", "Gaming", "Books / magazines", "Hobbies", "Events", "Concerts", "Museums", "Nightlife", "Photography", "Crafts", "Electronics", "Apps", "Social clubs"] },
  { group: "Travel and holidays", items: ["Accommodation", "Flights", "Train tickets", "Local transport", "Travel insurance", "Food while travelling", "Tours / attractions", "Visa / passport", "Luggage", "Currency exchange fee", "Holiday shopping"] },
  { group: "Pets", items: ["Pet food", "Veterinary", "Pet insurance", "Grooming", "Pet supplies", "Pet care / boarding", "Pet training"] },
  { group: "Financial obligations", items: ["Income tax", "Business tax", "Bank fees", "Interest charges", "Credit-card payment", "Personal-loan payment", "Student-loan payment", "Mortgage principal", "Debt repayment", "Late fee", "Fine / penalty", "Legal fees", "Accounting fees"] },
  { group: "Saving and investing", items: ["Emergency fund", "General savings", "Holiday savings", "House deposit", "Retirement", "Stocks", "ETFs", "Bonds", "Mutual funds", "Crypto", "Precious metals", "Property investment", "Business investment", "Education fund", "Investment fees"] },
  { group: "Gifts, charity and community", items: ["Gifts", "Birthday", "Wedding", "Holiday gifts", "Charity", "Religious giving", "Community support", "Political contribution"] },
  { group: "Business and self-employment", items: ["Inventory", "Materials", "Manufacturing", "Shipping", "Advertising", "Marketing", "Website", "Domain / hosting", "Business software", "Contractors", "Employee payroll", "Business insurance", "Business travel", "Client entertainment", "Equipment", "Licences / permits"] },
  { group: "Transfers and adjustments", items: ["Account transfer", "Cash deposit", "Cash withdrawal", "Opening balance", "Balance correction", "Currency conversion", "Refund adjustment", "Other / custom"] },
];

export const CATEGORY_ITEMS = CATEGORY_GROUPS.flatMap((group) => group.items);

// Active ISO 4217 currency codes commonly used as legal tender.
export const CURRENCY_CODES = [
  "AED","AFN","ALL","AMD","ANG","AOA","ARS","AUD","AWG","AZN","BAM","BBD","BDT","BGN","BHD","BIF","BMD","BND","BOB","BRL","BSD","BTN","BWP","BYN","BZD","CAD","CDF","CHF","CLP","CNY","COP","CRC","CUP","CVE","CZK","DJF","DKK","DOP","DZD","EGP","ERN","ETB","EUR","FJD","FKP","GBP","GEL","GHS","GIP","GMD","GNF","GTQ","GYD","HKD","HNL","HTG","HUF","IDR","ILS","INR","IQD","IRR","ISK","JMD","JOD","JPY","KES","KGS","KHR","KMF","KPW","KRW","KWD","KYD","KZT","LAK","LBP","LKR","LRD","LSL","LYD","MAD","MDL","MGA","MKD","MMK","MNT","MOP","MRU","MUR","MVR","MWK","MXN","MYR","MZN","NAD","NGN","NIO","NOK","NPR","NZD","OMR","PAB","PEN","PGK","PHP","PKR","PLN","PYG","QAR","RON","RSD","RUB","RWF","SAR","SBD","SCR","SDG","SEK","SGD","SHP","SLE","SOS","SRD","SSP","STN","SYP","SZL","THB","TJS","TMT","TND","TOP","TRY","TTD","TWD","TZS","UAH","UGX","USD","UYU","UZS","VES","VND","VUV","WST","XAF","XCD","XOF","XPF","YER","ZAR","ZMW","ZWL"
] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export function currencyName(
  code: string,
  locale: string | string[] = "en",
): string {
  try {
    const DisplayNames = Intl.DisplayNames;
    return new DisplayNames(
      Array.isArray(locale) ? locale : [locale],
      { type: "currency" },
    ).of(code) ?? code;
  } catch {
    return code;
  }
}

export function currencySymbol(code: string): string {
  try {
    return (
      new Intl.NumberFormat("en", {
        style: "currency",
        currency: code,
        currencyDisplay: "narrowSymbol",
      })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value ?? code
    );
  } catch {
    return code;
  }
}

const currencyFormatterCache = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: string): Intl.NumberFormat {
  const normalized = currency.toUpperCase();
  const cached = currencyFormatterCache.get(normalized);
  if (cached) return cached;

  const formatter = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: normalized,
    maximumFractionDigits: 2,
  });
  currencyFormatterCache.set(normalized, formatter);
  return formatter;
}

export function formatCurrency(value: number, currency: string): string {
  const numeric = Number.isFinite(value) ? value : 0;
  const normalized = currency.toUpperCase();
  try {
    return currencyFormatter(normalized).format(numeric);
  } catch {
    return `${normalized} ${numeric.toFixed(2)}`;
  }
}

export type ReportingCurrencyRuntime = Readonly<{
  workspace: "personal" | "business";
  reportingCurrency: string;
  baseCurrency: string;
  rate: number;
}>;

let reportingCurrencyRuntime: ReportingCurrencyRuntime = {
  workspace: "personal",
  reportingCurrency: "EUR",
  baseCurrency: "EUR",
  rate: 1,
};

export function setReportingCurrencyRuntime(
  next: ReportingCurrencyRuntime,
): void {
  const reportingCurrency = String(next.reportingCurrency || "EUR").toUpperCase();
  const baseCurrency = String(next.baseCurrency || reportingCurrency).toUpperCase();
  const rate = Number(next.rate);

  reportingCurrencyRuntime = {
    workspace: next.workspace,
    reportingCurrency,
    baseCurrency,
    rate: Number.isFinite(rate) && rate > 0 ? rate : 1,
  };
}

export function getReportingCurrencyRuntime(): ReportingCurrencyRuntime {
  return reportingCurrencyRuntime;
}

/**
 * Formats a value that is already expressed in FICONTER's internal personal
 * reporting currency (currently EUR). The original financial record is never
 * changed; only the displayed value is converted through the active base-
 * currency lens.
 */
export function formatReportingCurrency(
  value: number,
  reportingCurrency = "EUR",
): string {
  const numeric = Number.isFinite(value) ? value : 0;
  const source = reportingCurrency.toUpperCase();
  const runtime = reportingCurrencyRuntime;

  if (
    runtime.workspace === "personal" &&
    source === runtime.reportingCurrency &&
    runtime.baseCurrency !== runtime.reportingCurrency &&
    Number.isFinite(runtime.rate) &&
    runtime.rate > 0
  ) {
    return formatCurrency(numeric * runtime.rate, runtime.baseCurrency);
  }

  return formatCurrency(numeric, source);
}
