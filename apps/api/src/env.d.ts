// The bindings the API needs. It runs inside apps/web's Worker, whose wrangler.jsonc
// declares them; `wrangler types` there generates matching declarations that merge
// with these (vars are generated as plain strings, so the types agree). The API only
// generates runtime types, since the web Worker's generated Env imports its entry.
// Secrets aren't in wrangler.jsonc, so they are always declared here, whether or not
// a local .dev.vars exists (e.g. in CI).
// `wrangler types` declares the global `Env` and `Cloudflare.Env` as separate
// interfaces, so everything is added to both.
// GEMINI_API_KEY and COMPRESSOR_API_KEY may be unset locally; AI analysis then fails
// as "not configured".
// GOOGLE_EXTRA_CLIENT_IDS: other Google clients whose app sign-ins are accepted
// (see googleClientIds in lib/auth.ts).
// ADMIN_EMAILS is optional: a comma-separated list of addresses that are made admins
// when they sign up (admins can contribute without a DIU address).
interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  ANALYSIS_QUEUE: Queue;
  WATERMARK_QUEUE: Queue;
  UPLOAD_LIMITER: RateLimit;
  VOTE_LIMITER: RateLimit;
  REPORT_LIMITER: RateLimit;
  VIEW_LIMITER: RateLimit;
  SITE_URL: string;
  FILES_URL: string;
  PDF_PROCESSOR_URL: string;
  GEMINI_MODEL: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_EXTRA_CLIENT_IDS: string;
  GEMINI_API_KEY: string;
  COMPRESSOR_API_KEY: string;
  ADMIN_EMAILS: string;
}

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    BUCKET: R2Bucket;
    ANALYSIS_QUEUE: Queue;
    WATERMARK_QUEUE: Queue;
    UPLOAD_LIMITER: RateLimit;
    VOTE_LIMITER: RateLimit;
    REPORT_LIMITER: RateLimit;
    VIEW_LIMITER: RateLimit;
    SITE_URL: string;
    FILES_URL: string;
    PDF_PROCESSOR_URL: string;
    GEMINI_MODEL: string;
    BETTER_AUTH_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GOOGLE_EXTRA_CLIENT_IDS: string;
    GEMINI_API_KEY: string;
    COMPRESSOR_API_KEY: string;
    ADMIN_EMAILS: string;
  }
}
