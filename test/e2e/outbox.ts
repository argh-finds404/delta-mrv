// The local stack writes each email to .local/outbox (scripts/dev-local.ts) instead of sending it.
// A test reads the newest one for an address and follows its link, as the person would.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const OUTBOX = join(process.cwd(), ".local", "outbox");

/** The link in the newest (or oldest) email to `to` whose subject matches, waiting up to 20 s for it to arrive. */
export async function linkFromEmail(to: string, subject: RegExp, pick: "newest" | "oldest" = "newest"): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const names = (() => {
      try {
        const sorted = readdirSync(OUTBOX).sort(); // the file names start with the time sent
        return pick === "newest" ? sorted.reverse() : sorted;
      } catch {
        return [];
      }
    })();
    for (const name of names) {
      const mail = JSON.parse(readFileSync(join(OUTBOX, name), "utf8")) as { to: string; subject: string; text: string };
      if (mail.to === to && subject.test(mail.subject)) {
        const url = /https?:\/\/\S+/.exec(mail.text)?.[0];
        if (url) return url;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no email to ${to} matching ${subject} in ${OUTBOX}`);
}
