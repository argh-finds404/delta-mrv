// The pull-only project feeds: JSON Feed 1.1 and Atom 1.0 built from a project's anchored records.
import { describe, expect, it } from "vitest";
import { atomFeed, jsonFeed, type FeedSource } from "../src/lib/feeds";

const src: FeedSource = {
  project: { id: "p1", title: "Koyra <Mangrove> & Belt", ownerOrgName: "Trust \"A\"", updatedAt: new Date("2026-11-14T10:00:00Z") },
  entries: [
    { submissionId: "s2", followsSubmissionId: "s1", manifestHash: "b".repeat(64), approvedAtIso: "2026-11-14T09:00:00.000Z", batchId: 8, merkleRoot: `0x${"c".repeat(64)}`, txHash: null, anchoredAt: new Date("2026-11-14T10:00:00Z") },
    { submissionId: "s1", followsSubmissionId: null, manifestHash: "a".repeat(64), approvedAtIso: "2025-11-14T09:00:00.000Z", batchId: 3, merkleRoot: `0x${"d".repeat(64)}`, txHash: "0xabc", anchoredAt: new Date("2025-11-15T10:00:00Z") },
  ],
};

describe("a project's feed", () => {
  it("is JSON Feed 1.1 with one item per anchored record, each linking to its proof", () => {
    const f = jsonFeed(src, "https://delta.example");
    expect(f.version).toBe("https://jsonfeed.org/version/1.1");
    expect(f.feed_url).toBe("https://delta.example/api/v1/projects/p1/feed");
    expect(f.items.map((i) => i.url)).toEqual(["https://delta.example/proof/s2", "https://delta.example/proof/s1"]);
    expect(f.items[0]).toMatchObject({ title: "Survival check-up anchored in batch 8", date_published: "2026-11-14T10:00:00.000Z", _delta: { followsSubmissionId: "s1", batchId: 8 } });
    expect(f.items[1]!.title).toBe("Record anchored in batch 3");
  });

  it("is Atom 1.0 with every text escaped", () => {
    const a = atomFeed(src, "https://delta.example");
    expect(a).toMatch(/^<\?xml version="1\.0" encoding="utf-8"\?>\n<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom">/);
    expect(a).toContain("<title>Koyra &lt;Mangrove&gt; &amp; Belt: anchored records</title>");
    expect(a).toContain("<name>Trust &quot;A&quot;</name>");
    expect(a.match(/<entry>/g)).toHaveLength(2);
    expect(a).toContain('<link rel="self" type="application/atom+xml" href="https://delta.example/p/p1/feed.xml"/>');
    expect(a).not.toMatch(/<(?!\/|\?|feed|id|title|subtitle|link|updated|author|name|entry|summary)/);
  });
});
