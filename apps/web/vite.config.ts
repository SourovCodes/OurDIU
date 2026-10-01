import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
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
    ],
  },
  server: {
    // Must match SITE_URL in wrangler.jsonc.
    port: 5173,
    strictPort: true,
  },
});
