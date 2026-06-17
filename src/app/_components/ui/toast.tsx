'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastVariant = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  exiting?: boolean;
}

interface ToastContextType {
  toast: (message: string, variant?: ToastVariant) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// ─── Icons ────────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  );
}

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-accent-success/30 bg-accent-success/10 text-accent-success',
  error: 'border-accent-danger/30 bg-accent-danger/10 text-accent-danger',
  info: 'border-accent-primary/30 bg-accent-primary/10 text-accent-primary',
};

// ─── Individual Toast ─────────────────────────────────────────────────────────

function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast;
  onRemove: (id: string) => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-[var(--shadow-lg)] backdrop-blur-sm min-w-[280px] max-w-[380px] ${variantStyles[toast.variant]} ${
        toast.exiting ? 'animate-slide-out-right' : 'animate-slide-in-right'
      }`}
      style={{ background: 'var(--bg-raised)' }}
    >
      <span className={variantStyles[toast.variant].split(' ')[2]}>
        {toast.variant === 'success' ? (
          <CheckIcon />
        ) : toast.variant === 'error' ? (
          <ErrorIcon />
        ) : (
          <InfoIcon />
        )}
      </span>
      <p className="flex-1 text-sm font-medium text-text-primary">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
        aria-label="Dismiss"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    // Start exit animation
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    // Remove after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 280);
    // Clear auto-dismiss timer
    const timer = timeoutRefs.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timeoutRefs.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, message, variant }]);
      // Auto-dismiss after 4s
      const timer = setTimeout(() => removeToast(id), 4000);
      timeoutRefs.current.set(id, timer);
    },
    [removeToast]
  );

  // Cleanup on unmount
  useEffect(() => {
    const refs = timeoutRefs.current;
    return () => {
      refs.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Toast container — fixed bottom-right */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.toast;
}
