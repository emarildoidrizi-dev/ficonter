"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  CircleHelp,
  CreditCard,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./UserProfileMenu.module.css";

type Props = {
  email: string;
  fullName: string;
  displayName: string;
  profilePhoto: string;
};

type ProfileUpdateDetail = {
  fullName?: string;
  displayName?: string;
  profilePhoto?: string;
};

function initialsFrom(name: string, email: string) {
  const source = name.trim() || email.split("@")[0] || "F";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}

export function UserProfileMenu({
  email,
  fullName: initialFullName,
  displayName: initialDisplayName,
  profilePhoto: initialProfilePhoto,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(initialFullName);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [profilePhoto, setProfilePhoto] = useState(initialProfilePhoto);
  const [signingOut, setSigningOut] = useState(false);

  const visibleName =
    displayName.trim() || fullName.trim() || email.split("@")[0] || "Account";
  const initials = initialsFrom(fullName || displayName, email);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleProfileUpdate(event: Event) {
      const detail = (event as CustomEvent<ProfileUpdateDetail>).detail ?? {};

      if (typeof detail.fullName === "string") {
        setFullName(detail.fullName);
      }
      if (typeof detail.displayName === "string") {
        setDisplayName(detail.displayName);
      }
      if (typeof detail.profilePhoto === "string") {
        setProfilePhoto(detail.profilePhoto);
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener(
      "ficonter:profile-updated",
      handleProfileUpdate as EventListener,
    );
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener(
        "ficonter:profile-updated",
        handleProfileUpdate as EventListener,
      );
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function signOut() {
    if (signingOut) return;

    setSigningOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        className={styles.trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.avatarWrap}>
          {profilePhoto ? (
            <img
              className={styles.avatar}
              src={profilePhoto}
              alt={`${visibleName} profile`}
            />
          ) : (
            <span className={styles.fallbackAvatar} aria-hidden="true">
              {initials}
            </span>
          )}
          <span className={styles.onlineDot} aria-label="Online" />
        </span>

        <span className={styles.triggerName}>{visibleName}</span>
        <ChevronDown
          className={`${styles.chevron}${open ? ` ${styles.chevronOpen}` : ""}`}
          size={16}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className={styles.menu} role="menu">
          <div className={styles.identity}>
            <span className={styles.largeAvatarWrap}>
              {profilePhoto ? (
                <img
                  className={styles.largeAvatar}
                  src={profilePhoto}
                  alt=""
                />
              ) : (
                <span className={styles.largeFallback} aria-hidden="true">
                  {initials}
                </span>
              )}
              <span className={styles.largeOnlineDot} />
            </span>

            <span className={styles.identityText}>
              <strong>{visibleName}</strong>
              <span>{email}</span>
            </span>
          </div>

          <div className={styles.divider} />

          <nav className={styles.menuLinks} aria-label="Account menu">
            <Link
              href="/dashboard/settings?section=profile"
              role="menuitem"
              className={styles.menuLink}
            >
              <UserRound size={17} />
              My profile
            </Link>

            <Link
              href="/dashboard/settings"
              role="menuitem"
              className={styles.menuLink}
            >
              <Settings size={17} />
              Settings
            </Link>

            <Link
              href="/dashboard/settings?section=security"
              role="menuitem"
              className={styles.menuLink}
            >
              <ShieldCheck size={17} />
              Security
            </Link>

            <Link
              href="/dashboard/settings?section=subscription"
              role="menuitem"
              className={styles.menuLink}
            >
              <CreditCard size={17} />
              Subscription
            </Link>

            <Link
              href="/dashboard/settings?section=privacy"
              role="menuitem"
              className={styles.menuLink}
            >
              <CircleHelp size={17} />
              Help & privacy
            </Link>
          </nav>

          <div className={styles.divider} />

          <button
            className={styles.logout}
            type="button"
            role="menuitem"
            onClick={signOut}
            disabled={signingOut}
          >
            <LogOut size={17} />
            {signingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
