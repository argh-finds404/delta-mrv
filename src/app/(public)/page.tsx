import { Suspense, type CSSProperties, type ReactNode } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight } from "lucide-react";
import { AtlasMap } from "@/src/components/atlas/AtlasMap";
import type { AtlasSite } from "@/src/components/atlas/types";
import { HeroBand } from "@/src/components/hero/HeroBand";
import { Reveal } from "@/src/components/site/Reveal";
import { SiteFooter } from "@/src/components/site/SiteFooter";
import { SiteHeader } from "@/src/components/site/SiteHeader";
import { ACTIVITY_LABEL, formatClaim, formatCount } from "@/src/lib/format";
import { getPublicOverview, listPublicProjects } from "@/src/server/services/projects.service";

export const metadata: Metadata = {
  title: "Delta — restoration claims anyone can check",
  description:
    "Delta makes the evidence, the reviewer, and the review itself checkable by a stranger with a browser.",
};

const container = "mx-auto max-w-[1280px] px-6 lg:px-16";

// Real photographs (credited in the footer): the life a restoration claim is about.
const LIFE = [
  { src: "spotted-deer-grazing-in-sundarbans-mangrove-forest.jpg", alt: "A herd of spotted deer grazing among mangrove trunks and breathing roots", caption: "Spotted deer grazing in the Sundarbans mangrove forest." },
  { src: "collared-kingfisher-perched-on-mangrove-tree.jpg", alt: "A collared kingfisher perched in a mangrove tree", caption: "A collared kingfisher, one of the forest's many birds." },
  { src: "the-last-honey-hunters-of-the-sundarbans.jpg", alt: "A honey hunter smoking out a wild bee nest in the mangrove forest", caption: "Honey hunters, whose living depends on the forest standing." },
];

// docs/14-PAGE-SPEC.md §1 section 2: each fraud in the claimant's own voice, and what catches it.
const FRAUDS = [
  {
    name: "Double claiming",
    quote: "“These are new photos.”",
    catch: "Every file is fingerprinted. A photo reused in another project, even resized or lightly edited, is flagged with its reason.",
  },
  {
    name: "Location spoofing",
    quote: "“This was taken at the site.”",
    catch: "The location recorded in the photo is checked against the project boundary, which is never published.",
  },
  {
    name: "Self-auditing",
    quote: "“Our team reviewed it.”",
    catch: "Nobody may review their own organisation's work. Two reviewers from an independent organisation must agree.",
  },
  {
    name: "Silent tampering",
    quote: "“That's what we submitted.”",
    catch: "Approved evidence is fingerprinted and its record is append-only, so a later change shows up as a mismatch.",
  },
];

// docs/13-FEATURE-SPEC.md, connecting the dots. `built` is the honest state of this build.
const STEPS = [
  { title: "Capture", body: "Field teams photograph the site before and after. Originals go to private storage, untouched.", built: false },
  { title: "Automatic checks", body: "Each file is checked for reuse, location and timing. Every flag carries a reason a person can read.", built: false },
  { title: "Independent review", body: "Two reviewers from an organisation independent of the claimant must agree. Nobody reviews their own work.", built: true },
  { title: "Permanent record", body: "Every decision is appended to a log that no one, including us, can edit or delete.", built: true },
  { title: "Daily anchor", body: "Approved records are batched into one fingerprint and published once a day.", built: false },
  { title: "Anyone verifies", body: "A stranger recomputes the fingerprint in their browser and compares it with the published one.", built: false },
];

export default function Home() {
  return (
    <div data-theme="paper" className="min-h-dvh bg-paper font-sans text-paper-ink">
      <SiteHeader />
      <main>
        {/* 1. Hero: the claim on the left, the scene band on the right (after felt.com) */}
        <section
          className={`${container} grid gap-x-16 gap-y-10 overflow-x-clip py-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[auto_auto] lg:py-20`}
        >
          <div className="brush-on-load space-y-8 lg:col-start-1 lg:row-start-1 lg:self-end">
            <p className="text-[15px] text-paper-muted">Measurement, reporting and verification for restoration</p>
            <h1 className="type-display">
              “We planted 500 mangroves.”
              <span className="mt-2 block text-paper-muted">Anyone can say it. Almost nobody can check it.</span>
            </h1>
            <p className="max-w-[52ch] text-[17px] leading-[1.6] text-paper-muted">
              Delta makes the evidence, the reviewer, and the review itself checkable by{" "}
              <mark className="brush text-paper-ink">a stranger with a browser</mark>.
            </p>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <Link
                href="/atlas"
                className="inline-flex h-12 items-center gap-2 rounded-lg border border-paper-ink/15 bg-signal px-5 text-[15px] font-medium text-paper-ink transition-colors hover:bg-[#B9EA5F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-ink"
              >
                Explore the atlas
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href="#limits" className="text-[15px] text-paper-ink underline decoration-paper-rule underline-offset-[6px] transition-colors hover:decoration-paper-ink">
                What it does not prove
              </Link>
            </div>
          </div>
          <HeroBand />
        </section>

        <section aria-label="The registry today" className="border-t border-paper-rule">
          <Suspense fallback={<Numbers values={null} />}>
            <LiveNumbers />
          </Suspense>
        </section>

        {/* What the evidence is for: the forest, its wildlife and the people who live from it */}
        <section aria-labelledby="life" className="border-t border-paper-rule">
          <Reveal className={`${container} py-16 lg:py-24`}>
            <div className="rise-item max-w-[60ch] space-y-4">
              <p className="text-[15px] text-paper-muted">What the evidence protects</p>
              <h2 id="life" className="type-section">
                A forest that <mark className="brush">feeds, shelters and holds the coast</mark>
              </h2>
            </div>
            <ul className="mt-12 grid gap-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:grid-rows-2">
              {LIFE.map((p, i) => (
                <li key={p.src} className={`rise-item group ${i === 0 ? "md:row-span-2" : ""}`} style={{ "--i": i + 1 } as CSSProperties}>
                  <figure className="space-y-3">
                    <div className={`relative overflow-hidden rounded-xl ${i === 0 ? "aspect-[4/3] md:aspect-auto md:h-[calc(100%-2.5rem)] md:min-h-[480px]" : "aspect-[16/10]"}`}>
                      <Image
                        src={`/images/life/${p.src}`}
                        alt={p.alt}
                        fill
                        sizes={i === 0 ? "(min-width: 768px) 58vw, 100vw" : "(min-width: 768px) 42vw, 100vw"}
                        className="object-cover motion-safe:transition-transform motion-safe:duration-[1200ms] motion-safe:ease-[cubic-bezier(0.2,0,0,1)] group-hover:scale-[1.04]"
                      />
                    </div>
                    <figcaption className="text-[13px] leading-normal text-paper-muted">{p.caption}</figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        {/* The real artefact: the live map, read from the database (docs/14 §1) */}
        <section aria-labelledby="where" className="border-t border-paper-rule">
          <Reveal className={`${container} grid gap-10 py-16 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16 lg:py-24`}>
            <div className="rise-item space-y-4 lg:pt-2">
              <p className="flex items-center gap-2 text-[15px] text-paper-muted">
                <span aria-hidden className="live-dot size-2 rounded-full bg-paper-seal text-paper-seal" />
                Live from the registry
              </p>
              <h2 id="where" className="type-section">
                See where the work <mark className="brush">is being checked</mark>
              </h2>
              <p className="max-w-[46ch] text-[17px] leading-[1.6] text-paper-muted">
                Every active site, drawn as an area about 5.5 km across. The exact boundaries never leave the server: they
                are what protects a site from people who would rather it failed.
              </p>
            </div>
            <div className="rise-item" style={{ "--i": 1 } as CSSProperties}>
              <Suspense fallback={<MapFrame />}>
                <HeroMap />
              </Suspense>
            </div>
          </Reveal>
        </section>

        {/* 2. The four frauds */}
        <section aria-labelledby="frauds" className="border-t border-paper-rule">
          <div className={`${container} py-16 lg:py-24`}>
            <SectionHeading id="frauds" eyebrow="The problem" title="Four ways a restoration claim goes wrong">
              Each one is designed out by a specific part of Delta. The build status of each part is listed under How it works.
            </SectionHeading>
            <Reveal>
              <ul className="mt-12 grid gap-x-8 gap-y-12 md:grid-cols-2 xl:grid-cols-4">
                {FRAUDS.map((f, i) => (
                  <li key={f.name} className="rise-item space-y-3 border-t-2 border-fraud pt-5" style={{ "--i": i } as CSSProperties}>
                    <p className="text-[13px] text-paper-muted">{f.name}</p>
                    <p className="font-serif text-[24px] leading-[1.2] tracking-[-0.01em]">{f.quote}</p>
                    <p className="text-[15px] leading-[1.6] text-paper-muted">{f.catch}</p>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* 3. How it works: the chain, in order, with what is built */}
        <section id="how" aria-labelledby="how-heading" className="scroll-mt-16 bg-field-abyss text-field-text">
          <div className={`${container} py-16 lg:py-24`}>
            <SectionHeading dark id="how-heading" eyebrow="How it works" title="Six links, each one checkable">
              Every link depends on the one before it. Teal means that link is built and running in this demonstration;
              amber means it is still being built.
            </SectionHeading>
            <Reveal className="relative mt-14">
              <span aria-hidden className="reveal-line absolute inset-x-0 top-[6px] hidden h-px bg-field-hairline xl:block" />
              <ol className="grid gap-x-6 gap-y-10 md:grid-cols-3 xl:grid-cols-6">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="reveal-item relative space-y-3" style={{ "--i": i } as CSSProperties}>
                    <span
                      aria-hidden
                      className={`relative block size-[13px] rounded-full border-2 ${s.built ? "border-verified bg-verified" : "border-review bg-field-abyss"}`}
                    />
                    <p className="pt-2 text-[13px] text-field-muted">Step {i + 1}</p>
                    <h3 className="font-serif text-[22px] leading-[1.2]">{s.title}</h3>
                    <p className="text-[15px] leading-[1.6] text-field-muted">{s.body}</p>
                    <p className="inline-flex items-center gap-2 text-[13px] text-field-text">
                      <span aria-hidden className={`size-1.5 rounded-full ${s.built ? "bg-verified" : "bg-review"}`} />
                      {s.built ? "Built and running" : "In progress"}
                    </p>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
        </section>

        {/* 5. The only section that names the chain (docs/06 §5) */}
        <section aria-labelledby="integrity" className="border-t border-paper-rule">
          <div className={`${container} grid gap-10 py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-24`}>
            <SectionHeading id="integrity" eyebrow="Integrity" title="Why the record can still be trusted later" />
            <div className="max-w-[64ch] space-y-5 text-[17px] leading-[1.6] text-paper-muted">
              <p>
                Approved records are grouped into a daily batch and reduced to a single fingerprint, a Merkle root. That one
                value is written to a public blockchain, where nobody, including the people who run Delta, can quietly
                change it.
              </p>
              <p>
                Anyone holding a record can then prove it was in the batch without trusting Delta&apos;s servers: the browser
                does the arithmetic.
              </p>
              <p className="text-[15px] text-paper-ink">
                Not live yet. Anchoring is being built, and it targets the Base Sepolia test network, not a production chain.
              </p>
            </div>
          </div>
        </section>

        {/* 6. Verbatim from docs/00-PRODUCT.md §3 */}
        <section id="limits" aria-labelledby="limits-heading" className="scroll-mt-16 border-t border-paper-rule">
          <Reveal className={`${container} py-16 lg:py-24`}>
            <SectionHeading id="limits-heading" eyebrow="Limits" title={<>What this proves, and <mark className="brush">what it does not</mark></>} />
            <div className="mt-12 grid gap-10 rounded-lg border border-paper-ink/20 bg-paper-card p-8 md:grid-cols-2 lg:p-12">
              <LimitList title="It proves" tone="bg-paper-seal">
                {[
                  "The evidence file existed at a recorded point in time",
                  "The evidence has not changed since approval (hash comparison against chain)",
                  "It passed stated consistency checks — location, duplicates, timestamps",
                  "It was approved by named humans from an organisation independent of the claimant",
                  "The review history has not been silently rewritten (hash-chained audit log)",
                ]}
              </LimitList>
              <LimitList title="It does not prove" tone="bg-fraud">
                {[
                  "That trees were actually planted, or that they survived",
                  "That the photograph was taken where or when the EXIF says",
                  "Anything the AI “observed” — that is an opinion, logged as an opinion",
                ]}
              </LimitList>
            </div>
          </Reveal>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function SectionHeading({ id, eyebrow, title, dark = false, children }: { id: string; eyebrow: string; title: ReactNode; dark?: boolean; children?: ReactNode }) {
  const muted = dark ? "text-field-muted" : "text-paper-muted";
  return (
    <div className="max-w-[60ch] space-y-4">
      <p className={`text-[15px] ${muted}`}>{eyebrow}</p>
      <h2 id={id} className="type-section">
        {title}
      </h2>
      {children && <p className={`text-[17px] leading-[1.6] ${muted}`}>{children}</p>}
    </div>
  );
}

function LimitList({ title, tone, children }: { title: string; tone: string; children: string[] }) {
  return (
    <div className="space-y-4">
      <h3 className="font-serif text-[24px] leading-[1.2]">{title}</h3>
      <ul className="space-y-3 text-[15px] leading-[1.6]">
        {children.map((line) => (
          <li key={line} className="flex gap-3">
            <span aria-hidden className={`mt-[0.55em] size-2 shrink-0 rounded-full ${tone}`} />
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- live parts: read from the database at request time ----------------------------------

async function HeroMap() {
  await connection();
  const { items } = await listPublicProjects({ limit: 100 });
  const sites: AtlasSite[] = items.flatMap((p) =>
    p.fuzzedLocation
      ? [
          {
            id: p.id,
            title: p.title,
            ownerOrgName: p.ownerOrgName,
            activity: ACTIVITY_LABEL[p.activityType],
            claim: formatClaim(p.claimedQuantity, p.claimedUnit),
            commitment: p.locationCommitment,
            area: { kind: "approximate", center: p.fuzzedLocation.coordinates },
          },
        ]
      : [],
  );
  return (
    <MapFrame
      caption={
        <>
          <span className="font-mono tabular-nums text-paper-ink">{sites.length}</span> active sites, read live from the registry.
          Each is drawn as an area about 5.5 km across; the exact boundaries are withheld to protect the sites.
        </>
      }
    >
      <AtlasMap sites={sites} variant="preview" padding={{ top: 64, right: 72, bottom: 88, left: 72 }} className="absolute inset-0" />
    </MapFrame>
  );
}

/** The map card, Felt's framed map: the product shown working, not a picture of it. */
function MapFrame({ children, caption }: { children?: ReactNode; caption?: ReactNode }) {
  return (
    <figure className="space-y-3">
      <Link
        href="/atlas"
        aria-label="Open the impact atlas"
        className="group relative block aspect-[16/10] overflow-hidden rounded-lg border border-paper-rule bg-[#EFEBE2] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper-ink"
      >
        {children}
        <span className="absolute bottom-4 left-4 inline-flex h-9 items-center gap-2 rounded-lg border border-paper-rule bg-paper-card px-3 text-[13px] text-paper-ink transition-colors group-hover:border-paper-muted">
          Open the atlas
          <ArrowRight className="size-3.5 motion-safe:transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </Link>
      <figcaption className="min-h-[3em] max-w-[64ch] text-[13px] leading-[1.5] text-paper-muted">{caption}</figcaption>
    </figure>
  );
}

async function LiveNumbers() {
  await connection();
  return <Numbers values={await getPublicOverview()} />;
}

function Numbers({ values }: { values: Awaited<ReturnType<typeof getPublicOverview>> | null }) {
  const cells = [
    { n: values?.sites, label: "Active restoration sites" },
    { n: values?.approved, label: "Submissions approved by two independent reviewers" },
    { n: values?.verifierOrgs, label: values?.verifierOrgs === 1 ? "Independent reviewing organisation" : "Independent reviewing organisations" },
  ];
  return (
    <div className={container}>
      <dl className="grid divide-paper-rule md:grid-cols-3 md:divide-x">
        {cells.map(({ n, label }) => (
          <div key={label} className="flex flex-col-reverse gap-2 border-b border-paper-rule py-8 last:border-b-0 md:border-b-0 md:px-8 md:first:pl-0">
            <dt className="text-[15px] text-paper-muted">{label}</dt>
            {/* Headline counts, read once and not compared column by column: serif lining figures.
                Geist Mono gives the thousands comma a full cell, which set 3,792 as "3, 792". */}
            <dd className="font-serif text-[48px] leading-none tracking-[-0.02em] [font-variant-numeric:lining-nums_tabular-nums]">
              {n === undefined ? <span aria-hidden className="block h-10 w-24 rounded-sm bg-[#EFE9DC]" /> : formatCount(n)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="pb-8 text-[13px] text-paper-muted">Demonstration data, counted when this page loaded.</p>
    </div>
  );
}
