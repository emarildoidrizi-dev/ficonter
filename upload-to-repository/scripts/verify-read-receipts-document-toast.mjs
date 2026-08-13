import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [
  ["lib/supportMessaging.ts", /SUPPORT_READ_EVENT\s*=\s*"ficonter:support-read"/, "shared support-read event"],
  ["components/SupportConversations.tsx", /new CustomEvent<SupportReadEventDetail>\(SUPPORT_READ_EVENT/, "customer read event"],
  ["components/SupportInbox.tsx", /audience:\s*"admin"/, "admin read event"],
  ["components/NotificationCenter.tsx", /addEventListener\(SUPPORT_READ_EVENT/, "immediate badge listener"],
  ["components/NotificationCenter.tsx", /notificationsRef\.current\s*=\s*next/, "optimistic notification state"],
  ["app/api/support/threads/[id]/read/route.ts", /\.eq\("href", `\/dashboard\/inbox\?thread=\$\{id\}`\)/, "persistent thread-notification read state"],
  ["app/api/support/threads/[id]/read/route.ts", /\.in\("kind", \["support_reply", "support_status"\]\)/, "support notification scope"],
  ["components/DocumentVault.tsx", /setTimeout\(\(\) => setSuccess\(""\), 5_000\)/, "five-second success dismissal"],
];

let failures = 0;
for (const [file, pattern, label] of checks) {
  const ok = pattern.test(read(file));
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failures += 1;
}
if (failures) process.exit(1);
console.log(`Passed ${checks.length} read-state and document-toast checks.`);
