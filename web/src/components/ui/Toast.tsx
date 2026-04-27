/* eslint-disable react-refresh/only-export-components -- patrón provider + hook en un solo módulo */
import {
  createContext,
  useCallback,
  useContext,
  useState,
  useRef,
  type ReactNode,
} from 'react';

// ── tipos ─────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'info' | 'error';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

// ── context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}

// ── provider ──────────────────────────────────────────────────────────────────

const DURATION_MS = 3000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, DURATION_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastList toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </ToastContext.Provider>
  );
}

// ── lista de toasts ───────────────────────────────────────────────────────────

function ToastList({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-4 left-0 right-0 z-[300] flex flex-col items-center gap-2 px-4 pointer-events-none"
    >
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ── toast individual ──────────────────────────────────────────────────────────

const typeStyles: Record<ToastType, string> = {
  success: 'bg-ink text-sun',
  info:    'bg-ink text-white',
  error:   'bg-coral text-white',
};

const typeIcon: Record<ToastType, string> = {
  success: '✓',
  info:    'ℹ',
  error:   '✕',
};

function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => { onDismiss(toast.id); }}
      className={`pointer-events-auto dialog-in flex items-center gap-2.5 px-4 py-2.5 rounded-2xl font-bold text-sm shadow-lg max-w-sm w-full ${typeStyles[toast.type]}`}
      style={{ boxShadow: '3px 3px 0 rgba(14,21,37,0.25)' }}
    >
      <span className="text-base leading-none">{typeIcon[toast.type]}</span>
      <span className="flex-1 text-left leading-snug">{toast.message}</span>
    </button>
  );
}
