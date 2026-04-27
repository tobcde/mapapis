import type { ReactNode } from 'react';

interface LoadingScreenProps {
  /** Texto bajo el logo */
  message?: string;
  children?: ReactNode;
}

const BRAND_RING =
  'rounded-full border-ink/12 border-t-coral border-r-sun border-b-sage border-l-violet animate-spin motion-reduce:animate-none';

const SPINNER_SIZE: Record<'sm' | 'md', string> = {
  sm: 'h-3.5 w-3.5 border-2',
  md: 'h-12 w-12 border-[3.5px]',
};

/**
 * Aro que gira con los colores de marca: coral, sun, sage, violet
 * (tokens en `tokens.css`).
 */
export function BrandSpinner({
  className = '',
  size = 'md',
}: {
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      className={`${SPINNER_SIZE[size]} ${BRAND_RING} ${className}`.trim()}
      style={size === 'md' ? { animationDuration: '0.85s' } : { animationDuration: '0.7s' }}
      aria-hidden="true"
    />
  );
}

/**
 * Pantalla de espera unificada — sesión, perfil, Suspense lazy, etc.
 */
export function LoadingScreen({ message = 'Preparando MaPaPis…', children }: LoadingScreenProps) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 bg-cream"
      role="status"
      aria-live="polite"
    >
      <div className="font-display font-black text-2xl tracking-tight text-ink">
        MaPa<span className="text-coral">Pis</span>
      </div>
      <BrandSpinner />
      <p className="text-sm font-semibold text-ink/65 text-center max-w-xs">{message}</p>
      {children}
    </div>
  );
}
