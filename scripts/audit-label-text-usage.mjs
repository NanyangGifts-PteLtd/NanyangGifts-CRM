import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const ignored = new Set(["node_modules", ".next", ".git"]);
const files = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name)) walk(join(directory, entry.name));
    } else if (/\.(ts|tsx)$/.test(entry.name)) files.push(join(directory, entry.name));
  }
}
walk(root);

// Fixed business label decisions must use an option ID or system key, never
// the display text. This deliberately excludes generic field persistence.
const patterns = [
  /\.(?:currency|channel|importance|replyStatus|paymentStatus)\s*(?:===|!==)\s*["']/,
  /\b(?:client|subitem|c|s)\.status\s*(?:===|!==)\s*["']/,
  /["'](?:RMB|MYR|SGD|Awarded|Quoted|Shortlisted|Waiting|New Lead|Email|Forms)["']\s*={2,3}\s*[^\n]*(?:currency|status|channel|importance)/,
];
const findings = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.includes("typeof ") && patterns.some((pattern) => pattern.test(line)))
      findings.push(`${file.slice(root.length + 1)}:${index + 1}: ${line.trim()}`);
  });
}
if (findings.length) {
  console.error("Direct fixed label-text comparisons found:\n" + findings.join("\n"));
  process.exit(1);
}
console.log("No direct fixed label-text comparisons found.");
