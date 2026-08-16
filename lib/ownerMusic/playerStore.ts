"use client";

export type OwnerMusicTrack = {
  id: string;
  path: string;
  fileName: string;
  title: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: string | null;
  url: string;
};

type PlayerState = {
  tracks: OwnerMusicTrack[];
  currentId: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: boolean;
};

type Store = {
  audio: HTMLAudioElement | null;
  state: PlayerState;
  version: number;
  listeners: Set<() => void>;
};

declare global {
  var __ficonterOwnerMusicStore: Store | undefined;
}

const initialState: PlayerState = {
  tracks: [],
  currentId: null,
  playing: false,
  currentTime: 0,
  duration: 0,
  volume: 0.75,
  shuffle: false,
  repeat: false,
};

function getStore(): Store {
  if (!globalThis.__ficonterOwnerMusicStore) {
    globalThis.__ficonterOwnerMusicStore = {
      audio: null,
      state: { ...initialState },
      version: 0,
      listeners: new Set(),
    };
  }
  return globalThis.__ficonterOwnerMusicStore;
}

function emit() {
  const store = getStore();
  store.version += 1;
  for (const listener of store.listeners) listener();
}

function readSavedNumber(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) ? value : fallback;
}

function ensureAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  const store = getStore();
  if (store.audio) return store.audio;

  const audio = new Audio();
  audio.preload = "metadata";
  audio.volume = Math.min(1, Math.max(0, readSavedNumber("ficonter:owner-music-volume", 0.75)));
  store.state.volume = audio.volume;

  audio.addEventListener("play", () => {
    store.state.playing = true;
    emit();
  });
  audio.addEventListener("pause", () => {
    store.state.playing = false;
    emit();
  });
  audio.addEventListener("timeupdate", () => {
    store.state.currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    emit();
  });
  audio.addEventListener("durationchange", () => {
    store.state.duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    emit();
  });
  audio.addEventListener("ended", () => {
    if (store.state.repeat) {
      audio.currentTime = 0;
      void audio.play();
      return;
    }
    playAdjacent(1);
  });
  audio.addEventListener("error", () => {
    store.state.playing = false;
    emit();
  });

  store.audio = audio;
  return audio;
}

function currentIndex(): number {
  const { tracks, currentId } = getStore().state;
  return tracks.findIndex((track) => track.id === currentId);
}

function setMediaSession(track: OwnerMusicTrack | undefined) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator) || !track) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: "FICONTER Owner Music",
      album: "Private workspace",
      artwork: [
        { src: `${window.location.origin}/ficonter-app-icon.png`, sizes: "512x512", type: "image/png" },
      ],
    });
  } catch {
    // Media Session is optional browser enhancement only.
  }
}

function installMediaHandlers() {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  const mediaSession = navigator.mediaSession;
  const safe = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
    try { mediaSession.setActionHandler(action, handler); } catch { /* unsupported action */ }
  };
  safe("play", () => void play());
  safe("pause", pause);
  safe("previoustrack", () => playAdjacent(-1));
  safe("nexttrack", () => playAdjacent(1));
  safe("seekto", (details) => {
    if (typeof details.seekTime === "number") seek(details.seekTime);
  });
}

export function subscribeOwnerMusic(listener: () => void) {
  const store = getStore();
  store.listeners.add(listener);
  ensureAudio();
  installMediaHandlers();
  return () => store.listeners.delete(listener);
}

export function getOwnerMusicVersion(): number {
  return getStore().version;
}

export function getOwnerMusicSnapshot(): PlayerState {
  return getStore().state;
}

export function setOwnerMusicTracks(tracks: OwnerMusicTrack[]) {
  const store = getStore();
  const previousTrack = store.state.tracks.find((track) => track.id === store.state.currentId);
  store.state.tracks = tracks;

  if (store.state.currentId && !tracks.some((track) => track.id === store.state.currentId)) {
    store.state.currentId = null;
    const audio = ensureAudio();
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
  } else if (previousTrack && store.state.currentId) {
    const refreshed = tracks.find((track) => track.id === store.state.currentId);
    const audio = ensureAudio();
    if (audio && refreshed && !store.state.playing && audio.src !== refreshed.url) {
      audio.src = refreshed.url;
    }
  }

  emit();
}

export async function selectAndPlay(trackId: string) {
  const store = getStore();
  const track = store.state.tracks.find((item) => item.id === trackId);
  if (!track) return;
  const audio = ensureAudio();
  if (!audio) return;

  if (store.state.currentId !== trackId || audio.src !== track.url) {
    store.state.currentId = trackId;
    store.state.currentTime = 0;
    store.state.duration = 0;
    audio.src = track.url;
    setMediaSession(track);
    emit();
  }

  await audio.play();
}

export async function play() {
  const store = getStore();
  if (!store.state.currentId && store.state.tracks[0]) {
    return selectAndPlay(store.state.tracks[0].id);
  }
  const audio = ensureAudio();
  if (!audio) return;
  await audio.play();
}

export function pause() {
  ensureAudio()?.pause();
}

export function togglePlay() {
  return getStore().state.playing ? pause() : void play();
}

export function playAdjacent(direction: -1 | 1) {
  const store = getStore();
  const { tracks, shuffle } = store.state;
  if (tracks.length === 0) return;

  if (shuffle && tracks.length > 1) {
    const current = currentIndex();
    let next = current;
    while (next === current) next = Math.floor(Math.random() * tracks.length);
    void selectAndPlay(tracks[next].id);
    return;
  }

  const index = currentIndex();
  const base = index < 0 ? (direction > 0 ? -1 : 0) : index;
  const next = (base + direction + tracks.length) % tracks.length;
  void selectAndPlay(tracks[next].id);
}

export function seek(seconds: number) {
  const audio = ensureAudio();
  if (!audio || !Number.isFinite(seconds)) return;
  audio.currentTime = Math.max(0, Math.min(seconds, Number.isFinite(audio.duration) ? audio.duration : seconds));
}

export function setVolume(value: number) {
  const audio = ensureAudio();
  if (!audio) return;
  const volume = Math.max(0, Math.min(1, value));
  audio.volume = volume;
  getStore().state.volume = volume;
  try { window.localStorage.setItem("ficonter:owner-music-volume", String(volume)); } catch { /* optional persistence */ }
  emit();
}

export function toggleShuffle() {
  const store = getStore();
  store.state.shuffle = !store.state.shuffle;
  emit();
}

export function toggleRepeat() {
  const store = getStore();
  store.state.repeat = !store.state.repeat;
  emit();
}

export function stopIfTrack(trackId: string) {
  const store = getStore();
  if (store.state.currentId !== trackId) return;
  const audio = ensureAudio();
  audio?.pause();
  if (audio) {
    audio.removeAttribute("src");
    audio.load();
  }
  store.state.currentId = null;
  store.state.currentTime = 0;
  store.state.duration = 0;
  emit();
}
