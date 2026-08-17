import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const extensions = new Set([".tsx", ".ts", ".jsx", ".js"]);
const ignored = new Set(["node_modules", ".next", ".git"]);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (extensions.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

const files = walk(root);
const violations = [];

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const lines = source.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lower = line.toLowerCase();
    const moneyish =
      lower.includes("amount") ||
      lower.includes("budget") ||
      lower.includes("balance") ||
      lower.includes("price") ||
      lower.includes("cost") ||
      lower.includes("payment") ||
      lower.includes("income") ||
      lower.includes("expense");

    if (
      moneyish &&
      /type=["']number["']/.test(line)
    ) {
      violations.push(
        `${path.relative(root, file)}:${index + 1}: possible money field still uses type="number"`,
      );
    }
  });
}

if (violations.length) {
  console.error("FICONTER global money input audit failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("FICONTER global money input audit passed.");
