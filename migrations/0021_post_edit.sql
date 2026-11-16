-- Social feed: editing published posts. Additive only: two new optional columns; no existing data changes.

-- The editor's layout behind the post picture (positions, turns, crops, text, board color) as JSON, so its owner can
-- rearrange it later. Only ever sent to the owner; its pictures are kept privately under private/board/<userId>/.
-- Null for photos that were never opened in the editor (and for posts made before this).
ALTER TABLE "Post" ADD COLUMN "board" TEXT;

-- "Only me": the piece's name and picture stay public, but its brand, store, link and price are shown only to its owner.
ALTER TABLE "PostItem" ADD COLUMN "detailsPrivate" BOOLEAN NOT NULL DEFAULT false;
