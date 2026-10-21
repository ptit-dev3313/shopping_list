import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
const packageInfo = JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(packageInfo.version) },
  plugins: [react()],
  base: "./",
  server: {
    host: true,
    port: 5173,
  },
});
