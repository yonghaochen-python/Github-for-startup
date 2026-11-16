import { prisma } from "@/lib/prisma";
import { avatarUrl, normalizeUsername } from "@/lib/profiles";
import { canUserPost, isReportReason } from "@/lib/posts";
import { COMMENT_MAX, COMMENTS_PER_DAY, HIDE_AFTER_REPORTS, type FollowState, type PublicComment, type ReportReason } from "@/lib/postRules";

/**
 * Following people and comments. Only public things are ever shown: @username, display name and profile picture of
 * whoever follows or comments; never who follows whom beyond the counts, and never anything private.
 */

type Viewer = { id: string; role: string } | null | undefined;

/** The counts on a profile, and whether the viewer follows it (null when signed out or it's their own). */
export async function followState(username: string, viewer: Viewer): Promise<FollowState | null> {
  const user = await prisma.user.findUnique({ where: { username: normalizeUsername(username) }, select: { id: true } });
  if (!user) return null;
  const [followers, following, mine] = await Promise.all([
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    viewer && viewer.id !== user.id
      ? prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewer.id, followingId: user.id } }, select: { createdAt: true } })
      : Promise.resolve(undefined),
  ]);
  return { followers, following, followed: viewer && viewer.id !== user.id ? Boolean(mine) : null };
}

/** Follows (or unfollows) a profile. Not yourself. */
export async function setFollow(viewerId: string, username: string, follow: boolean): Promise<FollowState | "missing" | "self"> {
  const user = await prisma.user.findUnique({ where: { username: normalizeUsername(username) }, select: { id: true } });
  if (!user) return "missing";
  if (user.id === viewerId) return "self";
  const key = { followerId_followingId: { followerId: viewerId, followingId: user.id } };
  if (follow) await prisma.follow.upsert({ where: key, create: { followerId: viewerId, followingId: user.id }, update: {} });
  else await prisma.follow.delete({ where: key }).catch(() => {});
  return (await followState(username, { id: viewerId, role: "user" }))!;
}

const commentSelect = {
  id: true,
  body: true,
  createdAt: true,
  userId: true,
  user: { select: { username: true, displayName: true, avatarKey: true } },
};

/** A post's published comments, oldest first (null when the post isn't visible to the viewer). */
export async function listComments(postId: string, viewer: Viewer): Promise<PublicComment[] | null> {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true, status: true } });
  if (!post || post.status === "removed") return null;
  const owner = Boolean(viewer && (viewer.id === post.userId || viewer.role === "admin"));
  if (post.status !== "published" && !owner) return null;
  const rows = await prisma.postComment.findMany({ where: { postId, status: "published" }, orderBy: { createdAt: "asc" }, take: 200, select: commentSelect });
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    creator: { username: r.user.username ?? "virm", displayName: r.user.displayName, avatarUrl: avatarUrl(r.user.avatarKey) },
    ...(viewer && viewer.id === r.userId ? { mine: true } : {}),
    ...(viewer && (viewer.id === r.userId || owner) ? { canDelete: true } : {}),
  }));
}

const cleanComment = (v: unknown) =>
  typeof v === "string"
    ? v.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, COMMENT_MAX).trim()
    : "";

export type CommentResult = { comment: PublicComment } | { error: string; status: number; code?: string };

/** Adds a comment: people who may post (with a username), on a published post, within the daily limit. */
export async function addComment(postId: string, user: { id: string; role: string }, body: unknown): Promise<CommentResult> {
  const text = cleanComment(body);
  if (!text) return { error: "Write something first.", status: 400 };
  if (!(await canUserPost(user))) return { error: "Commenting isn't open yet.", status: 403 };
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { username: true } });
  if (!me?.username) return { error: "Pick a username first.", status: 409, code: "needs_username" };
  const post = await prisma.post.findFirst({ where: { id: postId, status: "published" }, select: { id: true } });
  if (!post) return { error: "Not found.", status: 404 };
  const today = await prisma.postComment.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
  if (today >= COMMENTS_PER_DAY) return { error: "That's a lot of comments today. Try again tomorrow.", status: 429 };
  const row = await prisma.postComment.create({ data: { postId, userId: user.id, body: text }, select: commentSelect });
  return {
    comment: {
      id: row.id,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      creator: { username: row.user.username ?? "virm", displayName: row.user.displayName, avatarUrl: avatarUrl(row.user.avatarKey) },
      mine: true,
      canDelete: true,
    },
  };
}

/** Deletes a comment: whoever wrote it, the post's owner, or an admin. */
export async function deleteComment(commentId: string, actor: { id: string; role: string }): Promise<boolean> {
  const row = await prisma.postComment.findUnique({ where: { id: commentId }, select: { userId: true, post: { select: { userId: true } } } });
  if (!row) return false;
  if (row.userId !== actor.id && row.post.userId !== actor.id && actor.role !== "admin") return false;
  await prisma.postComment.delete({ where: { id: commentId } });
  return true;
}

/** Records one person's report; reports from HIDE_AFTER_REPORTS people hide the comment until it's reviewed. */
export async function reportComment(commentId: string, reporterId: string, reason: unknown): Promise<"ok" | "duplicate" | "missing" | "own" | "reason"> {
  if (!isReportReason(reason)) return "reason";
  const row = await prisma.postComment.findUnique({ where: { id: commentId }, select: { userId: true, status: true } });
  if (!row || row.status === "removed") return "missing";
  if (row.userId === reporterId) return "own";
  try {
    await prisma.commentReport.create({ data: { commentId, reporterId, reason: reason as ReportReason } });
  } catch {
    return "duplicate";
  }
  const open = await prisma.commentReport.count({ where: { commentId, status: "open" } });
  await prisma.postComment.update({
    where: { id: commentId },
    data: { reportCount: { increment: 1 }, ...(open >= HIDE_AFTER_REPORTS && row.status === "published" ? { status: "hidden" } : {}) },
  });
  return "ok";
}

/** Admin: comments hidden by reports, or with open reports. */
export async function commentQueue() {
  const rows = await prisma.postComment.findMany({
    where: { OR: [{ status: "hidden" }, { status: "published", reports: { some: { status: "open" } } }] },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      body: true,
      status: true,
      postId: true,
      user: { select: { username: true } },
      reports: { where: { status: "open" }, select: { reason: true } },
    },
  });
  return rows.map((r) => ({ id: r.id, body: r.body, status: r.status, postId: r.postId, username: r.user.username, reasons: r.reports.map((x) => x.reason) }));
}

/** Admin review of a comment: restore (shown again), remove (taken down) or dismiss (reports closed). */
export async function reviewComment(commentId: string, action: unknown): Promise<boolean> {
  const row = await prisma.postComment.findUnique({ where: { id: commentId }, select: { id: true } });
  if (!row) return false;
  const now = new Date();
  if (action === "restore" || action === "dismiss") {
    await prisma.commentReport.updateMany({ where: { commentId, status: "open" }, data: { status: "dismissed", reviewedAt: now } });
    if (action === "restore") await prisma.postComment.update({ where: { id: commentId }, data: { status: "published" } });
    return true;
  }
  if (action === "remove") {
    await prisma.commentReport.updateMany({ where: { commentId, status: "open" }, data: { status: "actioned", reviewedAt: now } });
    await prisma.postComment.update({ where: { id: commentId }, data: { status: "removed" } });
    return true;
  }
  return false;
}
