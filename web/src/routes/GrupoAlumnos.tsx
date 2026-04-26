import { useParams, Link } from 'react-router-dom';
import { Shell } from '@/components/Shell';

export function GrupoAlumnos() {
  const { id } = useParams<{ id: string }>();

  return (
    <Shell>
      <div className="anim-in space-y-4">
        <Link
          to={`/grupos/${id ?? ''}`}
          className="text-[11px] font-bold uppercase tracking-wider text-ink/50 hover:text-ink"
        >
          ← Volver al grupo
        </Link>
        <h1 className="font-display text-2xl font-extrabold">Alumnos</h1>
        <p className="text-sm text-ink/60">
          Gestión de alumnos y tutores del grupo. — Fase 4.8
        </p>
      </div>
    </Shell>
  );
}
