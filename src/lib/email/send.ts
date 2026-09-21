import "server-only";
import { createTransport, type Transporter } from "nodemailer";

/**
 * One SMTP transport for the whole app. Gmail in development, MMCY's mail
 * server later: which one is a matter of the SMTP_* variables, never of the
 * code here.
 *
 * "server-only" makes a client import a build error rather than a leaked
 * SMTP password.
 */

export type SendResult = { ok: true } | { ok: false; error: string };

type Message = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

let transport: Transporter | null = null;

function getTransport(): Transporter {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    transport = createTransport({
      host: process.env.SMTP_HOST,
      port,
      // 465 is implicit TLS; 587 starts plaintext and upgrades with STARTTLS.
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transport;
}

/**
 * Outside production, nothing is delivered to the address on the row. The
 * test accounts are @ex.com — a real domain belonging to someone else, so
 * mailing them would be sending strangers our notifications.
 *
 * Every message goes to EMAIL_REDIRECT_TO instead, and if that is not set
 * nothing is sent at all. Refusing to send is the only safe default: the
 * alternative failure mode is silent and lands in a stranger's inbox.
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
    await getTransport().sendMail({
      from: process.env.EMAIL_FROM,
      to: resolved.address,
      subject: `${resolved.subjectPrefix}${message.subject}`,
      text: message.text,
      html: message.html,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
