/**
 * What each paid result costs Virm, for the admin dashboard. Claude calls record their real cost from the token
 * counts Claude returns (see lib/anthropic). Decart (live) charges by the second, so a live session's cost is its
 * reported length × the confirmed rate. BFL (photo try-on) doesn't report a price, so photo try-ons use the set
 * estimate below until it's confirmed in the BFL dashboard.
 */

/** Longest live session (Decart ends it then). */
export const MAX_LIVE_SECONDS = 20;
/** Decart Lucy VTON 720p: $0.02 a second (confirmed), in millionths of a dollar. */
export const LIVE_MICROS_PER_SECOND = 20_000;
/** BFL FLUX VTO: about $0.04 a try-on (estimate; BFL doesn't publish it). */
export const PHOTO_TRYON_MICROS = 40_000;
