import type { Config } from "@react-router/dev/config";

export default {
  // SSR for SEO and fast first paint; most visitors are anonymous readers.
  ssr: true,
  // Ship the whole route manifest (3.6 KB gzipped, cached) up front. The default lazy
  // discovery made /__manifest the Worker's busiest path and delayed link clicks by a
  // round trip (docs/PLAN.md, decision 27).
  routeDiscovery: { mode: "initial" },
} satisfies Config;
