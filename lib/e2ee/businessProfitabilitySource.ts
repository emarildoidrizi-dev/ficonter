import type {
  BusinessCostBudget,
  BusinessProfitabilityReport,
  BusinessSale,
  BusinessSaleLine,
  BusinessSupplierInvoice,
  BusinessTransaction,
} from "@/lib/business/types";
import { loadBusinessInventorySource } from "@/lib/e2ee/businessInventorySource";

const n = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;
const sum = <T,>(rows: T[], pick: (row: T) => unknown) => rows.reduce((total, row) => total + n(pick(row)), 0);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const month = (v: string) => v.slice(0, 7);
const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
}
function dayCount(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000) + 1;
}
function summary(transactions: BusinessTransaction[], sales: BusinessSale[]) {
  const completed = sales.filter((sale) => sale.status === "completed");
  const cashInflow = sum(transactions.filter((x) => x.type === "income"), (x) => x.amount_base);
  const cashOutflow = sum(transactions.filter((x) => x.type === "expense"), (x) => x.amount_base);
  const otherIncome = sum(transactions.filter((x) => x.type === "income" && !x.source_sale_id), (x) => x.amount_base);
  const operating = transactions.filter((x) => x.type === "expense" && !x.source_inventory_movement_id && String(x.category).toLowerCase() !== "inventory purchases");
  const inventoryPurchases = sum(transactions.filter((x) => x.type === "expense" && (Boolean(x.source_inventory_movement_id) || String(x.category).toLowerCase() === "inventory purchases")), (x) => x.amount_base);
  const operatingExpenses = sum(operating, (x) => x.amount_base);
  const fixedCosts = sum(operating.filter((x) => x.cost_nature === "fixed"), (x) => x.amount_base);
  const variableCosts = sum(operating.filter((x) => x.cost_nature === "variable"), (x) => x.amount_base);
  const netSales = sum(completed, (x) => x.net_sales_base);
  const salesTax = sum(completed, (x) => x.tax_base);
  const discounts = sum(completed, (x) => x.discount_base);
  const cogs = sum(completed, (x) => x.cogs_base);
  const grossProfit = sum(completed, (x) => x.gross_profit_base);
  const operatingIncome = netSales + otherIncome;
  const operatingProfit = grossProfit + otherIncome - operatingExpenses;
  const unitsSold = sum(completed, (x) => x.units_sold);
  return {
    cashInflow, cashOutflow, cashMovement: cashInflow - cashOutflow,
    netSales, salesTax, discounts, otherIncome, operatingIncome, cogs, grossProfit,
    operatingExpenses, inventoryPurchases, fixedCosts, variableCosts, operatingProfit,
    grossMargin: netSales > 0 ? grossProfit / netSales * 100 : 0,
    operatingMargin: operatingIncome > 0 ? operatingProfit / operatingIncome * 100 : 0,
    salesCount: completed.length, unitsSold,
    averageNetSale: completed.length ? netSales / completed.length : 0,
  };
}
function monthsBetween(start: string, end: string) {
  const rows: string[] = [];
  const cursor = new Date(`${start.slice(0,7)}-01T12:00:00Z`);
  const stop = end.slice(0,7);
  while (iso(cursor).slice(0,7) <= stop) {
    rows.push(iso(cursor).slice(0,7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return rows;
}
function monthOverlapFraction(budgetMonth: string, start: string, end: string) {
  const monthStart = budgetMonth.slice(0, 10);
  const date = new Date(`${monthStart}T12:00:00Z`);
  const next = new Date(date); next.setUTCMonth(next.getUTCMonth() + 1);
  const monthEnd = addDays(iso(next), -1);
  const overlapStart = start > monthStart ? start : monthStart;
  const overlapEnd = end < monthEnd ? end : monthEnd;
  if (overlapEnd < overlapStart) return 0;
  return dayCount(overlapStart, overlapEnd) / dayCount(monthStart, monthEnd);
}

export async function loadBusinessProfitabilityReport(client: any, businessId: string, startDate: string, endDate: string): Promise<BusinessProfitabilityReport> {
  if (!startDate || !endDate || endDate < startDate) throw new Error("Choose a valid reporting period.");
  const days = dayCount(startDate, endDate);
  if (days > 1827) throw new Error("A single report can cover at most five years.");
  const priorEndDate = addDays(startDate, -1);
  const priorStartDate = addDays(priorEndDate, -(days - 1));
  const [txr, sr, lr, br, ir, inventory] = await Promise.all([
    client.from("business_transactions").select("*").eq("business_id", businessId),
    client.from("business_sales").select("*").eq("business_id", businessId),
    client.from("business_sale_lines").select("*").eq("business_id", businessId),
    client.from("business_cost_budgets").select("*").eq("business_id", businessId),
    client.from("business_supplier_invoices").select("*").eq("business_id", businessId),
    loadBusinessInventorySource(client, businessId),
  ]);
  const first = txr.error ?? sr.error ?? lr.error ?? br.error ?? ir.error;
  if (first) throw first;
  const transactions = (txr.data ?? []) as BusinessTransaction[];
  const sales = (sr.data ?? []) as BusinessSale[];
  const lines = (lr.data ?? []) as BusinessSaleLine[];
  const budgets = (br.data ?? []) as BusinessCostBudget[];
  const invoices = (ir.data ?? []) as BusinessSupplierInvoice[];
  const inRange = (v: string, a: string, b: string) => v >= a && v <= b;
  const currentTx = transactions.filter((x) => inRange(x.transaction_date, startDate, endDate));
  const priorTx = transactions.filter((x) => inRange(x.transaction_date, priorStartDate, priorEndDate));
  const currentSales = sales.filter((x) => x.status === "completed" && inRange(x.sale_date, startDate, endDate));
  const priorSales = sales.filter((x) => x.status === "completed" && inRange(x.sale_date, priorStartDate, priorEndDate));
  const current = summary(currentTx, currentSales);
  const prior = summary(priorTx, priorSales);
  const categoryById = new Map(inventory.costCategories.map((x) => [x.id, x]));
  const centreById = new Map(inventory.costCentres.map((x) => [x.id, x]));
  const supplierById = new Map(inventory.suppliers.map((x) => [x.id, x]));
  const plannedOperatingCosts = budgets.reduce((total, b) => {
    const category = categoryById.get(b.category_id);
    if (String(category?.name ?? "").toLowerCase() === "inventory purchases") return total;
    return total + n(b.amount_base) * monthOverlapFraction(String(b.budget_month), startDate, endDate);
  }, 0);
  const trend = monthsBetween(startDate, endDate).map((m) => {
    const tx = currentTx.filter((x) => month(x.transaction_date) === m);
    const ss = currentSales.filter((x) => month(x.sale_date) === m);
    const s = summary(tx, ss);
    return { month: m, netSales: s.netSales, otherIncome: s.otherIncome, cogs: s.cogs, grossProfit: s.grossProfit, operatingExpenses: s.operatingExpenses, inventoryPurchases: s.inventoryPurchases, operatingProfit: s.operatingProfit, cashMovement: s.cashMovement };
  });
  const operatingTx = currentTx.filter((x) => x.type === "expense" && !x.source_inventory_movement_id && String(x.category).toLowerCase() !== "inventory purchases");
  const grouped = <T,>(rows: T[], key: (r:T)=>string, amount: (r:T)=>number) => {
    const map = new Map<string,{amount:number,count:number}>();
    for (const row of rows) { const k=key(row); const v=map.get(k) ?? {amount:0,count:0}; v.amount += amount(row); v.count++; map.set(k,v); }
    return map;
  };
  const catMap = grouped(operatingTx, (x) => `${x.cost_category_id ?? ""}|${x.category}`, (x) => n(x.amount_base));
  const costCategories = [...catMap].map(([k,v]) => { const [id,name]=k.split("|"); return { id:id||null, name, amount:v.amount, percentage: current.operatingExpenses > 0 ? v.amount/current.operatingExpenses*100:0, transactionCount:v.count }; }).sort((a,b)=>n(b.amount)-n(a.amount)).slice(0,12);
  const centreMap = grouped(operatingTx, (x) => x.cost_centre_id ?? "", (x) => n(x.amount_base));
  const costCentres = [...centreMap].map(([id,v]) => ({ id:id||null, name:id ? centreById.get(id)?.name ?? "Unassigned" : "Unassigned", amount:v.amount, percentage:current.operatingExpenses>0?v.amount/current.operatingExpenses*100:0, transactionCount:v.count })).sort((a,b)=>n(b.amount)-n(a.amount)).slice(0,12);
  const spend = grouped(currentTx.filter((x)=>x.type==="expense" && Boolean(x.supplier_id)), (x)=>x.supplier_id!, (x)=>n(x.amount_base));
  const suppliers = [...spend].map(([id,v]) => {
    const rows=currentTx.filter((x)=>x.supplier_id===id && x.type==="expense");
    const inventoryPurchases=sum(rows.filter((x)=>Boolean(x.source_inventory_movement_id)||String(x.category).toLowerCase()==="inventory purchases"),(x)=>x.amount_base);
    return { id, name:supplierById.get(id)?.name ?? "Supplier", operatingSpend:v.amount-inventoryPurchases, inventoryPurchases, totalSpend:v.amount, transactionCount:v.count };
  }).sort((a,b)=>n(b.totalSpend)-n(a.totalSpend)).slice(0,12);
  const saleById=new Map(currentSales.map((x)=>[x.id,x]));
  const lineGroups=new Map<string,{id:string,name:string,sku:string|null,quantity:number,netSales:number,cogs:number,sales:Set<string>}>();
  for (const line of lines) { const sale=saleById.get(line.sale_id); if(!sale) continue; const id=line.inventory_item_id ?? `service:${String(line.item_name).toLowerCase()}`; const g=lineGroups.get(id)??{id,name:line.item_name,sku:line.item_sku,quantity:0,netSales:0,cogs:0,sales:new Set()}; g.quantity+=n(line.quantity); const allocated=n(sale.subtotal_base)>0?n(line.line_subtotal_base)*n(sale.net_sales_base)/n(sale.subtotal_base):0; g.netSales+=allocated; g.cogs+=n(line.cogs_base); g.sales.add(line.sale_id); lineGroups.set(id,g); }
  const products=[...lineGroups.values()].map((g)=>({id:g.id,name:g.name,sku:g.sku,quantity:g.quantity,netSales:round2(g.netSales),cogs:round2(g.cogs),grossProfit:round2(g.netSales-g.cogs),grossMargin:g.netSales>0?(g.netSales-g.cogs)/g.netSales*100:0,saleCount:g.sales.size})).sort((a,b)=>n(b.grossProfit)-n(a.grossProfit)).slice(0,12);
  const customerMap=new Map<string,{netSales:number,grossProfit:number,salesCount:number}>();
  for(const sale of currentSales){const name=String(sale.customer_name??"").trim()||"Walk-in / unnamed"; const g=customerMap.get(name)??{netSales:0,grossProfit:0,salesCount:0};g.netSales+=n(sale.net_sales_base);g.grossProfit+=n(sale.gross_profit_base);g.salesCount++;customerMap.set(name,g);}
  const customers=[...customerMap].map(([name,g])=>({name,...g})).sort((a,b)=>n(b.netSales)-n(a.netSales)).slice(0,12);
  const active=inventory.items.filter((x)=>x.status==="active");
  const today=iso(new Date()); const open=invoices.filter((x)=>x.status==="open"); const overdue=open.filter((x)=>x.due_date<today);
  return {
    generatedAt:new Date().toISOString(), range:{startDate,endDate,priorStartDate,priorEndDate,dayCount:days}, summary:current, priorSummary:prior,
    budget:{plannedOperatingCosts,actualOperatingCosts:current.operatingExpenses,remaining:plannedOperatingCosts-current.operatingExpenses,usagePercentage:plannedOperatingCosts>0?current.operatingExpenses/plannedOperatingCosts*100:0,hasBudget:plannedOperatingCosts>0},
    trend,costCategories,costCentres,suppliers,products,customers,
    inventory:{activeItems:active.length,totalQuantity:sum(active,(x)=>x.quantity_on_hand),inventoryValue:sum(active,(x)=>x.inventory_value_base),potentialSalesValue:sum(active,(x)=>x.potential_sales_value_base),lowStockItems:active.filter((x)=>n(x.quantity_on_hand)<=n(x.low_stock_threshold)).length},
    supplierInvoices:{openCount:open.length,openAmount:sum(open,(x)=>x.amount_base),overdueCount:overdue.length,overdueAmount:sum(overdue,(x)=>x.amount_base)},
  };
}
