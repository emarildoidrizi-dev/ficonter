import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];
let passed = 0;

function read(file) {
  const path = resolve(root, file);
  if (!existsSync(path)) {
    failures.push(`Missing ${file}`);
    return "";
  }
  return readFileSync(path, "utf8");
}

function check(label, condition) {
  if (condition) passed += 1;
  else failures.push(label);
}

const health = read("app/api/health/route.ts");
const env = read(".env.example");

check("Public liveness health check remains available", health.includes('status: "healthy"') && health.includes('service: "ficonter-web"'));
check("Deep health check is opt-in", health.includes('get("deep") === "1"'));
check("Deep health check is protected by a server-only token", health.includes("FICONTER_HEALTH_TOKEN") && health.includes("x-ficonter-health-token"));
check("Deep health check validates database reachability", health.includes('.from("subscriptions")') && health.includes("DATABASE_TIMEOUT_MS"));
check("Database failure reports degraded service", health.includes('status: "degraded"') && health.includes("503"));
check("Health responses disable caching", health.includes("noStoreHeaders"));
check("Health token is documented as server-only", env.includes("FICONTER_HEALTH_TOKEN=") && env.includes("Never expose this value through NEXT_PUBLIC_* variables"));

if (failures.length) {
  console.error(`Production resilience verification failed (${failures.length} issues):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Production resilience verification passed (${passed} checks).`);
