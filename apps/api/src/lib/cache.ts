/** Workers Cache's purge; tests replace it (with caching off there is none). */
export const workersCache = {
  async purge(options: CachePurgeOptions): Promise<CachePurgeResult | null> {
    // Loaded here, not at the top: the OpenAPI export (scripts/) runs the app in Node.
    const { cache } = await import("cloudflare:workers");
    // Without caching (turned off, local dev) Workers have no purge().
    return typeof cache?.purge === "function" ? cache.purge(options) : null;
  },
};
