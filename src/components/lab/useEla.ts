"use client";

import * as React from "react";
import { ELA_QUALITY, elaHeatmap } from "@/src/lib/forensics/ela";

const MAX_SIDE = 1600; // the comparison never shows more; it keeps the lens instant on a phone
const done = new Map<string, Promise<string>>(); // one computation per photo per page

const canvasOf = (w: number, h: number) => Object.assign(document.createElement("canvas"), { width: w, height: h });
const toBlob = (c: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("the browser could not encode the image"))), type, quality));

/** The photo at `url`, re-saved as JPEG in this browser, differenced and drawn as a heatmap. Resolves to an object URL. */
async function compute(url: string): Promise<string> {
  const original = await createImageBitmap(await (await fetch(url)).blob());
  const scale = Math.min(1, MAX_SIDE / Math.max(original.width, original.height));
  const [w, h] = [Math.max(1, Math.round(original.width * scale)), Math.max(1, Math.round(original.height * scale))];
  const a = canvasOf(w, h);
  const ac = a.getContext("2d", { willReadFrequently: true })!;
  ac.drawImage(original, 0, 0, w, h);
  const before = ac.getImageData(0, 0, w, h);
  const resaved = await createImageBitmap(await toBlob(a, "image/jpeg", ELA_QUALITY));
  const b = canvasOf(w, h);
  const bc = b.getContext("2d", { willReadFrequently: true })!;
  bc.drawImage(resaved, 0, 0, w, h);
  const { pixels } = elaHeatmap(before.data, bc.getImageData(0, 0, w, h).data);
  ac.putImageData(new ImageData(pixels, w, h), 0, 0);
  return URL.createObjectURL(await toBlob(a, "image/png"));
}

/** The error-level heatmap of a photo, computed in the browser when `on`; nothing leaves the device. */
export function useEla(url: string, on: boolean): { src: string | null; failed: boolean } {
  const [state, setState] = React.useState<{ url: string; src: string | null; failed: boolean }>({ url, src: null, failed: false });
  React.useEffect(() => {
    if (!on) return;
    let ignore = false;
    if (!done.has(url)) done.set(url, compute(url));
    done.get(url)!.then(
      (src) => !ignore && setState({ url, src, failed: false }),
      () => {
        done.delete(url);
        if (!ignore) setState({ url, src: null, failed: true });
      },
    );
    return () => {
      ignore = true;
    };
  }, [url, on]);
  return state.url === url ? { src: state.src, failed: state.failed } : { src: null, failed: false };
}
