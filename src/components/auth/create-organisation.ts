import { authClient, ORG_TYPES, type OrgType } from "@/src/lib/auth-client";

export type OrgDetails = { name: string; type: OrgType; country: string; website: string };

/** The signed-in person's new organisation, with its org_type. Better Auth reports failures as { error }. */
export async function createOrganisation(d: OrgDetails): Promise<{ ok: true } | { ok: false; error: string }> {
  const base = d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "organisation";
  const org = await authClient.organization.create({
    name: d.name.trim(),
    slug: `${base}-${crypto.randomUUID().slice(0, 6)}`, // slugs are unique; two orgs may share a name
    orgType: d.type,
    country: d.country.trim(),
    website: d.website.trim() || undefined,
  });
  return org.error ? { ok: false, error: org.error.message ?? "unknown error" } : { ok: true };
}

/** Where the verification link returns: the organisation's details ride along, as nothing is stored before the address is proved. */
export const finishUrl = (d: OrgDetails) => `/sign-up/finish?org=${encodeURIComponent(JSON.stringify(d))}`;

export function parseOrgDetails(raw: string | null): OrgDetails | null {
  try {
    const d = JSON.parse(raw ?? "") as Partial<OrgDetails>;
    if (typeof d.name !== "string" || !d.name.trim() || d.name.length > 200) return null;
    if (!ORG_TYPES.includes(d.type as OrgType)) return null;
    return { name: d.name, type: d.type as OrgType, country: typeof d.country === "string" ? d.country.slice(0, 100) : "", website: typeof d.website === "string" ? d.website.slice(0, 200) : "" };
  } catch {
    return null;
  }
}
