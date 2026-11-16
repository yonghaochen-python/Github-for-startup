"use client";

import { Feed } from "@/components/feed/Feed";

/**
 * Virm's first page is Discover, the outfit feed, for everyone (signed-out visitors can browse it too). What the old
 * Home dashboard held lives elsewhere now: Your Next Step and What's New in Profile, This Week in Planner, saved looks
 * in Saved Looks, and the free demo at /try.
 */
export default function DiscoverPage() {
  return <Feed />;
}
