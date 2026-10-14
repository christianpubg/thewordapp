import { getStore } from "@netlify/blobs";

/* how long an unconfirmed claim holds a word before anyone else can take it */
export const HOLD_MS = 10 * 60 * 1000;

export const words = () => getStore({ name: "words", consistency: "strong" });
export const keyOf = w => "w/" + w;
export const ticker = w => w.toUpperCase().slice(0, 10);
export const cleanWord = w => String(w || "").toLowerCase().trim();
export const validWord = w => /^[a-z]{1,20}$/.test(w);
export const expired = rec => rec.status !== "live" && Date.now() - rec.at > HOLD_MS;

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const rpcUrl = () => process.env.RPC_URL || "https://api.mainnet-beta.solana.com";
export async function rpc(method, params){
  const r = await fetch(rpcUrl(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "RPC error");
  return j.result;
}

/* ---------- real Solana coins whose ticker is a word (from DexScreener) ---------- */
export const MARKET_WORDS = "buy sell moon sun cat dog frog bull bear king god gold money rich love fire send pump win based".split(" ");
const MARKET_TTL = 10 * 60 * 1000;
const DS = "https://api.dexscreener.com";

async function pool(items, n, fn){ const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch { out[k] = null; } } })); return out; }

async function lookupWord(w){
  const r = await fetch(`${DS}/latest/dex/search?q=${encodeURIComponent(w)}`, { signal: AbortSignal.timeout(4000) });
  if (!r.ok) return null;
  const { pairs = [] } = await r.json();
  const hits = pairs.filter(p => p.chainId === "solana" && String(p.baseToken?.symbol || "").toUpperCase() === w.toUpperCase() && (p.liquidity?.usd || 0) > 2000);
  if (!hits.length) return null;
  const best = hits.sort((a, b) => (b.marketCap || b.fdv || 0) - (a.marketCap || a.fdv || 0))[0];
  return { word: w, ca: best.baseToken.address, mc: best.marketCap || best.fdv || 0, ch: best.priceChange?.h24 ?? null, at: best.pairCreatedAt || 0 };
}

/* cached list, refreshed at most every 10 minutes */
export async function market(){
  const store = words();
  const cached = await store.get("market/cache", { type: "json" });
  if (cached && Date.now() - cached.at < MARKET_TTL) return cached.items;
  const items = (await pool(MARKET_WORDS, 10, lookupWord)).filter(Boolean);
  if (items.length) await store.setJSON("market/cache", { at: Date.now(), items });
  return items.length ? items : (cached?.items || []);
}

/* market caps for coins launched on Word */
export async function caps(mints){
  const out = {};
  for (let i = 0; i < mints.length; i += 30) {
    try {
      const r = await fetch(`${DS}/tokens/v1/solana/${mints.slice(i, i + 30).join(",")}`, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) continue;
      for (const p of await r.json()) { const a = p.baseToken?.address; const mc = p.marketCap || p.fdv || 0; if (a && mc > (out[a]?.mc || 0)) out[a] = { mc, ch: p.priceChange?.h24 ?? null }; }
    } catch {}
  }
  return out;
}
