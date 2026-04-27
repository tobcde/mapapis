import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { BrandSpinner } from '@/components/LoadingScreen';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const variantClass: Record<Variant, string> = {
  primary:   'btn-pop bg-ink text-sun',
  secondary: 'btn-pop bg-white text-ink border-[1.5px] border-ink',
  danger:    'btn-pop bg-coral text-white',
  ghost:     'text-ink/60 hover:text-ink underline-offset-2 hover:underline',
};

const sizeClass: Record<Size, string> = {
  sm: 'px-3 py-2 text-[11px]',
  md: 'px-4 py-3 text-xs',
  lg: 'px-5 py-3.5 text-xs',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  icon,
  children,
  disabled,
  className = '',
  ...props
}: Props) {
  const isDisabled = disabled ?? loading;

  return (
    <button
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-xl font-extrabold uppercase tracking-wider transition',
        'disabled:opacity-50 disabled:pointer-events-none',
        variantClass[variant],
        sizeClass[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {loading ? <BrandSpinner size="sm" /> : icon}
      {children}
    </button>
  );
}
