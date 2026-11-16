/** Shared with the browser (no server code): the choices and limits for posting an outfit. */

export const STYLE_TAGS = ["Old Money", "Streetwear", "Minimalist", "Casual", "Classic", "Y2K", "Boho", "Preppy", "Sporty", "Romantic", "Edgy", "Coquette"] as const;
export const OCCASION_TAGS = ["Everyday", "Work", "Date Night", "Party", "Weekend", "Travel", "Gym", "Wedding Guest"] as const;
export const MAX_TAGS = 4;
export const CAPTION_MAX = 220;
export const MAX_POST_ITEMS = 8;
export const ITEM_TEXT_MAX = 60;

/** Why a post can be reported (shown as choices; "not_mine" = a photo of someone else without permission). */
export const REPORT_REASONS = [
  { value: "nudity", label: "Nudity or sexual" },
  { value: "harassment", label: "Bullying or harassment" },
  { value: "hate", label: "Hate" },
  { value: "not_mine", label: "My photo, posted by someone else" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Something else" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["value"];
/** Posts per feed page. */
export const FEED_PAGE = 10;
/** Reports from this many different people hide a post until it's reviewed. */
export const HIDE_AFTER_REPORTS = 3;

/** What anyone may see of a post (never the owner's email or which closet piece an item came from). */
export type PublicPostItem = {
  name: string;
  category: string | null;
  brand: string | null;
  store: string | null;
  link: string | null;
  price: string | null;
  imageUrl: string | null;
  /** Only for the post's owner: which piece this is (for editing), and whether its details are "only me". */
  id?: string;
  detailsPrivate?: boolean;
};
export type PublicPost = {
  id: string;
  imageUrl: string;
  width: number;
  height: number;
  caption: string | null;
  styleTags: string[];
  occasionTags: string[];
  likeCount: number;
  createdAt: string;
  creator: { username: string; displayName: string | null; avatarUrl: string | null };
  items: PublicPostItem[];
  /** Only for the viewer: they made it (may delete), or they're an admin. */
  mine?: boolean;
  /** Only for the person who posted it: they may edit it (admins may not). */
  editable?: boolean;
  /** Only for the signed-in viewer: their own like / private dislike / save. */
  liked?: boolean;
  disliked?: boolean;
  saved?: boolean;
};

/**
 * "Try this outfit": one piece of a post, with the viewer's closest closet piece (only ever their own). `close` = a
 * near match (same kind and color or shape), otherwise just the nearest of that kind.
 */
export type TryPostPiece = {
  name: string;
  category: string | null;
  role: string;
  /** The post's own picture of the piece, if it has one. */
  theirs: string | null;
  mine: { id: string; imageUrl: string; description: string; close: boolean } | null;
};
/** Handed from a post to Studio (kept for this browser tab). */
export const TRY_POST_KEY = "virm-try-post";
export type TryPostHandoff = { closetIds: string[]; theirs: { name: string; imageUrl: string; category: string; role: string }[] };

/** Editing a post: at most this many layers, and this large a picture per layer (prepared on the device). */
export const MAX_BOARD_LAYERS = 24;
export const BOARD_LAYER_MAX_BYTES = 3 * 1024 * 1024;
