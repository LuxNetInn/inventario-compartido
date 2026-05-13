export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Local auth: login page is served within the app, no external OAuth needed.
export const getLoginUrl = (_returnPath?: string) => "/login";
