/** Cookie names only, so proxy.ts doesn't pull in the session/config modules. */
export const SESSION_COOKIE = 'sc_session'
export const SECURE_SESSION_COOKIE = `__Host-${SESSION_COOKIE}`
