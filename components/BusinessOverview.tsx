"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, ReceiptText, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { finiteNumber, subtractMoney, sumMoney } from "@/lib/finance/money";
import { formatCurrency } from "@/lib/financialOptions";
import type { Business, BusinessTransaction } from "@/lib/business/types";
import styles from "./BusinessOverview.module.css";

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
}

export function BusinessOverview({ business, initialTransactions }: { business: Business; initialTransactions: BusinessTransaction[] }) {
  const supabase = useMemo(()=>createClient(),[]);
  const [transactions,setTransactions] = useState(initialTransactions);

  useEffect(()=>{
    const channel = supabase.channel(`business-overview-${business.id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"business_transactions",filter:`business_id=eq.${business.id}`},(payload:RealtimePostgresChangesPayload<Record<string,unknown>>)=>{
        setTransactions(current=>{
          if(payload.eventType==="DELETE"){
            const id=(payload.old as {id?:string}).id;
            return current.filter(item=>item.id!==id);
          }
          const changed=payload.new as BusinessTransaction;
          return [changed,...current.filter(item=>item.id!==changed.id)].sort((a,b)=>b.occurred_at.localeCompare(a.occurred_at));
        });
      }).subscribe();
    return()=>{void supabase.removeChannel(channel)};
  },[business.id,supabase]);

  const month=currentMonthKey();
  const monthly=transactions.filter(item=>item.transaction_date.startsWith(month));
  const revenue=sumMoney(monthly.filter(item=>item.type==="income").map(item=>item.amount_base));
  const expenses=sumMoney(monthly.filter(item=>item.type==="expense").map(item=>item.amount_base));
  const result=subtractMoney(revenue,expenses);
  const lifetime=sumMoney(transactions.map(item=>item.type==="income"?finiteNumber(item.amount_base):-finiteNumber(item.amount_base)));
  const recent=transactions.slice(0,8);
  const money=(value:number)=>formatCurrency(value,business.base_currency);

  return <section className={styles.shell}>
    <header className={styles.hero}>
      <div><span>FICONTER BUSINESS · OVERVIEW</span><h1>{business.name}</h1><p>{business.business_type} · Base currency {business.base_currency}</p></div>
      <Link href="/business/transactions"><ReceiptText size={18}/> Open transactions <ArrowRight size={17}/></Link>
    </header>

    <div className={styles.kpis}>
      <article><TrendingUp/><span>Revenue this month</span><strong>{money(revenue)}</strong></article>
      <article><TrendingDown/><span>Expenses this month</span><strong>{money(expenses)}</strong></article>
      <article className={result>=0?styles.positive:styles.negative}><BriefcaseBusiness/><span>Operating result</span><strong>{money(result)}</strong></article>
      <article><ReceiptText/><span>Business position</span><strong>{money(lifetime)}</strong></article>
    </div>

    <article className={styles.panel}>
      <div className={styles.panelHead}><div><span>LIVE BUSINESS LEDGER</span><h2>Recent activity</h2></div><Link href="/business/transactions">View all</Link></div>
      {recent.length ? <div className={styles.rows}>{recent.map(item=><div className={styles.row} key={item.id}>
        <i className={item.type==="income"?styles.income:styles.expense}/>
        <div><strong>{item.description}</strong><span>{item.counterparty||item.category} · {new Date(item.occurred_at).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"})}</span></div>
        <b className={item.type==="income"?styles.incomeAmount:styles.expenseAmount}>{item.type==="income"?"+":"−"}{money(finiteNumber(item.amount_base))}</b>
      </div>)}</div> : <div className={styles.empty}>No business transactions yet. Add the first record in Business Transactions.</div>}
    </article>
  </section>;
}
