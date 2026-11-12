import "server-only";

/**
 * The language model, behind a port (docs/08-AI.md): tests use a fake and never touch the
 * network. `observe` returns the model's raw JSON text, or throws. The caller validates every
 * byte of it; nothing the model says is trusted.
 */
export interface AiPort {
  readonly model: string;
  observe(input: { activity: string; images: { label: "before" | "after"; jpeg: Buffer }[] }): Promise<string>;
}

/** Thrown by an adapter when the provider asked us to slow down: worth retrying later. */
export class AiRateLimited extends Error {}
