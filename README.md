# Word: going live on Netlify

Every word is a coin, first come first served. This folder is the whole site:

- `public/index.html`: the website
- `netlify/functions/`: the server (claims, launches, confirmations)
- Claimed words are stored in Netlify Blobs, Netlify's built-in storage. There's no database to set up.

## What happens when someone claims a word

1. They connect a wallet (Phantom, Solflare or Backpack).
2. They sign a free message proving it's their wallet.
3. The server reserves the word for 10 minutes. Nobody else can take it during that time.
4. The coin gets no image. Its details file (name, ticker, description) is served from your own site at `/api/meta/<word>`.
5. PumpPortal builds the pump.fun create transaction, with no dev buy.
6. Their wallet signs and sends it. They pay the small network and creation fee.
7. The server checks the transaction on Solana and marks the word as live for good.

If they cancel or the launch fails, the word frees up again after 10 minutes.

## Setup (about 15 minutes)

### 1. Put the site on Netlify
Pick one:
- **Netlify CLI:** in this folder, run `npm install`, then `npx netlify deploy --prod`
- **GitHub:** push this folder to a repo, then in Netlify go to **Add new site → Import from Git**

Dragging and dropping the folder won't work, because the functions need building.

### 2. Add environment variables
In Netlify, go to **Site configuration → Environment variables**:

| Name | Value | Needed |
|---|---|---|
| `RPC_URL` | a Solana RPC URL from Helius, QuickNode or similar. Their free tiers are fine. | strongly recommended |
| `SITE_URL` | your site, e.g. `https://word.fun`. The coin details link uses this, so set it to your final domain **before** the first launch | strongly recommended |
| `X_URL` | your X profile link | optional |
| `DEV_BUY` | SOL to buy at launch. Default `0`, meaning no dev buy | optional |
| `PRIORITY_FEE` | default `0.0005` SOL | optional |

Redeploy after adding these.

### 3. Change your handle in the page
At the top of the script in `public/index.html`:
```js
const CONFIG = { HANDLE: "@wordfun", SITE: "word.fun", API: "/api" };
```

### 4. Test it
Claim a throwaway word with a wallet holding about 0.05 SOL. You should get a wallet popup to sign the message, then one to approve the launch, and after a few seconds the coin is live and appears on pump.fun.

## Good to know
- **No image:** coins launch without a picture and show blank on pump.fun. Each coin's details file is served by your site, so keep the site (and its domain) up. If it goes down, pump.fun can't load the description, but the coin still trades.
- **The demo only shows when the server isn't there.** Opened as a local file or in a preview, the site runs a demo. On Netlify, once `/api/words` answers, it switches to real claims only, and all the demo words and fake activity disappear.
- **First come, first served applies on Word.** Anyone could still launch a coin with the same name directly on pump.fun. Being first on Word gets you the official one.
- **No dev buy:** PumpPortal's docs don't say whether `amount: 0` is accepted. If launches fail with an amount error, set `DEV_BUY` to something tiny like `0.0001`.
- **The public Solana RPC is slow and rate-limited.** Use a free Helius key for `RPC_URL`.
- **Market caps:** the "Already taken" wall shows real claimed words and who claimed them. Live prices need a market data API, which can be added later.
