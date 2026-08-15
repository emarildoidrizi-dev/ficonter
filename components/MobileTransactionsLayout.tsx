"use client";

import { List, Plus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import styles from "./MobileTransactionsLayout.module.css";

type View = "ledger" | "add";

type Props = {
  ledger: ReactNode;
  entry: ReactNode;
  initialView?: View;
};

export function MobileTransactionsLayout({
  ledger,
  entry,
  initialView = "ledger",
}: Props) {
  const [view, setView] = useState<View>(initialView);

  useEffect(() => {
    function openAdd() {
      setView("add");
    }

    window.addEventListener("ficonter:quick-add-transaction", openAdd);

    if (window.location.hash === "#quick-add") {
      setView("add");
    }

    return () => {
      window.removeEventListener("ficonter:quick-add-transaction", openAdd);
    };
  }, []);

  return (
    <section className={styles.workspace} data-mobile-transaction-view={view}>
      <div className={styles.switcher} role="tablist" aria-label="Transactions view">
        <button
          type="button"
          role="tab"
          aria-selected={view === "ledger"}
          className={view === "ledger" ? styles.active : undefined}
          onClick={() => setView("ledger")}
        >
          <List size={17} aria-hidden="true" />
          Transactions
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "add"}
          className={view === "add" ? styles.active : undefined}
          onClick={() => setView("add")}
        >
          <Plus size={18} aria-hidden="true" />
          Add transaction
        </button>
      </div>

      <div className={styles.ledger} data-mobile-view-panel="ledger">
        {ledger}
      </div>
      <div className={styles.entry} data-mobile-view-panel="add">
        {entry}
      </div>
    </section>
  );
}
