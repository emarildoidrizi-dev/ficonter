"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Camera,
  Check,
  Mail,
  Save,
  ShieldCheck,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import styles from "./SettingsWorkspace.module.css";

type Metadata = Record<string, unknown>;

type AuthIdentityUser = {
  email?: string | null;
  new_email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type Props = {
  userId: string;
  email: string;
  metadata: Metadata;
};

type Feedback = {
  type: "success" | "error";
  text: string;
};

function readEmailIdentity(
  user: AuthIdentityUser | null | undefined,
  fallbackEmail: string,
  fallbackPending: string,
) {
  const current = String(user?.email ?? fallbackEmail).trim().toLowerCase();
  const storedPending = String(
    user?.user_metadata?.pending_email_change ?? fallbackPending,
  )
    .trim()
    .toLowerCase();
  const authPending = String(user?.new_email ?? "").trim().toLowerCase();
  const pending =
    authPending ||
    (storedPending && storedPending !== current ? storedPending : "");

  return { current, pending };
}

function emailChangeRedirectUrl() {
  if (typeof window === "undefined") return undefined;
  const next = encodeURIComponent("/dashboard/profile");
  return `${window.location.origin}/auth/callback?next=${next}`;
}

async function compressProfilePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Choose an image smaller than 8 MB.");
  }

  const image = document.createElement("img");
  const objectUrl = URL.createObjectURL(file);

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The image could not be read."));
      image.src = objectUrl;
    });

    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("The image could not be processed.");

    const scale = Math.max(size / image.width, size / image.height);
    const width = image.width * scale;
    const height = image.height * scale;

    context.drawImage(
      image,
      (size - width) / 2,
      (size - height) / 2,
      width,
      height,
    );

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("The image could not be compressed."));
        },
        "image/jpeg",
        0.82,
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function ProfileWorkspace({ userId, email, metadata }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const photoInput = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(
    String(metadata.full_name ?? metadata.name ?? ""),
  );
  const [displayName, setDisplayName] = useState(
    String(metadata.display_name ?? metadata.full_name ?? ""),
  );
  const [profilePhotoPath, setProfilePhotoPath] = useState(
    String(metadata.avatar_path ?? ""),
  );
  const [profilePhoto, setProfilePhoto] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState<Blob | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);

  const initialPendingEmail = String(metadata.pending_email_change ?? "")
    .trim()
    .toLowerCase();
  const [currentEmail, setCurrentEmail] = useState(email.trim().toLowerCase());
  const [pendingEmail, setPendingEmail] = useState(initialPendingEmail);
  const [accountEmail, setAccountEmail] = useState(initialPendingEmail || email);

  const [savingProfile, setSavingProfile] = useState(false);
  const [emailRequesting, setEmailRequesting] = useState(false);
  const [emailResending, setEmailResending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadProfilePhoto() {
      if (!profilePhotoPath) {
        setProfilePhoto("");
        return;
      }

      const { data, error } = await supabase.storage
        .from("profile-photos")
        .createSignedUrl(profilePhotoPath, 60 * 60);

      if (!mounted) return;
      if (error) {
        setProfilePhoto("");
        return;
      }

      setProfilePhoto(data.signedUrl);
    }

    void loadProfilePhoto();

    return () => {
      mounted = false;
    };
  }, [profilePhotoPath, supabase]);

  useEffect(() => {
    let active = true;

    function syncIdentity(user: AuthIdentityUser | null | undefined) {
      if (!active) return;
      const identity = readEmailIdentity(user, email, initialPendingEmail);
      setCurrentEmail(identity.current);
      setPendingEmail(identity.pending);
      setAccountEmail(identity.pending || identity.current);
    }

    void supabase.auth.getUser().then(({ data }) => syncIdentity(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      syncIdentity(session?.user);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [email, initialPendingEmail, supabase]);

  useEffect(() => {
    const handleProfileUpdate = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail ?? {};
      if (typeof detail.fullName === "string") setFullName(detail.fullName);
      if (typeof detail.displayName === "string") {
        setDisplayName(detail.displayName);
      }
    };

    window.addEventListener("ficonter:profile-updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("ficonter:profile-updated", handleProfileUpdate);
    };
  }, []);

  async function saveMetadata(nextData: Metadata) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const current = user?.user_metadata ?? metadata;
    const { avatar_data_url: _legacyAvatar, ...safeCurrent } = current;

    const { error } = await supabase.auth.updateUser({
      data: {
        ...safeCurrent,
        ...nextData,
        avatar_data_url: null,
      },
    });

    if (error) throw error;
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingProfile) return;

    setSavingProfile(true);
    setFeedback(null);

    try {
      let nextPhotoPath = profilePhotoPath;

      if (removePhoto && profilePhotoPath) {
        const { error: removeError } = await supabase.storage
          .from("profile-photos")
          .remove([profilePhotoPath]);
        if (removeError) throw removeError;
        nextPhotoPath = "";
      }

      if (pendingPhoto) {
        const uploadPath = `${userId}/avatar.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("profile-photos")
          .upload(uploadPath, pendingPhoto, {
            contentType: "image/jpeg",
            cacheControl: "3600",
            upsert: true,
          });
        if (uploadError) throw uploadError;
        nextPhotoPath = uploadPath;
      }

      await saveMetadata({
        full_name: fullName.trim(),
        display_name: displayName.trim(),
        avatar_path: nextPhotoPath || null,
      });

      setProfilePhotoPath(nextPhotoPath);
      setPendingPhoto(null);
      setRemovePhoto(false);

      if (!nextPhotoPath) {
        setProfilePhoto("");
      } else {
        const { data, error } = await supabase.storage
          .from("profile-photos")
          .createSignedUrl(nextPhotoPath, 60 * 60);
        if (error) throw error;
        setProfilePhoto(data.signedUrl);
      }

      window.dispatchEvent(
        new CustomEvent("ficonter:profile-updated", {
          detail: {
            fullName: fullName.trim(),
            displayName: displayName.trim(),
            email: currentEmail,
            profilePhotoPath: nextPhotoPath,
          },
        }),
      );

      setFeedback({ type: "success", text: "Profile changes saved." });
    } catch (error) {
      setFeedback({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Your profile could not be updated.",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFeedback(null);

    try {
      const compressed = await compressProfilePhoto(file);
      const previewUrl = URL.createObjectURL(compressed);

      setPendingPhoto(compressed);
      setRemovePhoto(false);
      setProfilePhoto((current) => {
        if (current.startsWith("blob:")) URL.revokeObjectURL(current);
        return previewUrl;
      });
      setFeedback({
        type: "success",
        text: "Photo prepared. Select Save profile to upload it securely.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "The profile photo could not be prepared.",
      });
    } finally {
      event.target.value = "";
    }
  }

  async function updateEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emailRequesting) return;

    setEmailRequesting(true);
    setFeedback(null);

    try {
      const nextEmail = accountEmail.trim().toLowerCase();
      if (!nextEmail || !nextEmail.includes("@")) {
        throw new Error("Enter a valid email address.");
      }
      if (nextEmail === currentEmail && !pendingEmail) {
        setFeedback({ type: "success", text: "Your email address is unchanged." });
        return;
      }

      const { data, error } = await supabase.auth.updateUser(
        { email: nextEmail },
        { emailRedirectTo: emailChangeRedirectUrl() },
      );
      if (error) throw error;

      await saveMetadata({
        pending_email_change: nextEmail,
        pending_email_change_requested_at: new Date().toISOString(),
      });

      const identity = readEmailIdentity(
        data.user as AuthIdentityUser | null,
        currentEmail,
        nextEmail,
      );
      setCurrentEmail(identity.current);
      setPendingEmail(identity.pending || nextEmail);
      setAccountEmail(identity.pending || nextEmail);
      setFeedback({
        type: "success",
        text:
          "Confirmation link sent. Your current email remains active until the change is confirmed.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Your email address could not be updated.",
      });
    } finally {
      setEmailRequesting(false);
    }
  }

  async function resendEmailChange() {
    if (!pendingEmail || emailResending) return;

    setEmailResending(true);
    setFeedback(null);

    try {
      const { error } = await supabase.auth.resend({
        type: "email_change",
        email: currentEmail,
        options: { emailRedirectTo: emailChangeRedirectUrl() },
      });
      if (error) throw error;
      setFeedback({
        type: "success",
        text: "A new confirmation link was sent to the pending email address.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "The confirmation link could not be resent.",
      });
    } finally {
      setEmailResending(false);
    }
  }

  const avatarText = (displayName || fullName || email || "F")
    .trim()
    .slice(0, 1)
    .toUpperCase();

  return (
    <div className={styles.stack}>
      {feedback ? (
        <div
          className={`${styles.message} ${
            feedback.type === "error" ? styles.error : styles.success
          }`}
          role="status"
        >
          {feedback.type === "success" ? <Check size={17} /> : null}
          {feedback.text}
        </div>
      ) : null}

      <form className={styles.form} onSubmit={saveProfile}>
        <div className={styles.photoEditor}>
          <div className={styles.largeAvatar}>
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profile preview" />
            ) : (
              avatarText
            )}
          </div>
          <div>
            <h3>Profile photo</h3>
            <p>
              Upload a clear square image. Ficonter compresses it and stores it
              securely.
            </p>
            <div className={styles.inlineActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => photoInput.current?.click()}
              >
                <Camera size={16} />
                Choose photo
              </button>
              {profilePhoto ? (
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={() => {
                    setPendingPhoto(null);
                    setRemovePhoto(true);
                    setProfilePhoto("");
                  }}
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
          <input
            ref={photoInput}
            className={styles.hiddenInput}
            type="file"
            accept="image/*"
            onChange={choosePhoto}
          />
        </div>

        <div className={styles.formGrid}>
          <label>
            <span>Full name</span>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
              maxLength={120}
            />
          </label>
          <label>
            <span>Display name</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="nickname"
              maxLength={80}
            />
          </label>
        </div>

        <div className={styles.actions}>
          <button className={styles.primaryButton} disabled={savingProfile}>
            <Save size={16} />
            {savingProfile ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>

      <form className={styles.formCard} onSubmit={updateEmail}>
        <div className={styles.cardHeading}>
          <Mail size={19} />
          <div>
            <h3>Login email</h3>
            <p>Change the email used to sign in to Ficonter.</p>
          </div>
        </div>

        <div className={styles.formGrid}>
          <label>
            <span>Current email</span>
            <input type="email" value={currentEmail} disabled />
          </label>
          <label>
            <span>New email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={accountEmail}
              onChange={(event) => setAccountEmail(event.target.value)}
              required
            />
          </label>
        </div>

        {pendingEmail ? (
          <div className={styles.pendingEmailCard} role="status">
            <div>
              <span className={styles.pendingLabel}>Pending confirmation</span>
              <strong>{pendingEmail}</strong>
              <p>
                Your current email remains active until the required confirmation
                link or links are approved.
              </p>
            </div>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={emailResending}
              onClick={() => void resendEmailChange()}
            >
              {emailResending ? "Sending…" : "Resend link"}
            </button>
          </div>
        ) : null}

        <div className={styles.emailSecurityNote}>
          <ShieldCheck size={17} />
          <span>
            For security, Ficonter never changes the login email until Supabase
            confirms the request.
          </span>
        </div>

        <div className={styles.actions}>
          <button className={styles.secondaryButton} disabled={emailRequesting}>
            {emailRequesting
              ? "Sending confirmation…"
              : pendingEmail
                ? "Change pending email"
                : "Send confirmation link"}
          </button>
        </div>
      </form>
    </div>
  );
}
