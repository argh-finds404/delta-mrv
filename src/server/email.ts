import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

// The one way Delta sends email: verification links and password resets. Resend's HTTP API (free
// tier, no SDK) when RESEND_API_KEY and EMAIL_FROM are set; on a development machine, a JSON file
// per message in EMAIL_OUTBOX_DIR instead, so the local stack and its browser tests can follow the
// link. With neither, there is no email, and accounts work as before: no verification required.

export type Mail = { to: string; subject: string; text: string; html: string };
type Transport = "resend" | "outbox" | null;
type EmailEnv = { RESEND_API_KEY?: string; EMAIL_FROM?: string; EMAIL_OUTBOX_DIR?: string };

// Read on each call, like OPERATOR_EMAILS, so a test can switch email on for one case; the boot
// check in src/env.ts has already refused a malformed value. "" counts as unset.
const live = (): EmailEnv => ({ RESEND_API_KEY: process.env.RESEND_API_KEY || undefined, EMAIL_FROM: process.env.EMAIL_FROM || undefined, EMAIL_OUTBOX_DIR: process.env.EMAIL_OUTBOX_DIR || undefined });

export function emailTransport(e: EmailEnv = live(), production = process.env.NODE_ENV === "production"): Transport {
  if (e.RESEND_API_KEY && e.EMAIL_FROM) return "resend";
  if (!production && e.EMAIL_OUTBOX_DIR) return "outbox";
  return null;
}

/** Whether this server can send email at all: verification is required only when it can. */
export const emailConfigured = () => emailTransport() !== null;

export async function sendMail(mail: Mail, fetchImpl: typeof fetch = fetch): Promise<void> {
  const e = live();
  const transport = emailTransport(e);
  if (transport === "resend") {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${e.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: e.EMAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
      signal: AbortSignal.timeout(10_000),
    });
    // the status only: the body can echo the address, and the key is never logged
    if (!res.ok) throw new Error(`the email service answered ${res.status}`);
    return;
  }
  if (transport === "outbox") {
    // development only (emailTransport refuses it in production): not traced into the server bundle
    const dir = resolve(/* turbopackIgnore: true */ e.EMAIL_OUTBOX_DIR!);
    await mkdir(dir, { recursive: true });
    const name = `${new Date().toISOString().replace(/[:.]/g, "-")}-${mail.to.replace(/[^a-z0-9]/gi, "_")}.json`;
    await writeFile(join(dir, name), JSON.stringify(mail, null, 2));
    return;
  }
  throw new Error("email is not configured on this server");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A plain message with one button: no tracking, no images, readable as text. */
export function linkMail(to: string, subject: string, intro: string, action: string, url: string, after: string): Mail {
  const text = `${intro}\n\n${action}: ${url}\n\n${after}\n\nDelta, restoration claims anyone can check.`;
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#F4F1EA;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#101A18">
<div style="max-width:520px;margin:0 auto;background:#FFFDF8;border:1px solid #DED6C6;border-radius:12px;padding:28px">
<p style="margin:0 0 20px;font-size:15px;line-height:1.6">${esc(intro)}</p>
<p style="margin:0 0 20px"><a href="${esc(url)}" style="display:inline-block;background:#1C6C4F;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 18px;border-radius:8px">${esc(action)}</a></p>
<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#5E6460">${esc(after)}</p>
<p style="margin:0;font-size:12px;line-height:1.6;color:#5E6460;word-break:break-all">${esc(url)}</p>
</div></body></html>`;
  return { to, subject, text, html };
}
