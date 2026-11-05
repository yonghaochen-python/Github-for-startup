# Virm — your virtual mirror for personal styling

Virm is an AI wardrobe app. You put your clothes in a digital closet, get outfit ideas from what you already own, see them on a photo of yourself (or live on camera), and get a personal color, makeup, hair and style analysis.

- **Live site:** https://virm-virtualmirror.yonghaochen.workers.dev
- **Made for phones first**, then computers. A bottom tab bar on phones, a top bar on computers.
- **Menu:** Home · Shopping · My Closet · Studio · AI Stylist · Saved Looks · Profile

---

## What's in the demo

### Home
- A personal dashboard once you're signed in: your photo, your closet, your saved looks, and a "Next" suggestion.
- Signed out: an intro to Virm, with **Try it free** (see outfits on a model, nothing saved), Log in and Create account.

### My Closet
- Sliding rows of your clothes by type: tops, bottoms, dresses, outerwear, shoes, accessories.
- **Add clothes:** one photo per piece, or one photo of several pieces laid out flat. The AI finds each piece and fills in its type, color, material, season and how it's layered.
- **Edit** or **remove** any piece. Filters are behind a small icon.
- **Remove background** per piece, done on your phone or computer (free, nothing uploaded). **Keep background** undoes it.
- Light yellow by day, deep blue at night.

### Studio (try clothes on)
- **The mirror:** the outfit's pieces numbered down the left (01, 02, 03…), and you on the right, trimmed head to toe. The trimming happens on your device for free.
- **Top 3 picks:** three outfits from your closet to compare before choosing one. On computers they're to the right of the photo; on phones they're below it.
- **Style it:** type a theme (old money, first date…) for AI outfit ideas, or leave it empty for 3 new free picks.
- **One button:** **Try On** puts the outfit on your photo with AI. If an earlier try-on is showing, it says **Update photo**.
- **Save**, **Share** and **Undo** as icon buttons. **Change photo** is on the photo.
- **Live:** live AI try-on on your camera, 20 seconds per session (see limits below).
- **Your outfit** panel and closet / shop tabs on the side to add or swap pieces.

### AI Stylist
Four analyses made from a head-and-shoulders photo of you:

1. **Seasonal Color Analysis:** your season, undertone, a palette of colors that suit you, and colors to go easy on.
2. **Makeup guide:** shades for lips, blush and more, with a preview on your own photo.
3. **Hair & color guide:** lengths, textures, bangs, parting and cuts, with hair colors tried on your photo.
4. **Personal style guide:** your style direction, plus a look made from your own closet (swap or remove pieces).

How it works:
- **Take a selfie** right on the page, or **Upload** a photo. You can also use your Studio photo.
- **Tap an analysis to start it.** It's saved, so opening it again is free.
- **New photo?** The analyses you had are remade for it by themselves (**Analyzing…** until ready).
- **Download** and **Share** a report as a picture.
- **Good / Bad** feedback on each report.

### Shopping
- **Your shopping try-ons:** pieces you've tried from the shop.
- Tap a piece to add it to your outfit in Studio.
- Admin-only preview of real store shelves (Allbirds, Alo Yoga, Taylor Stitch, Tentree, Cuyana). Not public until the brands give permission.

### Saved Looks
- Your saved outfits, each with its pieces numbered and the whole look (your try-on of it if you have one).
- **Try On**, **Share**, **Remove**.

### Sharing with friends
- Pick up to 4 tried-on looks and send one link. Friends vote for their favorite (or ♥ a single look).
- Links last 48 hours. Send by the phone's share sheet, iMessage, WhatsApp, X, Pinterest, Email, Copy link or Save image.

### Profile
- Your account, your saved try-on photo, credits left this month, Log out. On phones, Admin is here too for admins.

### Plans and credits (Upgrade)
| Plan | Price | Photo credits / month | Live sessions / month |
|---|---|---|---|
| Free | $0 | 10 | 2 |
| Plus | $14.99 | 60 | 15 |
| Pro | $24.99 | 100 | 30 |

- A photo try-on or an AI Stylist analysis uses 1 photo credit. A credit is used only if it works.
- **Live sessions are limited now.** Also 3 a day per person and 50 a day for the whole site.
- **Photo credits are only counted for now, not limited.**
- **No payments yet.** Paid buttons say "Coming soon."
- **Bad ratings:** the first Bad rating each month on a real result gives +2 photo and +1 live credit as a thank-you.

### Admin (admins only)
- Sign-ups, usage and AI costs, and a cost calculator per plan.
- A tool to give test credits.

### Other pages
How it works · Pricing · About · Contact · Privacy · Terms · Reset password.

---

## Privacy in short
- Your try-on photo and AI Stylist photo are private: only you can open them.
- Background removal and the person trim happen on your device.
- Photos go to an AI provider only when you ask for a try-on or an analysis.
- Backups made before big changes are deleted within 30 days.

---

## Saved but not live yet

These are on the `closet-shelf` branch and go live with "go live":

- Studio: numbered pieces + you trimmed head to toe, top 3 picks, the one **Try On / Update photo** button, the phone-first layout.
- Studio: Save / Share / Undo moved off the face, next to the photo.
- AI Stylist:
  - Selfie camera.
  - Tap to start.
  - Reports remade for a new photo.
  - Reports keep going if you leave the page.
  - Icon Share / Download buttons.

---

## For developers

**Built with**
- Next.js 16 run by **vinext** (Vite) on **Cloudflare Workers**.
- **Cloudflare D1** database through Prisma.
- **Cloudflare R2** for photos.

**AI used**
- **Claude** (Anthropic): reading clothes, outfit ideas, AI Stylist analyses.
- **Black Forest Labs FLUX** virtual try-on: photo try-on.
- **Decart**: live try-on.
- On-device and free: **MediaPipe** (person and face finding, recolor previews) and a small background-removal model (u2netp).

**Run it on your computer**
```bash
npm install
```
```bash
npm run dev:vinext
```
Then open http://localhost:3001.
- On your computer, the AI Stylist makes free **practice** reports. No AI is used and nothing is counted.

**Going live**
- Pushing to `main` deploys the live site automatically.
- Database changes are SQL files in `migrations/`. Each one is run on the live database (with a backup first) before the code that needs it goes live.

**Secrets**
- API keys live only in the Cloudflare Worker's settings and in your own `.env.local`.
- They are never in the code or on GitHub. See `.env.example` for the names.
