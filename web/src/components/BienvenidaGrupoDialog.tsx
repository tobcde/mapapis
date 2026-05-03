import { Link } from 'react-router-dom';

interface Props {
  grupoId: string;
  grupoNombre: string;
  yoSoyPyme: boolean;
  yoTengoAlumnos: boolean;
  onClose: () => void;
}

/**
 * Modal de bienvenida que aparece la primera vez que el usuario entra a un
 * grupo recién unido por link de invitación. Explica los próximos pasos
 * según el rol (familia con/sin alumnos cargados, pyme).
 *
 * Se monta sobre la pantalla de detalle del grupo para que el contexto
 * (nombre del grupo, miembros, etc.) ya esté visible al fondo.
 */
export function BienvenidaGrupoDialog({
  grupoId,
  grupoNombre,
  yoSoyPyme,
  yoTengoAlumnos,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center px-4 pb-8 sm:pb-0">
      <div
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="relative w-full max-w-sm bg-cream rounded-3xl border-[1.5px] border-ink p-6 dialog-in"
        style={{ boxShadow: '4px 4px 0 var(--ink)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bienvenida-grupo-title"
      >
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4 bg-sun">
          <SparklesIcon className="w-5 h-5 text-ink" />
        </div>

        <h2
          id="bienvenida-grupo-title"
          className="font-display font-extrabold text-xl leading-tight mb-1"
        >
          ¡Listo! Ya formás parte de
        </h2>
        <p className="font-display font-extrabold text-2xl text-coral leading-tight mb-4">
          {grupoNombre}
        </p>

        <p className="text-sm text-ink/70 mb-5">
          Acá vas a coordinar las compras y necesidades del grupo con el resto
          de las familias.
        </p>

        <div className="space-y-3 mb-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink/50">
            Próximos pasos
          </p>

          {!yoSoyPyme && !yoTengoAlumnos && (
            <PasoLink
              to={`/grupos/${grupoId}/alumnos`}
              num="1"
              titulo="Cargá a tu hijo/a"
              desc="Sin un alumno asociado no podés votar ni dividir gastos."
              destacado
              onClick={onClose}
            />
          )}

          <Paso
            num={!yoSoyPyme && !yoTengoAlumnos ? '2' : '1'}
            titulo="Mirá las necesidades activas"
            desc="Revisá qué se está coordinando y sumate a votar o aportar."
          />

          <Paso
            num={!yoSoyPyme && !yoTengoAlumnos ? '3' : '2'}
            titulo="Conocé a las familias"
            desc="En la sección Miembros podés ver quiénes integran el grupo."
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl border-[1.5px] border-ink font-extrabold text-sm uppercase tracking-wide btn-pop bg-ink text-cream"
        >
          Ver el grupo
        </button>
      </div>
    </div>
  );
}

interface PasoProps {
  num: string;
  titulo: string;
  desc: string;
}

function Paso({ num, titulo, desc }: PasoProps) {
  return (
    <div className="flex gap-3">
      <span className="shrink-0 w-6 h-6 rounded-full bg-mist text-ink text-xs font-extrabold flex items-center justify-center">
        {num}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-ink leading-snug">{titulo}</p>
        <p className="text-xs text-ink/60 leading-snug">{desc}</p>
      </div>
    </div>
  );
}

interface PasoLinkProps extends PasoProps {
  to: string;
  destacado?: boolean;
  onClick: () => void;
}

function PasoLink({ to, num, titulo, desc, destacado, onClick }: PasoLinkProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex gap-3 p-2 -mx-2 rounded-lg transition-colors ${
        destacado ? 'bg-coral/10 hover:bg-coral/15' : 'hover:bg-ink/5'
      }`}
    >
      <span
        className={`shrink-0 w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center ${
          destacado ? 'bg-coral text-white' : 'bg-mist text-ink'
        }`}
      >
        {num}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold leading-snug ${destacado ? 'text-coral' : 'text-ink'}`}>
          {titulo} →
        </p>
        <p className="text-xs text-ink/60 leading-snug">{desc}</p>
      </div>
    </Link>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
