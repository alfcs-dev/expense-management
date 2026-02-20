import { redirect } from "@tanstack/react-router";
import { env } from "../env";

type SessionResponse = {
  user?: {
    id: string;
    email: string;
    name: string | null;
  };
} | null;

export type RouterAuthContext = {
  getSession: () => Promise<SessionResponse>;
  invalidateSession: () => void;
};

const AUTH_SESSION_CACHE_MS = 5000;

let cachedSession: SessionResponse = null;
let cacheExpiresAt = 0;
let inFlightSessionRequest: Promise<SessionResponse> | null = null;

async function fetchSession(): Promise<SessionResponse> {
  const response = await fetch(`${env.VITE_API_URL}/api/auth/get-session`, {
    credentials: "include",
  });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as SessionResponse;
}

async function getSession(): Promise<SessionResponse> {
  const now = Date.now();
  if (cachedSession?.user && now < cacheExpiresAt) {
    return cachedSession;
  }

  if (inFlightSessionRequest) {
    return inFlightSessionRequest;
  }

  inFlightSessionRequest = fetchSession()
    .then((session) => {
      if (session?.user) {
        cachedSession = session;
        cacheExpiresAt = Date.now() + AUTH_SESSION_CACHE_MS;
      } else {
        cachedSession = null;
        cacheExpiresAt = 0;
      }
      return session;
    })
    .finally(() => {
      inFlightSessionRequest = null;
    });

  return inFlightSessionRequest;
}

function invalidateSession() {
  cachedSession = null;
  cacheExpiresAt = 0;
}

export const authRouterContext: RouterAuthContext = {
  getSession,
  invalidateSession,
};

function getSignInRedirect(searchRedirect?: string) {
  if (searchRedirect) {
    return { redirect: searchRedirect };
  }
  return undefined;
}

export function resolvePostAuthPath(redirectParam?: string): string {
  if (!redirectParam) return "/";

  try {
    const url = new URL(redirectParam, window.location.origin);
    if (url.origin !== window.location.origin) return "/";
    return `${url.pathname}${url.search}${url.hash}` || "/";
  } catch {
    return redirectParam.startsWith("/") ? redirectParam : "/";
  }
}

export function toCallbackURL(path: string): string {
  return new URL(path, window.location.origin).toString();
}

export async function requireSession(auth: RouterAuthContext, attemptedPath?: string) {
  try {
    const session = await auth.getSession();
    if (!session?.user) {
      throw redirect({
        to: "/sign-in",
        search: getSignInRedirect(attemptedPath),
      });
    }
  } catch {
    throw redirect({
      to: "/sign-in",
      search: getSignInRedirect(attemptedPath),
    });
  }
}
