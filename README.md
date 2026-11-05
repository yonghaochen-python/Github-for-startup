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
- **Top 3 picks:** three outfits from your closet to compare before choosing one. With a Style Profile they're **Picks in your colors**. On computers they're to the right of the photo; on phones they're below it.
- **Style it:** type a theme (old money, first date…) for AI outfit ideas that also follow your style direction and colors, or leave it empty for 3 new free picks.
- **One button:** **Try On** puts the outfit on your photo with AI. If an earlier try-on is showing, it says **Update photo**.
- **Save**, **Share** and **Undo** as icon buttons. **Change photo** is on the photo.
- **Live:** live AI try-on on your camera, 20 seconds per session (see limits below).
- **Your outfit** panel and closet / shop tabs on the side to add or swap pieces.

### AI Stylist — "Your Style, Decoded."
A personal beauty and fashion consultation, made from a head-and-shoulders photo of you.

**Your photo**
- **Take a selfie** right on the page, **Upload** one, or **Use Studio photo** (zoomed to your face).
- You see it first, and it's used only when you press **Use this photo**.

**The four analyses** (each card shows a preview, a one-line description and its status: Not started, Analyzing…, Completed or From earlier photo)
1. **Seasonal Color Analysis:** your season, undertone, the colors that suit you, and colors to go easy on.
2. **Makeup Guide:** shades for lips, blush, eyes and brows, with a preview on your own photo.
3. **Hair & Color Guide:** cuts, lengths, bangs and partings, with hair colors tried on your photo.
4. **Personal Style Guide:** your style direction, jewelry, and a look from your own closet (swap or remove pieces, then **Try it on** in Studio).

**Each report**
- **Before / after slider** on your own photo (made on your device, free).
- Color swatches, **Download** and **Share** as a picture, and optional feedback: Helpful · Not accurate · Not my style · Colors don't look right · Suggestions aren't practical.
- Saved, so opening, downloading and sharing it again is free.

**Your Style Profile**
- Colors, makeup, hair, style and jewelry in one place, from your newest reports. Works with any number of analyses done.
- **Style my closet →** opens Studio with **Picks in your colors**.

**Nothing paid runs by itself**
- An analysis is made only when you press **Analyze** (1 photo credit).
- A new photo doesn't remake anything: older reports are marked **From earlier photo**, each with a **Refresh** button.
- A report that's being made keeps going if you leave the page.

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
- **Bad ratings:** the first Bad rating each month on a real photo or live try-on gives +2 photo and +2 live credits as a thank-you.

### Admin (admins only)
- Sign-ups, usage and AI costs, and a cost calculator per plan.
- **AI Stylist usage:** analyses per type, people, AI cost and failures, plus which feedback options people picked.
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

## Latest updates (live since November 5, 2026)

- Studio: numbered pieces + you trimmed head to toe, top 3 picks, the one **Try On / Update photo** button, the phone-first layout.
- Studio: Save / Share / Undo moved off the face, next to the photo.
- AI Stylist (the 8-stage upgrade):
  - **Your Style, Decoded.** homepage with four cards (preview, status, Analyze / View report).
  - Photo step: selfie, Upload or Studio photo → preview → Use this photo.
  - Nothing runs by itself: a new photo marks reports "From earlier photo", each with **Refresh**.
  - Before / after sliders on every report (made on your device, free).
  - Feedback: Helpful · Not accurate · Not my style · Colors don't look right · Suggestions aren't practical.
  - **Your Style Profile:** colors, makeup, hair, style and jewelry in one place, from your saved reports.
  - Studio's free picks become **Picks in your colors**; Style it uses your style direction and colors.
  - Admin: AI Stylist usage and AI cost per analysis type.
  - Icon Share / Download buttons; reports keep going if you leave the page.

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
