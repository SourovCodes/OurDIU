import type { D1Migration } from "cloudflare:test";
import type * as Main from "../src/index";

declare global {
  namespace Cloudflare {
    interface Env {
      // Injected in vitest.config.ts
      TEST_MIGRATIONS: D1Migration[];
    }
    // Tests run the API on its own (`main` in vitest.config.ts), so `exports` is its
    // handler. Declared here, not in src, where it'd clash with the web Worker's.
    interface GlobalProps {
      mainModule: typeof Main;
    }
  }
}
