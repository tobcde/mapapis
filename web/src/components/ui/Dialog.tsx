import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

/* ── tipos ─────────────────────────────────────────────────────────────── */

type DialogType = 'alert' | 'confirm';

interface DialogState {
  type: DialogType;
  message: string;
  resolve: (value: boolean) => void;
}

interface DialogContextValue {
  showAlert: (message: string) => Promise<void>;
  showConfirm: (message: string) => Promise<boolean>;
}

/* ── context ────────────────────────────────────────────────────────────── */

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog debe usarse dentro de <DialogProvider>');
  return ctx;
}

/* ── provider ───────────────────────────────────────────────────────────── */

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const showAlert = useCallback((message: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      setDialog({ type: 'alert', message, resolve: () => resolve() });
    });
  }, []);

  const showConfirm = useCallback((message: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setDialog({ type: 'confirm', message, resolve });
    });
  }, []);

  const handleConfirm = () => { dialog?.resolve(true); setDialog(null); };
  const handleCancel  = () => { dialog?.resolve(false); setDialog(null); };

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {dialog && (
        <CustomDialog
          dialog={dialog}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </DialogContext.Provider>
  );
}

/* ── componente visual ──────────────────────────────────────────────────── */

function CustomDialog({
  dialog,
  onConfirm,
  onCancel,
}: {
  dialog: DialogState;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isConfirm = dialog.type === 'confirm';

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center px-4 pb-8 sm:pb-0">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
        onClick={isConfirm ? onCancel : onConfirm}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-sm bg-cream rounded-3xl border-[1.5px] border-ink p-6 dialog-in"
        style={{ boxShadow: '4px 4px 0 var(--ink)' }}
      >
        {/* Ícono */}
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 ${
            isConfirm ? 'bg-sun' : 'bg-ink'
          }`}
        >
          {isConfirm ? (
            <SparklesIcon className="w-5 h-5 text-ink" />
          ) : (
            <CheckIcon className="w-5 h-5 text-cream" />
          )}
        </div>

        <p className="font-display font-semibold text-ink text-base leading-snug mb-6">
          {dialog.message}
        </p>

        <div className="flex gap-3">
          {isConfirm && (
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl border-[1.5px] border-ink font-bold text-sm uppercase tracking-wide bg-white text-ink"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-xl border-[1.5px] border-ink font-extrabold text-sm uppercase tracking-wide btn-pop ${
              isConfirm ? 'bg-coral text-white' : 'bg-ink text-cream'
            }`}
          >
            {isConfirm ? 'Confirmar' : 'Entendido'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── íconos inline ──────────────────────────────────────────────────────── */

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
