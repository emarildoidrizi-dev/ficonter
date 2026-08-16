"use client";

import {
  ChevronDown,
  Headphones,
  ListMusic,
  LoaderCircle,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Upload,
  Volume1,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ChangeEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getOwnerMusicSnapshot,
  getOwnerMusicVersion,
  pause,
  play,
  playAdjacent,
  seek,
  selectAndPlay,
  setOwnerMusicTracks,
  setVolume,
  stopIfTrack,
  subscribeOwnerMusic,
  toggleRepeat,
  toggleShuffle,
} from "@/lib/ownerMusic/playerStore";
import type { OwnerMusicTrack } from "@/lib/ownerMusic/playerStore";
import styles from "./OwnerMusicPlayer.module.css";

type LibraryResponse = { tracks?: OwnerMusicTrack[]; error?: string };
type UploadIntentResponse = { bucket?: string; path?: string; token?: string; mimeType?: string; error?: string };

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function OwnerMusicPlayer() {
  useSyncExternalStore(
    subscribeOwnerMusic,
    getOwnerMusicVersion,
    () => 0,
  );
  const player = getOwnerMusicSnapshot();
  const [expanded, setExpanded] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);

  const currentTrack = player.tracks.find((track) => track.id === player.currentId) ?? null;

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/owner/music", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as LibraryResponse;
      if (!response.ok) throw new Error(payload.error || "The music library could not be loaded.");
      setOwnerMusicTracks(Array.isArray(payload.tracks) ? payload.tracks : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The music library could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadLibrary();
    }, 4 * 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [loadLibrary]);

  useEffect(() => {
    function openOwnerMusic() {
      setExpanded(true);
      setLibraryOpen(true);
    }
    window.addEventListener("ficonter:owner-music-open", openOwnerMusic);
    return () => window.removeEventListener("ficonter:owner-music-open", openOwnerMusic);
  }, []);


  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setError("");
    try {
      const intentResponse = await fetch("/api/owner/music/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });
      const intent = (await intentResponse.json().catch(() => ({}))) as UploadIntentResponse;
      if (!intentResponse.ok || !intent.bucket || !intent.path || !intent.token) {
        throw new Error(intent.error || "The music upload could not be prepared.");
      }

      const { error: uploadError } = await supabase.storage
        .from(intent.bucket)
        .uploadToSignedUrl(intent.path, intent.token, file, {
          contentType: intent.mimeType || file.type || "audio/mpeg",
        });
      if (uploadError) throw uploadError;

      await loadLibrary();
      setExpanded(true);
      setLibraryOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The music file could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  async function deleteTrack(track: OwnerMusicTrack) {
    setError("");
    try {
      const response = await fetch("/api/owner/music", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: track.path }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "The track could not be deleted.");
      stopIfTrack(track.id);
      await loadLibrary();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The track could not be deleted.");
    }
  }

  const canSeek = player.duration > 0;

  return (
    <aside className={`${styles.dock}${expanded ? ` ${styles.dockExpanded}` : ""}`} aria-label="Owner Music">
      <input
        ref={fileInputRef}
        className={styles.fileInput}
        type="file"
        accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/ogg,audio/webm,audio/flac,audio/x-flac,.mp3,.m4a,.aac,.wav,.ogg,.webm,.flac"
        onChange={handleUpload}
      />

      {expanded ? (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelIdentity}>
              <span className={styles.panelIcon}><Headphones size={18} /></span>
              <div><strong>Owner Music</strong><small>Private workspace player</small></div>
            </div>
            <div className={styles.panelHeaderActions}>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Add music" aria-label="Add music">
                {uploading ? <LoaderCircle className={styles.spin} size={17} /> : <Plus size={17} />}
              </button>
              <button type="button" onClick={() => setExpanded(false)} title="Minimize" aria-label="Minimize Owner Music"><ChevronDown size={18} /></button>
            </div>
          </div>

          <div className={styles.nowPlaying}>
            <span className={styles.artwork}><Music2 size={26} /></span>
            <div className={styles.trackIdentity}>
              <span>NOW PLAYING</span>
              <strong>{currentTrack?.title ?? (player.tracks.length ? "Choose a track" : "Your private soundtrack")}</strong>
              <small>{currentTrack ? "FICONTER Owner Music" : "Upload your own music to begin"}</small>
            </div>
          </div>

          <div className={styles.progressRow}>
            <span>{formatTime(player.currentTime)}</span>
            <input
              type="range"
              min={0}
              max={Math.max(player.duration, 1)}
              step={1}
              value={Math.min(player.currentTime, Math.max(player.duration, 1))}
              disabled={!canSeek}
              onChange={(event) => seek(Number(event.target.value))}
              aria-label="Track position"
            />
            <span>{formatTime(player.duration)}</span>
          </div>

          <div className={styles.transport}>
            <button type="button" className={player.shuffle ? styles.activeControl : ""} onClick={toggleShuffle} aria-pressed={player.shuffle} title="Shuffle"><Shuffle size={17} /></button>
            <button type="button" onClick={() => playAdjacent(-1)} disabled={!player.tracks.length} title="Previous track"><SkipBack size={20} /></button>
            <button
              type="button"
              className={styles.playButton}
              onClick={() => player.playing ? pause() : void play()}
              disabled={!player.tracks.length}
              title={player.playing ? "Pause" : "Play"}
            >
              {player.playing ? <Pause size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" />}
            </button>
            <button type="button" onClick={() => playAdjacent(1)} disabled={!player.tracks.length} title="Next track"><SkipForward size={20} /></button>
            <button type="button" className={player.repeat ? styles.activeControl : ""} onClick={toggleRepeat} aria-pressed={player.repeat} title="Repeat track"><Repeat2 size={17} /></button>
          </div>

          <div className={styles.utilityRow}>
            <div className={styles.volumeControl}>
              {player.volume > 0.35 ? <Volume2 size={16} /> : <Volume1 size={16} />}
              <input type="range" min={0} max={1} step={0.05} value={player.volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label="Music volume" />
            </div>
            <button type="button" className={styles.libraryToggle} onClick={() => setLibraryOpen((open) => !open)} aria-expanded={libraryOpen}>
              <ListMusic size={16} /> Library <span>{player.tracks.length}</span>
            </button>
          </div>

          {error ? <div className={styles.error} role="status">{error}</div> : null}

          {libraryOpen ? (
            <div className={styles.library}>
              <div className={styles.libraryHeader}>
                <div><strong>Music library</strong><small>Owner only · private storage</small></div>
                <button type="button" className={styles.uploadButton} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload size={15} /> {uploading ? "Uploading…" : "Add track"}
                </button>
              </div>

              {loading ? (
                <div className={styles.libraryState}><LoaderCircle className={styles.spin} size={20} /> Loading music…</div>
              ) : player.tracks.length === 0 ? (
                <div className={styles.emptyState}><Music2 size={24} /><strong>No music yet</strong><span>Upload your own tracks and keep them private to the Owner workspace.</span></div>
              ) : (
                <div className={styles.trackList}>
                  {player.tracks.map((track, index) => {
                    const active = track.id === player.currentId;
                    return (
                      <div key={track.id} className={`${styles.trackRow}${active ? ` ${styles.trackRowActive}` : ""}`}>
                        <button type="button" className={styles.trackPlay} onClick={() => active && player.playing ? pause() : void selectAndPlay(track.id)} aria-label={`${active && player.playing ? "Pause" : "Play"} ${track.title}`}>
                          {active && player.playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
                        </button>
                        <span className={styles.trackNumber}>{String(index + 1).padStart(2, "0")}</span>
                        <div className={styles.trackText}><strong>{track.title}</strong><small>{formatBytes(track.sizeBytes) || "Private audio"}</small></div>
                        <button type="button" className={styles.deleteTrack} onClick={() => void deleteTrack(track)} aria-label={`Delete ${track.title}`} title="Delete track"><Trash2 size={15} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <div className={styles.miniPlayer}>
          <button type="button" className={styles.miniIdentity} onClick={() => setExpanded(true)} title="Open Owner Music">
            <span className={`${styles.miniIcon}${player.playing ? ` ${styles.miniIconPlaying}` : ""}`}><Music2 size={17} /></span>
            <span className={styles.miniText}><small>OWNER MUSIC</small><strong>{currentTrack?.title ?? "Music"}</strong></span>
          </button>
          <button type="button" className={styles.miniPlay} onClick={() => player.playing ? pause() : void play()} disabled={!player.tracks.length} aria-label={player.playing ? "Pause music" : "Play music"}>
            {player.playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          </button>
          <button type="button" className={styles.miniClose} onClick={() => setExpanded(true)} aria-label="Open music library"><ListMusic size={16} /></button>
        </div>
      )}
    </aside>
  );
}
