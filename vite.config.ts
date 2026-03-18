import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import {
  buildRuntimeTruthApiResponse,
} from "./src/journal/runtimeTruthServer";
import { resolveJournalDirectoryPath } from "./src/journal/journalDirectory";

function runtimeTruthApiPlugin(journalDirectoryPath: string): Plugin {
  return {
    name: "runtime-truth-api-bridge",
    configureServer(server) {
      server.middlewares.use("/api/runtime-truth", (req, res) => {
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        try {
          const payload = buildRuntimeTruthApiResponse({ journalDirectoryPath });
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(payload));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            error: error instanceof Error ? error.message : "Failed to read runtime truth",
          }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const journalDirectoryPath = resolveJournalDirectoryPath(env, { cwd: process.cwd() });

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      runtimeTruthApiPlugin(journalDirectoryPath),
      mode === "development" && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
