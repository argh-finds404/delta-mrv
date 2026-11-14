# Forensic test fixtures

| File | What it is | Source |
|---|---|---|
| `c2pa-signed.jpg` | A JPEG with an embedded C2PA manifest, signed by the C2PA test certificate, with a trusted timestamp | `sdk/tests/fixtures/C.jpg` in [contentauth/c2pa-rs](https://github.com/contentauth/c2pa-rs) (MIT OR Apache-2.0) |
| `c2pa-remote.jpg` | A JPEG whose XMP names a remote manifest (`dcterms:provenance` at `cai-manifests.adobe.com`) and embeds none | `sdk/tests/fixtures/cloud.jpg` in the same repository |
| `images.ts`, `exif.ts` | Synthetic images and EXIF blocks generated in the tests | This repository |

`c2pa-remote.jpg` exists to prove the reader never fetches: a photo can name any address as
its manifest's home, including an internal one.
