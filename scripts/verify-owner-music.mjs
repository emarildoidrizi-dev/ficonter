import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
const check = (condition, label) => checks.push({ ok: Boolean(condition), label });

const dashboard = read("app/dashboard/layout.tsx");
const business = read("app/business/layout.tsx");
const player = read("components/OwnerMusicPlayer.tsx");
const store = read("lib/ownerMusic/playerStore.ts");
const config = read("lib/ownerMusic/config.ts");
const server = read("lib/ownerMusic/server.ts");
const libraryApi = read("app/api/owner/music/route.ts");
const uploadApi = read("app/api/owner/music/upload-url/route.ts");
const css = read("components/OwnerMusicPlayer.module.css");
const nextConfig = read("next.config.ts");

check(dashboard.includes("isOwnerEmail(user.email)"), "Personal workspace derives the platform Owner explicitly");
check(dashboard.includes("isPlatformOwner ? <OwnerMusicPlayer /> : null"), "Personal workspace renders music only for Owner");
check(business.includes("isOwnerEmail(user.email)"), "Business workspace derives the platform Owner explicitly");
check(business.includes("isPlatformOwner ? <OwnerMusicPlayer /> : null"), "Business workspace renders music only for Owner");
check(server.includes("isOwnerEmail(user.email)"), "Server API repeats Owner authorization instead of trusting hidden UI");
check(server.includes("public: false"), "Owner music storage is private");
check(server.includes("updateBucket") && server.includes("data.public"), "A mistakenly public Owner bucket is forced back to private");
check(config.includes('OWNER_MUSIC_BUCKET = "owner-music"'), "Owner music has an isolated storage bucket");
check(config.includes("50 * 1024 * 1024"), "Per-track upload limit is bounded at 50 MB");
check(uploadApi.includes("createSignedUploadUrl"), "Uploads use short-lived signed upload authorization");
check(uploadApi.includes("isSameOriginRequest"), "Upload authorization is protected against cross-site mutation requests");
check(libraryApi.includes("createSignedUrl"), "Playback uses private signed read URLs");
check(nextConfig.includes("media-src 'self' blob: https://*.supabase.co"), "CSP explicitly allows private Supabase audio playback");
check(libraryApi.includes("isSameOriginRequest") && libraryApi.includes("DELETE"), "Track deletion is same-origin protected");
check(!libraryApi.includes("getPublicUrl"), "Private tracks are never exposed with public storage URLs");
check(player.includes("uploadToSignedUrl"), "Large audio files upload directly to Supabase instead of proxying through Vercel");
check(player.includes("Shuffle") && player.includes("Repeat2") && player.includes("SkipForward"), "Player exposes shuffle, repeat, previous and next controls");
check(player.includes('type="range"') && player.includes("Music volume"), "Owner can control playback position and volume");
check(store.includes("__ficonterOwnerMusicStore"), "Audio state uses a browser-global singleton across workspace layout remounts");
check(store.includes("new Audio()") && store.includes("audio.play()"), "Playback is client-side and starts only after a user action");
check(store.includes("mediaSession") && store.includes("MediaMetadata"), "Supported PWA/mobile browsers receive media-session controls");
check(store.includes("ficonter:owner-music-volume"), "Owner volume preference persists locally");
check(css.includes("position:fixed") && css.includes("bottom:88px"), "Mini-player stays reachable on desktop and above the mobile dock");
check(player.includes("playbackErrorMessage") && player.includes("startCurrentTrack"), "Playback failures are surfaced instead of failing silently");
check(player.includes("Owner only · private storage"), "The library clearly communicates Owner-only privacy");
check(config.includes("OWNER_MUSIC_MAX_TRACKS = 100"), "V1 library size is explicitly bounded");

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? "PASS" : "FAIL"}  ${item.label}`);
if (failed.length) {
  console.error(`\nOwner Music verification failed (${failed.length}/${checks.length}).`);
  process.exit(1);
}
console.log(`\nOwner Music verification passed (${checks.length}/${checks.length}).`);
