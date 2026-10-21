import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mjacopoleo.shoppinglist",
  appName: "Courses",
  webDir: "dist",
  plugins: {
    // Keep the entire WebView within system bars/cutouts, including older WebViews.
    SystemBars: { insetsHandling: "native", style: "LIGHT" },
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
