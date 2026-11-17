-- Social feed: video posts. Additive only: two new optional columns; no existing data changes.

-- A video post's video (its own public copy in storage, postvideo-…); the post's picture is the cover frame the
-- person chose. Null for picture posts.
ALTER TABLE "Post" ADD COLUMN "videoKey" TEXT;
-- How long the video is, in milliseconds (measured on the device; videos are at most 60 seconds).
ALTER TABLE "Post" ADD COLUMN "videoMs" INTEGER;
