import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const inputClass =
  'w-full rounded-xl border-[1.5px] border-ink/30 px-4 py-3 text-sm bg-white focus:outline-none focus:border-ink transition-colors placeholder:text-ink/30';

/* ── Input ──────────────────────────────────────────────────────────────── */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const fieldId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="grid gap-1">
        {label && (
          <label
            htmlFor={fieldId}
            className="text-[10px] font-bold uppercase tracking-wider text-ink/70"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={fieldId}
          className={`${inputClass} ${error ? 'border-coral focus:border-coral' : ''} ${className}`}
          {...props}
        />
        {error && <p className="text-[11px] text-coral">{error}</p>}
        {!error && hint && <p className="text-[11px] text-ink/50">{hint}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';

/* ── Textarea ───────────────────────────────────────────────────────────── */

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const fieldId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="grid gap-1">
        {label && (
          <label
            htmlFor={fieldId}
            className="text-[10px] font-bold uppercase tracking-wider text-ink/70"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={fieldId}
          rows={3}
          className={`${inputClass} resize-none ${error ? 'border-coral focus:border-coral' : ''} ${className}`}
          {...props}
        />
        {error && <p className="text-[11px] text-coral">{error}</p>}
        {!error && hint && <p className="text-[11px] text-ink/50">{hint}</p>}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';
