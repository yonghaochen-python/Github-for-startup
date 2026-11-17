# Virm — your virtual mirror for personal styling

Virm is an AI wardrobe app. You put your clothes in a digital closet, get outfit ideas from what you already own, see them on a photo of yourself (or live on camera), and get a personal color, makeup, hair and style analysis.

- **Live site:** https://virm-virtualmirror.yonghaochen.workers.dev
- **Made for phones first**, then computers. A bottom tab bar on phones, a top bar on computers.
- **Menu:** Home · Discover · My Closet · Studio · Planner (more: Shopping · AI Stylist · Saved Looks · Profile)
- **Live vs. demo:** everything below is in the demo on your computer. Items marked **(not live yet)** aren't on the live site yet.

---

## What's in the demo

**Getting around:** five main places, **Home · Discover · My Closet · Studio · Planner** (top bar on computers, bottom bar on phones). Discover is **(not live yet)**; on the live site it's four. **More** holds Shopping, AI Stylist and Saved Looks; your photo opens Profile, Admin and Log out (on phones it also holds Shopping, AI Stylist and Saved Looks). Works with a keyboard and screen readers, and up to 400% zoom.

### Home
- Signed in: a greeting beside your photo, **Your Next Step** (one suggestion based on where you are), **This Week** (your planned outfits), **My Closet** and **Saved Looks** with real counts, and **Recent** (the last two weeks).
- Signed out: **Your wardrobe. Reimagined.** with **Try It Free**, Create Account and Log In, and demo looks on a model.
- **Try it free:** Studio's mirror with a demo model and 20 ready-made looks. Tap a piece to see every look made with it. No AI, no account, nothing saved.

### My Closet
- Sliding rows of your clothes by type: tops, bottoms, dresses, outerwear, shoes, accessories.
- **Add clothes:** one photo per piece, or one photo of several pieces laid out flat. The AI finds each piece and fills in its type, color, material, season and how it's layered.
- **Edit** or **remove** any piece. Filters are behind a small icon.
- **Remove background** per piece, done on your phone or computer (free, nothing uploaded). **Keep background** undoes it.
- **Enhance with AI** (everyone; each month as many as your plan allows clothing photos — Free 30, Plus 150, trial 40 or 80 — admins and SVIP unlimited; the same picture again is free): one button lays the piece neatly flat and removes the background. It starts from your original photo, keeps the piece's real length (a cropped top stays cropped) and matches its color to your photo. About a minute, about $0.04 each. Switch between the AI picture and your own any time; try-ons always use your own picture.
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

### Discover (the outfit feed) **(not live yet)**
- **The feed:** one outfit per screen on phones (swipe up), columns on computers. Anyone can look, even without an account.
- **On each post:** ♥ like (count shown), 👎 not for me (private, only you know), ↗ share, 🔖 save. Saved posts go to **Saved Looks → Inspiration**.
- **Recreate with My Closet:** each piece of the post is matched to the closest piece in your closet. Pick **Yours** or **Theirs** for each, then **Open in Studio** dresses you in it. Matching is free; nothing is made until you press Try On.
- **Post an outfit (＋):**
  - **Photo:** your own outfit picture.
  - **A saved look:** one of your try-ons.
  - **Build an outfit:** choose pieces from your closet, from Shopping, or any store (paste a link or add a photo). Backgrounds are removed on your device and the pieces are laid out as a neat outfit board. Move, pinch to resize and layer them like a story post. One outfit per post: 1 jacket, up to 2 tops, 1 bottom or dress, 1 pair of shoes, up to 3 accessories.
  - Add a caption, style and occasion tags, and each piece's name, brand, store, price and link (**Shop** button on the post).
  - 10 posts a day per person. A back arrow at the top; after posting you land on your post.
- **Profiles:** @username, bio and picture at **/u/username**, with a grid of that person's posts. Set them up in Profile.
- **Safety:** Report a post (nudity, harassment, hate, someone else's photo, spam, other). 3 reports hide it until an admin reviews it in **Admin → Posts**. Owners and admins can delete posts.
- **Privacy:** posts use their own public copies of pictures. Your closet, emails and private photos are never shown, and nobody sees which closet piece a post came from.

### Shopping
- **Your Shopping Try-Ons:** pieces you've added from stores, with store, name and price. Kept apart from My Closet, and saved on your device.
- Tap a piece → **Add to Studio**: it joins the look you already have there. Nothing is made by AI until you press Try On.
- Admin only: **Store Preview** (Admin → Store Preview) with placeholder shelves for Allbirds, Alo Yoga, Taylor Stitch, Tentree and Cuyana. No real products, nothing read from their websites, no partnership.

### Planner
- Pick a month and press **Generate Plan**: an outfit for every day from today on (or every day of a future month), made from your own closet.
- It leans toward the season, your colors and your style (with a Style Profile), and rotates your pieces. The same outfit never repeats within a Monday–Sunday week.
- Tap a day: your outfit on the left (Replace / Remove), My Closet on the right. **Generate** suggests another outfit for that day only; **Keep** or **Save** it. **Try On** opens Studio.
- Days you chose or edited are kept (marked with a small gold dot) when you plan the month again; Virm asks before replacing a plan. Each month is saved on its own.
- Free: no AI and no photos. A photo is only made when you press Try On in Studio.

### What costs money (and what doesn't)
- Paid AI work: photo try-on and AI Stylist reports (photo credits), live try-on (live credits, its own allowance), and, without credits, adding clothes, Style it and outfit explanations.
- Free: browsing, Top 3 Picks, the Planner, cut-outs, sliders, and anything shown again — a try-on of the same pieces on the same photo (Studio and Shopping), a repeated Style it search, a reopened, downloaded or shared report.
- Profile shows what this month's photo credits went on (try-ons and reports). Admin → **AI costs** shows new (paid) results and free reuse per feature, with exact costs from the providers' usage counts and photo try-on marked as an estimate.

### Saved Looks
- Your saved outfits, each with its pieces numbered and the whole look (your try-on of it if you have one).
- **Try On**, **Share**, **Remove**.

### Sharing with friends
- Pick up to 4 tried-on looks and send one link. Friends vote for their favorite (or ♥ a single look).
- Links last 48 hours. Send by the phone's share sheet, iMessage, WhatsApp, X, Pinterest, Email, Copy link or Save image.

### Profile
- Your account, your saved try-on photo, credits left this month, Log out. On phones, Admin is here too for admins.

### Plans and credits (Upgrade)
| Plan | Price | Photo try-ons | Live try-ons | Clothing photos | Style it |
|---|---|---|---|---|---|
| Free | $0 | 10 / month | 2 / month | 30 / month | 10 / month |
| Plus | $14.99 / month | 60 / month | 15 / month | 150 / month | 60 / month |

- **Payments are live** (Stripe). Limits are enforced: when you run out, Virm offers the trial or Plus.
- **Free trial of Plus:** 7 days (15 photo, 3 live, 4 AI Stylist reports, 40 clothing photos, 20 Style it). With a **friend's invite code**, 14 days with double the amounts. A card is saved but nothing is charged unless you choose Plus. Only before your first paid month.
- **Plus rollover:** unused photo and live try-ons carry over one month (up to one month's worth), on top of the new month's.
- **Manage Plus** in Profile opens Stripe to change the card or cancel (Plus lasts to the end of the paid month).
- A photo try-on or an AI Stylist analysis uses 1 photo credit, only if it works. Live try-on is also capped at 3 a day per person and 50 a day for the whole site.
- **SVIP** (set by an admin): no monthly limits, but live try-on is still capped at 10 a day. Not an admin.
- **Bad ratings:** the first Bad rating each month on a real photo or live try-on gives +2 photo and +2 live credits as a thank-you.
- Pro ($24.99) exists but is hidden until Plus proves itself.

### Admin (admins only)
- Sign-ups, usage and AI costs, and a cost calculator per plan.
- **AI Stylist usage:** analyses per type, people, AI cost and failures, plus which feedback options people picked.
- A tool to give test credits, and **Make SVIP / Remove SVIP** by email.
- **Trials & Plus:** trials started, trial-to-paid, Plus members.
- **Posts** **(not live yet)**: reported posts to review, and who may post.

### Other pages
How it works · Pricing · About · Contact · Privacy · Terms · Reset password.

---

## Privacy in short
- Your try-on photo and AI Stylist photo are private: only you can open them.
- Background removal and the person trim happen on your device.
- Photos go to an AI provider only when you ask for a try-on or an analysis.
- Backups made before big changes are deleted within 30 days.
- Payments are handled by Stripe; Virm never sees your card number.
- Discover posts are public on purpose; everything else stays private. **(not live yet)**

---

## Latest updates

**Demo only (not live yet):**
- Discover: the outfit feed, posting (Photo, A saved look, Build an outfit with the story-style board), profiles, likes / saves / private dislikes, reports and Admin → Posts, **Recreate with My Closet**, back arrows. Needs `bash scripts/go-live-social.sh` (adds the new database tables, then publishes).

**Live since November 10–13, 2026:**
- Payments (Stripe), free trial, invite-code 14-day trial, Plus rollover, limits enforced.
- SVIP accounts.
- Enhance with AI (admins): one button, original photo, keeps length and color.

**Live since November 5, 2026:**

- Studio fitting room: tap a numbered piece to **Replace** or **Remove** it; the photo always says what it is (AI try-on, Earlier try-on, Your photo); quick theme chips; a color filter in the closet; a bottom drawer on phones.
- New Home: signed-in dashboard and a new signed-out page; **Try it free** rebuilt as a demo fitting room.
- Fewer words everywhere: captions that repeated titles are gone.
- Shopping: **Your Shopping Try-Ons** with **Add to Studio**; Store Preview moved to an admin page with placeholders only.

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
- **Black Forest Labs FLUX 3**: Enhance with AI (admins).
- **Stripe**: payments and trials.
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
