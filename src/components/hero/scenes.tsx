import type { HeroScene } from "./HeroBand";
import { SceneCard } from "./SceneCard";
import { Chip, Pin, Plot } from "./SceneImage";

// The four steps of a claim, as four places on one painting of the Sundarbans (Landscape): the
// camera moves from the village fields, across the marsh, into the mangrove planting and out to
// the sea. Plots, pins and card values illustrate what Delta records; none is a real project.

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
    pan: 470,
    overlay: (
      <>
        <Plot id="capture-a" pts={[[340, 572], [496, 578], [518, 634], [358, 630]]} />
        <Chip at={[150, 150]} label="Captured" value="07:41" i={0} />
        <Chip at={[150, 222]} label="Location" value="inside plot" i={1} />
        <Pin at={[430, 602]} i={0} pulse />
        <Pin at={[300, 512]} i={1} />
      </>
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
    cardAt: { left: "60%", top: "5%" },
  },
  {
    label: "Check",
    caption: (
      <>
        Every photo is compared with every other on record, so one picture cannot be <mark className="brush">claimed twice</mark>.
      </>
    ),
    pan: 1180,
    overlay: (
      <>
        <Plot id="check-a" pts={[[900, 566], [1030, 560], [1036, 646], [906, 652]]} />
        <Plot id="check-b" pts={[[1290, 566], [1420, 558], [1428, 646], [1296, 654]]} tone="#F6D2B0" />
        <path className="scene-draw" d="M968 604Q1165 470 1360 604" pathLength={1} fill="none" stroke="#C2412D" strokeWidth={3.5} strokeLinecap="round" />
        <Pin at={[968, 604]} i={0} />
        <Pin at={[1360, 604]} i={1} pulse />
      </>
    ),
    card: (
      <SceneCard
        title="Possible reuse"
        tone="fraud"
        note="The same photo, submitted to two plots run by different organisations."
        rows={[
          { label: "Bits that differ", value: "5 of 64", mono: true },
          { label: "Flagged below", value: "8", mono: true },
          { label: "Next", value: "A reviewer looks" },
        ]}
      />
    ),
    cardAt: { left: "4%", top: "5%" },
  },
  {
    label: "Review",
    caption: (
      <>
        Two reviewers from an <mark className="brush">independent organisation</mark> must agree before anything counts.
      </>
    ),
    pan: 2040,
    overlay: (
      <>
        <Plot id="review-a" pts={[[1914, 576], [2172, 574], [2182, 724], [1924, 724]]} />
        <Pin at={[1990, 640]} i={0} />
        <Pin at={[2104, 688]} i={1} pulse />
      </>
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
    cardAt: { left: "60%", top: "4%" },
  },
  {
    label: "Verify",
    caption: (
      <>
        Anyone can recheck the record in a browser, <mark className="brush">without trusting us</mark>.
      </>
    ),
    pan: 2700,
    overlay: (
      <>
        <Plot id="verify-a" pts={[[2272, 450], [2398, 440], [2408, 548], [2282, 556]]} />
        <Pin at={[2340, 500]} i={0} />
        <Pin at={[2760, 418]} i={1} pulse />
      </>
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
    cardAt: { left: "60%", top: "4%" },
  },
];
