/**
 * Evidence locations are free text; these decide when one is a web link.
 * Shared by the list (render as <a>?), the add dialog and the server-side
 * schema, so all three agree. Client-safe: no server imports.
 *
 * Only http and https are ever links. javascript:, data: and the rest are
 * rejected, not rendered — an href is executable in a way text is not.
 */

/** An http(s) URL, or null for anything else. */
export function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/**
 * What the user meant to type: "github.com/org/repo" becomes
 * "https://github.com/org/repo". Anything already carrying a scheme is left
 * alone so parseHttpUrl can refuse it — prefixing "javascript:alert(1)"
 * would turn it into a host name instead. "host:8080/x" is a port, not a
 * scheme, and gets the prefix.
 */
export function withScheme(raw: string): string {
  const value = raw.trim();
  if (value === "") return value;
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(value)) return value;
  return `https://${value}`;
}

export const INVALID_URL_MESSAGE = "Enter a web address starting with http:// or https://.";
