"use client";

import type { StudioModule, StudioReportData } from "@/lib/studioModules";

/**
 * Draws a finished report as one portrait-format picture (1080×1350, the size Instagram and most phones show
 * whole), to save or share: the module's tint, the portrait in an arch, the headline, the palette with names and
 * HEX codes, and the keywords. Drawn here on the device; nothing is uploaded.
 */

const W = 1080;
const H = 1350;
const INK = "#121821";
const MUTED = "#5d6874";

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** The page's own fonts, as the canvas needs them by name. */
function fontFamily(variable: string, fallback: string): string {
  const name = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return name ? `${name}, ${fallback}` : fallback;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function archPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, 0);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

export async function drawReportCard(module: StudioModule, data: StudioReportData, portrait: string | null, date: string): Promise<Blob> {
  await document.fonts?.ready;
  const serif = fontFamily("--font-instrument-serif", "Georgia, serif");
  const sans = fontFamily("--font-dm-sans", "Helvetica, Arial, sans-serif");
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = module.tint;
  ctx.fillRect(0, 0, W, H);

  // Top label.
  ctx.fillStyle = module.accent;
  ctx.font = `500 22px ${sans}`;
  ctx.letterSpacing = "5px";
  ctx.fillText(`VIRM AI STYLIST · ${module.label.toUpperCase()}`, 80, 110);
  ctx.fillStyle = MUTED;
  ctx.textAlign = "right";
  ctx.fillText(date.toUpperCase(), W - 80, 110);
  ctx.textAlign = "left";
  ctx.letterSpacing = "0px";

  // Portrait in an arch, right side.
  const px = 600;
  const py = 170;
  const pw = 400;
  const ph = 520;
  const img = portrait ? await loadImage(portrait) : null;
  ctx.save();
  archPath(ctx, px, py, pw, ph);
  ctx.clip();
  if (img) {
    const scale = Math.max(pw / img.width, ph / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, px + (pw - w) / 2, py + (ph - h) / 2, w, h);
  } else {
    ctx.fillStyle = "#e4e8ec";
    ctx.fillRect(px, py, pw, ph);
  }
  ctx.restore();

  // Title and headline, left side.
  ctx.fillStyle = INK;
  ctx.font = `400 34px ${serif}`;
  const extra = data.extra as { primary?: { subtype?: string }; directions?: { name?: string }[]; styles?: { name?: string }[]; final?: { style?: string } } | undefined;
  const subtype = extra?.primary?.subtype ?? extra?.directions?.[0]?.name ?? extra?.styles?.[0]?.name ?? extra?.final?.style;
  ctx.fillText(subtype ?? module.title, 80, 200);
  ctx.font = `400 76px ${serif}`;
  let y = 300;
  for (const line of wrap(ctx, data.headline, 470).slice(0, 4)) {
    ctx.fillText(line, 80, y);
    y += 80;
  }
  ctx.fillStyle = MUTED;
  ctx.font = `400 26px ${sans}`;
  y += 10;
  for (const line of wrap(ctx, data.keywords.join("  ·  "), 470).slice(0, 3)) {
    ctx.fillText(line, 80, y);
    y += 38;
  }

  // Palette: swatches with names and HEX codes.
  const swatches = data.palette.slice(0, 8);
  const top = 790;
  const cols = 4;
  const cell = (W - 160) / cols;
  swatches.forEach((s, i) => {
    const cx = 80 + (i % cols) * cell;
    const cy = top + Math.floor(i / cols) * 200;
    ctx.fillStyle = /^#[0-9a-f]{6}$/i.test(s.hex) ? s.hex : "#cccccc";
    ctx.beginPath();
    ctx.arc(cx + 50, cy + 50, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(18,24,33,0.12)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = `500 24px ${sans}`;
    ctx.fillText(s.name, cx, cy + 140);
    ctx.fillStyle = MUTED;
    ctx.font = `400 20px ${sans}`;
    ctx.fillText(s.hex.toUpperCase(), cx, cy + 170);
  });

  // Footer.
  ctx.fillStyle = INK;
  ctx.font = `400 44px ${serif}`;
  ctx.fillText("Virm", 80, H - 70);
  ctx.fillStyle = MUTED;
  ctx.font = `400 20px ${sans}`;
  ctx.textAlign = "right";
  ctx.fillText("A styling suggestion, made from one photo.", W - 80, H - 80);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("card"))), "image/png"));
}
