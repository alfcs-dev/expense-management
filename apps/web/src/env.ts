/**
 * Build-time and runtime env for the web app.
 * Vite exposes only variables prefixed with VITE_.
 */

export const env = {
  /** API base URL (no trailing slash). Default: local dev. */
  VITE_API_URL: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
} as const;
