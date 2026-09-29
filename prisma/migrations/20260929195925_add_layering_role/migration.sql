-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ClothingItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "layeringRole" TEXT NOT NULL DEFAULT 'mid_layer',
    "warmth" TEXT NOT NULL DEFAULT 'medium',
    "color" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "formality" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClothingItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ClothingItem" ("category", "color", "createdAt", "description", "formality", "id", "imageUrl", "material", "pattern", "season", "userId") SELECT "category", "color", "createdAt", "description", "formality", "id", "imageUrl", "material", "pattern", "season", "userId" FROM "ClothingItem";
DROP TABLE "ClothingItem";
ALTER TABLE "new_ClothingItem" RENAME TO "ClothingItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
