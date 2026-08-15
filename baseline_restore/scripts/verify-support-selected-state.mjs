import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = {
  admin: path.join(root, "components", "SupportInbox.tsx"),
  customer: path.join(root, "components", "SupportConversations.tsx"),
};

for (const file of Object.values(files)) {
  if (!fs.existsSync(file)) throw new Error(`Missing required file: ${file}`);
}

const admin = fs.readFileSync(files.admin, "utf8");
const customer = fs.readFileSync(files.customer, "utf8");

const checks = [
  [admin.includes("useState<string | null>"), "Admin selected thread state is explicitly nullable"],
  [admin.includes("const refreshedRequests: AdminSupportRequest[] = data.requests;"), "Admin refresh payload is narrowed once"],
  [!admin.includes("data.requests?.some"), "Admin state updater does not re-read an optional payload"],
  [customer.includes("useState<string | null>"), "Customer selected thread state is explicitly nullable"],
  [customer.includes("const refreshedThreads = data.threads;"), "Customer refresh payload is narrowed once"],
  [!customer.includes("data.threads?.some"), "Customer state updater does not re-read an optional payload"],
];

const failures = checks.filter(([passed]) => !passed);
if (failures.length) {
  for (const [, label] of failures) console.error(`FAIL: ${label}`);
  process.exit(1);
}

for (const [, label] of checks) console.log(`PASS: ${label}`);
console.log(`Support selected-state verification passed (${checks.length} checks).`);
