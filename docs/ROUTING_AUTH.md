# Routing and Auth Flow

## Goal

Make the app workflow-first:
- `/` is the primary authenticated app entry (dashboard).
- Unauthenticated users are redirected to `/sign-in`.
- Auth UI is isolated to a public route.

## Route Map

- `"/"`: protected dashboard home.
- `"/dashboard"`: optional legacy alias that redirects to `"/"`.
- `"/accounts"`: protected.
- `"/budgets"`: protected.
- `"/categories"`: protected.
- `"/expenses"`: protected.
- `"/recurring-expenses"`: protected.
- `"/sign-in"`: public sign-in screen.
- `"/register"`: public account creation screen.

## Guarding Strategy

- Use TanStack Router route-level guard on a pathless protected parent route.
- `beforeLoad` checks session through router context (`context.auth.getSession()`).
- If no session, redirect to `"/sign-in"`.

## Sign-Out Behavior

- On sign-out, invalidate cached router session state.
- Redirect to `"/sign-in"` immediately.

## Redirect Behavior

- If a user opens `"/sign-in"` while already authenticated, redirect to `"/"`.
- If a user opens `"/register"` while already authenticated, redirect to `"/"`.
- Protected-route guard appends `?redirect=<attempted-path>` when sending users to `"/sign-in"`.
- Sign-in and register preserve the `redirect` query parameter between each other.
- Auth callback URL resolves from `redirect` (same-origin only), otherwise falls back to `"/"`.

## Runtime Session Expiry

- Route entry protection is handled by `protected.beforeLoad`.
- Runtime `UNAUTHORIZED` responses (queries/mutations after app load) are handled globally in `main.tsx` using React Query `QueryCache` and `MutationCache` `onError`.
- Global handler behavior:
  - invalidates cached auth router context
  - redirects to `"/sign-in"` with `redirect=<current-url>`
  - avoids redirect loops while already on auth routes
