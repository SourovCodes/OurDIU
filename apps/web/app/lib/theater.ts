// Theater mode on a question's page (from `lg`): the paper and the lists beside it
// span the window's width instead of the page's. A cookie rather than localStorage, so the server
// renders the page in it (no jump after loading).

const COOKIE = "qb_theater";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Whether a Cookie header has theater mode on. */
export function theaterFromCookie(cookieHeader: string | null) {
  return new RegExp(`(?:^|;\\s*)${COOKIE}=1(?:;|$)`).test(cookieHeader ?? "");
}

/** Remembers the choice in the browser. */
export function rememberTheater(on: boolean) {
  document.cookie = on
    ? `${COOKIE}=1; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`
    : `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
