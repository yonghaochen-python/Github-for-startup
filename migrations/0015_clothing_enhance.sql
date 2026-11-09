-- AI clothing enhancement (admins only for now): a closet piece can keep an AI-tidied picture beside its own. plainUrl
-- is the picture shown before enhancing (the uploaded photo or its cut-out, never changed); enhancedUrl is the AI
-- version. imageUrl stays "the picture shown" and switches between the two without any new AI work. Additive only:
-- two optional columns; no existing data changes.

-- AlterTable
ALTER TABLE "ClothingItem" ADD COLUMN "plainUrl" TEXT;
ALTER TABLE "ClothingItem" ADD COLUMN "enhancedUrl" TEXT;
