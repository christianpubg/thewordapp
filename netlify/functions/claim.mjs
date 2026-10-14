import { Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { words, keyOf, ticker, cleanWord, validWord, expired, json, market } from "../lib/shared.mjs";

/*
  POST /api/claim  { word, wallet, message, signature }
  1. checks the wallet really signed the claim message
  2. reserves the word (first come, first served)
  3. points the coin at its details file on this site (/api/meta/<word>), no image
  4. asks PumpPortal for the pump.fun create transaction (no dev buy by default)
  5. signs it with the new mint key and hands it back for the user's wallet to sign and send
*/
export default async req => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let b; try { b = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const w = cleanWord(b.word), wallet = String(b.wallet || ""), message = String(b.message || ""), sig = String(b.signature || "");
  if (!validWord(w)) return json({ error: "Words are letters only, up to 20" }, 400);

  /* 1. signature */
  let pk; try { pk = new PublicKey(wallet); } catch { return json({ error: "Bad wallet address" }, 400); }
  if (!message.includes(`"${w}"`) || !message.includes(wallet)) return json({ error: "Signed message doesn't match" }, 400);
  const t = Date.parse((message.match(/Time: (.+)/) || [])[1] || "");
  if (!t || Math.abs(Date.now() - t) > 5 * 60 * 1000) return json({ error: "Signature expired. Sign again" }, 400);
  let ok = false; try { ok = nacl.sign.detached.verify(new TextEncoder().encode(message), bs58.decode(sig), pk.toBytes()); } catch {}
  if (!ok) return json({ error: "Signature check failed" }, 401);

  /* words that are already real coins on Solana are taken */
  try { if ((await market()).some(c => c.word === w)) return json({ error: `"${w}" is already a coin on Solana` }, 409); } catch {}

  /* 2. reserve */
  const store = words(), key = keyOf(w);
  const rec = { word: w, wallet, status: "pending", at: Date.now() };
  const first = await store.setJSON(key, rec, { onlyIfNew: true });
  if (!first.modified) {
    const cur = await store.getWithMetadata(key, { type: "json" });
    const d = cur?.data;
    if (d && d.status === "live") return json({ error: `"${w}" is already taken` }, 409);
    if (d && !expired(d) && d.wallet !== wallet) return json({ error: `Someone is claiming "${w}" right now` }, 409);
    const again = cur ? await store.setJSON(key, rec, { onlyIfMatch: cur.etag }) : await store.setJSON(key, rec, { onlyIfNew: true });
    if (!again.modified) return json({ error: `"${w}" was just claimed by someone else` }, 409);
  }
  const release = async () => { const cur = await store.get(key, { type: "json" }); if (cur && cur.status !== "live" && cur.wallet === wallet) await store.delete(key); };

  try {
    /* 3. details file lives on this site, no image */
    const origin = (process.env.SITE_URL || new URL(req.url).origin).replace(/\/$/, "");
    const metaUri = `${origin}/api/meta/${w}`;

    /* 4. create transaction (user is the payer and creator) */
    const mint = Keypair.generate();
    const r = await fetch("https://pumpportal.fun/api/trade-local", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey: wallet, action: "create",
        tokenMetadata: { name: w, symbol: ticker(w), uri: metaUri },
        mint: mint.publicKey.toBase58(),
        denominatedInSol: "true", amount: Number(process.env.DEV_BUY || 0),
        slippage: 10, priorityFee: Number(process.env.PRIORITY_FEE || 0.0005), pool: "pump",
      }),
    });
    if (r.status !== 200) throw new Error("PumpPortal said: " + (await r.text()).slice(0, 160));

    /* 5. sign with the mint key; the user's wallet adds its signature and sends */
    const tx = VersionedTransaction.deserialize(new Uint8Array(await r.arrayBuffer()));
    tx.sign([mint]);
    await store.setJSON(key, { ...rec, mint: mint.publicKey.toBase58() });
    return json({ transaction: Buffer.from(tx.serialize()).toString("base64"), mint: mint.publicKey.toBase58() });
  } catch (e) {
    await release();
    return json({ error: e.message || "Launch failed" }, 502);
  }
};

export const config = { path: "/api/claim" };
