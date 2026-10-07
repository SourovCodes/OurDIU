import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { E2E_PORT, E2E_STATE } from "./e2e/env";

// The e2e tests' server (CLOUDFLARE_ENV=e2e, see playwright.config.ts) runs beside
// `pnpm dev`, so it needs its own port, local state, dep cache and no debugger port.
const e2e = process.env.CLOUDFLARE_ENV === "e2e";

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: "ssr" },
      ...(e2e && { persistState: { path: E2E_STATE }, inspectorPort: false }),
    }),
    tailwindcss(),
    reactRouter(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  optimizeDeps: {
    // Pre-bundle client deps at startup. Otherwise Vite discovers them on first page
    // visit and force-reloads the page, which also breaks the first e2e run.
    include: [
      "class-variance-authority",
      "cmdk",
      "cn",
      "lucide-react",
      "radix-ui",
      "react-easy-crop",
      "recharts",
      "sonner",
      // Imported lazily after load (lib/analytics.ts), so the startup scan misses it.
      "web-vitals/attribution",
    ],
  },
  ...(e2e && { cacheDir: "node_modules/.vite-e2e" }),
  server: {
    // Must match SITE_URL (wrangler.jsonc; `.dev.vars.e2e` for the e2e server).
    port: e2e ? E2E_PORT : 5173,
    strictPort: true,
  },
});
