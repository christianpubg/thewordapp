import { words, keyOf, cleanWord, validWord, json, rpc } from "../lib/shared.mjs";

/*
  POST /api/confirm  { word, tx }
  Looks the transaction up on Solana. If it succeeded and created this word's mint,
  the word is marked live for good.
*/
export default async req => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const w = cleanWord(b.word), sig = String(b.tx || "");
  if (!validWord(w) || !sig) return json({ error: "Bad request" }, 400);

  const store = words(), key = keyOf(w);
  const rec = await store.get(key, { type: "json" });
  if (!rec) return json({ error: "No claim found for this word" }, 400);
  if (rec.status === "live") return json({ status: "live", mint: rec.mint });

  let tx = null;
  try { tx = await rpc("getTransaction", [sig, { encoding: "json", commitment: "confirmed", maxSupportedTransactionVersion: 0 }]); } catch {}
  if (!tx) return json({ status: "pending" }, 202);
  if (tx.meta?.err) return json({ error: "The launch transaction failed on-chain" }, 400);

  const keys = tx.transaction?.message?.accountKeys || [];
  if (!keys.includes(rec.mint) || keys[0] !== rec.wallet) return json({ error: "That transaction isn't this word's launch" }, 400);

  const live = { ...rec, status: "live", tx: sig, at: Date.now() };
  await store.setJSON(key, live);
  return json({ status: "live", mint: rec.mint });
};

export const config = { path: "/api/confirm" };
