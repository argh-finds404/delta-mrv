# ADR-0002 — Base Sepolia rather than a signed log or timestamping authority

**Status:** Accepted
**Date:** 2026-11-01
**Deciders:** Shoumik Orgho

## Context

The integrity requirement is: a third party can tell that an approved record
has not changed, without trusting Delta. A signed append-only log, an RFC 3161
timestamping authority, or a public blockchain all satisfy this.

## Decision

Anchor daily Merkle roots to Base Sepolia (chain id 84532).

## Reasoning

- A signed log still requires trusting that Delta did not re-sign history with
  the same key. The chain removes Delta from the trust path entirely.
- A timestamping authority is a single third party with its own availability
  and longevity risk, and its proofs are unfamiliar to most readers.
- Base Sepolia is free, publicly readable with no account, and verifiable
  through BaseScan by a non-technical visitor.
- Reading requires no key, so browser-side verification needs no secret.

## Consequences

- It is a **testnet**. Testnets can be reset. The README must say so plainly:
  this demonstrates the mechanism, and a production deployment would anchor to
  a mainnet L2 at real but small cost.
- A daily batch means up to 24 hours between approval and `ANCHORED`. The UI
  shows `PENDING ANCHOR` honestly rather than hiding the gap.
- An unreachable RPC must render `UNAVAILABLE`, never `MISMATCH`.

## Alternatives rejected

**Mainnet L2** — removes the reset risk, costs real money, violates the $0
constraint for a portfolio build.
**Signed log only** — cheaper and simpler, but keeps Delta inside its own
trust boundary, which is the thing the product is trying to escape.
