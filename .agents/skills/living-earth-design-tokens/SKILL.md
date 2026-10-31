---
name: living-earth-design-tokens
description: >-
  Frontend skill enforcing the Living Earth design tokens, Delta color palette, and monospace telemetry typography in Delta-MRV. Use whenever styling pages, cards, verification states, coordinates, risk scores, or cryptographic hashes.
---

# Frontend Skill: Living Earth Design Tokens

Enforce the Delta color palette and typography strictly across all views and components.

## Color Palette

- **Dark Mode Background**: `#101A18`
- **Elevated Cards / Surfaces**: `#172623`
- **Primary Buttons & Active Verification States**: `#D7F6B8`

## Typography & Telemetry

- Use `Geist_Mono` (`font-mono`) with `tabular-nums` for **all** rendered:
  - Geographic coordinates (`[longitude, latitude]`)
  - Risk & confidence scores
  - Cryptographic hashes (SHA-256, 64-bit dHash, transaction hashes)

