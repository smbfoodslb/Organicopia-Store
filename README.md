# Organicopia — Retail Catalog (web)

A plain HTML/CSS/JavaScript site — no build step, no npm packages required,
no password gate. Customers browse Organicopia's own product line, pick a
pack size for each item (×1, ×3, or ×6 — the more they take, the less each
one costs), and tap **Checkout via WhatsApp**, which opens WhatsApp with
their order pre-filled to **+961 78 879 350**. They just tap Send to
confirm.

This is a separate site from the SMB Foods wholesale catalog — same look
and feel and the same WhatsApp checkout mechanism, but its own GitHub
repo and its own Vercel project, open to the public with no login.

## What's in here

- `index.html`, `style.css`, `app.js` — the whole site.
- `data/products.json` — all 71 Organicopia products, with volume pricing
  tiers, cross-checked against the wholesale catalog's product data.
- `images/` — product photos (reused from the wholesale catalog's photos
  where available), plus `placeholder.svg` for items without a photo yet.

## Deploying it (GitHub + Vercel), step by step

**1. Put this folder on GitHub as a brand-new repository**

- Go to [github.com](https://github.com) and log in.
- Click the **+** in the top right → **New repository**. Name it something
  like `organicopia-shop`. Leave it Public or Private (either works for
  Vercel). Click **Create repository**.
- On the new repo's page, click **uploading an existing file**.
- Drag this folder's contents in. There are about 65 files total (mostly
  images), so it should fit under GitHub's 100-file-per-upload limit in
  one go — if it doesn't, upload `index.html`, `style.css`, `app.js`,
  `data/`, `favicon.svg`, and `README.md` first and commit, then go back
  into the new repo, open the `images` folder (or create it by uploading
  one image), and use **Add file → Upload files** again for the rest —
  same trick we used for the wholesale site.

**2. Deploy it on Vercel**

- Go to [vercel.com](https://vercel.com) and sign in with the same GitHub
  account.
- Click **Add New… → Project**.
- Find `organicopia-shop` in the list and click **Import**.
- Vercel will detect it as a plain static site (**Framework Preset: Other**).
  Leave the build command and output directory blank/default.
- Click **Deploy**. In about 30 seconds you'll get a live link like
  `https://organicopia-shop.vercel.app`.

That's it — no environment variables, no password setup needed. That link
is ready to share with customers right away.

**Custom domain (optional):** in the Vercel project → **Settings → Domains**,
you can attach something like `shop.organicopia.com` if you own that domain.

## Updating the catalog later

The product data lives in a small Python file (kept alongside the
wholesale catalog's build scripts) so both catalogs can be kept in sync
from the same source of truth when needed:

```
cd catalog/build
python3 export_organicopia_retail_data.py
```

This rewrites `organicopia-shop/data/products.json` and re-copies any
product photos it references. Commit and push the changed files to
GitHub, and Vercel redeploys automatically. (Ask me to do this any time
prices, stock status, or the product list changes, and I'll keep it in
sync and hand you the updated files.)

## How pricing and checkout work

Each product shows three prices — buy 1, buy 3, or buy 6 — and the unit
price drops at each step. Customers pick a pack size to add it to their
cart; a −/+ stepper lets them fine-tune the quantity afterward, and the
price automatically re-prices to whichever tier they've reached (e.g. 4
or 5 units still gets the ×3 rate; 6+ gets the best rate).

There's no backend, database, or payment processing — the cart lives in
the customer's browser (private to their device, survives a refresh).
Checkout builds a plain-text order summary showing each item, its tier
price, and the total, and opens:

```
https://wa.me/96178879350?text=<order summary>
```

WhatsApp opens (app or web) with that message pre-filled in a chat to
your number; the customer taps **Send**.
