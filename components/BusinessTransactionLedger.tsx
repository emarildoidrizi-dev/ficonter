"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { CalendarRange, Edit3, Plus, Search, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getExchangeRate } from "@/lib/performance/exchangeRateCache";
import { finiteNumber, roundMoney, roundRate, subtractMoney, sumMoney } from "@/lib/finance/money";
import { CURRENCY_CODES, currencyName, currencySymbol, formatCurrency } from "@/lib/financialOptions";
import type { Business, BusinessCostNature, BusinessTransaction, BusinessTransactionType } from "@/lib/business/types";
import styles from "./BusinessTransactionLedger.module.css";

const INCOME_CATEGORIES=["Sales revenue","Service revenue","Project revenue","Subscription revenue","Rental income","Interest","Refund","Other income"];
const EXPENSE_CATEGORIES=["Materials","Inventory purchases","Rent","Utilities","Payroll","Contractors","Marketing","Software","Insurance","Transport","Shipping","Equipment","Professional services","Taxes and fees","Bank fees","Travel","Other expense"];
const PAYMENT_METHODS=["Bank transfer","Direct debit","Card","Cash","Online payment","Invoice","Other"];

function localDateTimeInput(date=new Date()){
  const offset=date.getTimezoneOffset();
  return new Date(date.getTime()-offset*60_000).toISOString().slice(0,16);
}
function toLocalInput(value:string){return localDateTimeInput(new Date(value));}

const EMPTY={description:"",counterparty:"",type:"expense" as BusinessTransactionType,category:"Materials",customCategory:"",cost_nature:"variable" as Exclude<BusinessCostNature,null>,amount:"",currency:"EUR",occurred_at:localDateTimeInput(),payment_method:"Bank transfer",reference:"",notes:""};

export function BusinessTransactionLedger({business,initialTransactions}:{business:Business;initialTransactions:BusinessTransaction[]}){
  const supabase=useMemo(()=>createClient(),[]);
  const [transactions,setTransactions]=useState(initialTransactions);
  const [form,setForm]=useState(()=>({...EMPTY,currency:business.base_currency}));
  const [editing,setEditing]=useState<BusinessTransaction|null>(null);
  const [showForm,setShowForm]=useState(false);
  const [deleting,setDeleting]=useState<BusinessTransaction|null>(null);
  const [search,setSearch]=useState("");
  const [typeFilter,setTypeFilter]=useState("all");
  const [monthFilter,setMonthFilter]=useState("all");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");

  useEffect(()=>{if(!notice)return;const t=window.setTimeout(()=>setNotice(""),3200);return()=>window.clearTimeout(t)},[notice]);
  useEffect(()=>{
    const channel=supabase.channel(`business-transactions-${business.id}`)
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

  const categories=form.type==="income"?INCOME_CATEGORIES:EXPENSE_CATEGORIES;
  const months=useMemo(()=>[...new Set(transactions.map(item=>item.transaction_date.slice(0,7)))].sort((a,b)=>b.localeCompare(a)),[transactions]);
  const visible=useMemo(()=>{
    const query=search.trim().toLowerCase();
    return transactions.filter(item=>(!query||`${item.description} ${item.counterparty??""} ${item.category} ${item.reference??""}`.toLowerCase().includes(query))&&(typeFilter==="all"||item.type===typeFilter)&&(monthFilter==="all"||item.transaction_date.startsWith(monthFilter))).sort((a,b)=>b.occurred_at.localeCompare(a.occurred_at));
  },[transactions,search,typeFilter,monthFilter]);
  const revenue=sumMoney(visible.filter(item=>item.type==="income").map(item=>item.amount_base));
  const expenses=sumMoney(visible.filter(item=>item.type==="expense").map(item=>item.amount_base));
  const result=subtractMoney(revenue,expenses);
  const money=(value:unknown)=>formatCurrency(finiteNumber(value),business.base_currency);

  function resetForm(){setForm({...EMPTY,currency:business.base_currency,occurred_at:localDateTimeInput()});setEditing(null);setShowForm(false);setError("")}
  function openEdit(item:BusinessTransaction){
    const known=(item.type==="income"?INCOME_CATEGORIES:EXPENSE_CATEGORIES).includes(item.category);
    setForm({description:item.description,counterparty:item.counterparty??"",type:item.type,category:known?item.category:"Other / custom",customCategory:known?"":item.category,cost_nature:(item.cost_nature??"variable") as Exclude<BusinessCostNature,null>,amount:String(item.amount),currency:item.currency,occurred_at:toLocalInput(item.occurred_at),payment_method:item.payment_method??"Bank transfer",reference:item.reference??"",notes:item.notes??""});
    setEditing(item);setShowForm(true);setError("");window.scrollTo({top:0,behavior:"smooth"});
  }

  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;setBusy(true);setError("");
    try{
      const amount=roundMoney(form.amount);
      const description=form.description.trim();
      const finalCategory=form.category==="Other / custom"?form.customCategory.trim():form.category;
      const occurred=new Date(form.occurred_at);
      if(!description)throw new Error("Enter a transaction description.");
      if(!finalCategory)throw new Error("Enter a category.");
      if(amount<=0)throw new Error("Enter an amount greater than zero.");
      if(Number.isNaN(occurred.getTime()))throw new Error("Choose a valid date and time.");
      const rateResult=await getExchangeRate(form.currency,business.base_currency);
      const payload={business_id:business.id,description,counterparty:form.counterparty.trim()||null,type:form.type,category:finalCategory,cost_nature:form.type==="expense"?form.cost_nature:null,amount,currency:form.currency,amount_base:roundMoney(amount*rateResult.rate),exchange_rate_to_base:roundRate(rateResult.rate),exchange_rate_date:rateResult.date,exchange_rate_source:rateResult.source,transaction_date:form.occurred_at.slice(0,10),occurred_at:occurred.toISOString(),payment_method:form.payment_method||null,reference:form.reference.trim()||null,notes:form.notes.trim()||null,updated_at:new Date().toISOString()};
      if(editing){
        const {data,error:updateError}=await supabase.from("business_transactions").update(payload).eq("id",editing.id).eq("business_id",business.id).select().single();
        if(updateError)throw updateError;
        setTransactions(current=>current.map(item=>item.id===editing.id?data as BusinessTransaction:item));
        setNotice("Business transaction updated.");
      }else{
        const {data,error:insertError}=await supabase.from("business_transactions").insert(payload).select().single();
        if(insertError)throw insertError;
        setTransactions(current=>[data as BusinessTransaction,...current.filter(item=>item.id!==data.id)]);
        setNotice("Business transaction added.");
      }
      resetForm();
    }catch(saveError){setError(saveError instanceof Error?saveError.message:"The transaction could not be saved.")}finally{setBusy(false)}
  }

  async function confirmDelete(){if(!deleting||busy)return;setBusy(true);setError("");const {error:deleteError}=await supabase.from("business_transactions").delete().eq("id",deleting.id).eq("business_id",business.id);if(deleteError)setError(deleteError.message);else{setTransactions(current=>current.filter(item=>item.id!==deleting.id));setDeleting(null);setNotice("Business transaction deleted.")}setBusy(false)}

  return <section className={styles.shell}>
    <header className={styles.hero}><div><span>FICONTER BUSINESS · B2</span><h1>Business Transactions</h1><p>{business.name} · All records are isolated from Personal Transactions.</p></div><button onClick={()=>showForm?resetForm():setShowForm(true)}>{showForm?<X size={18}/>:<Plus size={18}/>} {showForm?"Close form":"Add transaction"}</button></header>
    {notice?<div className={styles.notice}>{notice}</div>:null}
    {error&&!showForm?<div className={styles.error}>{error}</div>:null}

    {showForm?<form className={styles.form} onSubmit={save}>
      <div className={styles.formHead}><div><span>{editing?"EDIT RECORD":"NEW RECORD"}</span><h2>{editing?"Update transaction":"Record business activity"}</h2></div>{editing?<button type="button" onClick={resetForm}>Cancel edit</button>:null}</div>
      <div className={styles.formGrid}>
        <label>Type<select value={form.type} onChange={e=>{const type=e.target.value as BusinessTransactionType;setForm({...form,type,category:type==="income"?INCOME_CATEGORIES[0]:EXPENSE_CATEGORIES[0]})}}><option value="income">Income</option><option value="expense">Expense</option></select></label>
        <label>Description<input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} required placeholder="What was this transaction?"/></label>
        <label>Customer / supplier<input value={form.counterparty} onChange={e=>setForm({...form,counterparty:e.target.value})} placeholder="Optional counterparty"/></label>
        <label>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(category=><option key={category}>{category}</option>)}<option>Other / custom</option></select></label>
        {form.category==="Other / custom"?<label>Custom category<input value={form.customCategory} onChange={e=>setForm({...form,customCategory:e.target.value})} required/></label>:null}
        {form.type==="expense"?<label>Cost type<select value={form.cost_nature} onChange={e=>setForm({...form,cost_nature:e.target.value as Exclude<BusinessCostNature,null>})}><option value="fixed">Fixed cost</option><option value="variable">Variable cost</option></select></label>:null}
        <label>Amount<input type="number" min="0.01" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} required/></label>
        <label>Currency<select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}>{CURRENCY_CODES.map(code=><option value={code} key={code}>{currencySymbol(code)} {code} — {currencyName(code)}</option>)}</select></label>
        <label>Date and exact time<input type="datetime-local" value={form.occurred_at} onChange={e=>setForm({...form,occurred_at:e.target.value})} required/></label>
        <label>Payment method<select value={form.payment_method} onChange={e=>setForm({...form,payment_method:e.target.value})}>{PAYMENT_METHODS.map(method=><option key={method}>{method}</option>)}</select></label>
        <label>Reference<input value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})} placeholder="Invoice or order reference"/></label>
        <label className={styles.full}>Notes<textarea rows={3} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Optional details"/></label>
      </div>
      {error?<div className={styles.error} role="alert">{error}</div>:null}
      <button className={styles.save} disabled={busy}>{busy?"Saving…":editing?"Save changes":"Save transaction"}</button>
    </form>:null}

    <div className={styles.summary}><article><span>Revenue</span><strong>{money(revenue)}</strong></article><article><span>Expenses</span><strong>{money(expenses)}</strong></article><article className={result>=0?styles.good:styles.bad}><span>Result</span><strong>{money(result)}</strong></article><article><span>Visible records</span><strong>{visible.length}</strong></article></div>

    <div className={styles.filters}><label><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search business transactions"/></label><select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="all">All types</option><option value="income">Income</option><option value="expense">Expense</option></select><select value={monthFilter} onChange={e=>setMonthFilter(e.target.value)}><option value="all">All months</option>{months.map(month=><option key={month} value={month}>{month}</option>)}</select></div>

    <div className={`${styles.list} ficonter-scroll-region`} tabIndex={visible.length>8?0:undefined}>
      {visible.length?visible.map(item=><article className={styles.row} key={item.id}><i className={item.type==="income"?styles.income:styles.expense}/><div className={styles.identity}><strong>{item.description}</strong><span>{item.counterparty||item.category} · {item.category}</span><small><CalendarRange size={13}/>{new Date(item.occurred_at).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"})}{item.cost_nature?` · ${item.cost_nature} cost`:""}</small></div><div className={styles.amount}><strong className={item.type==="income"?styles.incomeText:styles.expenseText}>{item.type==="income"?"+":"−"}{money(item.amount_base)}</strong>{item.currency!==business.base_currency?<span>{formatCurrency(finiteNumber(item.amount),item.currency)}</span>:null}</div><div className={styles.actions}><button onClick={()=>openEdit(item)} aria-label="Edit transaction"><Edit3 size={16}/></button><button onClick={()=>setDeleting(item)} aria-label="Delete transaction"><Trash2 size={16}/></button></div></article>):<div className={styles.empty}>No matching business transactions.</div>}
    </div>

    {deleting?<div className={styles.backdrop}><section className={styles.modal}><button className={styles.close} onClick={()=>setDeleting(null)}><X size={18}/></button><Trash2/><span>CONFIRM DELETION</span><h2>Delete this business transaction?</h2><p>{deleting.description} · {money(deleting.amount_base)}</p><div><button onClick={()=>setDeleting(null)}>Keep transaction</button><button className={styles.danger} disabled={busy} onClick={confirmDelete}>{busy?"Deleting…":"Delete transaction"}</button></div></section></div>:null}
  </section>;
}
