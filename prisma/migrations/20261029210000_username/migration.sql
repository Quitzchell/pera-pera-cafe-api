-- displayName becomes the login username. Existing rows get the part of their email before
-- the @, lowercased and reduced to the allowed characters.
ALTER TABLE "User" RENAME COLUMN "displayName" TO "username";

UPDATE "User"
SET "username" = lower(regexp_replace(split_part("email", '@', 1), '[^a-zA-Z0-9_-]', '', 'g'));

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
