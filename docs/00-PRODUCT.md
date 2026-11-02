# 00 — Product

Authority over: vision, problem statement, users, product boundary, honesty clauses.

---

## 1. The problem

Environmental restoration — mangrove planting in the Sundarbans, haor wetland
recovery in Sylhet, river plastic cleanups on the Buriganga — is funded on the
strength of spreadsheets, PDFs and self-reported photographs.

Four frauds are routine and currently undetectable:

| Fraud | What it looks like |
|---|---|
| **Double claiming** | The same restoration photo submitted against two grants or two projects |
| **Location spoofing** | Photos taken outside the claimed restoration boundary |
| **Self-auditing** | The organisation that did the work also signs off that the work was done |
| **Silent tampering** | Review logs or evidence metadata edited after approval |

Nothing in the current reporting chain catches any of these. A funder reading
a report has no way to tell a careful NGO from a fabricating one.

## 2. What Delta does

An NGO submits before/after photographs for a project with a defined
geographic boundary. An automated forensic pipeline produces a set of
findings. Verifiers from a **different** organisation review those findings
and decide. Approved evidence manifests are batched into a Merkle root
anchored on Base Sepolia. Anyone can open a public proof page and verify, in
their own browser, that the record has not changed since approval.

```
PROJECT → SUBMIT EVIDENCE → ANALYSE → INDEPENDENT REVIEW → ANCHOR → PUBLIC VERIFY
```

Every implementation decision must serve this line.

## 3. What it proves, and what it does not

**It proves**

- The evidence file existed at a recorded point in time
- The evidence has not changed since approval (hash comparison against chain)
- It passed stated consistency checks — location, duplicates, timestamps
- It was approved by named humans from an organisation independent of the claimant
- The review history has not been silently rewritten (hash-chained audit log)

**It does not prove**

- That trees were actually planted, or that they survived
- That the photograph was taken where or when the EXIF says
- Anything the AI "observed" — that is an opinion, logged as an opinion

**This section is not optional marketing humility.** It appears verbatim in
`README.md`, in the landing page "What this does not prove" block, and as a
permanent footer on every `/proof/[id]` page. Copy that implies otherwise is
a defect.

## 4. Users

### Owner organisation (NGO)
Creates projects, defines boundaries, uploads before/after evidence, responds
to requests for more proof, shares public proof links with funders.
**Cannot review anything.**

### Verifier organisation (independent auditor)
Reviews submissions on projects it has been explicitly assigned to. Approves,
rejects, or requests more proof, always with a written reason.
**Cannot review a project owned by its own organisation.**

### Funder
Read-only. Browses verified outcomes, opens proof dossiers, consumes the
public API.

### Platform admin
Manages organisations and verifier assignments, monitors the job queue,
triggers anchoring. **Admin is an operations role, not a trust role** — an
admin cannot approve a submission, override a quorum, or alter an audit row.

## 5. Why this stands out

Not the blockchain. Three things:

1. **A hard institutional rule enforced in code and proven by tests.** Nobody
   reviews their own work. That is governance, not CRUD.
2. **Cross-tenant fraud detection without cross-tenant data leakage.** The
   system can tell Org A "this image matches a submission belonging to another
   organisation, severity HIGH" without revealing who, which project, or where.
3. **Stated limits.** Every comparable project overclaims. Being the one that
   does not is the credibility moat.

## 6. Success criteria

A stranger with the live URL and no account can:

1. Browse real seeded projects on the Impact Atlas
2. Open a project and see its reported impact and evidence history
3. Open a public proof dossier
4. Drag the original photograph onto the page and watch it verify green
5. Follow the transaction hash to BaseScan and see the anchored root
6. Read exactly what the platform does and does not claim

A recruiter reading the repository sees: multi-tenant authorisation, an async
job pipeline, geospatial and vector queries, AI bounded responsibly, a smart
contract used soberly, a public API, tests, and measured scale numbers.
