import { words, expired, json } from "../lib/shared.mjs";

/* GET /api/words → every claimed word (live, plus ones being launched right now) */
export default async () => {
  const store = words();
  const { blobs } = await store.list({ prefix: "w/" });
  const recs = await Promise.all(blobs.slice(0, 2000).map(b => store.get(b.key, { type: "json" })));
  const out = recs.filter(r => r && !expired(r)).map(r => ({ word: r.word, wallet: r.wallet, mint: r.status === "live" ? r.mint : null, status: r.status, at: r.at }));
  return json({ words: out });
};

export const config = { path: "/api/words" };
