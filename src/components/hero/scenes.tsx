import Image from "next/image";
import type { HeroScene } from "./HeroBand";
import { SceneCard } from "./SceneCard";
import { Brackets, Chip, Pin, Plot, SceneImage } from "./SceneImage";

// The four steps of a claim, each over a real photograph of life in the Sundarbans (credited in
// the footer from public/images/life/credits.json). The plots, pins and card values illustrate what
// Delta records; the people and places are not projects in the registry.

const FINGERPRINT = "9e41…c07a";

export const HERO_SCENES: HeroScene[] = [
  {
    label: "Capture",
    caption: (
      <>
        A field team photographs the plot before and after, and every photo is <mark className="brush">fingerprinted</mark> the moment it
        arrives.
      </>
    ),
    art: (
      <SceneImage photo="fishing-boat-in-sundarban-tiger-reserve-west.jpg" alt="A boat crew working along a mangrove forest edge in the Sundarbans" priority>
        <Plot id="capture-a" pts={[[560, 262], [850, 250], [858, 404], [570, 414]]} />
        <Chip at={[150, 140]} label="Captured" value="07:41" i={0} />
        <Chip at={[150, 212]} label="Location" value="inside plot" i={1} />
        <Pin at={[520, 470]} i={0} />
        <Pin at={[712, 330]} i={1} pulse />
      </SceneImage>
    ),
    card: (
      <SceneCard
        title="Plot 7 · before and after"
        rows={[
          { label: "Before", value: "12 Mar 07:41", mono: true },
          { label: "After", value: "9 Sep 07:58", mono: true },
          { label: "Location", value: "Inside boundary", tone: "seal" },
          { label: "Fingerprint", value: FINGERPRINT, mono: true },
        ]}
      />
    ),
    cardAt: { left: "62%", top: "5%" },
    picture: "A boat crew at a mangrove edge, Sundarban Tiger Reserve.",
  },
  {
    label: "Check",
    caption: (
      <>
        Every photo is compared with every other on record, so one picture cannot be <mark className="brush">claimed twice</mark>.
      </>
    ),
    art: (
      <SceneImage photo="spotted-deer-in-the-sundarbans.jpg" alt="A spotted deer on a mudflat bristling with mangrove breathing roots">
        <Brackets x={330} y={250} w={370} h={360} />
        <Pin at={[520, 430]} i={0} pulse />
      </SceneImage>
    ),
    card: (
      <div className="rounded-lg border border-paper-rule bg-paper-card p-3 text-[12px] leading-[1.45] text-paper-ink">
        <p className="flex items-center gap-2 text-[13px] font-medium">
          <span aria-hidden className="size-1.5 rounded-full bg-[#B4432F]" />
          Possible reuse
        </p>
        <p className="mt-1 text-paper-muted">This photo was already submitted to a plot run by another organisation.</p>
        <div className="mt-2 flex items-center gap-2">
          <Image src="/images/life/spotted-deer-in-the-sundarbans.jpg" alt="" width={56} height={40} className="h-10 w-14 rounded object-cover" />
          <dl className="flex-1 space-y-0.5">
            <div className="flex justify-between gap-2">
              <dt className="text-paper-muted">Bits that differ</dt>
              <dd className="font-mono tabular-nums">5 of 64</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-paper-muted">Next</dt>
              <dd>A reviewer looks</dd>
            </div>
          </dl>
        </div>
      </div>
    ),
    cardAt: { left: "64%", top: "5%" },
    picture: "A spotted deer among mangrove roots, Sundarbans.",
  },
  {
    label: "Review",
    caption: (
      <>
        Two reviewers from an <mark className="brush">independent organisation</mark> must agree before anything counts.
      </>
    ),
    art: (
      <SceneImage photo="sundarbans-mangrove-forest.jpg" alt="Women of the Sundarbans gathering leaves in the mangrove forest">
        <Pin at={[470, 610]} i={0} />
        <Pin at={[650, 560]} i={1} pulse />
      </SceneImage>
    ),
    card: (
      <div className="rounded-lg border border-paper-rule bg-paper-card p-3 text-[12px] leading-[1.45] text-paper-ink">
        <p className="flex items-center gap-2 text-[13px] font-medium">
          <span aria-hidden className="size-1.5 rounded-full bg-paper-seal" />
          Decision · plot 7
        </p>
        <ul className="mt-2 space-y-2">
          {[
            ["R1", "New growth matches the after photo. Approve."],
            ["R2", "Location and dates are consistent. Approve."],
          ].map(([who, said]) => (
            <li key={who} className="flex gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#DDE9E2] text-[10px] font-medium text-paper-seal">{who}</span>
              <span className="text-paper-muted">{said}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex items-center justify-between border-t border-paper-rule pt-2">
          <span className="text-paper-muted">Independent of the claimant</span>
          <span className="font-mono tabular-nums">2 of 2</span>
        </p>
      </div>
    ),
    cardAt: { left: "64%", top: "4%" },
    picture: "Forest communities at work in the Sundarbans mangroves.",
  },
  {
    label: "Verify",
    caption: (
      <>
        Anyone can recheck the record in a browser, <mark className="brush">without trusting us</mark>.
      </>
    ),
    art: (
      <SceneImage photo="fishing-boat-in-sundarban-tiger-reserve-west-2.jpg" alt="A fishing boat on a wide Sundarbans river below a mangrove forest line">
        <Plot id="verify-a" pts={[[680, 262], [890, 246], [896, 338], [686, 346]]} />
        <Pin at={[321, 345]} i={0} />
        <Pin at={[790, 296]} i={1} pulse />
      </SceneImage>
    ),
    card: (
      <SceneCard
        title="Anyone can check"
        tone="chain"
        note="Recomputed in your browser."
        rows={[
          { label: "Your file", value: FINGERPRINT, mono: true },
          { label: "On record", value: FINGERPRINT, mono: true },
          { label: "Result", value: "Match", tone: "seal" },
        ]}
      />
    ),
    cardAt: { left: "4%", top: "5%" },
    picture: "A fishing boat below the mangrove line, Sundarban Tiger Reserve.",
  },
];
