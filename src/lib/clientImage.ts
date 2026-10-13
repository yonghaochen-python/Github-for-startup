/** Browser-only helpers for preparing a person's photo before it is sent anywhere. */

const MAX_SIDE = 1600;

function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode"));
    };
    img.src = url;
  });
}

/** Re-encodes any browser-readable photo as a JPEG no larger than 1600px on its longest side. */
export async function photoToJpeg(source: Blob, quality = 0.9, maxSide = MAX_SIDE): Promise<Blob> {
  let width: number;
  let height: number;
  let draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

  try {
    const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
    width = bitmap.width;
    height = bitmap.height;
    draw = (ctx, w, h) => {
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close();
    };
  } catch {
    const img = await loadImageElement(source);
    width = img.naturalWidth;
    height = img.naturalHeight;
    draw = (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h);
  }

  const scale = Math.min(1, maxSide / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  draw(ctx, w, h);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", quality);
  });
}
