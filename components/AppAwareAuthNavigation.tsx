"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { isStandaloneDisplayMode } from "@/lib/pwaRuntimeRecovery";
import { Brand } from "./Brand";

type HomepageLinkProps = {
  className?: string;
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
