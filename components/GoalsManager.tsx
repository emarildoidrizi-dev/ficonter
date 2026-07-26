"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Coins,
  History,
  Pencil,
  Plus,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyFiconterDataChange } from "@/lib/ficonterRealtime";
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

type GoalInvestment = {
  id: string;
  goal_id: string;
  user_id: string;
  amount: number | string;
  invested_at: string;
  notes: string | null;
  transaction_id: string;
  created_at: string;
};

const money = (value: number | string) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value) || 0);

const localDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const localTimeInputValue = (date = new Date()) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

const formatRecordedAt = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export function GoalsManager({
  userId,
  initialGoals,
  initialInvestments,
  initialError,
}: {
  userId: string;
  initialGoals: Goal[];
  initialInvestments: GoalInvestment[];
  initialError: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [goals, setGoals] = useState(initialGoals);
  const [investments, setInvestments] = useState(initialInvestments);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const [investmentGoal, setInvestmentGoal] = useState<Goal | null>(null);
  const [reversing, setReversing] = useState<GoalInvestment | null>(null);
  const [historyGoal, setHistoryGoal] = useState<Goal | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(initialError);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const channel = supabase
      .channel(`goals-module-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "goals",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setGoals((current) => {
            if (payload.eventType === "DELETE") {
              const id = (payload.old as { id?: string }).id;
              return current.filter((goal) => goal.id !== id);
            }
            const next = payload.new as Goal;
            return [
              next,
              ...current.filter((goal) => goal.id !== next.id),
            ].sort((a, b) => a.created_at.localeCompare(b.created_at));
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "goal_investments",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setInvestments((current) => {
            if (payload.eventType === "DELETE") {
              const id = (payload.old as { id?: string }).id;
              return current.filter((item) => item.id !== id);
            }
            const next = payload.new as GoalInvestment;
            return [
              next,
              ...current.filter((item) => item.id !== next.id),
            ].sort(
              (a, b) =>
                new Date(b.invested_at).getTime() -
                new Date(a.invested_at).getTime(),
            );
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  async function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setNotice("");

    try {
      const form = new FormData(event.currentTarget);
      const name = String(form.get("name") ?? "").trim();
      const targetAmount = Number(form.get("target_amount"));
      const targetDate = String(form.get("target_date") ?? "");

      if (!name) throw new Error("Enter a goal name.");
      if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
        throw new Error("Enter a target amount greater than zero.");
      }
      if (targetDate && Number.isNaN(new Date(`${targetDate}T00:00:00`).getTime())) {
        throw new Error("Choose a valid target date.");
      }
      const payload = {
        user_id: userId,
        name,
        target_amount: targetAmount,
        current_amount: editing ? Number(editing.current_amount) : 0,
        target_date: targetDate || null,
        status: String(form.get("status") ?? "active") as GoalStatus,
        updated_at: new Date().toISOString(),
      };

      const query = editing
        ? supabase
            .from("goals")
            .update(payload)
            .eq("id", editing.id)
            .eq("user_id", userId)
        : supabase.from("goals").insert(payload);

      const { data, error } = await query.select("*").single();
      if (error) throw error;
      if (!data) throw new Error("The saved goal could not be returned.");

      setGoals((current) => [
        data as Goal,
        ...current.filter((goal) => goal.id !== data.id),
      ]);
      setOpen(false);
      setEditing(null);
      setNotice(editing ? "Goal updated." : "Goal created.");
      notifyFiconterDataChange("all");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The goal could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function recordInvestment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!investmentGoal || busy) return;

    setBusy(true);
    setNotice("");

    try {
      const form = new FormData(event.currentTarget);
      const amount = Number(form.get("amount"));
      const investmentDate = String(form.get("investment_date") ?? "");
      const investmentTime = String(form.get("investment_time") ?? "");
      const notes = String(form.get("notes") ?? "").trim();
      const remaining = Math.max(
        0,
        Number(investmentGoal.target_amount) - Number(investmentGoal.current_amount),
      );

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Enter an investment amount greater than zero.");
      }
      if (amount > remaining) {
        throw new Error("Investment cannot exceed the remaining goal amount.");
      }
      if (!investmentDate) {
        throw new Error("Choose the date the investment was recorded.");
      }
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(investmentTime)) {
        throw new Error("Choose a valid recorded time.");
      }

      const recordedAt = new Date(`${investmentDate}T${investmentTime}:00`);
      if (Number.isNaN(recordedAt.getTime())) {
        throw new Error("Choose a valid recorded date and time.");
      }

      const { data, error } = await supabase.rpc("record_goal_investment", {
        p_goal_id: investmentGoal.id,
        p_amount: amount,
        p_invested_at: recordedAt.toISOString(),
        p_notes: notes || null,
      });
      if (error) throw error;

      const result = data as { goal?: Goal; investment?: GoalInvestment };
      if (!result.goal || !result.investment) {
        throw new Error("The database did not return the completed investment.");
      }

      setGoals((current) =>
        current.map((goal) =>
          goal.id === result.goal?.id ? (result.goal as Goal) : goal,
        ),
      );
      setInvestments((current) => [
        result.investment as GoalInvestment,
        ...current.filter((item) => item.id !== result.investment?.id),
      ]);
      setInvestmentGoal(null);
      setNotice("Investment recorded and deducted from cash flow.");
      notifyFiconterDataChange("all");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The investment could not be recorded.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function reverseInvestment() {
    if (!reversing || busy) return;

    setBusy(true);
    setNotice("");

    try {
      const { data, error } = await supabase.rpc("reverse_goal_investment", {
        p_investment_id: reversing.id,
      });
      if (error) throw error;

      const result = data as { goal?: Goal };
      if (result.goal) {
        setGoals((current) =>
          current.map((goal) =>
            goal.id === result.goal?.id ? (result.goal as Goal) : goal,
          ),
        );
      }
      setInvestments((current) =>
        current.filter((item) => item.id !== reversing.id),
      );
      setReversing(null);
      setNotice("Investment reversed and cash flow restored.");
      notifyFiconterDataChange("all");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The investment could not be reversed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteGoal() {
    if (!deleting || busy) return;

    setBusy(true);
    setNotice("");

    try {
      const { error } = await supabase.rpc("delete_goal_with_investments", {
        p_goal_id: deleting.id,
      });
      if (error) throw error;

      setGoals((current) =>
        current.filter((goal) => goal.id !== deleting.id),
      );
      setInvestments((current) =>
        current.filter((item) => item.goal_id !== deleting.id),
      );
      setDeleting(null);
      setNotice("Goal and linked investments deleted.");
      notifyFiconterDataChange("all");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The goal could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  const totalTarget = goals.reduce(
    (sum, goal) => sum + Number(goal.target_amount),
    0,
  );
  const totalSaved = goals.reduce(
    (sum, goal) => sum + Number(goal.current_amount),
    0,
  );

  const investmentHistory = historyGoal
    ? investments.filter((item) => item.goal_id === historyGoal.id)
    : [];

  return (
    <section className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <span>GOALS</span>
          <h1>Financial goals</h1>
          <p>
            Create targets, record investments and keep cash flow synchronized.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus size={17} />
          Add goal
        </button>
      </header>

      {notice ? <div className={styles.notice}>{notice}</div> : null}

      <div className={styles.summary}>
        <article>
          <span>Total target</span>
          <strong>{money(totalTarget)}</strong>
        </article>
        <article>
          <span>Total invested</span>
          <strong>{money(totalSaved)}</strong>
        </article>
        <article>
          <span>Overall progress</span>
          <strong>
            {totalTarget
              ? `${Math.min(100, (totalSaved / totalTarget) * 100).toFixed(1)}%`
              : "0%"}
          </strong>
        </article>
      </div>

      <div className={styles.grid}>
        {goals.length ? (
          goals.map((goal) => {
            const target = Number(goal.target_amount);
            const current = Number(goal.current_amount);
            const progress = target
              ? Math.min(100, (current / target) * 100)
              : 0;
            const goalInvestments = investments.filter(
              (item) => item.goal_id === goal.id,
            );

            return (
              <article className={styles.card} key={goal.id}>
                <div className={styles.cardTop}>
                  <span
                    className={styles.progressRing}
                    style={{
                      background: `conic-gradient(#9c7cc6 ${progress * 3.6}deg, #ece8e2 0deg)`,
                    }}
                    aria-label={`${progress.toFixed(1)} percent complete`}
                  >
                    <span>
                      <Target size={17} />
                    </span>
                  </span>
                  <div>
                    <h2>{goal.name}</h2>
                    <p className={`${styles.status} ${styles[goal.status]}`}>{goal.status.replace("_", " ")}</p>
                  </div>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(goal);
                        setOpen(true);
                      }}
                      aria-label="Edit goal"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(goal)}
                      aria-label="Delete goal"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className={styles.amounts}>
                  <div>
                    <span>Invested</span>
                    <strong>{money(current)}</strong>
                  </div>
                  <div>
                    <span>Remaining</span>
                    <strong>{money(Math.max(0, target - current))}</strong>
                  </div>
                  <div>
                    <span>Target</span>
                    <strong>{money(target)}</strong>
                  </div>
                </div>

                <div className={styles.progress}>
                  <i style={{ width: `${progress}%` }} />
                </div>

                <footer>
                  <span>{progress.toFixed(1)}% complete</span>
                  <span className={styles.deadline}>
                    {goal.target_date ? (
                      <span>
                        <CalendarDays size={13} />
                        {new Date(
                          `${goal.target_date}T12:00:00`,
                        ).toLocaleDateString("en-GB")}
                      </span>
                    ) : (
                      "No deadline"
                    )}
                  </span>
                </footer>

                <div className={styles.cardCommands}>
                  <button
                    className={styles.investButton}
                    type="button"
                    disabled={goal.status === "completed"}
                    onClick={() => setInvestmentGoal(goal)}
                  >
                    <Coins size={16} />
                    Record investment
                  </button>
                  <button
                    className={styles.historyButton}
                    type="button"
                    onClick={() => setHistoryGoal(goal)}
                  >
                    <History size={16} />
                    {goalInvestments.length}
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <div className={styles.empty}>
            No goals yet. Add your first financial target.
          </div>
        )}
      </div>

      {open ? (
        <div
          className={styles.backdrop}
          onMouseDown={() => !busy && setOpen(false)}
        >
          <form
            className={styles.modal}
            onSubmit={saveGoal}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.close}
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
            <span>GOAL DETAILS</span>
            <h2>{editing ? "Edit goal" : "Create goal"}</h2>
            <label>
              Goal name
              <input
                name="name"
                defaultValue={editing?.name ?? ""}
                required
              />
            </label>
            <label>
              Target amount
              <input
                name="target_amount"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={editing?.target_amount ?? ""}
                required
              />
            </label>
            <div className={styles.deadlineFields}>
              <label>
                Target date
                <input
                  name="target_date"
                  type="date"
                  defaultValue={editing?.target_date ?? ""}
                />
              </label>
              <label>
                Status
                <select
                  name="status"
                  defaultValue={editing?.status ?? "active"}
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="paused">Paused</option>
                </select>
              </label>
            </div>
            <button className={styles.save} disabled={busy}>
              {busy ? "Saving…" : "Save goal"}
            </button>
          </form>
        </div>
      ) : null}

      {investmentGoal ? (
        <div
          className={styles.backdrop}
          onMouseDown={() => !busy && setInvestmentGoal(null)}
        >
          <form
            className={`${styles.modal} ${styles.investmentModal}`}
            onSubmit={recordInvestment}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.close}
              onClick={() => setInvestmentGoal(null)}
            >
              <X size={18} />
            </button>

            <span className={styles.modalIcon}>
              <Coins size={22} />
            </span>
            <span>RECORD INVESTMENT</span>
            <h2>{investmentGoal.name}</h2>
            <p className={styles.outstanding}>
              Remaining:{" "}
              {money(
                Math.max(
                  0,
                  Number(investmentGoal.target_amount) -
                    Number(investmentGoal.current_amount),
                ),
              )}
            </p>

            <label>
              Investment amount (EUR)
              <input
                name="amount"
                type="number"
                min="0.01"
                max={Math.max(
                  0.01,
                  Number(investmentGoal.target_amount) -
                    Number(investmentGoal.current_amount),
                )}
                step="0.01"
                required
                autoFocus
              />
            </label>

            <div className={styles.recordedFields}>
              <label>
                Recorded date
                <input
                  name="investment_date"
                  type="date"
                  defaultValue={localDateInputValue()}
                  required
                />
              </label>
              <label>
                Recorded time
                <input
                  name="investment_time"
                  type="time"
                  defaultValue={localTimeInputValue()}
                  required
                />
              </label>
            </div>
            <p className={styles.recordedHelp}>
              This exact date and time will appear on the linked transaction.
            </p>

            <label>
              Notes
              <textarea name="notes" placeholder="Optional" rows={4} />
            </label>

            <button className={styles.save} disabled={busy}>
              {busy ? "Recording…" : "Record investment"}
            </button>
          </form>
        </div>
      ) : null}

      {historyGoal ? (
        <div
          className={styles.backdrop}
          onMouseDown={() => setHistoryGoal(null)}
        >
          <div
            className={`${styles.modal} ${styles.historyModal}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.close}
              onClick={() => setHistoryGoal(null)}
            >
              <X size={18} />
            </button>
            <span>INVESTMENT HISTORY</span>
            <h2>{historyGoal.name}</h2>

            <div className={styles.historyList}>
              {investmentHistory.length ? (
                investmentHistory.map((investment) => (
                  <article key={investment.id}>
                    <div>
                      <strong>{money(investment.amount)}</strong>
                      <span>{formatRecordedAt(investment.invested_at)}</span>
                      {investment.notes ? <p>{investment.notes}</p> : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => setReversing(investment)}
                    >
                      <Trash2 size={15} />
                      Reverse
                    </button>
                  </article>
                ))
              ) : (
                <div className={styles.emptyHistory}>
                  No investments recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {deleting ? (
        <div className={styles.backdrop}>
          <div className={`${styles.modal} ${styles.confirm}`}>
            <span>PERMANENT ACTION</span>
            <h2>Delete goal?</h2>
            <p>
              “{deleting.name}” and its investment history will be removed.
              Linked cash-flow transactions will also be deleted.
            </p>
            <div className={styles.confirmActions}>
              <button type="button" onClick={() => setDeleting(null)}>
                Cancel
              </button>
              <button
                className={styles.danger}
                type="button"
                onClick={deleteGoal}
                disabled={busy}
              >
                {busy ? "Deleting…" : "Delete goal"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reversing ? (
        <div className={styles.backdrop}>
          <div className={`${styles.modal} ${styles.confirm}`}>
            <span>REVERSE INVESTMENT</span>
            <h2>Reverse {money(reversing.amount)}?</h2>
            <p>
              The goal progress will decrease and the linked cash-flow
              transaction will be removed.
            </p>
            <div className={styles.confirmActions}>
              <button type="button" onClick={() => setReversing(null)}>
                Cancel
              </button>
              <button
                className={styles.danger}
                type="button"
                onClick={reverseInvestment}
                disabled={busy}
              >
                {busy ? "Reversing…" : "Reverse investment"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
