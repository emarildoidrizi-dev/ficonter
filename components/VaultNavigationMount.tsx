"use client";

import { VaultHeaderControl } from "@/components/VaultHeaderControl";
import styles from "./VaultHeaderControl.module.css";

type VaultWorkspace = "personal" | "business";

/**
 * Permanent Vault placement for both Personal and Business workspaces.
 *
 * This intentionally does not use portals, MutationObserver, DOM queries, or
 * route timing. The control is rendered directly by each workspace layout, so
 * it is present as soon as that layout renders and cannot disappear when
 * Next.js swaps workspace shells client-side.
 */
export function VaultNavigationMount({ workspace: _workspace = "personal" }: { workspace?: VaultWorkspace }) {
  return (
    <>
      <span className={styles.persistentDesktopHost} data-ficonter-vault-slot="desktop">
        <VaultHeaderControl />
      </span>
      <span className={styles.persistentMobileHost} data-ficonter-vault-slot="mobile">
        <VaultHeaderControl />
      </span>
    </>
  );
}
