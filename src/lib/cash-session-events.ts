/**
 * Cash session change notifications.
 *
 * The layout header is a client component that reads the active cash session
 * itself (see components/layout/header.tsx) instead of receiving it as a prop
 * from a server component. That means `router.refresh()` / `revalidatePath()`
 * cannot update it — only a remount or its own polling interval can.
 *
 * This tiny event bus lets the cash page tell the header to re-read the session
 * the moment a session is opened or closed, so the status chip flips instantly
 * instead of waiting for the poll.
 */

/** Fired after a cash session is opened or closed. */
export const CASH_SESSION_CHANGED_EVENT = "cash-session-changed";

/**
 * Tell every mounted listener that the active cash session changed.
 *
 * `session` is the new active session, or `null` once it has been closed.
 * Passing it lets the header repaint without an extra round-trip.
 *
 * Safe to call from anywhere: no-ops during SSR, where `window` is undefined.
 */
export function notifyCashSessionChanged(
  session: { openingCash?: number | string } | null = null
): void {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(CASH_SESSION_CHANGED_EVENT, {
      detail: { session },
    })
  );
}
