import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { execSync } from "child_process";
import { existsSync } from "fs";

// Plugin to update APP_VERSION from git tags before build
function versionUpdatePlugin(): Plugin {
  return {
    name: "version-update",
    buildStart() {
      const scriptPath = path.resolve(__dirname, "scripts/update-version.sh");
      if (existsSync(scriptPath)) {
        try {
          console.log("📦 Updating APP_VERSION from git tags...");
          execSync(`bash "${scriptPath}"`, { stdio: "inherit" });
        } catch (error) {
          // Non-fatal: continue build even if version update fails
          console.warn("⚠️ Version update skipped:", (error as Error).message);
        }
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode === "production" && versionUpdatePlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
