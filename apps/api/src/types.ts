import type { Auth, AuthSession } from "./lib/auth";
import type { Database } from "./db/client";

export type AppEnv = {
  Bindings: Env;
  Variables: {
    db: Database;
    auth: Auth;
    session: AuthSession | null;
  };
};

/** Env for handlers mounted behind `requireAuth`, where a session is guaranteed. */
export type AuthedAppEnv = AppEnv & {
  Variables: { session: AuthSession };
};
