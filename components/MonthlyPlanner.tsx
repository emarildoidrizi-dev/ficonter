"use client";

import { ChevronLeft, ChevronRight, LockKeyhole, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEncryptedTransactions } from "@/components/EncryptedTransactionProvider";
import {
  isFinancialDataScope,
  notifyFiconterDataChange,
  subscribeFiconterDataChanges,
} from "@/lib/ficonterRealtime";
import { addMoney, finiteNumber, roundMoney, subtractMoney, sumMoney } from "@/lib/finance/money";
import {
  billActivityDate,
  calculateMonthlyCashActuals,
  isMonthlyBudgetExpenseTransaction,
  transactionActivityDate,
} from "@/lib/finance/monthlyCashActuals";
import { formatCurrency } from "@/lib/financialOptions";
import { useCurrencyDisplay, useHistoricalReportingRates } from "@/components/CurrencyDisplayProvider";
import { baseCurrencyAmountToCanonicalEur, canonicalAmountInBaseCurrency, mapBillsToBaseCurrency, mapTransactionsToBaseCurrency } from "@/lib/finance/baseCurrencyReconciliation";
import styles from "./MonthlyPlanner.module.css";

type Section = "income" | "bills" | "expenses" | "savings" | "debt";
type BreakdownView = "ring" | "bars" | "tiles";
type BreakdownKey = Section | "goals";
type Tx = { id:string; user_id:string; description:string; amount:number|string; currency:string|null; amount_eur:number|string; type:string; category:string; transaction_date:string; occurred_at:string|null; exchange_rate_source:string|null };
type Bill = { id:string; user_id:string; name:string; category:string; amount:number|string; currency:string|null; amount_eur:number|string; due_date:string; status:string; paid_at:string|null; transaction_id:string|null };
type Plan = { id:string; user_id:string; month:string; start_balance:number|string; spending_budget:number|string; created_at:string; updated_at:string };
type Item = { id:string; user_id:string; month:string; section:Section; label:string; planned_amount:number|string; position:number; created_at:string; updated_at:string };
type Goal = { id:string; user_id:string; name:string; target_amount:number|string; current_amount:number|string; target_date:string|null; status:string; created_at:string; updated_at:string };

const compactSections = new Set<Section>(["income","bills","expenses","savings","debt"]);
const sections: {key:Section; title:string}[] = [
  {key:"income",title:"Income"},{key:"bills",title:"Bills"},{key:"expenses",title:"Expenses"},{key:"savings",title:"Savings"},{key:"debt",title:"Debt"},
];
const debtWords=["debt","loan","credit-card","credit card","mortgage principal","student-loan","personal-loan"];
const savingWords=["savings","emergency fund","retirement","stocks","etfs","bonds","crypto","investment","house deposit","education fund"];
const monthKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
const monthTitle=(m:string)=>new Date(`${m}-01T12:00:00`).toLocaleDateString("en-GB",{month:"long",year:"numeric"});
const inMonth=(date:string|null,m:string)=>Boolean(date?.startsWith(m));
const isGoalInvestment=(tx:Tx)=>tx.description.startsWith("Goal investment ·");
const realtimeRowId=(row:unknown):string|null=>{
  if(!row||typeof row!=="object"||!("id" in row))return null;
  const id=(row as {id?:unknown}).id;
  return typeof id==="string"?id:null;
};
const isBillTransaction=(tx:Tx)=>{
  const source=(tx.exchange_rate_source??"").trim().toLowerCase();
  return source==="automatic bill schedule"||source==="bill conversion";
};
const classify=(tx:Tx):Section=>{
  if(tx.type==="income") return "income";
  if(isBillTransaction(tx)) return "bills";
  const c=tx.category.toLowerCase();
  if(debtWords.some(w=>c.includes(w))) return "debt";
  if(savingWords.some(w=>c.includes(w))) return "savings";
  return "expenses";
};

export function MonthlyPlanner({userId,initialTransactions,initialBills,initialPlans,initialItems,initialGoals,initialError="",showAdvancedPosition=true}:{userId:string;initialTransactions:Tx[];initialBills:Bill[];initialPlans:Plan[];initialItems:Item[];initialGoals:Goal[];initialError?:string;showAdvancedPosition?:boolean}){
  const { baseCurrency, latestRate } = useCurrencyDisplay();
  const supabase=useMemo(()=>createClient(),[]);
  const [month,setMonth]=useState(monthKey());
  const { transactions: encryptedTransactions } = useEncryptedTransactions();
  const transactions = encryptedTransactions as Tx[];
  const [bills,setBills]=useState(initialBills);
  const [plans,setPlans]=useState(initialPlans);
  const [items,setItems]=useState(initialItems);
  const [goals,setGoals]=useState(initialGoals);
  const [notice,setNotice]=useState(initialError);
  const [budgetStatus,setBudgetStatus]=useState("");
  const [budgetSaving,setBudgetSaving]=useState(false);
  const [startBalanceBehavior,setStartBalanceBehavior]=useState("manual");
  const [breakdownView,setBreakdownView]=useState<BreakdownView>("ring");
  const [startBalanceDraft,setStartBalanceDraft]=useState("");
  const refreshTimerRef=useRef<number|null>(null);
  const refreshInFlightRef=useRef<Promise<void>|null>(null);
  const refreshQueuedRef=useRef(false);

  useEffect(()=>{ if(!notice)return; const t=setTimeout(()=>setNotice(""),3500); return()=>clearTimeout(t)},[notice]);
  function chooseBreakdownView(view:BreakdownView){
    // View-only preference: keep it local to this visit. It is not persisted
    // unless FICONTER later exposes an explicit Save control for it.
    setBreakdownView(view);
  }

  useEffect(()=>{
    let active=true;
    async function loadPlannerPreference(){
      const {data:{user}}=await supabase.auth.getUser();
      const prefs=user?.user_metadata?.ficonter_preferences as {plannerStartBalance?:string}|undefined;
      if(active)setStartBalanceBehavior(prefs?.plannerStartBalance??"manual");
    }
    void loadPlannerPreference();
    const handle=()=>void loadPlannerPreference();
    window.addEventListener("ficonter:preferences-updated",handle);
    return()=>{active=false;window.removeEventListener("ficonter:preferences-updated",handle)};
  },[supabase]);
  const refreshPlannerData=useCallback(async()=>{
    if(refreshInFlightRef.current){
      refreshQueuedRef.current=true;
      return refreshInFlightRef.current;
    }
    const request=(async()=>{
      do{
        refreshQueuedRef.current=false;
        const [billResult,planResult,itemResult,goalResult]=await Promise.all([
          supabase.from("bills").select("id,user_id,name,category,amount,currency,amount_eur,due_date,status,paid_at,transaction_id").eq("user_id",userId),
          supabase.from("monthly_budget_plans").select("id,user_id,month,start_balance,spending_budget,created_at,updated_at").eq("user_id",userId).order("month",{ascending:false}),
          supabase.from("monthly_budget_items").select("id,user_id,month,section,label,planned_amount,position,created_at,updated_at").eq("user_id",userId).order("position",{ascending:true}),
          supabase.from("goals").select("id,user_id,name,target_amount,current_amount,target_date,status,created_at,updated_at").eq("user_id",userId).order("created_at",{ascending:true}),
        ]);
        const error=billResult.error??planResult.error??itemResult.error??goalResult.error;
        if(error)setNotice(error.message);
        else{
          setBills((billResult.data??[]) as Bill[]);
          setPlans((planResult.data??[]) as Plan[]);
          setItems((itemResult.data??[]) as Item[]);
          setGoals((goalResult.data??[]) as Goal[]);
        }
      }while(refreshQueuedRef.current);
    })();
    refreshInFlightRef.current=request;
    try{await request;}finally{refreshInFlightRef.current=null;}
  },[supabase,userId]);
  const schedulePlannerRefresh=useCallback(()=>{
    if(refreshTimerRef.current)window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current=window.setTimeout(()=>{
      refreshTimerRef.current=null;
      void refreshPlannerData();
    },80);
  },[refreshPlannerData]);
  useEffect(()=>{
    const unsubscribe=subscribeFiconterDataChanges(change=>{
      if(isFinancialDataScope(change.scope))schedulePlannerRefresh();
    });
    const handleFocus=()=>schedulePlannerRefresh();
    const handleVisible=()=>{if(document.visibilityState==="visible")schedulePlannerRefresh();};
    const handleOnline=()=>schedulePlannerRefresh();
    const safetyTimer=window.setInterval(()=>{
      if(document.visibilityState==="visible")schedulePlannerRefresh();
    },15_000);
    window.addEventListener("focus",handleFocus);
    window.addEventListener("online",handleOnline);
    document.addEventListener("visibilitychange",handleVisible);
    return()=>{
      unsubscribe();
      window.removeEventListener("focus",handleFocus);
      window.removeEventListener("online",handleOnline);
      document.removeEventListener("visibilitychange",handleVisible);
      window.clearInterval(safetyTimer);
      if(refreshTimerRef.current)window.clearTimeout(refreshTimerRef.current);
    };
  },[schedulePlannerRefresh]);
  useEffect(()=>{
    const channel=supabase.channel(`planner-${userId}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"bills",filter:`user_id=eq.${userId}`},p=>setBills(c=>p.eventType==="DELETE"?c.filter(x=>x.id!==realtimeRowId(p.old)):[p.new as Bill,...c.filter(x=>x.id!==realtimeRowId(p.new))]))
      .on("postgres_changes",{event:"*",schema:"public",table:"monthly_budget_plans",filter:`user_id=eq.${userId}`},p=>setPlans(c=>p.eventType==="DELETE"?c.filter(x=>x.id!==realtimeRowId(p.old)):[p.new as Plan,...c.filter(x=>x.id!==realtimeRowId(p.new))]))
      .on("postgres_changes",{event:"*",schema:"public",table:"monthly_budget_items",filter:`user_id=eq.${userId}`},p=>setItems(c=>p.eventType==="DELETE"?c.filter(x=>x.id!==realtimeRowId(p.old)):[p.new as Item,...c.filter(x=>x.id!==realtimeRowId(p.new))]))
      .on("postgres_changes",{event:"*",schema:"public",table:"goals",filter:`user_id=eq.${userId}`},p=>setGoals(c=>p.eventType==="DELETE"?c.filter(x=>x.id!==realtimeRowId(p.old)):[p.new as Goal,...c.filter(x=>x.id!==realtimeRowId(p.new))]))
      .subscribe();
    return()=>{void supabase.removeChannel(channel)};
  },[supabase,userId]);

  const currencyDates=useMemo(()=>[
    ...transactions.map(transaction=>transaction.transaction_date),
    ...bills.map(bill=>bill.paid_at?.slice(0,10)??bill.due_date),
  ],[transactions,bills]);
  const { rateForDate }=useHistoricalReportingRates(currencyDates);
  const currencyContext=useMemo(()=>({baseCurrency,latestRate,rateForDate}),[baseCurrency,latestRate,rateForDate]);
  const financeTransactions=useMemo(()=>mapTransactionsToBaseCurrency(transactions,currencyContext) as Tx[],[transactions,currencyContext]);
  const financeBills=useMemo(()=>mapBillsToBaseCurrency(bills,currencyContext) as Bill[],[bills,currencyContext]);
  const money=useCallback((value:number|string)=>formatCurrency(finiteNumber(value),baseCurrency),[baseCurrency]);

  const plan=plans.find(p=>p.month===month);
  const previousMonth=(()=>{const d=new Date(`${month}-01T12:00:00`);d.setMonth(d.getMonth()-1);return monthKey(d)})();
  const previousPlan=plans.find(p=>p.month===previousMonth);
  const previousTransactions=financeTransactions.filter(t=>inMonth(transactionActivityDate(t),previousMonth));
  const previousPaidBillTxIds=new Set(financeBills.filter(b=>b.transaction_id).map(b=>b.transaction_id as string));
  const previousActual:Record<Section,number>={income:0,bills:0,expenses:0,savings:0,debt:0};
  let previousGoalInvestments=0;
  previousTransactions.forEach(t=>{
    if(previousPaidBillTxIds.has(t.id))return;
    if(isGoalInvestment(t)){previousGoalInvestments=addMoney(previousGoalInvestments,t.amount_eur);return;}
    previousActual[classify(t)]=addMoney(previousActual[classify(t)],t.amount_eur);
  });
  financeBills.filter(b=>b.status==="paid"&&inMonth(billActivityDate(b),previousMonth)).forEach(b=>{previousActual.bills=addMoney(previousActual.bills,b.amount_eur)});
  const previousStartBalance=previousPlan
    ? canonicalAmountInBaseCurrency(previousPlan.start_balance,currencyContext)
    : 0;
  const previousLeft=subtractMoney(addMoney(previousStartBalance,previousActual.income),previousActual.bills,previousActual.expenses,previousActual.savings,previousActual.debt,previousGoalInvestments);
  const derivedStartBalance=startBalanceBehavior==="carry-forward"?previousLeft:0;
  const startBalance=plan
    ? canonicalAmountInBaseCurrency(plan.start_balance,currencyContext)
    : roundMoney(derivedStartBalance);
  const spendingBudget=plan
    ? canonicalAmountInBaseCurrency(plan.spending_budget,currencyContext)
    : 0;
  useEffect(()=>{
    setStartBalanceDraft(String(startBalance));
  },[month,startBalance]);
  const paidBillTxIds=useMemo(()=>new Set(financeBills.filter(b=>b.transaction_id).map(b=>b.transaction_id as string)),[financeBills]);
  const monthTx=useMemo(()=>financeTransactions.filter(t=>inMonth(transactionActivityDate(t),month)),[financeTransactions,month]);
  const expenseTransactions=useMemo(()=>[...monthTx.filter(t=>t.type!=="income"&&!paidBillTxIds.has(t.id)&&!isGoalInvestment(t)&&classify(t)==="expenses")].sort((a,b)=>(b.occurred_at??b.transaction_date).localeCompare(a.occurred_at??a.transaction_date)),[monthTx,paidBillTxIds]);
  const monthlyBudgetExpenseTransactions=useMemo(
    ()=>expenseTransactions.filter(isMonthlyBudgetExpenseTransaction),
    [expenseTransactions],
  );
  const actualBySection=useMemo(()=>{
    const totals:Record<Section,number>={income:0,bills:0,expenses:0,savings:0,debt:0};
    monthTx.forEach(t=>{
      if(paidBillTxIds.has(t.id)||isGoalInvestment(t))return;
      totals[classify(t)]=addMoney(totals[classify(t)],t.amount_eur);
    });
    financeBills.filter(b=>b.status==="paid"&&inMonth(billActivityDate(b),month)).forEach(b=>{totals.bills=addMoney(totals.bills,b.amount_eur)});
    return totals;
  },[monthTx,financeBills,month,paidBillTxIds]);
  const monthItems=items.filter(i=>i.month===month);
  const planned=(s:Section)=>sumMoney(
    monthItems
      .filter(i=>i.section===s)
      .map(i=>canonicalAmountInBaseCurrency(i.planned_amount,currencyContext)),
  );
  const actual=(s:Section)=>actualBySection[s];
  const synchronizedCashActuals=useMemo(
    ()=>calculateMonthlyCashActuals(month,financeTransactions,financeBills),
    [month,financeTransactions,financeBills],
  );
  const totalIncome=synchronizedCashActuals.income;
  const incomeCardTotal=addMoney(startBalance,totalIncome);
  const goalInvestments=sumMoney(monthTx.filter(isGoalInvestment).map(transaction=>transaction.amount_eur));
  const totalGoalInvested=sumMoney(goals.map(goal=>canonicalAmountInBaseCurrency(goal.current_amount,currencyContext)));
  const totalGoalTarget=sumMoney(goals.map(goal=>canonicalAmountInBaseCurrency(goal.target_amount,currencyContext)));
  const totalOut=synchronizedCashActuals.outflow;
  const monthlyBudgetExpenses=sumMoney(monthlyBudgetExpenseTransactions.map(transaction=>transaction.amount_eur));
  const budgetUsedPercent=spendingBudget>0?Math.max(0,monthlyBudgetExpenses/spendingBudget*100):null;
  const budgetRemaining=spendingBudget>0?subtractMoney(spendingBudget,monthlyBudgetExpenses):0;
  // Goal investments reduce available cash independently.
  // They never update the Monthly Planner Savings card.
  const left=subtractMoney(incomeCardTotal,totalOut);
  const leftToBudget=left;
  const availableCash=incomeCardTotal;
  const breakdownCandidates: {
    key: BreakdownKey;
    label: string;
    value: number;
    color: string;
  }[] = [
    { key: "bills", label: "Bills", value: actual("bills"), color: "var(--breakdown-bills)" },
    { key: "expenses", label: "Expenses", value: actual("expenses"), color: "var(--breakdown-expenses)" },
    { key: "savings", label: "Savings", value: actual("savings"), color: "var(--breakdown-savings)" },
    { key: "goals", label: "Goals", value: goalInvestments, color: "var(--breakdown-goals)" },
    { key: "debt", label: "Debt", value: actual("debt"), color: "var(--breakdown-debt)" },
  ];
  const breakdownParts = breakdownCandidates.filter((part) => part.value > 0);
  const breakdownTotal=sumMoney(breakdownParts.map(part=>part.value));
  let cursor=0;
  const gradient=breakdownParts.length
    ?`conic-gradient(${breakdownParts.map(part=>{const start=cursor;cursor+=part.value/Math.max(breakdownTotal,1)*100;return `${part.color} ${start}% ${cursor}%`}).join(",")})`
    :"conic-gradient(var(--breakdown-track) 0 100%)";
  const spendingBreakdown=useMemo<Array<[string,number]>>(()=>Object.entries(monthlyBudgetExpenseTransactions.reduce<Record<string,number>>((rows,t)=>{rows[t.category]=addMoney(rows[t.category]||0,t.amount_eur);return rows},{})).sort((a,b)=>b[1]-a[1]).slice(0,10),[monthlyBudgetExpenseTransactions]);

  function shiftMonth(n:number){const d=new Date(`${month}-01T12:00:00`);d.setMonth(d.getMonth()+n);setMonth(monthKey(d));}
  async function saveStartBalance(v:string){
    const entered=roundMoney(v);
    const canonical=baseCurrencyAmountToCanonicalEur(entered,currencyContext);
    if(canonical===null){
      setNotice("Currency conversion is still loading. Try again in a moment.");
      return;
    }
    const payload={user_id:userId,month,start_balance:canonical,updated_at:new Date().toISOString()};
    const {data,error}=await supabase.from("monthly_budget_plans").upsert(payload,{onConflict:"user_id,month"}).select().single();
    if(error)setNotice(error.message);
    else{
      setPlans(c=>[data as Plan,...c.filter(x=>x.month!==month)]);
      setStartBalanceDraft(String(entered));
      setNotice("Starting balance saved.");
      notifyFiconterDataChange("all");
    }
  }
  async function saveMonthlyBudget(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const entered=Number(new FormData(event.currentTarget).get("spending_budget"));
    if(!Number.isFinite(entered)||entered<0){
      setBudgetStatus("Enter a valid budget amount.");
      return;
    }
    const canonical=baseCurrencyAmountToCanonicalEur(roundMoney(entered),currencyContext);
    if(canonical===null){
      setBudgetStatus("Currency conversion is still loading. Try again in a moment.");
      return;
    }
    setBudgetSaving(true);
    setBudgetStatus("");
    const payload={user_id:userId,month,spending_budget:canonical,updated_at:new Date().toISOString()};
    const {data,error}=await supabase.from("monthly_budget_plans").upsert(payload,{onConflict:"user_id,month"}).select().single();
    setBudgetSaving(false);
    if(error){
      setBudgetStatus(error.message);
      return;
    }
    setPlans(current=>[data as Plan,...current.filter(entry=>entry.month!==month)]);
    setBudgetStatus(entered>0?"Monthly budget saved.":"Monthly budget cleared.");
    notifyFiconterDataChange("planner");
  }
  async function deleteItem(id:string){const {error}=await supabase.from("monthly_budget_items").delete().eq("id",id).eq("user_id",userId);if(error)setNotice(error.message);else {setItems(c=>c.filter(i=>i.id!==id));notifyFiconterDataChange("all")}}

  return <section className={styles.planner}>
    <header className={styles.header}><div><span>MONTHLY FINANCIAL PLANNER</span><h1>{monthTitle(month)}</h1><p>Your complete monthly activity and financial position in one view.</p></div><div className={styles.monthNav}><button onClick={()=>shiftMonth(-1)}><ChevronLeft/></button><input type="month" value={month} onChange={e=>setMonth(e.target.value)}/><button onClick={()=>shiftMonth(1)}><ChevronRight/></button></div></header>
    {notice&&<div className={styles.notice}>{notice}</div>}
    <div className={styles.topGrid}>
      <article className={styles.overview}><h3>Overview</h3><label>Start date<strong>01 {monthTitle(month)}</strong></label><label>End date<strong>{new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate()} {monthTitle(month)}</strong></label><label>Currency<strong>{baseCurrency}</strong></label><label>Start balance<input value={startBalanceDraft} type="number" step="0.01" disabled={!plan&&startBalanceBehavior==="zero"} onChange={e=>setStartBalanceDraft(e.target.value)}/><button type="button" disabled={!plan&&startBalanceBehavior==="zero"} onClick={()=>void saveStartBalance(startBalanceDraft)}>Save start balance</button></label></article>
      <article className={styles.donutCard}><h3>Available Capital</h3><div className={styles.ring} style={{"--progress":`${Math.max(0,Math.min(100,availableCash?Math.max(leftToBudget,0)/availableCash*100:0))}%`} as React.CSSProperties}><strong>{showAdvancedPosition?money(left):"Personal Pro"}</strong></div>{!showAdvancedPosition?<button type="button" onClick={()=>window.location.assign("/dashboard/settings?section=subscription&required=planner_left_after_everything_paid")}><LockKeyhole size={14}/> Unlock final balance</button>:null}</article>
      <article className={styles.bars}><h3>Recorded activity</h3>{sections.map(s=>{const max=Math.max(...sections.map(section=>actual(section.key)),1);return <div key={s.key}><span>{s.title}</span><i><em style={{width:`${actual(s.key)/max*100}%`}}/></i><strong>{money(actual(s.key))}</strong></div>})}</article>
      <article className={styles.breakdown}>
        <div className={styles.breakdownHeader}>
          <h3>Breakdown</h3>
          <div className={styles.breakdownControls} role="group" aria-label="Choose breakdown view">
            {(["ring","bars","tiles"] as BreakdownView[]).map(view=><button key={view} type="button" className={breakdownView===view?styles.activeBreakdownView:""} aria-pressed={breakdownView===view} onClick={()=>chooseBreakdownView(view)}>{view==="ring"?"Ring":view==="bars"?"Bars":"Tiles"}</button>)}
          </div>
        </div>
        {!breakdownParts.length?<div className={styles.breakdownEmpty}>No outgoing activity recorded yet.</div>:null}
        {breakdownParts.length>0&&breakdownView==="ring"?<div className={styles.ringView}>
          <div className={styles.breakdownRing} style={{background:gradient}}><div><span>Total activity</span><strong>{money(breakdownTotal)}</strong></div></div>
          <div className={styles.breakdownLegend}>{breakdownParts.map(part=><span key={part.key}><i style={{background:part.color}}/>{part.label}<b>{Math.round(part.value/breakdownTotal*100)}%</b></span>)}</div>
        </div>:null}
        {breakdownParts.length>0&&breakdownView==="bars"?<div className={styles.breakdownBars}>{[...breakdownParts].sort((a,b)=>b.value-a.value).map(part=>{const percent=part.value/breakdownTotal*100;return <div className={styles.breakdownBarRow} key={part.key}><div><span>{part.label}</span><strong>{money(part.value)}</strong></div><i><em style={{width:`${percent}%`,background:part.color}}/></i><small>{percent.toFixed(1)}%</small></div>})}</div>:null}
        {breakdownParts.length>0&&breakdownView==="tiles"?<div className={styles.breakdownTiles}>{[...breakdownParts].sort((a,b)=>b.value-a.value).map(part=>{const percent=part.value/breakdownTotal*100;return <div key={part.key}><span><i style={{background:part.color}}/>{part.label}</span><strong>{money(part.value)}</strong><small>{percent.toFixed(1)}% of outgoing activity</small></div>})}</div>:null}
      </article>
    </div>
    <article className={styles.monthlyBudgetCard}>
      <div className={styles.monthlyBudgetIntro}>
        <span>Monthly spending limit</span>
        <h3>Monthly budget</h3>
        <p>Set the amount you plan to use for Expenses in {monthTitle(month)}. Bills, savings, debt, goals and transfers are excluded.</p>
      </div>
      <form className={styles.monthlyBudgetForm} onSubmit={saveMonthlyBudget}>
        <label htmlFor="monthly-budget-amount">Budget amount</label>
        <div>
          <input key={`${month}-${baseCurrency}-${spendingBudget}`} id="monthly-budget-amount" name="spending_budget" inputMode="decimal" min="0" step="0.01" type="number" defaultValue={spendingBudget>0?roundMoney(spendingBudget):""} placeholder="0.00"/>
          <span>{baseCurrency}</span>
          <button type="submit" disabled={budgetSaving}>{budgetSaving?"Saving…":"Save budget"}</button>
        </div>
        <p className={styles.monthlyBudgetStatus} aria-live="polite">{budgetStatus||"Enter 0 to clear the budget."}</p>
      </form>
      <div className={styles.monthlyBudgetMetric}>
        <span>Expenses so far</span>
        <strong>{money(monthlyBudgetExpenses)}</strong>
      </div>
      <div className={styles.monthlyBudgetMetric}>
        <span>{budgetRemaining<0?"Over budget":"Remaining"}</span>
        <strong className={budgetRemaining<0?styles.overBudget:""}>{spendingBudget>0?money(Math.abs(budgetRemaining)):"—"}</strong>
      </div>
      <div className={styles.monthlyBudgetProgress}>
        <div><span>Budget used</span><strong>{budgetUsedPercent===null?"Set a budget":`${budgetUsedPercent.toFixed(1)}%`}</strong></div>
        <i aria-label={budgetUsedPercent===null?"No monthly budget set":`${budgetUsedPercent.toFixed(1)} percent of monthly budget used`}><em style={{width:`${Math.min(100,budgetUsedPercent??0)}%`}}/></i>
        <small>{spendingBudget>0?`${money(monthlyBudgetExpenses)} of ${money(spendingBudget)}`:"Add a monthly budget to track expenses in real time."}</small>
      </div>
    </article>
    <div className={styles.cashFlow}><h3>Cash flow</h3><div><span>Income<b>{money(incomeCardTotal)}</b></span><span>Bills & expenses<b>-{money(addMoney(actual("bills"),actual("expenses")))}</b></span><span>Savings<b>-{money(actual("savings"))}</b></span><span>Goals<b>-{money(goalInvestments)}</b></span><span>Debt<b>-{money(actual("debt"))}</b></span><span className={styles.left}>Left<b>{showAdvancedPosition?money(left):"Personal Pro"}</b></span></div></div>
    <div className={styles.sectionGrid}>
      {sections.map((s) => {
        const isCompact = compactSections.has(s.key);
        const sectionItems = monthItems.filter((item) => item.section === s.key);

        const incomeRows =
          s.key === "income"
            ? monthTx
                .filter((transaction) => transaction.type === "income")
                .reduce<Record<string, number>>((rows, transaction) => {
                  rows[transaction.description] =
                    addMoney(rows[transaction.description] || 0,transaction.amount_eur);
                  return rows;
                }, {"Start balance": startBalance})
            : {};

        const billRows =
          s.key === "bills"
            ? monthTx
                .filter(
                  (transaction) =>
                    transaction.type !== "income" &&
                    isBillTransaction(transaction) &&
                    !paidBillTxIds.has(transaction.id),
                )
                .reduce<Record<string, number>>((rows, transaction) => {
                  rows[transaction.description] =
                    addMoney(rows[transaction.description] || 0,transaction.amount_eur);
                  return rows;
                }, bills
                  .filter(
                    (bill) =>
                      bill.status === "paid" &&
                      inMonth(billActivityDate(bill), month),
                  )
                  .reduce<Record<string, number>>((rows, bill) => {
                    rows[bill.name] =
                      addMoney(rows[bill.name] || 0,bill.amount_eur);
                    return rows;
                  }, {}))
            : {};

        const debtRows =
          s.key === "debt"
            ? monthTx
                .filter(
                  (transaction) =>
                    transaction.type !== "income" &&
                    classify(transaction) === "debt",
                )
                .reduce<Record<string, number>>((rows, transaction) => {
                  rows[transaction.description] =
                    addMoney(rows[transaction.description] || 0,transaction.amount_eur);
                  return rows;
                }, {})
            : {};

        const savingsRows =
          s.key === "savings"
            ? monthTx
                .filter(
                  (transaction) =>
                    transaction.type !== "income" &&
                    classify(transaction) === "savings" &&
                    !isGoalInvestment(transaction),
                )
                .reduce<Record<string, number>>((rows, transaction) => {
                  rows[transaction.description] =
                    addMoney(rows[transaction.description] || 0,transaction.amount_eur);
                  return rows;
                }, {})
            : {};

        const expenseRows =
          s.key === "expenses"
            ? monthTx
                .filter(
                  (transaction) =>
                    transaction.type !== "income" &&
                    !paidBillTxIds.has(transaction.id) &&
                    !isGoalInvestment(transaction) &&
                    classify(transaction) === "expenses",
                )
                .reduce<Record<string, number>>((rows, transaction) => {
                  const label = transaction.category || "Uncategorized";
                  rows[label] =
                    addMoney(rows[label] || 0,transaction.amount_eur);
                  return rows;
                }, {})
            : {};

        const compactRows =
          s.key === "income"
            ? Object.entries(incomeRows)
            : s.key === "bills"
              ? Object.entries(billRows)
              : s.key === "expenses"
                ? Object.entries(expenseRows).sort((a, b) => b[1] - a[1])
                : s.key === "savings"
                  ? Object.entries(savingsRows)
                  : s.key === "debt"
                    ? Object.entries(debtRows)
                    : [];
        const sectionActualTotal =
          s.key === "income" ? incomeCardTotal : actual(s.key);

        return (
          <article
            className={`${styles.tableCard} ${styles[s.key]} ${
              isCompact ? styles.compactCard : ""
            }`}
            key={s.key}
          >
            <header className={styles.cleanCardHeader}>
              <div className={styles.cardHeaderIdentity}>
                <span className={styles.cardHeaderMarker} aria-hidden="true" />
                <h3>{s.title}</h3>
              </div>
              <div className={styles.cardHeaderMetric}>
                <span>Actual</span>
                <strong>{money(sectionActualTotal)}</strong>
              </div>
            </header>

            {isCompact ? (
              <>
                <div className={`${styles.tableHead} ${styles.compactTable}`}>
                  <span>Item</span>
                  <span>Actual</span>
                </div>

                {compactRows.length ? (
                  compactRows.map(([label, value]) => (
                    <div
                      className={`${styles.row} ${styles.compactTable}`}
                      key={`${s.key}-${label}`}
                    >
                      <span>{label}</span>
                      <span>{money(value)}</span>
                    </div>
                  ))
                ) : (
                  <div className={styles.compactEmpty}>No actual records yet.</div>
                )}

                <footer className={styles.compactFooter}>
                  <span>Total</span>
                  <b>{money(sectionActualTotal)}</b>
                </footer>
              </>
            ) : (
              <>
                <div className={styles.tableHead}>
                  <span>Item</span>
                  <span>Budget</span>
                  <span>Actual</span>
                  <span>Left</span>
                </div>

                {sectionItems.map((item) => {
                  const matchingActual =
                    s.key === "income"
                      ? monthTx
                          .filter(
                            (transaction) =>
                              transaction.type === "income" &&
                              transaction.description
                                .toLowerCase()
                                .includes(item.label.toLowerCase()),
                          )
                          .reduce(
                            (total, transaction) =>
                              addMoney(total,transaction.amount_eur),
                            0,
                          )
                      : 0;

                  return (
                    <div className={styles.row} key={item.id}>
                      <span>{item.label}</span>
                      <span>{money(canonicalAmountInBaseCurrency(item.planned_amount,currencyContext))}</span>
                      <span>{matchingActual ? money(matchingActual) : "—"}</span>
                      <span>
                        {money(canonicalAmountInBaseCurrency(item.planned_amount,currencyContext) - matchingActual)}
                      </span>
                      <button onClick={() => deleteItem(item.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}

                <footer>
                  <span>Total</span>
                  <b>{money(planned(s.key))}</b>
                  <b>{money(actual(s.key))}</b>
                  <b>{money(planned(s.key) - actual(s.key))}</b>
                </footer>
              </>
            )}
          </article>
        );
      })}

    <article className={`${styles.tableCard} ${styles.goals} ${styles.goalSummaryCard}`}>
      <header className={styles.cleanCardHeader}>
        <div className={styles.cardHeaderIdentity}>
          <span className={styles.cardHeaderMarker} aria-hidden="true" />
          <h3>Goals</h3>
        </div>
        <div className={styles.cardHeaderMetric}>
          <span>Invested</span>
          <strong>{money(totalGoalInvested)}</strong>
        </div>
      </header>
      {(() => {
        const invested = totalGoalInvested;
        const target = totalGoalTarget;
        const progress = target ? Math.min(100, invested / target * 100) : 0;
        return <div className={styles.goalSummaryBody}>
          <div className={styles.goalSummaryAmounts}>
            <span>Invested<b>{money(invested)}</b></span>
            <span>Target<b>{money(target)}</b></span>
          </div>
          <div className={styles.goalSummaryProgress}><i style={{width:`${progress}%`}}/></div>
          <div className={styles.goalSummaryFooter}>
            <strong>{progress.toFixed(1)}% complete</strong>
            <a href="/dashboard/goals">View goals</a>
          </div>
        </div>;
      })()}
    </article>
    </div>
    <div className={styles.bottomGrid}><article className={styles.expenseTracker}><h3>Expense tracker</h3><div className={styles.expenseHead}><span>Date</span><span>Amount</span><span>Category</span><span>Notes</span></div><div className={`${styles.expenseViewport} ficonter-scroll-region`} tabIndex={expenseTransactions.length>10?0:undefined} aria-label="Monthly expense transactions. The newest ten are visible first; scroll for older records.">{expenseTransactions.map(t=><div className={styles.expenseRow} key={t.id}><span>{t.transaction_date}</span><span>{money(finiteNumber(t.amount_eur))}</span><span>{t.category}</span><span>{t.description}</span></div>)}</div>{expenseTransactions.length>10&&<p className={styles.expenseScrollHint}>Showing 10 transactions at a time · Scroll for older activity</p>}</article><article className={styles.spending}><h3>Spending breakdown</h3>{spendingBreakdown.map(([k,v])=><div key={k}><span>{k}</span><b>{money(v)}</b><em>{totalOut?`${(v/totalOut*100).toFixed(1)}%`:"0%"}</em></div>)}</article></div>
  </section>
}
