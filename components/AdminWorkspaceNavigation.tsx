"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";
import styles from "./AdminWorkspaceNavigation.module.css";

type AdminWorkspaceNavigationProps = {
  showUiLab?: boolean;
};

function activeRoute(pathname: string, href: string) {
  if (href === "/dashboard/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminWorkspaceNavigation({
  showUiLab = false,
}: AdminWorkspaceNavigationProps) {
  const pathname = usePathname();
  const links = [
    ["/dashboard/admin", ShieldCheck, "Personal Admin"],
    ["/dashboard/admin/usage", Activity, "Personal Live & Usage"],
    ["/business/admin", Building2, "Business Admin"],
    ...(showUiLab
      ? [["/dashboard/admin/ui-lab", FlaskConical, "UI Lab"]] as const
      : []),
  ] as const;

  return (
    <nav className={styles.navigation} aria-label="FICONTER administration workspaces">
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
