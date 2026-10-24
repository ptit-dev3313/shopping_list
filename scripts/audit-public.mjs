import fs from "node:fs";
import { execFileSync } from "node:child_process";

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const forbiddenPath = /(^|\/)(?:\.tools|\.idea|\.vscode|private-notes|backups|release|node_modules|supabase)(\/|$)|(^|\/)\.env(?:\.|$)|\.(?:p12|pfx|pem|jks|keystore|key|dump|backup|bundle|sqlite3?|log)$/i;
const checks = [
  ["clé privée", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["jeton GitHub", /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ["clé secrète Supabase", /\bsb_secret_[A-Za-z0-9_-]{16,}/],
  ["jeton JWT", /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b/],
  ["adresse personnelle", /[\w.+-]+@(?:gmail|hotmail|outlook|icloud|protonmail|yahoo)\.[a-z.]+\b/i],
];
const failures = [];
for (const file of files) {
  if (file !== ".env.example" && forbiddenPath.test(file)) failures.push(`${file} : fichier privé ou local`);
  if (!fs.existsSync(file)) continue;
  const buffer = fs.readFileSync(file);
  if (buffer.includes(0)) continue;
  const content = buffer.toString("utf8");
  for (const [label, pattern] of checks) {
    const match = pattern.exec(content);
    if (match) failures.push(`${file}:${content.slice(0, match.index).split("\n").length} : ${label}`);
  }
  if (file === ".env.example" && /https:\/\/[a-z0-9]{20}\.supabase\.co/i.test(content)) failures.push(`${file} : utiliser un projet fictif`);
}
if (failures.length) {
  // Report locations, never the potentially sensitive values themselves.
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Audit public : ${files.length} fichiers suivis vérifiés, aucun motif bloquant détecté.`);
}
