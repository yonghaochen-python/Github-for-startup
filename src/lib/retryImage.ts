/**
 * For a picture's onError: try loading it once more a moment later (a storage hiccup shouldn't leave a blank tile
 * that looks like the photo was never saved). A second failure is left as it is.
 */
export function retryImage(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.dataset.retried) return;
  img.dataset.retried = "1";
  const src = img.currentSrc || img.src;
  setTimeout(() => {
    img.src = `${src}${src.includes("?") ? "&" : "?"}r=${Date.now()}`;
  }, 1500);
}
