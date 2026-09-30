import type { Config } from "@react-router/dev/config";

export default {
  // SSR for SEO and fast first paint; most visitors are anonymous readers.
  ssr: true,
} satisfies Config;
