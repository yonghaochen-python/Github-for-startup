import { randomUUID } from "node:crypto";
import { env } from "cloudflare:workers";
import { prisma } from "@/lib/prisma";
import { avatarUrl } from "@/lib/profiles";
import {
  CAPTION_MAX,
  HIDE_AFTER_REPORTS,
  ITEM_TEXT_MAX,
  MAX_POST_ITEMS,
  MAX_TAGS,
  OCCASION_TAGS,
  REPORT_REASONS,
  STYLE_TAGS,
  FEED_PAGE,
  BOARD_LAYER_MAX_BYTES,
  MAX_BOARD_LAYERS,
  type PublicPost,
  type ReportReason,
} from "@/lib/postRules";

/**
 * Social feed posts. A post's picture and its item pictures are their own public copies (post-…, postitem-…), so a
 * post never points at a closet picture or a private photo, and deleting one never affects the other.
 */

/** Posting is limited to admins and testers (canPost) for now; set POSTING_OPEN=1 later to open it to everyone. */
export async function canUserPost(user: { id: string; role: string }): Promise<boolean> {
  if (user.role === "admin" || process.env.POSTING_OPEN === "1") return true;
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { canPost: true } });
  return Boolean(row?.canPost);
}

/** At most this many posts a day per account (spam protection). */
export const POSTS_PER_DAY = 10;
/** The post picture, prepared on the device (long side 1440 px or less). */
export const POST_IMAGE_MAX_BYTES = 2.5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

const oneLine = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max).trim() || null : null;
const caption = (v: unknown) =>
  typeof v === "string"
    ? v.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, CAPTION_MAX).trim() || null
    : null;
const tags = (v: unknown, allowed: readonly string[]) =>
  Array.isArray(v) ? [...new Set(v.filter((t): t is string => typeof t === "string" && allowed.includes(t)))].slice(0, MAX_TAGS) : [];
/** Only ordinary web links (https/http), so a post can't carry a script or app link. */
function cleanLink(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  try {
    const url = new URL(v.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString().slice(0, 500) : null;
  } catch {
    return null;
  }
}

export type NewPostItem = {
  name?: unknown;
  category?: unknown;
  brand?: unknown;
  store?: unknown;
  link?: unknown;
  price?: unknown;
  closetItemId?: unknown;
  detailsPrivate?: unknown;
  /** Editing: a piece already on the post (keeps its picture). */
  id?: unknown;
};
/** A store piece's own picture (prepared on the device), by the piece's position in the list. */
export type ItemPictures = Map<number, File>;
export const ITEM_IMAGE_MAX_BYTES = 600 * 1024;
export type NewPost = { caption?: unknown; styleTags?: unknown; occasionTags?: unknown; width?: unknown; height?: unknown; items?: unknown };

async function putImage(prefix: string, bytes: Uint8Array, type: string): Promise<string> {
  const key = `${prefix}${randomUUID()}.${IMAGE_TYPES[type] ?? "jpg"}`;
  await env.UPLOADS.put(key, bytes, { httpMetadata: { contentType: type } });
  return key;
}

/** A public copy of the person's own closet piece picture for a post item (none if it isn't theirs or has none). */
async function copyClosetPicture(userId: string, closetItemId: string): Promise<string | null> {
  const item = await prisma.clothingItem.findFirst({ where: { id: closetItemId, userId }, select: { imageUrl: true } });
  if (!item?.imageUrl.startsWith("/uploads/")) return null;
  const object = await env.UPLOADS.get(item.imageUrl.slice("/uploads/".length)).catch(() => null);
  if (!object) return null;
  return putImage("postitem-", new Uint8Array(await object.arrayBuffer()), object.httpMetadata?.contentType ?? "image/jpeg");
}

type CleanItem = {
  name: string;
  category: string | null;
  brand: string | null;
  store: string | null;
  link: string | null;
  price: string | null;
  closetItemId: string | null;
  detailsPrivate: boolean;
  /** A piece already on the post (editing): its id and picture are kept. */
  keep: { id: string; imageKey: string | null } | null;
  picture: File | null;
};

/** Checks the pieces as sent. `existing` = the post's pieces now (editing), so kept ones keep their pictures. */
async function cleanItems(
  userId: string,
  raw: unknown,
  itemPictures: ItemPictures,
  existing: { id: string; imageKey: string | null; closetItemId: string | null }[] = []
): Promise<CleanItem[]> {
  const rawItems = Array.isArray(raw) ? (raw as NewPostItem[]).slice(0, MAX_POST_ITEMS) : [];
  const items: CleanItem[] = [];
  for (const [index, it] of rawItems.entries()) {
    const name = oneLine(it?.name, ITEM_TEXT_MAX);
    if (!name) continue;
    const kept = typeof it.id === "string" ? existing.find((e) => e.id === it.id) : undefined;
    const closetItemId = kept ? kept.closetItemId : typeof it.closetItemId === "string" ? it.closetItemId : null;
    // A closet piece is only linked when it's the poster's own.
    const owned = closetItemId ? await prisma.clothingItem.findFirst({ where: { id: closetItemId, userId }, select: { id: true } }) : null;
    items.push({
      name,
      category: oneLine(it.category, 30),
      brand: oneLine(it.brand, ITEM_TEXT_MAX),
      store: oneLine(it.store, ITEM_TEXT_MAX),
      link: cleanLink(it.link),
      price: oneLine(it.price, 24),
      closetItemId: owned?.id ?? null,
      detailsPrivate: it.detailsPrivate === true,
      keep: kept ? { id: kept.id, imageKey: kept.imageKey } : null,
      // A store piece's own picture (closet pieces use a copy of the closet picture instead).
      picture: owned || kept ? null : (itemPictures.get(index) ?? null),
    });
  }
  return items;
}

/** Each piece's public picture: kept, copied from the closet, or the store picture sent with it. */
const itemImageKeys = (userId: string, items: CleanItem[]) =>
  Promise.all(
    items.map(async (it) => {
      if (it.keep) return it.keep.imageKey;
      if (it.closetItemId) return copyClosetPicture(userId, it.closetItemId).catch(() => null);
      if (it.picture && IMAGE_TYPES[it.picture.type] && it.picture.size <= ITEM_IMAGE_MAX_BYTES) {
        return putImage("postitem-", new Uint8Array(await it.picture.arrayBuffer()), it.picture.type);
      }
      return null;
    })
  );

const itemRows = (items: CleanItem[], keys: (string | null)[]) =>
  items.map((it, i) => ({
    name: it.name,
    category: it.category,
    brand: it.brand,
    store: it.store,
    link: it.link,
    price: it.price,
    closetItemId: it.closetItemId,
    detailsPrivate: it.detailsPrivate,
    position: i,
    imageKey: keys[i],
  }));

function checkPicture(picture: File, data: NewPost): { width: number; height: number } {
  if (!IMAGE_TYPES[picture.type]) throw new Error("Use a JPG, PNG or WebP picture.");
  if (picture.size > POST_IMAGE_MAX_BYTES) throw new Error("That picture is too large.");
  const width = Math.round(Number(data.width));
  const height = Math.round(Number(data.height));
  if (!(width > 0 && height > 0 && width <= 4000 && height <= 4000)) throw new Error("That picture couldn't be read.");
  return { width, height };
}

/**
 * The editor's layout, as sent: layers whose `img` is the number of a picture sent with it ("layer-<n>"), or none for
 * text. Kept privately (only its owner ever gets it back), so a post never points at a closet picture.
 */
export type BoardPictures = Map<number, File>;
type StoredLayer = {
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rot?: number;
  crop?: [number, number, number, number];
  flat?: boolean;
  text?: string;
  color?: string;
  font?: "serif" | "sans" | "bold";
};
type StoredBoard = { width: number; height: number; background: string; layers: StoredLayer[] };
const HEX = /^#[0-9a-f]{6}$/i;
const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null);

/** Checks the layout and stores its pictures privately. Null when there's nothing usable. */
async function saveBoard(userId: string, raw: unknown, pictures: BoardPictures): Promise<string | null> {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as { width?: unknown; height?: unknown; background?: unknown; layers?: unknown };
  const width = num(b.width, 1, 4000);
  const height = num(b.height, 1, 4000);
  if (!width || !height || !Array.isArray(b.layers)) return null;
  const stored = new Map<number, string>();
  const layers: StoredLayer[] = [];
  for (const l of b.layers.slice(0, MAX_BOARD_LAYERS) as Record<string, unknown>[]) {
    const x = num(l?.x, -2, 2);
    const y = num(l?.y, -2, 2);
    const w = num(l?.w, 0.01, 2);
    const h = num(l?.h, 0.01, 2);
    if (x === null || y === null || !w || !h) continue;
    const layer: StoredLayer = { src: "", x, y, w, h };
    const rot = num(l.rot, 0, 360);
    if (rot) layer.rot = rot;
    if (typeof l.text === "string") {
      const text = l.text.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").slice(0, 80);
      if (!text.trim()) continue;
      layer.text = text;
      layer.color = typeof l.color === "string" && HEX.test(l.color) ? l.color : "#121821";
      layer.font = l.font === "sans" || l.font === "bold" ? l.font : "serif";
    } else {
      const n = typeof l.img === "number" ? l.img : -1;
      const file = pictures.get(n);
      if (!file || !IMAGE_TYPES[file.type] || file.size > BOARD_LAYER_MAX_BYTES) continue;
      if (!stored.has(n)) {
        const key = `private/board/${userId}/${randomUUID()}.${IMAGE_TYPES[file.type]}`;
        await env.UPLOADS.put(key, new Uint8Array(await file.arrayBuffer()), { httpMetadata: { contentType: file.type } });
        stored.set(n, key);
      }
      layer.src = stored.get(n)!;
      if (Array.isArray(l.crop) && l.crop.length === 4) {
        const c = l.crop.map((v) => num(v, 0, 1));
        if (c.every((v) => v !== null) && c[0]! < c[2]! && c[1]! < c[3]!) layer.crop = c as [number, number, number, number];
      }
      if (l.flat === true) layer.flat = true;
    }
    layers.push(layer);
  }
  if (layers.length === 0) return null;
  const background = typeof b.background === "string" && HEX.test(b.background) ? b.background : "#ecebe8";
  return JSON.stringify({ width, height, background, layers } satisfies StoredBoard);
}

const parseBoard = (json: string | null): StoredBoard | null => {
  if (!json) return null;
  try {
    return JSON.parse(json) as StoredBoard;
  } catch {
    return null;
  }
};
/** The private pictures a layout keeps (to delete with it). */
export const boardKeys = (json: string | null): string[] => [...new Set((parseBoard(json)?.layers ?? []).map((l) => l.src).filter((k) => k.startsWith("private/board/")))];

/** Every stored picture of a post: its own, its pieces', and its layout's. */
export const postStorageKeys = (post: { imageKey: string; board: string | null; items: { imageKey: string | null }[] }): string[] => [
  post.imageKey,
  ...post.items.map((i) => i.imageKey).filter((k): k is string => Boolean(k)),
  ...boardKeys(post.board),
];

/** Publishes a post. Only what the person typed or chose is stored; the picture becomes its own public copy. */
export async function createPost(
  userId: string,
  picture: File,
  data: NewPost,
  itemPictures: ItemPictures = new Map(),
  board: { raw: unknown; pictures: BoardPictures } | null = null
): Promise<string> {
  const { width, height } = checkPicture(picture, data);
  const items = await cleanItems(userId, data.items, itemPictures);
  const imageKey = await putImage("post-", new Uint8Array(await picture.arrayBuffer()), picture.type);
  const itemKeys = await itemImageKeys(userId, items);
  const post = await prisma.post.create({
    data: {
      userId,
      imageKey,
      width,
      height,
      caption: caption(data.caption),
      styleTags: JSON.stringify(tags(data.styleTags, STYLE_TAGS)),
      occasionTags: JSON.stringify(tags(data.occasionTags, OCCASION_TAGS)),
      board: board ? await saveBoard(userId, board.raw, board.pictures) : null,
      items: { create: itemRows(items, itemKeys) },
    },
    select: { id: true },
  });
  return post.id;
}

/**
 * Edits a post: only by the person who posted it (not admins, not anyone else). Caption, tags and pieces are replaced
 * by what's sent; the picture and layout only when new ones are sent. Pictures no longer used are deleted.
 */
export async function updatePost(
  postId: string,
  userId: string,
  picture: File | null,
  data: NewPost,
  itemPictures: ItemPictures = new Map(),
  board: { raw: unknown; pictures: BoardPictures } | null = null
): Promise<boolean> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { userId: true, status: true, imageKey: true, board: true, items: { select: { id: true, imageKey: true, closetItemId: true } } },
  });
  if (!post || post.userId !== userId || post.status === "removed") return false;
  const size = picture ? checkPicture(picture, data) : null;
  const items = await cleanItems(userId, data.items, itemPictures, post.items);
  const imageKey = picture ? await putImage("post-", new Uint8Array(await picture.arrayBuffer()), picture.type) : post.imageKey;
  const itemKeys = await itemImageKeys(userId, items);
  const newBoard = board ? await saveBoard(userId, board.raw, board.pictures) : post.board;
  await prisma.$transaction([
    prisma.postItem.deleteMany({ where: { postId } }),
    prisma.post.update({
      where: { id: postId },
      data: {
        ...(picture && size ? { imageKey, ...size } : {}),
        caption: caption(data.caption),
        styleTags: JSON.stringify(tags(data.styleTags, STYLE_TAGS)),
        occasionTags: JSON.stringify(tags(data.occasionTags, OCCASION_TAGS)),
        board: newBoard,
        items: { create: itemRows(items, itemKeys) },
      },
    }),
  ]);
  // What the post no longer uses.
  const before = postStorageKeys(post);
  const now = new Set(postStorageKeys({ imageKey, board: newBoard, items: itemKeys.map((k) => ({ imageKey: k })) }));
  const unused = before.filter((k) => !now.has(k));
  if (unused.length) await env.UPLOADS.delete(unused).catch(() => {});
  return true;
}

/** The layout behind a post, for its owner only; its pictures by number (served by /api/posts/[id]/board/[n]). */
export async function getBoard(postId: string, userId: string): Promise<{ board: StoredBoard; keys: string[] } | null> {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true, board: true } });
  if (!post || post.userId !== userId) return null;
  const board = parseBoard(post.board);
  if (!board) return null;
  const keys = boardKeys(post.board);
  return { board: { ...board, layers: board.layers.map((l) => (l.src ? { ...l, src: `/api/posts/${postId}/board/${keys.indexOf(l.src)}` } : l)) }, keys };
}

/**
 * Reads a post form: "data" (JSON), store pieces' pictures ("itemPicture-<position>") and, when the editor was used,
 * "board" (JSON) with its pictures ("layer-<n>"). Throws on broken JSON.
 */
export function readPostForm(form: FormData): { data: NewPost; itemPictures: ItemPictures; board: { raw: unknown; pictures: BoardPictures } | null } {
  const data = JSON.parse(String(form.get("data") ?? "{}")) as NewPost;
  const itemPictures: ItemPictures = new Map();
  const pictures: BoardPictures = new Map();
  for (const [name, value] of form.entries()) {
    if (!(value instanceof File)) continue;
    const item = /^itemPicture-(\d{1,2})$/.exec(name);
    if (item) itemPictures.set(Number(item[1]), value);
    const layer = /^layer-(\d{1,2})$/.exec(name);
    if (layer && pictures.size < MAX_BOARD_LAYERS) pictures.set(Number(layer[1]), value);
  }
  const rawBoard = form.get("board");
  const board = typeof rawBoard === "string" ? { raw: JSON.parse(rawBoard) as unknown, pictures } : null;
  return { data, itemPictures, board };
}

/** Posts made in the last 24 hours (for the daily limit). */
export const postsToday = (userId: string) => prisma.post.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });

const parseTags = (json: string): string[] => {
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
};

export const postSelect = {
  id: true,
  userId: true,
  imageKey: true,
  width: true,
  height: true,
  caption: true,
  styleTags: true,
  occasionTags: true,
  likeCount: true,
  createdAt: true,
  status: true,
  user: { select: { username: true, displayName: true, avatarKey: true } },
  items: {
    orderBy: { position: "asc" as const },
    select: { id: true, name: true, category: true, brand: true, store: true, link: true, price: true, imageKey: true, detailsPrivate: true },
  },
};
type PostRow = Awaited<ReturnType<typeof prisma.post.findFirst<{ select: typeof postSelect }>>>;

export function toPublic(row: NonNullable<PostRow>, viewer?: { id: string; role: string } | null): PublicPost {
  const owner = Boolean(viewer && viewer.id === row.userId);
  return {
    id: row.id,
    imageUrl: `/uploads/${row.imageKey}`,
    width: row.width,
    height: row.height,
    caption: row.caption,
    styleTags: parseTags(row.styleTags),
    occasionTags: parseTags(row.occasionTags),
    likeCount: row.likeCount,
    createdAt: row.createdAt.toISOString(),
    creator: { username: row.user.username ?? "virm", displayName: row.user.displayName, avatarUrl: avatarUrl(row.user.avatarKey) },
    items: row.items.map((it) => {
      // "Only me" details are left out for everyone but the person who posted it.
      const shown = owner || !it.detailsPrivate;
      return {
        name: it.name,
        category: it.category,
        brand: shown ? it.brand : null,
        store: shown ? it.store : null,
        link: shown ? it.link : null,
        price: shown ? it.price : null,
        imageUrl: it.imageKey ? `/uploads/${it.imageKey}` : null,
        ...(owner ? { id: it.id, detailsPrivate: it.detailsPrivate } : {}),
      };
    }),
    ...(viewer && (viewer.id === row.userId || viewer.role === "admin") ? { mine: true } : {}),
    ...(owner ? { editable: true } : {}),
  };
}

/** One post as the viewer may see it: published posts for everyone; a hidden one only for its owner or an admin. */
export async function getPost(id: string, viewer?: { id: string; role: string } | null): Promise<PublicPost | null> {
  const row = await prisma.post.findFirst({ where: { id }, select: postSelect });
  if (!row || row.status === "removed") return null;
  const owner = viewer && (viewer.id === row.userId || viewer.role === "admin");
  if (row.status !== "published" && !owner) return null;
  const [post] = await withViewerState([toPublic(row, viewer)], viewer?.id);
  return post;
}

/** A profile's published posts, newest first. */
export async function postsBy(username: string, viewer?: { id: string; role: string } | null): Promise<PublicPost[]> {
  const rows = await prisma.post.findMany({
    where: { status: "published", user: { username } },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: postSelect,
  });
  return withViewerState(rows.map((r) => toPublic(r, viewer)), viewer?.id);
}

/** Deletes a post and its pictures (by its owner or an admin). */
export async function deletePost(id: string, actor: { id: string; role: string }): Promise<boolean> {
  const post = await prisma.post.findUnique({ where: { id }, select: { userId: true, imageKey: true, board: true, items: { select: { imageKey: true } } } });
  if (!post || (post.userId !== actor.id && actor.role !== "admin")) return false;
  await prisma.post.delete({ where: { id } });
  await env.UPLOADS.delete(postStorageKeys(post)).catch(() => {});
  return true;
}

/** Every post of an account and their pictures (account deleted). */
export async function deleteAllPosts(userId: string): Promise<void> {
  const posts = await prisma.post.findMany({ where: { userId }, select: { imageKey: true, board: true, items: { select: { imageKey: true } } } });
  const keys = posts.flatMap(postStorageKeys);
  for (let i = 0; i < keys.length; i += 1000) await env.UPLOADS.delete(keys.slice(i, i + 1000)).catch(() => {});
}

export const isReportReason = (v: unknown): v is ReportReason => REPORT_REASONS.some((r) => r.value === v);

/** Records one person's report; reports from HIDE_AFTER_REPORTS people hide the post until it's reviewed. */
export async function reportPost(postId: string, reporterId: string, reason: ReportReason, note: unknown): Promise<"ok" | "duplicate" | "missing" | "own"> {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true, status: true } });
  if (!post || post.status === "removed") return "missing";
  if (post.userId === reporterId) return "own";
  try {
    await prisma.postReport.create({ data: { postId, reporterId, reason, note: oneLine(note, 300) } });
  } catch {
    return "duplicate";
  }
  const open = await prisma.postReport.count({ where: { postId, status: "open" } });
  await prisma.post.update({
    where: { id: postId },
    data: { reportCount: { increment: 1 }, ...(open >= HIDE_AFTER_REPORTS && post.status === "published" ? { status: "hidden" } : {}) },
  });
  return "ok";
}

/** Adds the viewer's own like / dislike / save to each post (nothing for signed-out visitors). */
export async function withViewerState(posts: PublicPost[], viewerId?: string | null): Promise<PublicPost[]> {
  if (!viewerId || posts.length === 0) return posts;
  const ids = posts.map((p) => p.id);
  const [reactions, saves] = await Promise.all([
    prisma.postReaction.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true, kind: true } }),
    prisma.postSave.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true } }),
  ]);
  const kindOf = new Map(reactions.map((r) => [r.postId, r.kind]));
  const savedIds = new Set(saves.map((s) => s.postId));
  return posts.map((p) => ({ ...p, liked: kindOf.get(p.id) === "like", disliked: kindOf.get(p.id) === "dislike", saved: savedIds.has(p.id) }));
}

/**
 * The feed: published posts, newest first, 10 at a time (cursor = the last post's id). A signed-in person never sees
 * posts they disliked. Version 1 ranking is simply "newest"; For You comes later.
 */
/** What a search looks in: captions, tags, @usernames, and the pieces' names, brands and stores. */
function searchWhere(query: string | null) {
  const q = (query ?? "").replace(/^@/, "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (!q) return {};
  // Its own group, so it never clashes with the page's "after this post" condition.
  return {
    AND: [
      {
        OR: [
          { caption: { contains: q } },
          { styleTags: { contains: q } },
          { occasionTags: { contains: q } },
          { user: { username: { contains: q } } },
          { items: { some: { name: { contains: q } } } },
          // "Only me" brands and stores aren't searchable.
          { items: { some: { detailsPrivate: false, OR: [{ brand: { contains: q } }, { store: { contains: q } }] } } },
        ],
      },
    ],
  };
}

export async function feedPage(
  viewer: { id: string; role: string } | null,
  cursor: string | null,
  query: string | null = null
): Promise<{ posts: PublicPost[]; next: string | null }> {
  const after = cursor ? await prisma.post.findUnique({ where: { id: cursor }, select: { createdAt: true, id: true } }) : null;
  const rows = await prisma.post.findMany({
    where: {
      status: "published",
      ...searchWhere(query),
      ...(viewer ? { reactions: { none: { userId: viewer.id, kind: "dislike" } } } : {}),
      ...(after ? { OR: [{ createdAt: { lt: after.createdAt } }, { createdAt: after.createdAt, id: { lt: after.id } }] } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: FEED_PAGE + 1,
    select: postSelect,
  });
  const page = rows.slice(0, FEED_PAGE);
  return { posts: await withViewerState(page.map((r) => toPublic(r, viewer)), viewer?.id), next: rows.length > FEED_PAGE ? page[page.length - 1].id : null };
}

/**
 * Sets this person's reaction to a post: "like", "dislike" (private) or null (none). The shown like count is kept in
 * step on the post. A dislike also takes back a like, and the reverse.
 */
export async function setReaction(userId: string, postId: string, kind: "like" | "dislike" | null): Promise<{ likeCount: number } | null> {
  const post = await prisma.post.findFirst({ where: { id: postId, status: "published" }, select: { id: true } });
  if (!post) return null;
  const before = await prisma.postReaction.findUnique({ where: { userId_postId: { userId, postId } }, select: { kind: true } });
  if ((before?.kind ?? null) !== kind) {
    if (kind) await prisma.postReaction.upsert({ where: { userId_postId: { userId, postId } }, create: { userId, postId, kind }, update: { kind } });
    else await prisma.postReaction.delete({ where: { userId_postId: { userId, postId } } }).catch(() => {});
    const change = (kind === "like" ? 1 : 0) - (before?.kind === "like" ? 1 : 0);
    if (change) await prisma.post.update({ where: { id: postId }, data: { likeCount: { increment: change } } });
  }
  const after = await prisma.post.findUnique({ where: { id: postId }, select: { likeCount: true } });
  return { likeCount: Math.max(0, after?.likeCount ?? 0) };
}

/** Saves a post to (or takes it out of) this person's Saved → Inspiration. */
export async function setSaved(userId: string, postId: string, saved: boolean): Promise<boolean> {
  const post = await prisma.post.findFirst({ where: { id: postId, status: "published" }, select: { id: true } });
  if (!post) return false;
  const had = await prisma.postSave.findUnique({ where: { userId_postId: { userId, postId } }, select: { postId: true } });
  if (saved && !had) {
    await prisma.postSave.create({ data: { userId, postId } }).catch(() => {});
    await prisma.post.update({ where: { id: postId }, data: { saveCount: { increment: 1 } } });
  } else if (!saved && had) {
    await prisma.postSave.delete({ where: { userId_postId: { userId, postId } } }).catch(() => {});
    await prisma.post.update({ where: { id: postId }, data: { saveCount: { decrement: 1 } } });
  }
  return true;
}

/** This person's saved posts (still published), most recently saved first. */
export async function savedPosts(viewer: { id: string; role: string }): Promise<PublicPost[]> {
  const saves = await prisma.postSave.findMany({
    where: { userId: viewer.id, post: { status: "published" } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { post: { select: postSelect } },
  });
  return withViewerState(saves.map((s) => toPublic(s.post, viewer)), viewer.id);
}
