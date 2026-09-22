import "server-only";
import { Resend } from "resend";

/**
 * Mail goes out through Resend's HTTPS API rather than SMTP. Outbound SMTP
 * does not survive this network — the last nodemailer attempt died on
 * "Connection timeout" — and 443 works wherever the browser works. Only the
 * transport changed: the redirect rule below, and the rule that an email
 * carries no document content, are unchanged.
 *
 * Until MMCY's domain is verified in Resend, the API only accepts mail
 * addressed to the account owner and only from onboarding@resend.dev.
 * Production needs that domain verified before an email can reach anyone
 * else; until then Resend answers anything wider with a 403, which lands on
 * the row as email_error.
 *
 * "server-only" makes a client import a build error rather than a leaked
 * API key. RESEND_API_KEY is server-side and must never become NEXT_PUBLIC_.
 */

export type SendResult = { ok: true } | { ok: false; error: string };

type Message = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

let client: Resend | null = null;

// Built on first use, inside sendEmail's try: the constructor throws when
// RESEND_API_KEY is missing, and a missing key belongs on the row as
// email_error, not as an unhandled rejection inside after().
function getClient(): Resend {
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

/**
 * Outside production, nothing is delivered to the address on the row. The
 * test accounts are @ex.com — a real domain belonging to someone else, so
 * mailing them would be sending strangers our notifications.
 *
 * Every message goes to EMAIL_REDIRECT_TO instead, and if that is not set
 * nothing is sent at all. Refusing to send is the only safe default: the
 * alternative failure mode is silent and lands in a stranger's inbox. This
 * stays the first guard even now that Resend would refuse an unknown
 * recipient itself — that refusal is the second one, not a replacement.
 */
type Recipient =
  | { ok: true; address: string; subjectPrefix: string }
  | { ok: false; error: string };

function resolveRecipient(to: string): Recipient {
  if (process.env.NODE_ENV === "production") {
    return { ok: true, address: to, subjectPrefix: "" };
  }

  const redirect = process.env.EMAIL_REDIRECT_TO?.trim();
  if (!redirect) {
    return { ok: false, error: "skipped: no redirect" };
  }

  // The real recipient goes in the subject: one inbox receives mail meant for
  // several people, and without it a test cannot tell who each one was for.
  return { ok: true, address: redirect, subjectPrefix: `[to: ${to}] ` };
}

export async function sendEmail(message: Message): Promise<SendResult> {
  const resolved = resolveRecipient(message.to);
  if (!resolved.ok) return resolved;

  try {
    const { error } = await getClient().emails.send({
      from: process.env.EMAIL_FROM ?? "",
      to: resolved.address,
      subject: `${resolved.subjectPrefix}${message.subject}`,
      text: message.text,
      html: message.html,
    });

    // The SDK resolves on failure rather than rejecting, so a refused send
    // arrives here as an ordinary value. Returning ok without reading this
    // would record Resend's 403 as a delivered email.
    if (error) {
      return {
        ok: false,
        error: `${error.name} (${error.statusCode ?? "no status"}): ${error.message}`,
      };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
