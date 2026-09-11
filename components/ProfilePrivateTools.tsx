"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  LockKeyhole,
  MessageCircleQuestion,
  Music2,
  Sparkles,
} from "lucide-react";

import styles from "./ProfilePrivateTools.module.css";

type Props = {
  askFiconterAvailable: boolean;
  isPlatformOwner: boolean;
};

export function ProfilePrivateTools({
  askFiconterAvailable,
  isPlatformOwner,
}: Props) {
  const router = useRouter();
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const host = document.createElement("div");
    host.dataset.ficonterProfilePrivateTools = "true";

    const placeHost = () => {
      const fullNameInput = document.querySelector<HTMLInputElement>(
        'input[autocomplete="name"]',
      );
      const profileForm = fullNameInput?.closest("form");
      const profileStack = profileForm?.parentElement;

      if (!profileStack) {
        if (host.isConnected) host.remove();
        return;
      }

      if (host.parentElement !== profileStack) {
        profileStack.appendChild(host);
      }
    };

    setPortalHost(host);
    placeHost();

    const observer = new MutationObserver(placeHost);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      host.remove();
    };
  }, []);

  function openAskFiconter() {
    if (askFiconterAvailable) {
      router.push("/dashboard/insights/ask-ficonter");
      return;
    }

    router.push(
      "/dashboard/settings?section=subscription&required=advanced_financial_recommendations",
    );
  }

  function openOwnerMusic() {
    window.dispatchEvent(new Event("ficonter:owner-music-open"));
  }

  if (!portalHost) return null;

  return createPortal(
    <section className={styles.card} aria-labelledby="profile-private-tools-title">
      <div className={styles.heading}>
        <span className={styles.headingIcon} aria-hidden="true">
          <Sparkles size={18} />
        </span>
        <div>
          <h3 id="profile-private-tools-title">Profile tools</h3>
          <p>
            Open private FICONTER utilities from your profile instead of keeping
            them floating over the workspace.
          </p>
        </div>
      </div>

      <div className={styles.toolGrid}>
        <button
          type="button"
          className={styles.toolButton}
          data-locked={askFiconterAvailable ? "false" : "true"}
          onClick={openAskFiconter}
        >
          <span className={styles.toolIcon} aria-hidden="true">
            {askFiconterAvailable ? (
              <MessageCircleQuestion size={20} />
            ) : (
              <LockKeyhole size={19} />
            )}
          </span>
          <span className={styles.toolCopy}>
            <strong>Ask FICONTER</strong>
            <small>
              {askFiconterAvailable
                ? "Open financial decision intelligence."
                : "Personal Pro is required to use this tool."}
            </small>
          </span>
          {!askFiconterAvailable ? (
            <span className={styles.badge}>Personal Pro</span>
          ) : null}
          <ChevronRight className={styles.chevron} size={17} aria-hidden="true" />
        </button>

        {isPlatformOwner ? (
          <button
            type="button"
            className={styles.toolButton}
            onClick={openOwnerMusic}
          >
            <span className={styles.toolIcon} aria-hidden="true">
              <Music2 size={20} />
            </span>
            <span className={styles.toolCopy}>
              <strong>Owner Music</strong>
              <small>Open your private music player and library.</small>
            </span>
            <span className={styles.badge}>Owner only</span>
            <ChevronRight className={styles.chevron} size={17} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </section>,
    portalHost,
  );
}
