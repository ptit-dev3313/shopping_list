import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const folder = path.resolve(import.meta.dirname, "../.tools/signing");
const configPath = path.join(folder, "config.json");
if (fs.existsSync(configPath)) { console.log("La signature est déjà configurée. Conservez une sauvegarde privée de .tools/signing."); process.exit(0); }
fs.mkdirSync(folder, { recursive: true });
const password = crypto.randomBytes(32).toString("base64url");
const keystore = path.join(folder, "courses.p12");
const previous = path.join(os.homedir(), ".android", "debug.keystore");
const env = { ...process.env, SIGNING_STORE_PASSWORD: password, SOURCE_SIGNING_PASSWORD: "android" };
const keytool = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "keytool.exe" : "keytool") : "keytool";
const args = fs.existsSync(previous) ? ["-importkeystore", "-srckeystore", previous, "-srcstorepass:env", "SOURCE_SIGNING_PASSWORD", "-srcalias", "androiddebugkey", "-destalias", "courses", "-destkeystore", keystore, "-deststoretype", "PKCS12", "-deststorepass:env", "SIGNING_STORE_PASSWORD", "-destkeypass:env", "SIGNING_STORE_PASSWORD", "-noprompt"] :
  ["-genkeypair", "-alias", "courses", "-keyalg", "RSA", "-keysize", "3072", "-validity", "10000", "-dname", "CN=Courses Android", "-keystore", keystore, "-storetype", "PKCS12", "-storepass:env", "SIGNING_STORE_PASSWORD", "-keypass:env", "SIGNING_STORE_PASSWORD"];
const result = spawnSync(keytool, args, { env, stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
fs.writeFileSync(configPath, JSON.stringify({ SIGNING_STORE_FILE: keystore, SIGNING_STORE_PASSWORD: password, SIGNING_KEY_ALIAS: "courses", SIGNING_KEY_PASSWORD: password }, null, 2), { mode: 0o600 });
console.log(fs.existsSync(previous) ? "Identité de signature existante conservée pour permettre la mise à jour de l’APK déjà installée." : "Nouvelle identité de signature créée.");
console.log("Configuration privée : .tools/signing. Sauvegardez ce dossier hors du dépôt public.");
