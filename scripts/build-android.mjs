import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const tools = path.join(root, ".tools", "jdk21");
const candidates = [
  ...(fs.existsSync(tools) ? fs.readdirSync(tools).map((entry) => path.join(tools, entry)) : []),
  process.env.JAVA_HOME,
].filter(Boolean);
let javaHome;
for (const candidate of candidates) {
  const java = path.join(candidate, "bin", process.platform === "win32" ? "java.exe" : "java");
  const result = spawnSync(java, ["-version"], { encoding: "utf8" });
  const version = Number((result.stderr ?? "").match(/version "(\d+)/)?.[1]);
  if (result.status === 0 && version >= 21 && version <= 24) { javaHome = candidate; break; }
}
if (!javaHome) throw new Error("Configurez JAVA_HOME avec un JDK 21 (ou placez-le dans .tools/jdk21). Le JDK 25 n’est pas compatible avec ce Gradle.");
const env = { ...process.env, JAVA_HOME: javaHome };
const debug = process.argv.includes("--debug");
const signingConfig = path.join(root, ".tools", "signing", "config.json");
if (!debug && !env.SIGNING_STORE_FILE && fs.existsSync(signingConfig)) {
  Object.assign(env, JSON.parse(fs.readFileSync(signingConfig, "utf8")));
}
if (!debug && !env.SIGNING_STORE_FILE) throw new Error("Configurez la signature de publication. Voir docs/ANDROID_RELEASES.md. Pour une APK de test : npm run android:build -- --debug");
for (const command of ["npm run build", "npx cap sync android", `${process.platform === "win32" ? "android\\gradlew.bat" : "./android/gradlew"} -p android ${debug ? "assembleDebug" : "assembleRelease"} --console=plain`]) {
  const result = spawnSync(command, { cwd: root, env, shell: true, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const { version } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const variant = debug ? "debug" : "release";
const target = path.join(root, "release", `Courses-${version}${debug ? "-debug" : ""}.apk`);
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(path.join(root, `android/app/build/outputs/apk/${variant}/app-${variant}.apk`), target);
if (!debug) fs.copyFileSync(target, path.join(root, "release", "Courses.apk"));
console.log(`APK : ${target}`);
