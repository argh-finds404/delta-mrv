// The one way Delta sends email: which transport is used, what reaches Resend, and the outbox a
// development machine writes instead. No network: fetch is injected.
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { emailConfigured, emailTransport, linkMail, sendMail } from "../src/server/email";

const saved = { ...process.env };
afterEach(() => {
  for (const k of ["RESEND_API_KEY", "EMAIL_FROM", "EMAIL_OUTBOX_DIR"]) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("the email transport", () => {
  it("is Resend with a key and a sender, an outbox only off production, otherwise none", () => {
    expect(emailTransport({ RESEND_API_KEY: "re_x", EMAIL_FROM: "Delta <no-reply@delta.example>" }, true)).toBe("resend");
    expect(emailTransport({ RESEND_API_KEY: "re_x" }, true)).toBeNull(); // a key without a sender sends nothing
    expect(emailTransport({ EMAIL_OUTBOX_DIR: ".local/outbox" }, false)).toBe("outbox");
    expect(emailTransport({ EMAIL_OUTBOX_DIR: ".local/outbox" }, true)).toBeNull(); // never a file in production
    expect(emailTransport({}, false)).toBeNull();
  });

  it("posts one message to Resend with the key as a bearer token, and reports a refusal by status only", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "Delta <no-reply@delta.example>";
    expect(emailConfigured()).toBe(true);
    const calls: { url: string; init: RequestInit }[] = [];
    const ok = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    await sendMail(linkMail("a@example.test", "Confirm", "Intro.", "Confirm my email", "https://delta.example/x?t=1", "After."), ok);
    expect(calls[0]!.url).toBe("https://api.resend.com/emails");
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe("Bearer re_test_key");
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ from: "Delta <no-reply@delta.example>", to: ["a@example.test"], subject: "Confirm" });
    const refused = (async () => new Response("the address a@example.test is unknown", { status: 422 })) as unknown as typeof fetch;
    await expect(sendMail(linkMail("a@example.test", "s", "i", "a", "https://x", "f"), refused)).rejects.toThrow(/^the email service answered 422$/);
  });

  it("writes each message to the outbox as JSON on a development machine", async () => {
    const dir = mkdtempSync(join(tmpdir(), "delta-outbox-"));
    try {
      delete process.env.RESEND_API_KEY;
      process.env.EMAIL_OUTBOX_DIR = dir;
      await sendMail(linkMail("b@example.test", "Reset your Delta password", "Someone asked.", "Choose a new password", "https://delta.example/r?t=2", "One hour."));
      const [file] = readdirSync(dir);
      const mail = JSON.parse(readFileSync(join(dir, file!), "utf8")) as { to: string; text: string; html: string };
      expect(mail.to).toBe("b@example.test");
      expect(mail.text).toContain("Choose a new password: https://delta.example/r?t=2");
      expect(mail.html).toContain('href="https://delta.example/r?t=2"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("escapes what it puts in the HTML", () => {
    expect(linkMail("c@example.test", "s", "<b>hi</b> & bye", "Go", 'https://x/"y', "f").html).toContain("&lt;b&gt;hi&lt;/b&gt; &amp; bye");
  });
});
