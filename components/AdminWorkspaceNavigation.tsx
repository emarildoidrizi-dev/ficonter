"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  ShieldCheck,
} from "lucide-react";
import styles from "./AdminWorkspaceNavigation.module.css";

const links = [
  ["/dashboard/admin", ShieldCheck, "Personal Admin"],
  ["/dashboard/admin/usage", Activity, "Personal Live & Usage"],
  ["/business/admin", Building2, "Business Admin"],
] as const;

function activeRoute(pathname: string, href: string) {
  if (href === "/dashboard/admin") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminWorkspaceNavigation() {
  const pathname = usePathname();

  return (
    <nav
      className={styles.navigation}
      aria-label="FICONTER administration workspaces"
    >
      <div>
        <span>PLATFORM ADMINISTRATION</span>
        <strong>Personal and Business remain separate</strong>
      </div>

      <div className={styles.links}>
        {links.map(([href, Icon, label]) => {
          const active = activeRoute(pathname, href);
          return (
            <Link
              href={href}
              key={href}
              className={active ? styles.active : ""}
              aria-current={active ? "page" : undefined}
              prefetch={false}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
