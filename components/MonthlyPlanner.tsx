"use client";

import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { notifyFiconterDataChange } from "@/lib/ficonterRealtime";
import { addMoney, finiteNumber, roundMoney, subtractMoney, sumMoney } from "@/lib/finance/money";
import { formatCurrency } from "@/lib/financialOptions";
import styles from "./MonthlyPlanner.module.css";

type Section = "income" | "bills" | "expenses" | "savings" | "debt";
type BreakdownView = "ring" | "bars" | "tiles";
type BreakdownKey = Section | "goals";
type Tx = { id:string; user_id:string; description:string; amount_eur:number|string; type:string; category:string; transaction_date:string; occurred_at:string|null };
type Bill = { id:string; user_id:string; name:string; category:string; amount_eur:number|string; due_date:string; status:string; paid_at:string|null; transaction_id:string|null };
type Plan = { id:string; user_id:string; month:string; start_balance:number|string; created_at:string; updated_at:string };
type Item = { id:string; user_id:string; month:string; section:Section; label:string; planned_amount:number|string; position:number; created_at:string; updated_at:string };
type Goal = { id:string; user_id:string; name:string; target_amount:number|string; current_amount:number|string; target_date:string|null; status:string; created_at:string; updated_at:string };

const compactSections = new Set<Section>(["income","bills","expenses","savings","debt"]);
const sections: {key:Section; title:string}[] = [
  {key:"income",title:"Income"},{key:"bills",title:"Bills"},{key:"expenses",title:"Expenses"},{key:"savings",title:"Savings"},{key:"debt",title:"Debt"},
];
const debtWords=["debt","loan","credit-card","credit card","mortgage principal","student-loan","personal-loan"];
const savingWords=["savings","emergency fund","retirement","stocks","etfs","bonds","crypto","investment","house deposit","education fund"];
const eur=(v:number)=>formatCurrency(finiteNumber(v),"EUR");
const monthKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
const monthTitle=(m:string)=>new Date(`${m}-01T12:00:00`).toLocaleDateString("en-GB",{month:"long",year:"numeric"});
const inMonth=(date:string|null,m:string)=>Boolean(date?.startsWith(m));
const transactionActivityDate=(tx:Tx)=>tx.transaction_date||tx.occurred_at?.slice(0,10)||"";
const billActivityDate=(bill:Bill)=>bill.status==="paid"?(bill.paid_at?.slice(0,10)??bill.due_date):bill.due_date;
const isGoalInvestment=(tx:Tx)=>tx.description.startsWith("Goal investment ·");
const classify=(tx:Tx):Section=>{
  if(tx.type==="income") return "income";
  const c=tx.category.toLowerCase();
  if(debtWords.some(w=>c.includes(w))) return "debt";
  if(savingWords.some(w=>c.includes(w))) return "savings";
  return "expenses";
};

export function MonthlyPlanner({userId,initialTransactions,initialBills,initialPlans,initialItems,initialGoals}:{userId:string;initialTransactions:Tx[];initialBills:Bill[];initialPlans:Plan[];initialItems:Item[];initialGoals:Goal[]}){
  const supabase=useMemo(()=>createClient(),[]);
  const [month,setMonth]=useState(monthKey());
  const [transactions,setTransactions]=useState(initialTransactions);
  const [bills,setBills]=useState(initialBills);
  const [plans,setPlans]=useState(initialPlans);
  const [items,setItems]=useState(initialItems);
  const [goals,setGoals]=useState(initialGoals);
  const [notice,setNotice]=useState("");
  const [startBalanceBehavior,setStartBalanceBehavior]=useState("manual");
  const [breakdownView,setBreakdownView]=useState<BreakdownView>("ring");

  useEffect(()=>{ if(!notice)return; const t=setTimeout(()=>setNotice(""),3500); return()=>clearTimeout(t)},[notice]);
  useEffect(()=>{
    const saved=window.localStorage.getItem("ficonter:planner-breakdown-view");
    if(saved==="ring"||saved==="bars"||saved==="tiles")setBreakdownView(saved);
  },[]);

  function chooseBreakdownView(view:BreakdownView){
    setBreakdownView(view);
    window.localStorage.setItem("ficonter:planner-breakdown-view",view);
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
  useEffect(()=>{
    const channel=supabase.channel(`planner-${userId}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"transactions",filter:`user_id=eq.${userId}`},p=>setTransactions(c=>p.eventType==="DELETE"?c.filter(x=>x.id!==(p.old as any).id):[p.new as Tx,...c.filter(x=>x.id!==(p.new as any).id)]))
      .on("postgres_changes",{event:"*",schema:"public",table:"bills",filter:`user_id=eq.${userId}`},p=>setBills(c=>p.eventType==="DELETE"?c.filter(x=>x.id!==(p.old as any).id):[p.new as Bill,...c.filter(x=>x.id!==(p.new as any).id)]))
      .on("postgres_changes",{event:"*",schema:"public",table:"monthly_budget_plans",filter:`user_id=eq.${userId}`},p=>setPlans(c=>p.eventType==="DELETE"?c.filter(x=>x.id!==(p.old as any).id):[p.new as Plan,...c.filter(x=>x.id!==(p.new as any).id)]))
      .on("postgres_changes",{event:"*",schema:"public",table:"monthly_budget_items",filter:`user_id=eq.${userId}`},p=>setItems(c=>p.eventType==="DELETE"?c.filter(x=>x.id!==(p.old as any).id):[p.new as Item,...c.filter(x=>x.id!==(p.new as any).id)]))
      .on("postgres_changes",{event:"*",schema:"public",table:"goals",filter:`user_id=eq.${userId}`},p=>setGoals(c=>p.eventType==="DELETE"?c.filter(x=>x.id!==(p.old as any).id):[p.new as Goal,...c.filter(x=>x.id!==(p.new as any).id)]))
      .subscribe();
    return()=>{void supabase.removeChannel(channel)};
  },[supabase,userId]);

  const plan=plans.find(p=>p.month===month);
  const previousMonth=(()=>{const d=new Date(`${month}-01T12:00:00`);d.setMonth(d.getMonth()-1);return monthKey(d)})();
  const previousPlan=plans.find(p=>p.month===previousMonth);
  const previousTransactions=transactions.filter(t=>inMonth(transactionActivityDate(t),previousMonth));
  const previousPaidBillTxIds=new Set(bills.filter(b=>b.transaction_id).map(b=>b.transaction_id as string));
  const previousActual:Record<Section,number>={income:0,bills:0,expenses:0,savings:0,debt:0};
  let previousGoalInvestments=0;
  previousTransactions.forEach(t=>{
    if(previousPaidBillTxIds.has(t.id))return;
    if(isGoalInvestment(t)){previousGoalInvestments=addMoney(previousGoalInvestments,t.amount_eur);return;}
    previousActual[classify(t)]=addMoney(previousActual[classify(t)],t.amount_eur);
  });
  bills.filter(b=>b.status==="paid"&&inMonth(billActivityDate(b),previousMonth)).forEach(b=>{previousActual.bills=addMoney(previousActual.bills,b.amount_eur)});
  const previousLeft=subtractMoney(addMoney(previousPlan?.start_balance??0,previousActual.income),previousActual.bills,previousActual.expenses,previousActual.savings,previousActual.debt,previousGoalInvestments);
  const derivedStartBalance=startBalanceBehavior==="carry-forward"?previousLeft:0;
  const startBalance=roundMoney(plan?.start_balance??derivedStartBalance);
  const paidBillTxIds=useMemo(()=>new Set(bills.filter(b=>b.transaction_id).map(b=>b.transaction_id as string)),[bills]);
  const monthTx=useMemo(()=>transactions.filter(t=>inMonth(transactionActivityDate(t),month)),[transactions,month]);
  const expenseTransactions=useMemo(()=>[...monthTx.filter(t=>t.type!=="income"&&!paidBillTxIds.has(t.id)&&!isGoalInvestment(t))].sort((a,b)=>(b.occurred_at??b.transaction_date).localeCompare(a.occurred_at??a.transaction_date)),[monthTx,paidBillTxIds]);
  const actualBySection=useMemo(()=>{
    const totals:Record<Section,number>={income:0,bills:0,expenses:0,savings:0,debt:0};
    monthTx.forEach(t=>{
      if(paidBillTxIds.has(t.id)||isGoalInvestment(t))return;
      totals[classify(t)]=addMoney(totals[classify(t)],t.amount_eur);
    });
    bills.filter(b=>b.status==="paid"&&inMonth(billActivityDate(b),month)).forEach(b=>{totals.bills=addMoney(totals.bills,b.amount_eur)});
    return totals;
  },[monthTx,bills,month,paidBillTxIds]);
  const monthItems=items.filter(i=>i.month===month);
  const planned=(s:Section)=>sumMoney(monthItems.filter(i=>i.section===s).map(i=>i.planned_amount));
  const actual=(s:Section)=>actualBySection[s];
  const totalIncome=actual("income");
  const goalInvestments=sumMoney(monthTx.filter(isGoalInvestment).map(transaction=>transaction.amount_eur));
  const totalOut=sumMoney([actual("bills"),actual("expenses"),actual("savings"),actual("debt"),goalInvestments]);
  // Goal investments reduce available cash independently.
  // They never update the Monthly Planner Savings card.
  const left=subtractMoney(addMoney(startBalance,totalIncome),totalOut);
  const leftToBudget=left;
  const availableCash=addMoney(startBalance,totalIncome);
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
  const spendingBreakdown=useMemo<Array<[string,number]>>(()=>Object.entries(monthTx.filter(t=>t.type!=="income"&&!paidBillTxIds.has(t.id)&&!isGoalInvestment(t)).reduce<Record<string,number>>((rows,t)=>{rows[t.category]=addMoney(rows[t.category]||0,t.amount_eur);return rows},{})).sort((a,b)=>b[1]-a[1]).slice(0,10),[monthTx,paidBillTxIds]);

  function shiftMonth(n:number){const d=new Date(`${month}-01T12:00:00`);d.setMonth(d.getMonth()+n);setMonth(monthKey(d));}
  async function saveStartBalance(v:string){const value=roundMoney(v); const payload={user_id:userId,month,start_balance:value,updated_at:new Date().toISOString()}; const {data,error}=await supabase.from("monthly_budget_plans").upsert(payload,{onConflict:"user_id,month"}).select().single(); if(error)setNotice(error.message); else {setPlans(c=>[data as Plan,...c.filter(x=>x.month!==month)]);setNotice("Starting balance updated.");notifyFiconterDataChange("all")}}
  async function deleteItem(id:string){const {error}=await supabase.from("monthly_budget_items").delete().eq("id",id).eq("user_id",userId);if(error)setNotice(error.message);else {setItems(c=>c.filter(i=>i.id!==id));notifyFiconterDataChange("all")}}

  return <section className={styles.planner}>
    <header className={styles.header}><div><span>MONTHLY FINANCIAL PLANNER</span><h1>{monthTitle(month)}</h1><p>Your complete monthly activity and financial position in one view.</p></div><div className={styles.monthNav}><button onClick={()=>shiftMonth(-1)}><ChevronLeft/></button><input type="month" value={month} onChange={e=>setMonth(e.target.value)}/><button onClick={()=>shiftMonth(1)}><ChevronRight/></button></div></header>
    {notice&&<div className={styles.notice}>{notice}</div>}
    <div className={styles.topGrid}>
      <article className={styles.overview}><h3>Overview</h3><label>Start date<strong>01 {monthTitle(month)}</strong></label><label>End date<strong>{new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate()} {monthTitle(month)}</strong></label><label>Currency<strong>EUR</strong></label><label>Start balance<input key={`${month}-${startBalance}`} defaultValue={startBalance} type="number" step="0.01" disabled={!plan&&startBalanceBehavior==="zero"} onBlur={e=>saveStartBalance(e.target.value)}/></label></article>
      <article className={styles.donutCard}><h3>Available Capital</h3><div className={styles.ring} style={{"--progress":`${Math.max(0,Math.min(100,availableCash?Math.max(leftToBudget,0)/availableCash*100:0))}%`} as React.CSSProperties}><strong>{eur(left)}</strong></div></article>
      <article className={styles.bars}><h3>Recorded activity</h3>{sections.map(s=>{const max=Math.max(...sections.map(section=>actual(section.key)),1);return <div key={s.key}><span>{s.title}</span><i><em style={{width:`${actual(s.key)/max*100}%`}}/></i><strong>{eur(actual(s.key))}</strong></div>})}</article>
      <article className={styles.breakdown}>
        <div className={styles.breakdownHeader}>
          <h3>Breakdown</h3>
          <div className={styles.breakdownControls} role="group" aria-label="Choose breakdown view">
            {(["ring","bars","tiles"] as BreakdownView[]).map(view=><button key={view} type="button" className={breakdownView===view?styles.activeBreakdownView:""} aria-pressed={breakdownView===view} onClick={()=>chooseBreakdownView(view)}>{view==="ring"?"Ring":view==="bars"?"Bars":"Tiles"}</button>)}
          </div>
        </div>
        {!breakdownParts.length?<div className={styles.breakdownEmpty}>No outgoing activity recorded yet.</div>:null}
        {breakdownParts.length>0&&breakdownView==="ring"?<div className={styles.ringView}>
          <div className={styles.breakdownRing} style={{background:gradient}}><div><span>Total activity</span><strong>{eur(breakdownTotal)}</strong></div></div>
          <div className={styles.breakdownLegend}>{breakdownParts.map(part=><span key={part.key}><i style={{background:part.color}}/>{part.label}<b>{Math.round(part.value/breakdownTotal*100)}%</b></span>)}</div>
        </div>:null}
        {breakdownParts.length>0&&breakdownView==="bars"?<div className={styles.breakdownBars}>{[...breakdownParts].sort((a,b)=>b.value-a.value).map(part=>{const percent=part.value/breakdownTotal*100;return <div className={styles.breakdownBarRow} key={part.key}><div><span>{part.label}</span><strong>{eur(part.value)}</strong></div><i><em style={{width:`${percent}%`,background:part.color}}/></i><small>{percent.toFixed(1)}%</small></div>})}</div>:null}
        {breakdownParts.length>0&&breakdownView==="tiles"?<div className={styles.breakdownTiles}>{[...breakdownParts].sort((a,b)=>b.value-a.value).map(part=>{const percent=part.value/breakdownTotal*100;return <div key={part.key}><span><i style={{background:part.color}}/>{part.label}</span><strong>{eur(part.value)}</strong><small>{percent.toFixed(1)}% of outgoing activity</small></div>})}</div>:null}
      </article>
    </div>
    <div className={styles.cashFlow}><h3>Cash flow</h3><div><span>Income<b>{eur(totalIncome)}</b></span><span>Bills & expenses<b>-{eur(addMoney(actual("bills"),actual("expenses")))}</b></span><span>Savings<b>-{eur(actual("savings"))}</b></span><span>Goals<b>-{eur(goalInvestments)}</b></span><span>Debt<b>-{eur(actual("debt"))}</b></span><span className={styles.left}>Left<b>{eur(left)}</b></span></div></div>
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
                }, {})
            : {};

        const billRows =
          s.key === "bills"
            ? bills
                .filter(
                  (bill) =>
                    bill.status === "paid" &&
                    inMonth(billActivityDate(bill), month),
                )
                .reduce<Record<string, number>>((rows, bill) => {
                  rows[bill.name] = addMoney(rows[bill.name] || 0,bill.amount_eur);
                  return rows;
                }, {})
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

        return (
          <article
            className={`${styles.tableCard} ${styles[s.key]} ${
              isCompact ? styles.compactCard : ""
            }`}
            key={s.key}
          >
            <header className={styles.cleanCardHeader}>
              <h3>{s.title}</h3>
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
                      <span>{eur(value)}</span>
                    </div>
                  ))
                ) : (
                  <div className={styles.compactEmpty}>No actual records yet.</div>
                )}

                <footer className={styles.compactFooter}>
                  <span>Total</span>
                  <b>{eur(actual(s.key))}</b>
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
                      <span>{eur(Number(item.planned_amount))}</span>
                      <span>{matchingActual ? eur(matchingActual) : "—"}</span>
                      <span>
                        {eur(Number(item.planned_amount) - matchingActual)}
                      </span>
                      <button onClick={() => deleteItem(item.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}

                <footer>
                  <span>Total</span>
                  <b>{eur(planned(s.key))}</b>
                  <b>{eur(actual(s.key))}</b>
                  <b>{eur(planned(s.key) - actual(s.key))}</b>
                </footer>
              </>
            )}
          </article>
        );
      })}

    <article className={`${styles.tableCard} ${styles.goals} ${styles.goalSummaryCard}`}>
      <header className={styles.cleanCardHeader}><h3>Goals</h3></header>
      {(() => {
        const invested = sumMoney(goals.map(goal=>goal.current_amount));
        const target = sumMoney(goals.map(goal=>goal.target_amount));
        const progress = target ? Math.min(100, invested / target * 100) : 0;
        return <div className={styles.goalSummaryBody}>
          <div className={styles.goalSummaryAmounts}>
            <span>Invested<b>{eur(invested)}</b></span>
            <span>Target<b>{eur(target)}</b></span>
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
    <div className={styles.bottomGrid}><article className={styles.expenseTracker}><h3>Expense tracker</h3><div className={styles.expenseHead}><span>Date</span><span>Amount</span><span>Category</span><span>Notes</span></div><div className={`${styles.expenseViewport} ficonter-scroll-region`} tabIndex={expenseTransactions.length>10?0:undefined} aria-label="Monthly expense transactions. The newest ten are visible first; scroll for older records.">{expenseTransactions.map(t=><div className={styles.expenseRow} key={t.id}><span>{t.transaction_date}</span><span>{eur(finiteNumber(t.amount_eur))}</span><span>{t.category}</span><span>{t.description}</span></div>)}</div>{expenseTransactions.length>10&&<p className={styles.expenseScrollHint}>Showing 10 transactions at a time · Scroll for older activity</p>}</article><article className={styles.spending}><h3>Spending breakdown</h3>{spendingBreakdown.map(([k,v])=><div key={k}><span>{k}</span><b>{eur(v)}</b><em>{totalOut?`${(v/totalOut*100).toFixed(1)}%`:"0%"}</em></div>)}</article></div>
  </section>
}
