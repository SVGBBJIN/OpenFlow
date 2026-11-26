"use client";
import { useStore } from "@/lib/store";

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-10 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto flex items-center gap-3 rounded-md border border-line2 bg-raised px-3 py-2 text-[13px] shadow-lg">
          <span>{t.msg}</span>
          {t.undo && (
            <button className="text-accent hover:underline" onClick={() => { t.undo?.(); dismiss(t.id); }}>
              Undo
            </button>
          )}
          <button className="text-muted hover:text-fg" onClick={() => dismiss(t.id)} aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  );
}
