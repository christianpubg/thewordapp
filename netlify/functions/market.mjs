import { market, caps, words, expired, json } from "../lib/shared.mjs";

/* GET /api/market → real Solana coins whose ticker is a word, plus market caps for Word coins */
export default async () => {
  const store = words();
  const { blobs } = await store.list({ prefix: "w/" });
  const recs = (await Promise.all(blobs.slice(0, 500).map(b => store.get(b.key, { type: "json" })))).filter(r => r && r.status === "live" && !expired(r));
  const [coins, mcs] = await Promise.all([market(), caps(recs.map(r => r.mint).filter(Boolean))]);
  return new Response(JSON.stringify({ coins, caps: mcs }), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" } });
};

export const config = { path: "/api/market" };
