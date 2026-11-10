"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ToastAction = { label: string; onClick: () => void };
type ToastContextValue = { showToast: (message: string, action?: ToastAction) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

/** Matches the real Figma source's `.toast` — bottom-right, check icon, auto-dismiss after 3.5s. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; action?: ToastAction; id: number } | null>(null);

  // A note with an action (Undo) stays a little longer, so there's time to tap it.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.action ? 6000 : 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((message: string, action?: ToastAction) => setToast({ message, action, id: Date.now() }), []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          key={toast.id}
          role="status"
          className="fixed inset-x-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 flex items-center gap-2.5 rounded-full bg-[#121821] py-2 pl-5 pr-2 text-xs text-white shadow-[0_5px_30px_rgba(0,0,0,0.2)] md:inset-x-auto md:bottom-6 md:right-6"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
            <path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className={`flex-1 ${toast.action ? "" : "py-2 pr-3"}`}>{toast.message}</span>
          {toast.action && (
            <button
              onClick={() => {
                toast.action!.onClick();
                setToast(null);
              }}
              className="min-h-[36px] shrink-0 rounded-full bg-white px-4 text-[12.5px] font-semibold text-[#121821]"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
