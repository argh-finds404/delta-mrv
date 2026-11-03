// Where to send someone after sign-in. The value comes from a URL, so it is untrusted:
// only a plain path on this origin is returned, never anything that can leave it.

/** A same-origin path, or null. Rejects absolute URLs, `//host`, backslashes, control characters. */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw.includes("\\") || /[\u0000-\u001f\u007f]/.test(raw)) return null;
  // returning someone to an auth page just loops
  if (/^\/(sign-in|sign-up|demo)(?:[/?#]|$)/.test(raw)) return null;
  return raw;
}

/** The sign-in URL that remembers where the visitor was going. */
export function signInRedirect(pathname: string, search = ""): string {
  return `/sign-in?next=${encodeURIComponent(pathname + search)}`;
}
