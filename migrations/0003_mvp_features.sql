-- AlterTable
ALTER TABLE "User" ADD COLUMN "selfieUrl" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Outfit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "occasion" TEXT,
    "weather" TEXT,
    "style" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Outfit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Outfit" ("createdAt", "id", "rationale", "userId") SELECT "createdAt", "id", "rationale", "userId" FROM "Outfit";
DROP TABLE "Outfit";
ALTER TABLE "new_Outfit" RENAME TO "Outfit";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
