# Virtual Mirror

AI-powered digital closet MVP: upload photos of your clothes, Claude classifies each item, and you can generate outfit combinations from what you already own.

This is the first-cut MVP scope — see the full product vision as it grows.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- [Prisma](https://www.prisma.io) + SQLite for the database
- [Claude API](https://docs.anthropic.com) (`@anthropic-ai/sdk`) for both clothing recognition (vision) and outfit generation (text)
- Uploaded photos are stored locally under `public/uploads` (not committed to git)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the env template and add your own Anthropic API key:
   ```bash
   cp .env.example .env.local
   ```
   Then open `.env.local` and set `ANTHROPIC_API_KEY` (get one from the [Anthropic Console](https://console.anthropic.com)). Leave `DATABASE_URL` as-is.
3. Create the database:
   ```bash
   npx prisma migrate dev
   ```
4. Run the dev server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000), go to **Closet**, and upload a few clothing photos. Once you have 2+ items, go to **Outfits** and generate a combination.

## Project structure

- `src/app/closet` — upload UI + closet grid
- `src/app/outfits` — outfit generation UI
- `src/app/api/closet/items` — upload, classify (Claude vision), list, delete
- `src/app/api/outfits` — list saved outfits
- `src/app/api/outfits/generate` — generate new outfits from the closet (Claude text)
- `src/lib` — Prisma client, Anthropic client, image saving, classification, and outfit-generation logic
- `prisma/schema.prisma` — data model (`ClothingItem`, `Outfit`, `OutfitItem`)
