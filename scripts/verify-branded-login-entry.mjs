import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (name) => readFileSync(path.join(root, name), "utf8");

const component = read("components/BrandedLoginEntrance.tsx");
const css = read("components/BrandedLoginEntrance.module.css");
const login = read("app/login/page.tsx");
const manifest = read("app/manifest.ts");
const home = read("app/page.tsx");
const dashboardLayout = read("app/dashboard/layout.tsx");
const businessLayout = read("app/business/layout.tsx");

const checks = [
  ["PWA opens the login route directly", manifest.includes('start_url: "/login?entry=app"')],
  ["Login page renders the branded entrance", login.includes("<BrandedLoginEntrance />")],
  ["App and brand entry intents are explicit", login.includes('params.entry === "app"') && login.includes('params.entry === "brand"')],
  ["Authenticated users bypass login and continue to dashboard", login.includes('if (user) redirect("/dashboard")')],
  ["Desktop protected shell uses branded login recovery", dashboardLayout.includes('redirect("/login?entry=app")')],
  ["Business protected shell uses branded login recovery", businessLayout.includes('redirect("/login?entry=app")')],
  ["Public landing login links request the entrance", (home.match(/href="\/login\?entry=brand"/g) ?? []).length >= 3],
  ["Entrance uses the canonical FICONTER mark", component.includes('src="/ficonter-mark.svg"')],
  ["Entrance identifies FICONTER Financial Control Center", component.includes("FICONTER") && component.includes("Financial Control Center")],
  ["Entrance is a client visual layer without a route hop", component.includes('"use client"') && !component.includes("router.push") && !component.includes("router.replace") && !component.includes("window.location.assign")],
  ["Entrance query is cleaned without adding browser history", component.includes("window.history.replaceState")],
  ["Normal entrance stays under one second", component.includes("STANDARD_DURATION_MS = 980")],
  ["Reduced-motion timing is short", component.includes("REDUCED_MOTION_DURATION_MS = 300")],
  ["Bounce/settle animation is restrained", css.includes("@keyframes emblemArrival") && css.includes("scale(1.075)") && css.includes("scale(0.985)")],
  ["Entrance fades instead of disappearing abruptly", css.includes("@keyframes entranceFade")],
  ["Reduced-motion accessibility is present", css.includes("@media (prefers-reduced-motion: reduce)")],
  ["Entrance sits above the already-rendered login form", css.includes("position: fixed") && css.includes("z-index: 10000")],
  ["Brand animation is responsive on phones", css.includes("@media (max-width: 640px)")],
];

let failures = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failures += 1;
}

if (failures) {
  console.error(`\nBranded login entry verification failed (${failures}/${checks.length}).`);
  process.exit(1);
}

console.log(`\nBranded login entry verification passed (${checks.length}/${checks.length}).`);
