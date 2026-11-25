ALTER TABLE fanpages ADD COLUMN IF NOT EXISTS "syncedDates" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE fanpages ADD COLUMN IF NOT EXISTS "fullSync" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS "likesAvailable" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS "commentsAvailable" BOOLEAN NOT NULL DEFAULT TRUE;
-- Run once when upgrading legacy full-history syncs.
UPDATE fanpages SET "fullSync" = TRUE WHERE "lastSync" IS NOT NULL AND cardinality("syncedDates") = 0;
