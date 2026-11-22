/** Transient toast for errors and status messages (rate limits, permissions, offline …). */
import { Info, TriangleAlert } from 'lucide-react';
import type { Toast } from '../types';

export function ToastView({ toast }: { toast: Toast | null }) {
  if (!toast) return null;
  const isError = toast.tone === 'error';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-9 z-50 flex justify-center px-4">
      <div
        key={toast.id}
        role="status"
        aria-live="polite"
        className="toast-enter ui-surface pointer-events-auto flex max-w-md items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-2xl"
      >
        {isError ? (
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
        ) : (
          <Info className="mt-0.5 h-4 w-4 shrink-0 ui-muted" aria-hidden="true" />
        )}
        <span>{toast.text}</span>
      </div>
    </div>
  );
}
