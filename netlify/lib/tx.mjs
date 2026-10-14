/* tiny Solana transaction helpers, so the server doesn't need @solana/web3.js */
import nacl from "tweetnacl";
import bs58 from "bs58";

export function newKeypair(){ const kp = nacl.sign.keyPair(); return { publicKey: bs58.encode(kp.publicKey), secretKey: kp.secretKey, pub: kp.publicKey }; }

export function isAddress(a){ try { return bs58.decode(String(a)).length === 32; } catch { return false; } }

export function verifySig(message, sigB58, walletB58){
  try { return nacl.sign.detached.verify(new TextEncoder().encode(message), bs58.decode(sigB58), bs58.decode(walletB58)); } catch { return false; }
}

function shortvec(buf, off){ let len = 0, size = 0; for (;;) { const b = buf[off + size]; len |= (b & 0x7f) << (7 * size); size++; if (!(b & 0x80)) break; } return [len, size]; }

/* add the mint key's signature to a serialized (legacy or v0) transaction */
export function signWith(txBytes, kp){
  const tx = new Uint8Array(txBytes);
  const [nSig, s1] = shortvec(tx, 0);
  const msgStart = s1 + nSig * 64;
  const msg = tx.slice(msgStart);
  let o = (msg[0] & 0x80) ? 1 : 0;
  const numReq = msg[o]; o += 3;
  const [nKeys, s2] = shortvec(msg, o); o += s2;
  let idx = -1;
  for (let i = 0; i < nKeys; i++) {
    const k = msg.subarray(o + 32 * i, o + 32 * i + 32);
    if (k.every((b, j) => b === kp.pub[j])) { idx = i; break; }
  }
  if (idx < 0 || idx >= numReq || idx >= nSig) throw new Error("Mint isn't a signer on this transaction");
  tx.set(nacl.sign.detached(msg, kp.secretKey), s1 + idx * 64);
  return tx;
}
