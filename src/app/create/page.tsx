"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CREATE_OPTIONS, CreateOptionRow, takeHandedPhoto, takeHandedVideo, type CreateStart } from "@/components/CreateMenu";
import { grabFrame, readVideo, uploadVideo, type ChosenVideo } from "@/lib/postVideoClient";
import type { ClothingItem, Outfit } from "@/components/OutfitCard";
import { CAPTION_MAX, MAX_POST_ITEMS, MAX_TAGS, OCCASION_TAGS, STYLE_TAGS, type PublicPost } from "@/lib/postRules";
import { layoutBoard, newBoard, packBoard, pictureSize, renderBoard, shrinkPicture, withoutBackground, type Board, type BoardLayer } from "@/lib/outfitBoard";
import { PostPreview } from "@/components/feed/PostPreview";
import { Dialog } from "@/components/Dialog";
import { VideoIcon } from "@/components/Icons";
import { createPortal } from "react-dom";
import { BoardEditor } from "@/components/BoardEditor";
import { warmUpCutout } from "@/lib/cutout";
import { ROLE_FOR, type TrayCategory, type TrayItem } from "@/lib/shopCatalog";
import { keepShopTryOn, readShopTryOns } from "@/lib/shopWishlist";
import { BackButton } from "@/components/BackButton";
import { PageShell, btnPrimary, btnSecondary, btnText, eyebrow } from "@/components/ui";
import { useToast } from "@/components/Toast";

type Draft = {
  name: string;
  brand: string;
  store: string;
  link: string;
  price: string;
  category: string | null;
  /** Where it goes in a built outfit's picture (layering role). */
  role: string;
  closetItemId: string | null;
  thumb: string | null;
  /** A store piece's own picture, posted with it. */
  shopPicture: string | null;
  /** Where it came from in "Build an outfit" (so it can be picked again or taken out). */
  key: string;
  /** Editing: the piece already on the post (keeps its picture). */
  postItemId: string | null;
  /** "Only me": brand, store, link and price shown only to you. */
  detailsPrivate: boolean;
};
type Picture = { blob: Blob; url: string; width: number; height: number };

const blankItem = (): Draft => ({ name: "", brand: "", store: "", link: "", price: "", category: null, role: "accessory", closetItemId: null, thumb: null, shopPicture: null, key: `new-${Math.random()}`, postItemId: null, detailsPrivate: false });
const shortName = (d: string) => d.split(/[,;(]/)[0].trim().slice(0, 60);
/** A closet piece as the API sends it (with its brand, when known). */
type ClosetPiece = ClothingItem & { brand?: string | null };
const fromCloset = (c: ClosetPiece): Draft => ({
  name: shortName(c.description),
  brand: c.brand ?? "",
  store: "",
  link: "",
  price: "",
  category: c.category,
  role: c.layeringRole,
  closetItemId: c.id,
  thumb: c.imageUrl,
  shopPicture: null,
  key: `closet-${c.id}`,
  postItemId: null,
  detailsPrivate: false,
});
/** A Shopping piece (from another store): its store, price and link come along. */
const fromShop = (t: TrayItem): Draft => ({
  name: t.name.slice(0, 60),
  brand: "",
  store: t.label,
  link: t.productUrl ?? "",
  price: t.price ?? "",
  category: t.category,
  role: t.layeringRole,
  closetItemId: null,
  thumb: t.imageUrl,
  shopPicture: t.imageUrl,
  key: `shop-${t.key}`,
  postItemId: null,
  detailsPrivate: false,
});
/** One outfit: at most this many of each kind (a dress counts as the bottom). */
type Slot = "jacket" | "top" | "bottom" | "shoes" | "accessory";
const slotOf = (role: string): Slot =>
  role === "outer_layer" ? "jacket" : role === "base_layer" || role === "mid_layer" ? "top" : role === "bottom" || role === "one_piece" ? "bottom" : role === "shoes" ? "shoes" : "accessory";
const SLOT_LIMITS: Record<Slot, number> = { jacket: 1, top: 2, bottom: 1, shoes: 1, accessory: 3 };
const SLOT_NAMES: Record<Slot, string> = { jacket: "the jacket", top: "a top", bottom: "the bottom", shoes: "the shoes", accessory: "an accessory" };

const KINDS: { value: TrayCategory; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "dress", label: "Dress" },
  { value: "outerwear", label: "Jacket" },
  { value: "shoes", label: "Shoes" },
  { value: "accessory", label: "Accessory" },
];

/** Shrinks the photo on this device (long side 1440 px, WebP), which also drops its location data. */
async function preparePicture(source: Blob): Promise<Picture> {
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, 1440 / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that photo."))), "image/webp", 0.86));
  return { blob, url: URL.createObjectURL(blob), width, height };
}

/**
 * Post an outfit: a photo (new, or a saved look's try-on), or an outfit built from pieces (your closet, Shopping, or
 * any store link, laid out into one picture on this device), then a caption, tags and "Post publicly".
 */
/** Each choice in the ＋ menu opens a fresh New post (even when one is already open), so it starts that way of posting. */
export default function CreatePage() {
  const searchParams = useSearchParams();
  return <CreatePost key={searchParams.toString()} />;
}

function CreatePost() {
  const router = useRouter();
  const { showToast } = useToast();
  const [access, setAccess] = useState<{ canPost: boolean; username: string | null } | null>(null);
  const [picture, setPicture] = useState<Picture | null>(null);
  // "Build an outfit": choosing pieces (before the picture is made from them).
  const [building, setBuilding] = useState(false);
  const [source, setSource] = useState<"closet" | "shop">("closet");
  const [shopPieces, setShopPieces] = useState<TrayItem[]>([]);
  const [link, setLink] = useState("");
  const storePhoto = useRef<HTMLInputElement | null>(null);
  const [linkKind, setLinkKind] = useState<TrayCategory>("top");
  const [linkBusy, setLinkBusy] = useState(false);
  const [boardBusy, setBoardBusy] = useState(false);
  // The board behind the picture (a built outfit, or a photo opened in the editor), kept so it can be edited again.
  const [board, setBoard] = useState<Board | null>(null);
  const [editing, setEditing] = useState(false);
  // The board as it was when editing began (Cancel goes back to it).
  const before = useRef<Board | null>(null);
  // Adding (or replacing) a piece from inside the editor.
  const [picker, setPicker] = useState<{ replace: string | null } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  // Editing a published post (?edit=<id>): only what changed is sent again.
  const editId = useSearchParams().get("edit");
  // Editing couldn't start: not your post, or it couldn't be opened (a connection problem).
  const [editMissing, setEditMissing] = useState<"notYours" | "failed" | null>(null);
  const [pictureChanged, setPictureChanged] = useState(false);
  // A video post: the video (stays on the device until Post), its cover's moment, and sending progress.
  const [video, setVideo] = useState<ChosenVideo | null>(null);
  const [coverAt, setCoverAt] = useState(0);
  const [sent, setSent] = useState<number | null>(null);
  // Editing a video post: its video as posted (it stays; the words and pieces can change).
  const [postedVideo, setPostedVideo] = useState<string | null>(null);
  // Saved Live Try On recordings (private), offered only when there are some.
  const [recordings, setRecordings] = useState<{ id: string; savedAt: string }[] | null>(null);
  const [showRecordings, setShowRecordings] = useState(false);
  const videoInput = useRef<HTMLInputElement | null>(null);
  const [saved, setSaved] = useState<Outfit[] | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [closet, setCloset] = useState<ClosetPiece[] | null>(null);
  const [showCloset, setShowCloset] = useState(false);
  const [caption, setCaption] = useState("");
  const [styles, setStyles] = useState<string[]>([]);
  const [occasions, setOccasions] = useState<string[]>([]);
  const [items, setItems] = useState<Draft[]>([]);
  const [publicOk, setPublicOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  // Arriving from the ＋ menu (?start=photo|look|build): go straight to that way of posting (a photo picked there comes
  // along in memory). Once per visit.
  const searchParams = useSearchParams();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const start = searchParams.get("start") as CreateStart | null;
    const begin = () => {
      if (start === "photo") {
        const file = takeHandedPhoto();
        if (file) void takePhoto(file);
      } else if (start === "video") {
        const file = takeHandedVideo();
        if (file) void takeVideo(file);
      } else if (start === "look") void openSaved();
      else if (start === "build") startBuilding();
    };
    // After this render (the choices it opens are state of their own).
    queueMicrotask(begin);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per visit
  }, []);

  // Editing: the post as it is now (its pieces with their ids and "only me" choices, which only its owner gets), and
  // the layout behind it if it was made in the editor.
  useEffect(() => {
    if (!editId) return;
    let gone = false;
    (async () => {
      const res = await fetch(`/api/posts/${encodeURIComponent(editId)}`, { cache: "no-store" }).catch(() => null);
      const post = res?.ok ? ((await res.json()) as { post: PublicPost }).post : null;
      const image = post?.editable ? await fetch(post.imageUrl).then((r) => (r.ok ? r.blob() : null)).catch(() => null) : null;
      if (gone) return;
      if (post && !post.editable) return setEditMissing("notYours");
      if (!post || !image) return setEditMissing("failed");
      const url = URL.createObjectURL(image);
      urls.current.push(url);
      setPicture({ blob: image, url, width: post.width, height: post.height });
      if (post.videoUrl) setPostedVideo(post.videoUrl);
      setCaption(post.caption ?? "");
      setStyles(post.styleTags);
      setOccasions(post.occasionTags);
      setItems(
        post.items.map((it, i) => ({
          name: it.name,
          brand: it.brand ?? "",
          store: it.store ?? "",
          link: it.link ?? "",
          price: it.price ?? "",
          category: it.category,
          role: "accessory",
          closetItemId: null,
          thumb: it.imageUrl,
          shopPicture: null,
          key: `kept-${i}`,
          postItemId: it.id ?? null,
          detailsPrivate: Boolean(it.detailsPrivate),
        }))
      );
      const saved = await fetch(`/api/posts/${encodeURIComponent(editId)}/board`, { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<{ board: Board | null }>) : { board: null }))
        .catch(() => ({ board: null }));
      if (!gone && saved.board) setBoard({ ...saved.board, layers: saved.board.layers.map((l, i) => ({ ...l, key: l.flat ? "photo" : typeof l.item === "number" ? `kept-${l.item}` : `saved-${i}` })) });
    })();
    return () => {
      gone = true;
    };
  }, [editId]);

  // Saved Live Try On recordings, for "Share a Live Try On video" (new posts only).
  useEffect(() => {
    if (editId) return;
    fetch("/api/me/live-videos", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { videos: { id: string; savedAt: string }[] }).videos : []))
      .then(setRecordings)
      .catch(() => setRecordings([]));
  }, [editId]);

  useEffect(() => {
    fetch("/api/me/can-post", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { canPost: boolean; username: string | null }) : { canPost: false, username: null }))
      .then(setAccess)
      .catch(() => setAccess({ canPost: false, username: null }));
  }, []);
  // Photos made on this page stay until it closes (the editor may still be using an earlier one).
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  async function takePhoto(source: Blob) {
    setError(null);
    try {
      const next = await preparePicture(source);
      urls.current.push(next.url);
      setPicture(next);
      setBoard(null);
      setPictureChanged(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that photo.");
    }
  }

  /** A video: checked here (type, 50 MB, a minute, that it plays), with a frame near the start as its cover. */
  async function takeVideo(file: Blob) {
    setError(null);
    setShowRecordings(false);
    try {
      const chosen = await readVideo(file);
      urls.current.push(chosen.url);
      const at = Math.min(0.5, chosen.ms / 2000);
      const cover = await grabFrame(chosen.url, at);
      const url = URL.createObjectURL(cover.blob);
      urls.current.push(url);
      coverShown.current = at;
      setVideo(chosen);
      setCoverAt(at);
      setPicture({ ...cover, url });
      setBoard(null);
      setPictureChanged(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that video.");
    }
  }

  /** Another moment of the video as its cover. */
  async function chooseCover(seconds: number) {
    if (!video) return;
    try {
      const cover = await grabFrame(video.url, seconds);
      const url = URL.createObjectURL(cover.blob);
      urls.current.push(url);
      setPicture({ ...cover, url });
    } catch {}
  }

  // The cover follows the slider, a moment after it stops moving.
  const coverShown = useRef(0);
  useEffect(() => {
    if (!video || coverAt === coverShown.current) return;
    const t = setTimeout(() => {
      coverShown.current = coverAt;
      void chooseCover(coverAt);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the slider moves
  }, [coverAt, video]);

  async function openRecordings() {
    setShowRecordings(true);
  }

  /** One of your saved Live Try On recordings (private until you post it, and only if you choose to). */
  async function pickRecording(id: string) {
    const res = await fetch(`/api/me/live-videos/${encodeURIComponent(id)}`).catch(() => null);
    if (!res?.ok) return setError("Couldn't open that recording.");
    const blob = await res.blob();
    await takeVideo(new File([blob], id, { type: blob.type || (id.endsWith(".webm") ? "video/webm" : "video/mp4") }));
  }

  async function openSaved() {
    setShowSaved(true);
    if (saved) return;
    const res = await fetch("/api/outfits", { cache: "no-store" }).catch(() => null);
    const data = res?.ok ? ((await res.json()) as { outfits: Outfit[] }) : { outfits: [] };
    setSaved(data.outfits.filter((o) => o.isFavorite && o.tryOn));
  }

  async function pickSaved(o: Outfit) {
    setShowSaved(false);
    const res = await fetch(`/api/outfits/${o.id}/try-on/image?v=${o.tryOn}`).catch(() => null);
    if (!res?.ok) return setError("Couldn't open that look's picture.");
    await takePhoto(await res.blob());
    // Its pieces come along (each can be edited or removed).
    setItems(o.layers.flatMap((l) => l.items).slice(0, MAX_POST_ITEMS).map(fromCloset));
    if (o.occasion) setCaption((c) => c || o.occasion!.charAt(0).toUpperCase() + o.occasion!.slice(1));
  }

  async function openCloset() {
    setShowCloset(true);
    await loadCloset();
  }
  async function loadCloset() {
    if (closet) return;
    const res = await fetch("/api/closet/items", { cache: "no-store" }).catch(() => null);
    setCloset(res?.ok ? ((await res.json()) as { items: ClosetPiece[] }).items : []);
  }

  function startBuilding() {
    // The background remover starts loading now, so making the outfit is quicker.
    warmUpCutout();
    setError(null);
    setBuilding(true);
    setShopPieces(readShopTryOns());
    void openCloset();
    setShowCloset(false);
  }

  /**
   * Picks or unpicks a piece, keeping it one outfit: a second jacket, bottom/dress or pair of shoes swaps out the one
   * already there (a third top or fourth accessory swaps out the oldest), with a short note.
   */
  function pick(draft: Draft) {
    if (items.some((it) => it.key === draft.key)) return setItems((list) => list.filter((it) => it.key !== draft.key));
    const slot = slotOf(draft.role);
    const same = items.filter((it) => slotOf(it.role) === slot);
    const out = same.length >= SLOT_LIMITS[slot] ? same[0] : null;
    if (!out && items.length >= MAX_POST_ITEMS) return showToast(`Up to ${MAX_POST_ITEMS} pieces`);
    setItems((list) => [...list.filter((it) => it.key !== out?.key), draft]);
    if (out) showToast(`Swapped ${SLOT_NAMES[slot]}`);
  }

  /** A piece from any store: its page is read for the picture, name, store and price (no AI), and kept in Shopping too. */
  async function addLink() {
    setError(null);
    setLinkBusy(true);
    const res = await fetch("/api/shop/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: link.trim() }) }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { product?: { productUrl: string | null; retailer: string; name: string | null; price: string | null; currency: string | null; imageDataUrl: string }; error?: string }) : {};
    setLinkBusy(false);
    // Many stores block reading their pages: a photo or screenshot of the piece works instead.
    if (!res?.ok || !data.product) return setError("That store didn't let us read the link. Add a photo or screenshot of the piece instead.");
    const p = data.product;
    const item: TrayItem = {
      key: `ext-${Date.now()}`,
      name: p.name ?? "Piece",
      label: p.retailer,
      category: linkKind,
      layeringRole: ROLE_FOR[linkKind],
      color: "",
      // The background is removed on this device (free), like closet pieces.
      imageUrl: await withoutBackground(p.imageDataUrl),
      price: p.price ? `${p.currency === "USD" || !p.currency ? "$" : ""}${p.price}${p.currency && p.currency !== "USD" ? ` ${p.currency}` : ""}` : null,
      productUrl: p.productUrl,
    };
    setShopPieces(keepShopTryOn(item));
    pick(fromShop(item));
    setLink("");
  }

  /** A store piece from a photo or screenshot (shrunk on this device; kept in Shopping too). Name it in the list below. */
  async function addStorePhoto(file: File) {
    setError(null);
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const item: TrayItem = {
        key: `ext-${Date.now()}`,
        name: KINDS.find((k) => k.value === linkKind)?.label ?? "Piece",
        label: "",
        category: linkKind,
        layeringRole: ROLE_FOR[linkKind],
        color: "",
        imageUrl: await withoutBackground(canvas.toDataURL("image/png")),
        price: null,
        productUrl: null,
      };
      setShopPieces(keepShopTryOn(item));
      pick(fromShop(item));
    } catch {
      setError("Couldn't read that photo.");
    }
  }

  /** Lays the chosen pieces out into the post's picture (on this device). */
  /** Arranges the chosen pieces automatically (backgrounds removed); then they can be moved, resized and layered. */
  async function makeBoard() {
    setError(null);
    setBoardBusy(true);
    try {
      const layers = await layoutBoard(items.filter((it) => it.thumb).map((it) => ({ imageUrl: it.thumb!, role: it.role, name: it.name, key: it.key })));
      // Reset keeps the chosen color.
      setBoard((b) => ({ ...newBoard(layers), background: b?.background ?? newBoard([]).background }));
      before.current = null;
      setEditing(true);
      setBuilding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't make the picture.");
    }
    setBoardBusy(false);
  }

  /** Done arranging: draws the post's picture from the arrangement (on this device). */
  async function finishBoard() {
    if (!board) return;
    setBoardBusy(true);
    try {
      const drawn = await renderBoard(board);
      const url = URL.createObjectURL(drawn.blob);
      urls.current.push(url);
      setPicture({ ...drawn, url });
      setPictureChanged(true);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't make the picture.");
    }
    setBoardBusy(false);
  }

  /** Opens the photo in the editor (the photo lies flat under everything; text, pictures and pieces go on top). */
  function editPicture() {
    if (!picture) return;
    const start = board ?? { width: picture.width, height: picture.height, background: "#ecebe8", layers: [{ key: "photo", src: picture.url, x: 0, y: 0, w: 1, h: 1, flat: true }] };
    before.current = board;
    setBoard(start);
    setEditing(true);
  }

  function cancelEditing() {
    setBoard(before.current);
    setEditing(false);
  }

  /** A piece added (or swapped in) from inside the editor: it joins the pieces list too. */
  async function placePiece(draft: Draft) {
    const replace = picker?.replace ?? null;
    setPicker(null);
    if (!board || !draft.thumb) return;
    if (items.some((it) => it.key === draft.key)) return showToast("Already on the board");
    if (!replace && items.length >= MAX_POST_ITEMS) return showToast(`Up to ${MAX_POST_ITEMS} pieces`);
    setBoardBusy(true);
    const src = await withoutBackground(draft.thumb);
    const size = await pictureSize(src);
    setBoardBusy(false);
    if (!size) return showToast("Couldn't open that piece's picture");
    const shape = (board.width * size.height) / (size.width * board.height);
    setBoard((b) => {
      if (!b) return b;
      const old = replace ? b.layers.find((l) => l.key === replace) : null;
      if (old) {
        // Same middle, width and turn; the height follows the new piece's shape.
        const h = old.w * shape;
        const layer: BoardLayer = { key: draft.key, src, x: old.x, y: old.y + (old.h - h) / 2, w: old.w, h, rot: old.rot };
        return { ...b, layers: b.layers.map((l) => (l.key === replace ? layer : l)) };
      }
      let w = 0.36;
      let h = w * shape;
      if (h > 0.5) {
        w *= 0.5 / h;
        h = 0.5;
      }
      return { ...b, layers: [...b.layers, { key: draft.key, src, x: 0.5 - w / 2, y: 0.5 - h / 2, w, h }] };
    });
    setItems((list) => (replace ? list.map((it) => (it.key === replace ? draft : it)) : [...list, draft]));
  }

  const toggle = (list: string[], set: (v: string[]) => void, tag: string) =>
    set(list.includes(tag) ? list.filter((t) => t !== tag) : list.length < MAX_TAGS ? [...list, tag] : list);
  const setItem = (i: number, patch: Partial<Draft>) => setItems((list) => list.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  async function post() {
    if (!picture) return;
    setBusy(true);
    setError(null);
    // A video goes first, straight to storage (with progress); the post then claims it.
    let videoKey: string | null = null;
    if (video && !editId) {
      try {
        setSent(0);
        videoKey = await uploadVideo(video, setSent);
      } catch (err) {
        setSent(null);
        setError(err instanceof Error ? err.message : "Couldn't send the video.");
        return setBusy(false);
      }
      setSent(null);
    }
    const form = new FormData();
    if (!editId || pictureChanged) form.append("picture", picture.blob, "post.webp");
    // The layout, kept privately so it can be rearranged later. Sent every time there is one: it also says which
    // picture is which piece (by its place in the list), and that changes when pieces are added or taken out.
    if (board) {
      try {
        const pieceOf = new Map(items.filter((it) => it.name.trim()).map((it, i) => [it.key, i] as const));
        const packed = await packBoard(board, pieceOf);
        form.append("board", packed.json);
        packed.files.forEach((f, n) => form.append(`layer-${n}`, f, `layer-${n}`));
      } catch {}
    }
    const kept = items.filter((it) => it.name.trim());
    // Store pieces' own pictures, by their position in the posted list.
    await Promise.all(
      kept.map(async (it, i) => {
        if (it.closetItemId || it.postItemId || !it.shopPicture) return;
        const blob = await shrinkPicture(it.shopPicture);
        if (blob) form.append(`itemPicture-${i}`, blob, `piece-${i}.webp`);
      })
    );
    form.append(
      "data",
      JSON.stringify({
        caption,
        styleTags: styles,
        occasionTags: occasions,
        width: picture.width,
        height: picture.height,
        ...(videoKey && video ? { videoKey, videoMs: video.ms } : {}),
        items: kept.map(({ name, brand, store, link, price, category, closetItemId, postItemId, detailsPrivate }) => ({
          name,
          brand,
          store,
          link,
          price,
          category,
          closetItemId,
          detailsPrivate,
          id: postItemId ?? undefined,
        })),
      })
    );
    if (editId) {
      const res = await fetch(`/api/posts/${encodeURIComponent(editId)}`, { method: "PATCH", body: form }).catch(() => null);
      if (res?.ok) return router.replace(`/p/${editId}`);
      const data = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
      setError(data.error ?? "Couldn't save the changes. Please try again.");
      return setBusy(false);
    }
    const res = await fetch("/api/posts", { method: "POST", body: form }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { id?: string; error?: string }) : {};
    // Replace the form in history, so Back from the new post goes where they were before.
    if (res?.ok && data.id) return router.replace(`/p/${data.id}`);
    // The sent video didn't become a post: throw it away.
    if (videoKey) void fetch(`/api/posts/video?key=${encodeURIComponent(videoKey)}`, { method: "DELETE" }).catch(() => {});
    setError(data.error ?? "Couldn't post right now. Please try again.");
    setBusy(false);
  }

  if (!access) return <main className="flex-1" />;
  if (editMissing) {
    return (
      <main className="flex-1 pb-20">
        <PageShell className="pt-14 text-center">
          <p className="text-[15px] text-[#4f5b66]">
            {editMissing === "notYours" ? "You can only edit your own posts." : "Couldn't open this post. Please try again."}
          </p>
        </PageShell>
      </main>
    );
  }
  if (!access.canPost) {
    return (
      <main className="flex-1 pb-20">
        <PageShell className="pt-14 text-center">
          <p className="text-[15px] text-[#4f5b66]">Posting opens soon.</p>
        </PageShell>
      </main>
    );
  }
  if (!access.username) {
    return (
      <main className="flex-1 pb-20">
        <PageShell className="pt-14 text-center">
          <p className="text-[15px] text-[#4f5b66]">Pick a username first, so people know whose outfit it is.</p>
          <Link href="/profile" className={`${btnPrimary} mt-5`}>
            Pick a username
          </Link>
        </PageShell>
      </main>
    );
  }

  const field =
    "h-10 w-full min-w-0 rounded-[10px] bg-white px-3 text-[13.5px] text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_#121821]";
  const chip = (on: boolean) =>
    `rounded-full px-3.5 py-1.5 text-[12.5px] font-medium ${on ? "bg-[#121821] text-white" : "bg-white text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)]"}`;

  return (
    <main className="flex-1 pb-24">
      <PageShell className="max-w-xl pt-8">
        <div className="flex items-center gap-3">
          <BackButton fallback="/discover" disabled={busy} />
          <h1 className="font-display text-[36px] leading-none text-[#121821]">{editId ? "Edit post" : "New post"}</h1>
        </div>

        {/* The photo */}
        <section className="mt-6">
          {picture && !editing && (video || postedVideo) ? (
            // A video post: the video, and (new posts) a slider to choose its cover.
            <div>
              <div className="relative overflow-hidden rounded-[18px] bg-[#0b0f14]">
                <video src={video?.url ?? postedVideo ?? undefined} poster={picture.url} controls muted playsInline loop className="mx-auto max-h-[60vh] w-auto" />
                {!editId && (
                  <button
                    onClick={() => {
                      setVideo(null);
                      setPicture(null);
                      setItems([]);
                    }}
                    className="absolute right-3 top-3 rounded-full bg-white/95 px-3.5 py-1.5 text-[12px] font-semibold text-[#121821] shadow"
                  >
                    Start over
                  </button>
                )}
              </div>
              {video && (
                <div className="mt-3 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- the chosen cover, on this device */}
                  <img src={picture.url} alt="Cover" className="h-14 w-11 shrink-0 rounded-[8px] bg-[#f1efeb] object-cover" />
                  <label className="min-w-0 flex-1 text-[12px] font-semibold text-[#5d6874]">
                    Cover
                    <input
                      type="range"
                      min={0}
                      max={video.ms / 1000}
                      step={0.1}
                      value={coverAt}
                      onChange={(e) => setCoverAt(Number(e.target.value))}
                      className="mt-1 block w-full accent-[#121821]"
                    />
                  </label>
                </div>
              )}
              {video?.hevc && <p className="mt-2 text-[11.5px] text-[#8a949e]">Filmed in HEVC: some Android phones may not play it.</p>}
            </div>
          ) : picture && !editing ? (
            <div className="relative overflow-hidden rounded-[18px] bg-[#f1efeb]">
              {/* eslint-disable-next-line @next/next/no-img-element -- the person's own photo, not uploaded yet */}
              <img src={picture.url} alt="Your outfit photo" className="mx-auto max-h-[60vh] w-auto" />
              <div className="absolute right-3 top-3 flex gap-2">
                <button onClick={editPicture} className="rounded-full bg-[#121821] px-3.5 py-1.5 text-[12px] font-semibold text-white shadow">
                  Edit
                </button>
                {!editId && (
                  <button
                    onClick={() => {
                      setPicture(null);
                      setBoard(null);
                      setItems([]);
                    }}
                    className="rounded-full bg-white/95 px-3.5 py-1.5 text-[12px] font-semibold text-[#121821] shadow"
                  >
                    Start over
                  </button>
                )}
              </div>
            </div>
          ) : (
            !editId && !picture && !building && !board && !showSaved && !showRecordings && (
            // The same choices as the ＋ menu (and your Live Try On recordings, when you have some).
            <ul className="rounded-[22px] bg-white p-2 shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)]">
              {CREATE_OPTIONS.map((o) => (
                <li key={o.start}>
                  <CreateOptionRow
                    title={o.title}
                    sub={o.sub}
                    Icon={o.Icon}
                    onClick={
                      o.start === "photo"
                        ? () => fileInput.current?.click()
                        : o.start === "video"
                          ? () => videoInput.current?.click()
                          : o.start === "look"
                            ? openSaved
                            : startBuilding
                    }
                  />
                </li>
              ))}
              {recordings && recordings.length > 0 && (
                <li>
                  <CreateOptionRow title="Share a Live Try On video" sub="One of your saved recordings" Icon={VideoIcon} onClick={openRecordings} />
                </li>
              )}
            </ul>
            )
          )}
          <input
            ref={videoInput}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,.mov,.mp4,.webm"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void takeVideo(file);
            }}
          />
          {showRecordings && !picture && (
            <div className="rounded-[18px] bg-white p-3 shadow-[inset_0_0_0_1px_rgba(18,24,33,0.08)]">
              <div className="flex items-center justify-between px-1 pb-2">
                <p className="text-[14px] font-semibold text-[#121821]">Your Live Try On videos</p>
                <button onClick={() => setShowRecordings(false)} className="text-[12.5px] font-semibold text-[#5d6874]">
                  Other ways to post
                </button>
              </div>
              <ul className="grid grid-cols-3 gap-2">
                {(recordings ?? []).map((r) => (
                  <li key={r.id}>
                    <button onClick={() => pickRecording(r.id)} aria-label={`Recording from ${new Date(r.savedAt).toLocaleDateString()}`} className="block w-full overflow-hidden rounded-[12px] bg-[#0b0f14]">
                      <video src={`/api/me/live-videos/${encodeURIComponent(r.id)}#t=0.5`} muted playsInline preload="metadata" className="pointer-events-none aspect-[3/4] w-full object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void takePhoto(file);
            }}
          />
          {showSaved && !picture && (
            <div className="rounded-[18px] bg-white p-3 shadow-[inset_0_0_0_1px_rgba(18,24,33,0.08)]">
              <div className="flex items-center justify-between px-1 pb-2">
                <p className="text-[14px] font-semibold text-[#121821]">Your saved looks</p>
                <button onClick={() => setShowSaved(false)} className="text-[12.5px] font-semibold text-[#5d6874]">
                  Other ways to post
                </button>
              </div>
              {!saved ? (
                <p className="p-2 text-[13px] text-[#5d6874]">Loading…</p>
              ) : saved.length === 0 ? (
                <p className="p-2 text-[13px] text-[#5d6874]">No saved looks with a try-on picture yet.</p>
              ) : (
                <ul className="grid grid-cols-3 gap-2">
                  {saved.map((o) => (
                    <li key={o.id}>
                      <button onClick={() => pickSaved(o)} className="block w-full overflow-hidden rounded-[12px] bg-[#f1efeb]">
                        {/* eslint-disable-next-line @next/next/no-img-element -- the person's own saved look */}
                        <img src={`/api/outfits/${o.id}/try-on/image?v=${o.tryOn}`} alt={o.occasion ?? "Saved look"} className="aspect-[3/4] w-full object-cover" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {board && editing && (
          <section className="mt-6">
            <BoardEditor
              board={board}
              onChange={setBoard}
              onAddPiece={() => {
                void loadCloset();
                setShopPieces(readShopTryOns());
                setPicker({ replace: null });
              }}
              onReplace={(key) => {
                void loadCloset();
                setShopPieces(readShopTryOns());
                setPicker({ replace: key });
              }}
              onDeleted={(key) => setItems((list) => list.filter((it) => it.key !== key))}
            />
            <div className="mt-3 flex gap-2">
              <button onClick={finishBoard} disabled={boardBusy} className={`${btnPrimary} flex-1`}>
                {boardBusy ? "One moment…" : "Done"}
              </button>
              {/* Editing a picture that's already made: Cancel keeps it as it was. */}
              {picture ? (
                <button onClick={cancelEditing} disabled={boardBusy} className={btnSecondary}>
                  Cancel
                </button>
              ) : (
                <>
                  <button onClick={makeBoard} disabled={boardBusy} className={btnSecondary}>
                    Reset
                  </button>
                  <button
                    onClick={() => {
                      setBoard(null);
                      setEditing(false);
                      setBuilding(true);
                    }}
                    disabled={boardBusy}
                    className={btnSecondary}
                  >
                    Pieces
                  </button>
                </>
              )}
            </div>
          </section>
        )}
        {picker &&
          createPortal(
            <Dialog label={picker.replace ? "Replace piece" : "Add a piece"} onClose={() => setPicker(null)} className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-[22px] bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-semibold text-[#121821]">{picker.replace ? "Replace with" : "Add a piece"}</h2>
                <button onClick={() => setPicker(null)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-[20px] text-[#5d6874]">
                  ×
                </button>
              </div>
              <SourceTabs source={source} onChange={setSource} />
              <div className="mt-3">
                {source === "closet" && !closet ? (
                  <p className="p-2 text-[13px] text-[#5d6874]">Loading…</p>
                ) : (
                  <PieceGrid
                    list={source === "closet" ? (closet ?? []).map(fromCloset) : shopPieces.map(fromShop)}
                    isOn={(d) => items.some((it) => it.key === d.key)}
                    onPick={(d) => void placePiece(d)}
                    empty={source === "shop" ? "Pieces you try on from Shopping show here." : "Your closet is empty."}
                  />
                )}
              </div>
            </Dialog>,
            document.body
          )}

        {building && !picture && (
          <section className="mt-6">
            <SourceTabs source={source} onChange={setSource} />

            <div className="mt-3 rounded-[18px] bg-white p-3 shadow-[inset_0_0_0_1px_rgba(18,24,33,0.08)]">
              {source === "shop" && (
                <div className="mb-3 flex flex-col gap-2 border-b border-black/[0.06] p-1 pb-3">
                  <div className="flex gap-2">
                    <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste a store link" inputMode="url" className={field} />
                    <button onClick={addLink} disabled={!link.trim() || linkBusy || items.length >= MAX_POST_ITEMS} className={`${btnSecondary} !min-h-[40px] shrink-0 !px-4`}>
                      {linkBusy ? "…" : "Add"}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {KINDS.map((k) => (
                      <button key={k.value} type="button" onClick={() => setLinkKind(k.value)} aria-pressed={linkKind === k.value} className={chip(linkKind === k.value)}>
                        {k.label}
                      </button>
                    ))}
                    <button type="button" onClick={() => storePhoto.current?.click()} className={`${btnText} ml-auto text-[12.5px]`}>
                      or a photo
                    </button>
                  </div>
                  <input
                    ref={storePhoto}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void addStorePhoto(file);
                    }}
                  />
                </div>
              )}
              {source === "closet" && !closet ? (
                <p className="p-2 text-[13px] text-[#5d6874]">Loading…</p>
              ) : (
                <PieceGrid
                  list={source === "closet" ? (closet ?? []).map(fromCloset) : shopPieces.map(fromShop)}
                  isOn={(d) => items.some((it) => it.key === d.key)}
                  onPick={pick}
                  empty={source === "shop" ? "Paste a store link or add a photo of a piece." : "Your closet is empty."}
                />
              )}
            </div>

            {items.length > 0 && (
              <div className="mt-3 flex items-center gap-2 overflow-x-auto">
                {items.map((it) => (
                  <button key={it.key} type="button" onClick={() => pick(it)} aria-label={`Remove ${it.name}`} className="relative shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element -- the chosen pieces */}
                    <img src={it.thumb ?? ""} alt="" className="h-14 w-14 rounded-[10px] bg-white object-contain p-0.5" />
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#121821] text-[10px] text-white">✕</span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={makeBoard} disabled={!items.some((it) => it.thumb) || boardBusy} className={`${btnPrimary} flex-1`}>
                {boardBusy ? "Laying it out…" : `Make the outfit (${items.length})`}
              </button>
              <button
                onClick={() => {
                  setBuilding(false);
                  setItems([]);
                }}
                className={btnSecondary}
              >
                Back
              </button>
            </div>
          </section>
        )}

        {picture && !editing && (
          <>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX))}
              rows={2}
              placeholder="Caption (optional)"
              className="mt-5 block w-full resize-none rounded-[14px] bg-white px-3.5 py-3 text-[14px] text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_#121821]"
            />

            <p className={`${eyebrow} mt-5`}>Style</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STYLE_TAGS.map((t) => (
                <button key={t} type="button" onClick={() => toggle(styles, setStyles, t)} aria-pressed={styles.includes(t)} className={chip(styles.includes(t))}>
                  {t}
                </button>
              ))}
            </div>
            <p className={`${eyebrow} mt-4`}>Occasion</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {OCCASION_TAGS.map((t) => (
                <button key={t} type="button" onClick={() => toggle(occasions, setOccasions, t)} aria-pressed={occasions.includes(t)} className={chip(occasions.includes(t))}>
                  {t}
                </button>
              ))}
            </div>

            {/* The pieces: optional; anything unknown can be left empty. */}
            <div className="mt-6 flex items-center justify-between">
              <p className={eyebrow}>Pieces</p>
              <div className="flex gap-3 text-[12.5px]">
                <button type="button" onClick={openCloset} className={btnText} disabled={items.length >= MAX_POST_ITEMS}>
                  From my closet
                </button>
                <button type="button" onClick={() => setItems((l) => [...l, blankItem()])} className={btnText} disabled={items.length >= MAX_POST_ITEMS}>
                  ＋ Add
                </button>
              </div>
            </div>
            {showCloset && (
              <div className="mt-2 rounded-[18px] bg-white p-3 shadow-[inset_0_0_0_1px_rgba(18,24,33,0.08)]">
                {!closet ? (
                  <p className="p-2 text-[13px] text-[#5d6874]">Loading…</p>
                ) : (
                  <ul className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto">
                    {closet.map((c) => {
                      const added = items.some((it) => it.closetItemId === c.id);
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => setItems((l) => (added ? l.filter((it) => it.closetItemId !== c.id) : l.length < MAX_POST_ITEMS ? [...l, fromCloset(c)] : l))}
                            aria-pressed={added}
                            aria-label={c.description}
                            className={`block w-full overflow-hidden rounded-[10px] bg-[#f4f3f0] ${added ? "ring-2 ring-[#121821]" : ""}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- the person's own closet */}
                            <img src={c.imageUrl} alt="" className="aspect-square w-full object-contain p-1" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <button type="button" onClick={() => setShowCloset(false)} className={`${btnText} mt-1 text-[12.5px]`}>
                  Done
                </button>
              </div>
            )}
            <ul className="mt-2 flex flex-col gap-3">
              {items.map((it, i) => (
                <li key={i} className="rounded-[14px] bg-white p-3 shadow-[inset_0_0_0_1px_rgba(18,24,33,0.08)]">
                  <div className="flex items-center gap-2">
                    {it.thumb && (
                      // eslint-disable-next-line @next/next/no-img-element -- the person's own closet piece
                      <img src={it.thumb} alt="" className="h-10 w-10 shrink-0 rounded-[8px] bg-[#f4f3f0] object-contain" />
                    )}
                    <input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="What is it? e.g. Oversized blazer" className={field} />
                    <button type="button" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} aria-label="Remove piece" className="shrink-0 px-1 text-[16px] text-[#5d6874]">
                      ✕
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input value={it.brand} onChange={(e) => setItem(i, { brand: e.target.value })} placeholder="Brand" className={field} />
                    <input value={it.store} onChange={(e) => setItem(i, { store: e.target.value })} placeholder="Store" className={field} />
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_88px] gap-2">
                    <input value={it.link} onChange={(e) => setItem(i, { link: e.target.value })} placeholder="Shopping link (optional)" inputMode="url" className={field} />
                    <input value={it.price} onChange={(e) => setItem(i, { price: e.target.value })} placeholder="Price" className={field} />
                  </div>
                  {/* The name and picture are always public; these details can be kept to yourself. */}
                  <button
                    type="button"
                    onClick={() => setItem(i, { detailsPrivate: !it.detailsPrivate })}
                    aria-pressed={it.detailsPrivate}
                    className={`mt-2 rounded-full px-3 py-1 text-[11.5px] font-semibold ${it.detailsPrivate ? "bg-[#121821] text-white" : "text-[#5d6874] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)]"}`}
                  >
                    {it.detailsPrivate ? "Details: only you" : "Details: everyone"}
                  </button>
                </li>
              ))}
            </ul>

            {error && !previewing && (
              <p role="alert" className="mt-3 text-[13px] text-[#a1312a]">
                {error}
              </p>
            )}
            <div className="mt-6 flex gap-2">
              <button onClick={() => setPreviewing(true)} disabled={busy} className={`${btnPrimary} flex-1`}>
                Preview
              </button>
              <button onClick={() => router.back()} disabled={busy} className={btnSecondary}>
                Cancel
              </button>
            </div>
          </>
        )}
        {previewing && picture && (
          <PostPreview
            imageUrl={picture.url}
            videoUrl={video?.url ?? postedVideo ?? undefined}
            progress={sent}
            username={access.username}
            caption={caption}
            tags={[...styles, ...occasions]}
            pieces={items.filter((it) => it.name.trim()).length}
            busy={busy}
            error={error}
            onClose={() => setPreviewing(false)}
            onPost={post}
            canPost={editId ? true : publicOk}
            postLabel={editId ? "Save" : "Post"}
          >
            {/* Nothing becomes public without this (an edited post is already public). */}
            {!editId && (
            <label className="flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-snug text-[#4f5b66]">
              <input type="checkbox" checked={publicOk} onChange={(e) => setPublicOk(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#121821]" />
              <span>
                Post publicly as <b className="text-[#121821]">@{access.username}</b>. Anyone can see this photo, caption and pieces. Your closet stays private. Follow
                the{" "}
                <Link href="/terms" className="underline underline-offset-2">
                  community rules
                </Link>
                .
              </span>
            </label>
            )}
          </PostPreview>
        )}
        {error && !picture && (
          <p role="alert" className="mt-3 text-[13px] text-[#a1312a]">
            {error}
          </p>
        )}
      </PageShell>
    </main>
  );
}

function SourceTabs({ source, onChange }: { source: "closet" | "shop"; onChange: (s: "closet" | "shop") => void }) {
  return (
    <div role="tablist" aria-label="Where pieces come from" className="mt-2 inline-flex rounded-full bg-white p-1 shadow-[inset_0_0_0_1px_rgba(18,24,33,0.1)]">
      {(
        [
          ["closet", "My closet"],
          ["shop", "Shopping"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          role="tab"
          aria-selected={source === value}
          onClick={() => onChange(value)}
          className={`rounded-full px-4 py-1.5 text-[12.5px] font-semibold ${source === value ? "bg-[#121821] text-white" : "text-[#4f5b66]"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Pieces to choose from (closet or Shopping), as a grid of pictures. */
function PieceGrid({ list, isOn, onPick, empty }: { list: Draft[]; isOn: (d: Draft) => boolean; onPick: (d: Draft) => void; empty: string }) {
  if (list.length === 0) return <p className="p-2 text-[13px] text-[#5d6874]">{empty}</p>;
  return (
    <ul className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto">
      {list.map((d) => {
        const on = isOn(d);
        return (
          <li key={d.key}>
            <button type="button" onClick={() => onPick(d)} aria-pressed={on} aria-label={d.name} className={`block w-full overflow-hidden rounded-[10px] bg-[#f4f3f0] ${on ? "ring-2 ring-[#121821]" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- the person's own pieces */}
              <img src={d.thumb ?? ""} alt="" className="aspect-square w-full object-contain p-1" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
