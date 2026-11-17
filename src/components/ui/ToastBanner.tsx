import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export interface ToastMessage {
  type: 'success' | 'error';
  text: string;
}

export function ToastBanner({
  toast,
  onDismiss,
}: {
  toast: ToastMessage | null;
  onDismiss: () => void;
}) {
  if (!toast) return null;
  const isErr = toast.type === 'error';

  return (
    <div
      className={`mb-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
        isErr
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800'
      }`}
      role="status"
    >
      <div className="flex items-center gap-2.5">
        {isErr ? (
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        )}
        <span className="font-medium">{toast.text}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded p-1 opacity-70 hover:opacity-100"
        aria-label="Dismiss message"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
