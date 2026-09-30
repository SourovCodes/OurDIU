// The bindings the API needs. It runs inside apps/web's Worker, whose wrangler.jsonc
// declares them; `wrangler types` there generates matching declarations that merge
// with these (vars are generated as plain strings, so the types agree). The API only
// generates runtime types, since the web Worker's generated Env imports its entry.
// Secrets aren't in wrangler.jsonc, so they are always declared here, whether or not
// a local .dev.vars exists (e.g. in CI).
// `wrangler types` declares the global `Env` and `Cloudflare.Env` as separate
// interfaces, so everything is added to both.
// ADMIN_EMAILS is optional: a comma-separated list of addresses that may create an
// account without a DIU address, and are made admins when they do.
interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  SITE_URL: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  ADMIN_EMAILS: string;
}

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    BUCKET: R2Bucket;
    SITE_URL: string;
    BETTER_AUTH_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    ADMIN_EMAILS: string;
  }
}
