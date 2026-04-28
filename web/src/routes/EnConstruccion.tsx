/**
 * Pantalla "en construcción" estilo cuadernillo escolar.
 *
 * Inspirada en la pieza social "Hola, somos mapapis": papel rayado con
 * anillos a la izquierda, margen rojo, header de metadata, título grande
 * con la palabra "mapapis" en highlight + pin geográfico, y un mensaje
 * en handwriting (Caveat).
 */
export function EnConstruccion() {
  return (
    <main className="min-h-screen px-4 py-6 flex items-center justify-center">
      <div
        className="relative w-full max-w-[420px] rounded-2xl overflow-hidden border-[1.5px] border-ink"
        style={{
          background: 'var(--cream)',
          boxShadow: '0 18px 40px -16px rgba(14, 21, 37, 0.25)',
        }}
      >
        {/* Líneas horizontales del cuadernillo */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent 0, transparent 39px, rgba(14, 21, 37, 0.08) 39px, rgba(14, 21, 37, 0.08) 40px)',
            backgroundPosition: '0 60px',
          }}
        />

        {/* Anillos del lado izquierdo */}
        <div className="absolute left-3 top-0 bottom-0 flex flex-col justify-around py-12 pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="block w-2.5 h-2.5 rounded-full bg-ink"
            />
          ))}
        </div>

        {/* Margen rojo vertical */}
        <div
          className="absolute top-0 bottom-0 w-px"
          style={{ left: '52px', background: 'rgba(255, 90, 78, 0.55)' }}
        />

        {/* Contenido */}
        <div className="relative pl-16 pr-6 py-8">
          {/* Header metadata */}
          <header className="flex items-center justify-between text-[11px] font-mono text-ink/70 tracking-wider mb-6">
            <span>Sáb · 10:00</span>
            <span>ep. 06</span>
          </header>

          {/* Kicker */}
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-coral mb-4">
            ▸ Por eso existimos
          </div>

          {/* Título principal */}
          <h1 className="font-display font-extrabold text-5xl leading-[0.95] tracking-tight">
            Hola,
            <br />
            somos
          </h1>

          {/* "mapapis" highlight + pin */}
          <div className="relative mt-3 mb-8 flex items-center gap-3">
            <span
              className="font-display font-extrabold text-5xl leading-none px-2 py-1 inline-block -rotate-1"
              style={{
                background: 'var(--sun)',
                boxShadow: '2px 2px 0 var(--ink)',
              }}
            >
              mapapis
            </span>
            <PinIcon className="w-7 h-7 shrink-0" />
          </div>

          {/* Mensaje handwriting */}
          <p
            className="text-2xl leading-snug text-ink"
            style={{ fontFamily: "'Caveat', cursive", fontWeight: 600 }}
          >
            Estamos haciendo algo para que{' '}
            <span className="hl-sun">el grupo del cole</span> deje de ser un
            trabajo de medio tiempo.{' '}
            <span aria-hidden="true">🤲</span>
          </p>

          {/* Footer card oscura */}
          <div
            className="mt-10 rounded-2xl bg-ink text-cream p-4 flex items-center gap-4"
            style={{ boxShadow: '3px 3px 0 var(--coral)' }}
          >
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-cream/55">
                Seguinos →
              </div>
              <div className="font-display font-bold text-base mt-0.5 truncate">
                @mapapis
              </div>
            </div>
            <div className="w-px self-stretch bg-cream/20" />
            <div className="flex-1 min-w-0 text-right">
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-cream/55">
                Web
              </div>
              <div className="font-mono font-bold text-[13px] mt-0.5 truncate">
                mapapis.com.ar
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 2c-3.87 0-7 3.13-7 7 0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        fill="var(--coral)"
        stroke="var(--ink)"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="9" r="2.5" fill="var(--cream)" stroke="var(--ink)" strokeWidth="1.5" />
    </svg>
  );
}
