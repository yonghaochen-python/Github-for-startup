"use client";

import { useEffect, useRef, useState } from "react";

const arrow = "flex h-7 w-7 items-center justify-center rounded-full text-[15px] opacity-60 hover:bg-black/5 hover:opacity-100";

/**
 * One row on the closet / Shopping shelf: a label, and pieces that slide left and right inside the row only (swipe,
 * trackpad, or the ‹ › arrows).
 */
export function ShelfRow({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  const listRef = useRef<HTMLUListElement | null>(null);
  // The arrows only show when the row has more than fits.
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => setOverflows(list.scrollWidth > list.clientWidth + 4);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [count]);

  const slide = (direction: 1 | -1) => {
    const list = listRef.current;
    if (list) list.scrollBy({ left: direction * list.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section aria-label={label} className="py-2.5">
      <div className="mb-1.5 flex items-center gap-2">
        <h2 className="flex-1 text-[10.5px] font-semibold uppercase tracking-[1.8px] opacity-70">
          {label} <span className="ml-1 font-normal">{count}</span>
        </h2>
        {overflows && (
          <>
            <button onClick={() => slide(-1)} aria-label={`Slide ${label} left`} className={arrow}>
              ‹
            </button>
            <button onClick={() => slide(1)} aria-label={`Slide ${label} right`} className={arrow}>
              ›
            </button>
          </>
        )}
      </div>
      <ul ref={listRef} className="closet-row flex snap-x snap-mandatory items-end gap-1.5 overflow-x-auto pb-1 pt-2">
        {children}
      </ul>
    </section>
  );
}
