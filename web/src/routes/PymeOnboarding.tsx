import { useNavigate } from 'react-router-dom';

export function PymeOnboarding() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 gap-6">
      <div className="anim-in text-center space-y-3 max-w-sm w-full">
        <div className="font-display font-extrabold text-2xl">
          Perfil <span className="hl-sun">pyme</span>
        </div>
        <p className="text-sm text-ink/60">
          Completá los datos de tu empresa para aparecer en el feed de familias. — Fase 4.7
        </p>
        <button
          type="button"
          onClick={() => { void navigate('/feed', { replace: true }); }}
          className="mt-4 text-[11px] font-bold uppercase tracking-wider text-ink/50 hover:text-ink transition-colors"
        >
          Continuar →
        </button>
      </div>
    </main>
  );
}
