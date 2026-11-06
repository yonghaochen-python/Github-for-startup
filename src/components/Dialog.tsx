"use client";

import { useRef } from "react";
import { useDialog } from "@/lib/useDialog";

/**
 * A small window over the page: a dimmed backdrop (a tap on it closes), the panel as a sheet from the bottom on
 * phones and centered on computers, and keyboard handling (focus inside, Tab kept inside, Escape closes, focus back
 * to what opened it).
 */
export function Dialog({
  label,
  onClose,
  className = "",
  children,
}: {
  label: string;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement | null>(null);
  useDialog(panel, onClose);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()} className={className}>
        {children}
      </div>
    </div>
  );
}
