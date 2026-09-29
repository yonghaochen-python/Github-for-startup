/**
 * D1 (SQLite under the hood) can transiently fail a read that lands right after a
 * write to the same table — observed live as intermittent 500s on GET routes
 * immediately following an upload/edit/delete. Retry once before giving up.
 */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error("DB read failed, retrying once:", err);
    await new Promise((resolve) => setTimeout(resolve, 150));
    return await fn();
  }
}
