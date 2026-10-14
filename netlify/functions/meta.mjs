import { words, keyOf, ticker, cleanWord, validWord } from "../lib/shared.mjs";

/* GET /api/meta/<word> → the coin's details file that pump.fun reads (no image) */
export default async req => {
  const w = cleanWord(new URL(req.url).pathname.split("/").pop());
  if (!validWord(w)) return new Response("Not found", { status: 404 });
  const rec = await words().get(keyOf(w), { type: "json" });
  if (!rec) return new Response("Not found", { status: 404 });
  const site = (process.env.SITE_URL || new URL(req.url).origin).replace(/\/$/, "");
  const meta = {
    name: w,
    symbol: ticker(w),
    description: `The word "${w}". Claimed on Word.`,
    image: "",
    showName: true,
    createdOn: site,
    website: site,
    twitter: process.env.X_URL || "",
    telegram: "",
  };
  return new Response(JSON.stringify(meta), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" } });
};

export const config = { path: "/api/meta/*" };
