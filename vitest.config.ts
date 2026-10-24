import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({ define: { __APP_VERSION__: JSON.stringify("0.5.0") }, plugins: [react()], test: { environment: "jsdom", include: ["tests/**/*.test.{ts,tsx}"] } });
