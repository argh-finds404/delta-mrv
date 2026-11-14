// A project's anchored records as a feed a partner polls: JSON Feed 1.1 and Atom 1.0. Pull-only:
// nothing is pushed, retried or queued (S10 webhooks stay cut). Pure, so the routes stay thin.

export type FeedEntry = {
  submissionId: string;
  followsSubmissionId: string | null;
  manifestHash: string;
  approvedAtIso: string | null;
  batchId: number;
  merkleRoot: string;
  txHash: string | null;
  anchoredAt: Date;
};
export type FeedSource = { project: { id: string; title: string; ownerOrgName: string; updatedAt: Date }; entries: FeedEntry[] };

const titleOf = (e: FeedEntry) => (e.followsSubmissionId ? `Survival check-up anchored in batch ${e.batchId}` : `Record anchored in batch ${e.batchId}`);
const summaryOf = (e: FeedEntry) =>
  `${e.followsSubmissionId ? "A check-up photographed again from the spot of an approved record" : "An approved record"}, reviewed by two people from an independent organisation, is now in batch ${e.batchId}, whose Merkle root is on Base Sepolia. Manifest fingerprint ${e.manifestHash}.`;

export function jsonFeed(src: FeedSource, origin: string) {
  const { project } = src;
  return {
    version: "https://jsonfeed.org/version/1.1",
    title: `${project.title}: anchored records`,
    home_page_url: `${origin}/p/${project.id}`,
    feed_url: `${origin}/api/v1/projects/${project.id}/feed`,
    description: `Records of ${project.ownerOrgName}'s project as they are anchored. Each links to a proof anyone can check in a browser. The claim is the organisation's own.`,
    authors: [{ name: project.ownerOrgName }],
    items: src.entries.map((e) => ({
      id: `${origin}/proof/${e.submissionId}`,
      url: `${origin}/proof/${e.submissionId}`,
      title: titleOf(e),
      content_text: summaryOf(e),
      date_published: e.anchoredAt.toISOString(),
      _delta: { submissionId: e.submissionId, followsSubmissionId: e.followsSubmissionId, manifestHash: e.manifestHash, approvedAtIso: e.approvedAtIso, batchId: e.batchId, merkleRoot: e.merkleRoot, txHash: e.txHash },
    })),
  };
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function atomFeed(src: FeedSource, origin: string): string {
  const { project } = src;
  const self = `${origin}/p/${project.id}/feed.xml`;
  const entries = src.entries
    .map(
      (e) => `  <entry>
    <id>${xml(`${origin}/proof/${e.submissionId}`)}</id>
    <title>${xml(titleOf(e))}</title>
    <link rel="alternate" type="text/html" href="${xml(`${origin}/proof/${e.submissionId}`)}"/>
    <updated>${e.anchoredAt.toISOString()}</updated>
    <summary>${xml(summaryOf(e))}</summary>
  </entry>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${xml(self)}</id>
  <title>${xml(`${project.title}: anchored records`)}</title>
  <subtitle>${xml(`Records of ${project.ownerOrgName}'s project as they are anchored. The claim is the organisation's own.`)}</subtitle>
  <link rel="self" type="application/atom+xml" href="${xml(self)}"/>
  <link rel="alternate" type="text/html" href="${xml(`${origin}/p/${project.id}`)}"/>
  <updated>${project.updatedAt.toISOString()}</updated>
  <author><name>${xml(project.ownerOrgName)}</name></author>
${entries}
</feed>
`;
}
