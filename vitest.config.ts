import { defineConfig } from "vitest/config";
import path from "path";

// Run date logic in the timezone the app is used in, so local-vs-UTC
// date bugs (e.g. toISOString() on a local midnight) show up in tests.
process.env.TZ = "Asia/Kolkata";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
