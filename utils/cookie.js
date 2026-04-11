/**
 * Cookie helpers — centralised config for the HttpOnly refresh token cookie
 *
 * Security properties:
 *   httpOnly  — JS cannot read it (XSS-proof)
 *   secure    — HTTPS only in production
 *   sameSite  — "strict" in production, "lax" in dev (allows cross-origin dev tools)
 *   path      — scoped to /api/admin/auth so it is NOT sent on every request
 */

const IS_PROD = process.env.NODE_ENV === "production";

// How long the refresh token cookie lives (matches JWT_REFRESH_IN)
const REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const REFRESH_COOKIE_NAME = "admin_refresh_token";

export const refreshCookieOptions = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "none",
  maxAge: REFRESH_MAX_AGE_MS,
  path: "/api/admin/auth", // cookie only sent to auth endpoints
};

/** Set the HttpOnly refresh token cookie on a response */
export const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions);
};

/** Clear the refresh token cookie (on logout) */
export const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "none",
    path: "/api/admin/auth",
  });
};
