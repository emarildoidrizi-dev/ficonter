"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, Pencil, Plus, Target, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "./GoalsManager.module.css";

type GoalStatus = "active" | "completed" | "paused";
type Goal = {
  id: string;
  user_id: string;
  name: string;
  target_amount: number | string;
  current_amount: number | string;
  target_date: string | null;
  status: GoalStatus;
  created_at: string;
  updated_at: string;
};

const money=(value:number|string)=>new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(Number(value)||0);

export function GoalsManager({userId,initialGoals,initialError}:{userId:string;initialGoals:Goal[];initialError:string}){
  const supabase=useMemo(()=>createClient(),[]);
  const [goals,setGoals]=useState(initialGoals);
  const [open,setOpen]=useState(false);
  const [editing,setEditing]=useState<Goal|null>(null);
  const [deleting,setDeleting]=useState<Goal|null>(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState(initialError);

  useEffect(()=>{if(!notice)return;const t=window.setTimeout(()=>setNotice(""),3500);return()=>window.clearTimeout(t)},[notice]);
  useEffect(()=>{
    const channel=supabase.channel(`goals-${userId}`).on("postgres_changes",{event:"*",schema:"public",table:"goals",filter:`user_id=eq.${userId}`},payload=>{
      setGoals(current=>{
        if(payload.eventType==="DELETE")return current.filter(goal=>goal.id!==(payload.old as {id?:string}).id);
        const next=payload.new as Goal;
        return [next,...current.filter(goal=>goal.id!==next.id)].sort((a,b)=>a.created_at.localeCompare(b.created_at));
      });
    }).subscribe();
    return()=>{void supabase.removeChannel(channel)};
  },[supabase,userId]);

  async function saveGoal(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setNotice("");
    const form=new FormData(event.currentTarget);
    const payload={user_id:userId,name:String(form.get("name")??"").trim(),target_amount:Number(form.get("target_amount")),current_amount:Number(form.get("current_amount")),target_date:String(form.get("target_date")??"")||null,status:String(form.get("status")??"active") as GoalStatus,updated_at:new Date().toISOString()};
    const query=editing?supabase.from("goals").update(payload).eq("id",editing.id).eq("user_id",userId):supabase.from("goals").insert(payload);
    const {data,error}=await query.select("*").single();
    if(error)setNotice(error.message);else if(data){setGoals(current=>[data as Goal,...current.filter(goal=>goal.id!==data.id)]);setOpen(false);setEditing(null);setNotice(editing?"Goal updated.":"Goal created.");}
    setBusy(false);
  }

  async function deleteGoal(){if(!deleting)return;setBusy(true);const {error}=await supabase.from("goals").delete().eq("id",deleting.id).eq("user_id",userId);if(error)setNotice(error.message);else{setGoals(current=>current.filter(goal=>goal.id!==deleting.id));setDeleting(null);setNotice("Goal deleted.");}setBusy(false)}
  const totalTarget=goals.reduce((sum,g)=>sum+Number(g.target_amount),0);
  const totalSaved=goals.reduce((sum,g)=>sum+Number(g.current_amount),0);

  return <section className={styles.workspace}>
    <header className={styles.header}><div><span>GOALS</span><h1>Financial goals</h1><p>Create targets, record progress and keep the Monthly Planner synchronized.</p></div><button onClick={()=>{setEditing(null);setOpen(true)}}><Plus size={17}/>Add goal</button></header>
    {notice&&<div className={styles.notice}>{notice}</div>}
    <div className={styles.summary}><article><span>Total target</span><strong>{money(totalTarget)}</strong></article><article><span>Total saved</span><strong>{money(totalSaved)}</strong></article><article><span>Overall progress</span><strong>{totalTarget?`${Math.min(100,totalSaved/totalTarget*100).toFixed(1)}%`:"0%"}</strong></article></div>
    <div className={styles.grid}>{goals.length?goals.map(goal=>{const target=Number(goal.target_amount);const current=Number(goal.current_amount);const progress=target?Math.min(100,current/target*100):0;return <article className={styles.card} key={goal.id}><div className={styles.cardTop}><span className={styles.icon}><Target size={19}/></span><div><h2>{goal.name}</h2><p>{goal.status.replace("_"," ")}</p></div><div className={styles.actions}><button onClick={()=>{setEditing(goal);setOpen(true)}} aria-label="Edit goal"><Pencil size={16}/></button><button onClick={()=>setDeleting(goal)} aria-label="Delete goal"><Trash2 size={16}/></button></div></div><div className={styles.amounts}><div><span>Saved</span><strong>{money(current)}</strong></div><div><span>Target</span><strong>{money(target)}</strong></div></div><div className={styles.progress}><i style={{width:`${progress}%`}}/></div><footer><span>{progress.toFixed(1)}% complete</span><span>{goal.target_date?<><CalendarDays size={13}/>{new Date(`${goal.target_date}T12:00:00`).toLocaleDateString("en-GB")}</>:"No deadline"}</span></footer></article>}):<div className={styles.empty}>No goals yet. Add your first financial target.</div>}</div>
    {open&&<div className={styles.backdrop} onMouseDown={()=>!busy&&setOpen(false)}><form className={styles.modal} onSubmit={saveGoal} onMouseDown={e=>e.stopPropagation()}><button type="button" className={styles.close} onClick={()=>setOpen(false)}><X size={18}/></button><span>GOAL DETAILS</span><h2>{editing?"Edit goal":"Create goal"}</h2><label>Goal name<input name="name" defaultValue={editing?.name??""} required/></label><div className={styles.two}><label>Target amount<input name="target_amount" type="number" min="0.01" step="0.01" defaultValue={editing?.target_amount??""} required/></label><label>Saved amount<input name="current_amount" type="number" min="0" step="0.01" defaultValue={editing?.current_amount??0} required/></label></div><div className={styles.two}><label>Target date<input name="target_date" type="date" defaultValue={editing?.target_date??""}/></label><label>Status<select name="status" defaultValue={editing?.status??"active"}><option value="active">Active</option><option value="completed">Completed</option><option value="paused">Paused</option></select></label></div><button className={styles.save} disabled={busy}>{busy?"Saving…":"Save goal"}</button></form></div>}
    {deleting&&<div className={styles.backdrop}><div className={`${styles.modal} ${styles.confirm}`}><span>PERMANENT ACTION</span><h2>Delete goal?</h2><p>“{deleting.name}” will be removed from Goals and the Monthly Planner.</p><div className={styles.confirmActions}><button onClick={()=>setDeleting(null)}>Cancel</button><button className={styles.danger} onClick={deleteGoal} disabled={busy}>{busy?"Deleting…":"Delete goal"}</button></div></div></div>}
  </section>
}
