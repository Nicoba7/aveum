import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import {
  buildRuntimeTruthApiResponse,
} from "./src/journal/runtimeTruthServer";
import { resolveJournalDirectoryPath } from "./src/journal/journalDirectory";
import {
  buildPlanningStyleApiResponse,
  resolvePlanningStyle,
  resolvePlanningStyleFromValue,
  writePersistedPlanningStyle,
  type PlanningStyleSourceEnvironment,
} from "./src/application/runtime/planningStyleStore";

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

function planningStyleApiPlugin(sourceEnvironment: PlanningStyleSourceEnvironment): Plugin {
  return {
    name: "planning-style-api-bridge",
    configureServer(server) {
      server.middlewares.use("/api/planning-style", (req, res) => {
        const sendJson = (statusCode: number, payload: unknown) => {
          res.statusCode = statusCode;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(payload));
        };

        if (req.method === "GET") {
          try {
            sendJson(200, buildPlanningStyleApiResponse(resolvePlanningStyle(sourceEnvironment)));
          } catch (error) {
            sendJson(500, {
              error: error instanceof Error ? error.message : "Failed to read planning style",
            });
          }
          return;
        }

        if (req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", () => {
            try {
              const parsed = JSON.parse(body || "{}") as { planningStyle?: string };
              const planningStyle = resolvePlanningStyleFromValue(parsed.planningStyle);
              if (!planningStyle) {
                sendJson(400, { error: "Invalid planning style" });
                return;
              }

              writePersistedPlanningStyle(planningStyle, sourceEnvironment);
              sendJson(200, buildPlanningStyleApiResponse(resolvePlanningStyle(sourceEnvironment)));
            } catch (error) {
              sendJson(400, {
                error: error instanceof Error ? error.message : "Invalid planning style payload",
              });
            }
          });
          return;
        }

        sendJson(405, { error: "Method not allowed" });
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
      planningStyleApiPlugin(env),
      mode === "development" && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
