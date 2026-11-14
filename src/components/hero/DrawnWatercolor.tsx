"use client";

import * as React from "react";
import NextImage from "next/image";

// Our watercolour reveal, written for Delta. Three inputs per scene, all made by
// scripts/render-hero-from-art.ts from the hero illustrations:
//   <art>.webp        the finished painting (also the still frame and the no-WebGL fallback)
//   <art>-ink.webp    R: when each ink line is drawn (0..1), G: where the ink is
//   <art>-wash.webp   R: when the colour wash reaches each place (0..1)
// Ink lines draw on bare paper first; then the colour arrives in pools with a ragged, darker wet
// front that dries back to the finished painting. The last frame equals the still image.

export interface DrawnWatercolorMeta {
  inkEnd: number;
  washFrom: number;
  washEnd: number;
  paper: number[];
}

export interface DrawnWatercolorProps {
  art: string;
  alt: string;
  meta: DrawnWatercolorMeta;
  paused?: boolean;
}

export const heroArtFiles = (art: string) => [`/images/hero/${art}.webp`, `/images/hero/${art}-ink.webp`, `/images/hero/${art}-wash.webp`] as const;

const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D u_paint;
uniform sampler2D u_ink;
uniform sampler2D u_wash;
uniform vec2 u_res;
uniform float u_t;
uniform float u_inkEnd;
uniform float u_washFrom;
uniform float u_washEnd;
uniform vec3 u_paper;
out vec4 o;

float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + 1.0), f.x), f.y);
}

void main() {
  vec2 uv = vec2(gl_FragCoord.x / u_res.x, 1.0 - gl_FragCoord.y / u_res.y);
  vec3 paint = texture(u_paint, uv).rgb;
  vec2 ink = texture(u_ink, uv).rg;
  float washAt = mix(u_washFrom, u_washEnd, texture(u_wash, uv).r);

  // the wet front: ragged at two scales, as pigment creeps along the paper's grain
  float rag = 0.6 * n(uv * vec2(150.0, 75.0)) + 0.4 * n(uv * vec2(460.0, 230.0));
  float front = (u_t - washAt) / 0.3 + (rag - 0.5) * 1.8;
  float wet = clamp(front, 0.0, 1.0);
  float age = max(u_t - washAt, 0.0);
  float rim = exp(-max(front, 0.0) * 1.4) * step(0.0, front) * (1.0 - smoothstep(0.0, 1.1, age));

  vec3 col = mix(u_paper, paint, wet);
  col *= 1.0 - 0.24 * rim;

  // ink on bare paper, before the colour reaches it; the painting already holds the lines
  float drawn = smoothstep(0.0, 0.14, u_t - ink.r * u_inkEnd) * ink.g;
  col = mix(col, vec3(0.2, 0.28, 0.32), 0.6 * drawn * (1.0 - wet));
  o = vec4(col, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader did not compile");
  return s;
}

function texture(gl: WebGL2RenderingContext, img: HTMLImageElement, unit: number) {
  const t = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

const load = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });

// idle: bare paper, nothing drawn yet. drawing: the canvas covers the still. done: the still alone.
type Phase = "idle" | "drawing" | "done";

export function DrawnWatercolor({ art, alt, meta, paused = false }: DrawnWatercolorProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const pausedRef = React.useRef(paused);
  React.useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    // no motion wanted, or no WebGL2: the finished painting, at once
    const gl = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? null : canvas.getContext("webgl2", { alpha: false, antialias: false });
    if (!gl) {
      const t = setTimeout(() => setPhase("done"), 0);
      return () => clearTimeout(t);
    }

    let frame = 0;
    let disposed = false;
    const owned: { textures: WebGLTexture[]; program: WebGLProgram | null } = { textures: [], program: null };

    void (async () => {
      try {
        const [paint, ink, wash] = await Promise.all(heroArtFiles(art).map(load));
        if (disposed || !paint || !ink || !wash) return;
        const program = gl.createProgram()!;
        gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
        gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("program did not link");
        owned.program = program;
        gl.useProgram(program);
        owned.textures = [texture(gl, paint, 0), texture(gl, ink, 1), texture(gl, wash, 2)];
        const u = (name: string) => gl.getUniformLocation(program, name);
        gl.uniform1i(u("u_paint"), 0);
        gl.uniform1i(u("u_ink"), 1);
        gl.uniform1i(u("u_wash"), 2);
        gl.uniform1f(u("u_inkEnd"), meta.inkEnd);
        gl.uniform1f(u("u_washFrom"), meta.washFrom);
        gl.uniform1f(u("u_washEnd"), meta.washEnd);
        gl.uniform3f(u("u_paper"), meta.paper[0] ?? 0.957, meta.paper[1] ?? 0.945, meta.paper[2] ?? 0.918);
        const uRes = u("u_res");
        const uT = u("u_t");
        const end = meta.washEnd + 1.4;
        let t = 0;
        let last = 0;

        const draw = (now: number) => {
          if (disposed) return;
          if (last) t += pausedRef.current ? 0 : (now - last) / 1000;
          else setPhase("drawing");
          last = now;
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const w = Math.round(box.clientWidth * dpr);
          const h = Math.round(box.clientHeight * dpr);
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }
          gl.viewport(0, 0, w, h);
          gl.uniform2f(uRes, w, h);
          gl.uniform1f(uT, t);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          if (t >= end) setPhase("done");
          else frame = requestAnimationFrame(draw);
        };
        frame = requestAnimationFrame(draw);
      } catch {
        // a missing file or a driver without WebGL2 features: show the finished painting
        if (!disposed) setPhase("done");
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      owned.textures.forEach((tex) => gl.deleteTexture(tex));
      if (owned.program) gl.deleteProgram(owned.program);
    };
  }, [art, meta]);

  return (
    <div ref={boxRef} data-phase={phase} className="dw-fig relative aspect-[2/1] w-full overflow-hidden">
      {/* the finished painting: the still frame, the reduced-motion view, and what the canvas ends on.
          Unoptimised, so the file is served as it is and the canvas lies on exactly the same pixels. */}
      <NextImage src={`/images/hero/${art}.webp`} alt={alt} width={1800} height={900} unoptimized className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      {phase !== "done" && <canvas ref={canvasRef} aria-hidden="true" className="dw-canvas pointer-events-none absolute inset-0 h-full w-full" />}
    </div>
  );
}
