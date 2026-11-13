// These tests need the local stack (pnpm dev:local). Playwright reuses whatever answers on port
// 3000, and a plain `pnpm dev` there (hosted database, no evidence storage) fails them halfway
// with errors that point nowhere. The local stack is the only server whose development upload
// route exists: it refuses a bad token with 403, where every other server answers 404.
export default async function globalSetup() {
  const res = await fetch("http://localhost:3000/api/dev/storage", { method: "PUT", headers: { authorization: "none", "x-pathname": "none" } });
  if (res.status !== 403) {
    throw new Error("The server on port 3000 is not the local stack. Stop it (it is probably `pnpm dev` or `npm run dev`) and run pnpm test:e2e again: it starts the local stack itself.");
  }
}
