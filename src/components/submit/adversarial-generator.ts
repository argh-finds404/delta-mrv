// Browser-native adversarial fixture generator for live verification testing.
// Generates synthetic JPEGs with embedded EXIF headers directly via browser Canvas and TypedArrays.

export interface AdversarialScenario {
  id: "LEGITIMATE_MANGROVE" | "CROSS_PROJECT_DUPLICATE" | "OFF_SITE_NURSERY_SPOOF";
  title: string;
  badge: string;
  description: string;
  expectedOutcome: string;
}

export const ADVERSARIAL_SCENARIOS: AdversarialScenario[] = [
  {
    id: "LEGITIMATE_MANGROVE",
    title: "Scenario A: Legitimate Sundarbans Mangrove Planting",
    badge: "Clean Pass",
    description:
      "Tidal mudflat baseline followed by 350 Rhizophora saplings. Embedded EXIF matches the registered Sundarbans polygon coordinates with high visual change.",
    expectedOutcome:
      "PostGIS ST_Covers evaluates inside polygon (0 m distance), perceptual dHash confirms genuine delta, dispatched to verifiers.",
  },
  {
    id: "CROSS_PROJECT_DUPLICATE",
    title: "Scenario B: Adversarial Cross-Project Double-Claim",
    badge: "Duplicate Fraud",
    description:
      "Re-submits identical or imperceptibly altered imagery to claim a second grant milestone without performing on-the-ground restoration.",
    expectedOutcome:
      "Perceptual dHash Hamming distance < 4 bits triggers NO_VISIBLE_CHANGE or duplicate alert in the forensics telemetry pane.",
  },
  {
    id: "OFF_SITE_NURSERY_SPOOF",
    title: "Scenario C: Adversarial Off-Site Nursery Spoof",
    badge: "Boundary Violation",
    description:
      "Potted nursery saplings photographed 28+ km away at a commercial plant depot in Khulna city, outside the registered coastal restoration zone.",
    expectedOutcome:
      "PostGIS ST_Covers returns false. locateAgainstBoundary flags GPS_OUTSIDE_BOUNDARY with severe fraud risk score.",
  },
];

interface ExifOptions {
  make?: string;
  model?: string;
  dateTimeOriginal?: string;
  gps?: { lat: number; lon: number };
}

function dms(deg: number): [number, number][] {
  const a = Math.abs(deg);
  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  const s = Math.round(((a - d) * 60 - m) * 60 * 1000);
  return [
    [d, 1],
    [m, 1],
    [s, 1000],
  ];
}

interface EntryDef {
  tag: number;
  type: number;
  count: number;
  inline?: Uint8Array;
  inlineVal?: number;
  data?: Uint8Array;
  offset?: number;
}

function buildExifApp1(options: ExifOptions): Uint8Array {
  const entriesIFD0: EntryDef[] = [];
  const entriesExif: EntryDef[] = [];
  const entriesGps: EntryDef[] = [];
  const externalData: EntryDef[] = [];

  function addString(tag: number, str: string, target: EntryDef[]) {
    const bytes = new TextEncoder().encode(str + "\0");
    if (bytes.length <= 4) {
      target.push({ tag, type: 2, count: bytes.length, inline: bytes });
    } else {
      const item: EntryDef = { tag, type: 2, count: bytes.length, data: bytes };
      target.push(item);
      externalData.push(item);
    }
  }

  function addRationals(tag: number, parts: [number, number][], target: EntryDef[]) {
    const buf = new Uint8Array(8 * parts.length);
    const view = new DataView(buf.buffer);
    parts.forEach(([n, d], i) => {
      view.setUint32(8 * i, n, true);
      view.setUint32(8 * i + 4, d, true);
    });
    const item: EntryDef = { tag, type: 5, count: parts.length, data: buf };
    target.push(item);
    externalData.push(item);
  }

  if (options.make) addString(0x010f, options.make, entriesIFD0);
  if (options.model) addString(0x0110, options.model, entriesIFD0);

  if (options.dateTimeOriginal) {
    addString(0x9003, options.dateTimeOriginal, entriesExif);
  }

  if (options.gps) {
    const lat = options.gps.lat;
    const lon = options.gps.lon;
    entriesGps.push({ tag: 0x0000, type: 1, count: 4, inline: new Uint8Array([2, 3, 0, 0]) });
    entriesGps.push({
      tag: 0x0001,
      type: 2,
      count: 2,
      inline: new TextEncoder().encode((lat >= 0 ? "N" : "S") + "\0"),
    });
    addRationals(0x0002, dms(lat), entriesGps);
    entriesGps.push({
      tag: 0x0003,
      type: 2,
      count: 2,
      inline: new TextEncoder().encode((lon >= 0 ? "E" : "W") + "\0"),
    });
    addRationals(0x0004, dms(lon), entriesGps);
  }

  const exifPointer: EntryDef = { tag: 0x8769, type: 4, count: 1, inlineVal: 0 };
  const gpsPointer: EntryDef = { tag: 0x8825, type: 4, count: 1, inlineVal: 0 };

  if (entriesExif.length > 0) entriesIFD0.push(exifPointer);
  if (entriesGps.length > 0) entriesIFD0.push(gpsPointer);

  entriesIFD0.sort((a, b) => a.tag - b.tag);
  entriesExif.sort((a, b) => a.tag - b.tag);
  entriesGps.sort((a, b) => a.tag - b.tag);

  const ifdSize = (entries: EntryDef[]) => 2 + 12 * entries.length + 4;
  const ifd0Size = ifdSize(entriesIFD0);
  const exifSize = entriesExif.length > 0 ? ifdSize(entriesExif) : 0;
  const gpsSize = entriesGps.length > 0 ? ifdSize(entriesGps) : 0;

  const ifd0At = 8;
  const exifAt = ifd0At + ifd0Size;
  const gpsAt = exifAt + exifSize;
  const dataAt = gpsAt + gpsSize;

  exifPointer.inlineVal = exifAt;
  gpsPointer.inlineVal = gpsAt;

  let totalDataSize = 0;
  for (const ext of externalData) {
    const len = ext.data!.length + (ext.data!.length % 2);
    ext.offset = dataAt + totalDataSize;
    totalDataSize += len;
  }

  const tiffSize = dataAt + totalDataSize;
  const tiff = new Uint8Array(tiffSize);
  const view = new DataView(tiff.buffer);

  tiff[0] = 0x49;
  tiff[1] = 0x49;
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);

  function writeIFD(entries: EntryDef[], offset: number) {
    view.setUint16(offset, entries.length, true);
    let p = offset + 2;
    for (const e of entries) {
      view.setUint16(p, e.tag, true);
      view.setUint16(p + 2, e.type, true);
      view.setUint32(p + 4, e.count, true);
      if (e.inline) {
        for (let i = 0; i < e.inline.length; i++) {
          tiff[p + 8 + i] = e.inline[i];
        }
      } else if (e.inlineVal !== undefined) {
        view.setUint32(p + 8, e.inlineVal, true);
      } else if (e.offset !== undefined) {
        view.setUint32(p + 8, e.offset, true);
      }
      p += 12;
    }
    view.setUint32(p, 0, true);
  }

  writeIFD(entriesIFD0, ifd0At);
  if (entriesExif.length > 0) writeIFD(entriesExif, exifAt);
  if (entriesGps.length > 0) writeIFD(entriesGps, gpsAt);

  for (const ext of externalData) {
    tiff.set(ext.data!, ext.offset!);
  }

  const body = new Uint8Array(6 + tiffSize);
  body.set(new TextEncoder().encode("Exif\0\0"), 0);
  body.set(tiff, 6);

  const app1 = new Uint8Array(4 + body.length);
  app1[0] = 0xff;
  app1[1] = 0xe1;
  const app1Len = body.length + 2;
  app1[2] = (app1Len >> 8) & 0xff;
  app1[3] = app1Len & 0xff;
  app1.set(body, 4);

  return app1;
}

export function injectExifToJpeg(jpegBytes: Uint8Array, options: ExifOptions): Uint8Array {
  if (jpegBytes[0] !== 0xff || jpegBytes[1] !== 0xd8) {
    throw new Error("Target file is not a valid JPEG");
  }
  const app1 = buildExifApp1(options);
  const out = new Uint8Array(2 + app1.length + (jpegBytes.length - 2));
  out.set(jpegBytes.subarray(0, 2), 0);
  out.set(app1, 2);
  out.set(jpegBytes.subarray(2), 2 + app1.length);
  return out;
}

function renderCanvas(type: "mudflat" | "mangrove" | "nursery", seed = 1): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  if (type === "mudflat") {
    // Wet tidal mudflat: brown/grey silt, water pools
    const grad = ctx.createLinearGradient(0, 0, 0, 480);
    grad.addColorStop(0, "#4a3e35");
    grad.addColorStop(0.5, "#3d3229");
    grad.addColorStop(1, "#2b221a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 480);

    // Mud cracks / tidal channels
    ctx.strokeStyle = "#251d16";
    ctx.lineWidth = 3;
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.moveTo(30 * i, 0);
      ctx.bezierCurveTo(40 * i, 150, 20 * i, 300, 35 * i, 480);
      ctx.stroke();
    }

    // Baseline label
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "14px monospace";
    ctx.fillText("BASELINE SURVEY: PLOT SECTOR 4B (UNSTABILIZED TIDAL FLAT)", 20, 450);
  } else if (type === "mangrove") {
    // Restored mangrove: deep green canopy, prop roots, tidal marsh
    const grad = ctx.createLinearGradient(0, 0, 0, 480);
    grad.addColorStop(0, "#1c382b");
    grad.addColorStop(0.4, "#24503c");
    grad.addColorStop(1, "#152e22");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 480);

    // Saplings grid
    ctx.fillStyle = "#489d71";
    for (let x = 40; x < 600; x += 45) {
      for (let y = 60; y < 440; y += 45) {
        ctx.beginPath();
        ctx.arc(x + (seed % 7), y + (seed % 5), 14, 0, Math.PI * 2);
        ctx.fill();

        // Stems
        ctx.strokeStyle = "#1b3325";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 25);
        ctx.stroke();
      }
    }

    // Water reflections
    ctx.fillStyle = "rgba(100, 180, 140, 0.25)";
    ctx.fillRect(0, 360, 640, 120);

    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "14px monospace";
    ctx.fillText("OUTCOME AUDIT: RHIZOPHORA MUCRONATA (350 STEMS/HA)", 20, 450);
  } else {
    // Commercial Nursery: Concrete floor, black plastic pots, plastic tags
    ctx.fillStyle = "#666666";
    ctx.fillRect(0, 0, 640, 480);

    // Shelves / Rows
    ctx.fillStyle = "#222222";
    for (let r = 0; r < 5; r++) {
      ctx.fillRect(20, 40 + r * 85, 600, 70);
    }

    // Potted plants with plastic tags
    ctx.fillStyle = "#33aa55";
    for (let c = 0; c < 10; c++) {
      for (let r = 0; r < 5; r++) {
        ctx.beginPath();
        ctx.arc(50 + c * 58, 75 + r * 85, 18, 0, Math.PI * 2);
        ctx.fill();

        // Yellow barcode tag
        ctx.fillStyle = "#ffcc00";
        ctx.fillRect(45 + c * 58, 85 + r * 85, 10, 6);
        ctx.fillStyle = "#33aa55";
      }
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "14px monospace";
    ctx.fillText("COMMERCIAL PLANT NURSERY DEPOT - KHULNA CITY", 20, 450);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas conversion to Blob failed"));
      },
      "image/jpeg",
      0.92,
    );
  });
}

export async function generateAdversarialPair(scenarioId: AdversarialScenario["id"]): Promise<{
  beforeFile: File;
  afterFile: File;
  deviceGps: { lat: number; lon: number };
  note: string;
}> {
  if (scenarioId === "LEGITIMATE_MANGROVE") {
    // Valid Sundarbans location inside registered boundary: 21.9497° N, 89.1833° E
    const gps = { lat: 21.9497, lon: 89.1833 };
    const beforeBlob = await renderCanvas("mudflat", 101);
    const afterBlob = await renderCanvas("mangrove", 202);

    const beforeRaw = new Uint8Array(await beforeBlob.arrayBuffer());
    const afterRaw = new Uint8Array(await afterBlob.arrayBuffer());

    const beforeExif = injectExifToJpeg(beforeRaw, {
      make: "Sony",
      model: "Alpha 7 IV",
      dateTimeOriginal: "2026:01:10 09:30:00",
      gps: { lat: 21.9497, lon: 89.1833 },
    });

    const afterExif = injectExifToJpeg(afterRaw, {
      make: "Sony",
      model: "Alpha 7 IV",
      dateTimeOriginal: "2026:03:20 14:15:00",
      gps: { lat: 21.9498, lon: 89.1834 },
    });

    return {
      beforeFile: new File([beforeExif as unknown as BlobPart], "sundarbans_baseline_mudflat_p4.jpg", { type: "image/jpeg" }),
      afterFile: new File([afterExif as unknown as BlobPart], "sundarbans_restored_mangrove_p4.jpg", { type: "image/jpeg" }),
      deviceGps: gps,
      note: "Legitimate baseline and 60-day restoration milestone. 350 Rhizophora saplings anchored in tidal silt with 2m spacing.",
    };
  }

  if (scenarioId === "CROSS_PROJECT_DUPLICATE") {
    // Duplicate attack: same photo used for both before and after (or repeat identical pixels)
    const gps = { lat: 21.9497, lon: 89.1833 };
    const photoBlob = await renderCanvas("mangrove", 777);
    const photoRaw = new Uint8Array(await photoBlob.arrayBuffer());

    const beforeExif = injectExifToJpeg(photoRaw, {
      make: "Apple",
      model: "iPhone 15 Pro",
      dateTimeOriginal: "2026:02:01 10:00:00",
      gps,
    });

    // Identical image bytes submitted as AFTER
    const afterExif = injectExifToJpeg(photoRaw, {
      make: "Apple",
      model: "iPhone 15 Pro",
      dateTimeOriginal: "2026:02:01 10:01:00",
      gps,
    });

    return {
      beforeFile: new File([beforeExif as unknown as BlobPart], "mangrove_plot_claim_a.jpg", { type: "image/jpeg" }),
      afterFile: new File([afterExif as unknown as BlobPart], "mangrove_plot_claim_b.jpg", { type: "image/jpeg" }),
      deviceGps: gps,
      note: "[Adversarial Test] Attempting duplicate photo submission to claim restoration payment without ground change.",
    };
  }

  // OFF_SITE_NURSERY_SPOOF: Khulna City commercial nursery, 28+ km outside boundary
  const nurseryGps = { lat: 22.8456, lon: 89.5403 };
  const beforeBlob = await renderCanvas("mudflat", 303);
  const afterBlob = await renderCanvas("nursery", 404);

  const beforeRaw = new Uint8Array(await beforeBlob.arrayBuffer());
  const afterRaw = new Uint8Array(await afterBlob.arrayBuffer());

  const beforeExif = injectExifToJpeg(beforeRaw, {
    make: "Apple",
    model: "iPhone 15 Pro",
    dateTimeOriginal: "2026:02:15 11:20:00",
    gps: nurseryGps,
  });

  const afterExif = injectExifToJpeg(afterRaw, {
    make: "Apple",
    model: "iPhone 15 Pro",
    dateTimeOriginal: "2026:03:01 15:45:00",
    gps: nurseryGps,
  });

  return {
    beforeFile: new File([beforeExif as unknown as BlobPart], "nursery_baseline_depot.jpg", { type: "image/jpeg" }),
    afterFile: new File([afterExif as unknown as BlobPart], "nursery_potted_saplings.jpg", { type: "image/jpeg" }),
    deviceGps: nurseryGps,
    note: "[Adversarial Test] Field officer captured photos at Khulna City commercial plant nursery, 28.4 km outside project polygon.",
  };
}

