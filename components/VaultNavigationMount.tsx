"use client";

import { VaultHeaderControl } from "@/components/VaultHeaderControl";
import styles from "./VaultHeaderControl.module.css";

type VaultWorkspace = "personal" | "business";

/**
 * Permanent desktop Vault placement for Personal and Business workspaces.
 *
 * On mobile/PWA layouts the Vault control is rendered directly inside the
 * shared header action group beside Inbox and Notifications, so it participates
 * in the header layout instead of floating above it.
 */
export function VaultNavigationMount({ workspace: _workspace = "personal" }: { workspace?: VaultWorkspace }) {
  return (
    <span className={styles.persistentDesktopHost} data-ficonter-vault-slot="desktop">
      <VaultHeaderControl />
    </span>
  );
}
