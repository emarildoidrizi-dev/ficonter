"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { isStandaloneDisplayMode } from "@/lib/pwaRuntimeRecovery";
import { Brand } from "./Brand";

type HomepageLinkProps = {
  className?: string;
};

type AppAwareLoginShellProps = {
  className: string;
  browserPanel: ReactNode;
  children: ReactNode;
};

function useStandaloneAuthMode() {
  const [standalone, setStandalone] = useState<boolean | null>(null);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const synchronize = () => setStandalone(isStandaloneDisplayMode());

    synchronize();
    displayMode.addEventListener?.("change", synchronize);

    return () => {
      displayMode.removeEventListener?.("change", synchronize);
    };
  }, []);

  return standalone;
}

export function AppAwareLoginShell({
  className,
  browserPanel,
  children,
}: AppAwareLoginShellProps) {
  const standalone = useStandaloneAuthMode();
  const browserMode = standalone === false;

  return (
    <div
      className={className}
      style={
        browserMode
          ? undefined
          : {
              gridTemplateColumns: "minmax(0, 1fr)",
              maxWidth: 720,
            }
      }
    >
      {browserMode ? browserPanel : null}
      {children}
    </div>
  );
}

export function AppAwareAuthBrand() {
  const standalone = useStandaloneAuthMode();

  return (
    <Brand
      href={standalone === false ? "/" : "/login?entry=app"}
    />
  );
}

export function BrowserOnlyHomepageLink({ className }: HomepageLinkProps) {
  const standalone = useStandaloneAuthMode();

  if (standalone !== false) return null;

  return (
    <Link className={className} href="/">
      ← Back to homepage
    </Link>
  );
}
