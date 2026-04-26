import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shell } from '@/components/Shell';
import { NecesidadCard } from '@/components/NecesidadCard';
import { SkeletonList } from '@/components/ui';
import { useProfile } from '@/lib/queries/useProfile';
import { usePymeProfile } from '@/lib/queries/usePymeProfile';
import { useFeedFamilia } from '@/lib/queries/useFeedFamilia';
import { useFeedPyme } from '@/lib/queries/useFeedPyme';
import type { NecesidadEstado } from '@/lib/database.types';

// ─── Shared UI ────────────────────────────────────────────────────────────────

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border-[1.5px] border-ink transition-colors ${
        active ? 'bg-ink text-sun' : 'bg-white text-ink'
      }`}
    >
      {label}
    </button>
  );
}

function EmptyState({
  title,
  subtitle,
  ctaLabel,
  onCta,
}: {
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  return (
    <div className="bg-white rounded-3xl border-[1.5px] border-dashed border-ink/30 px-6 py-8 text-center">
      <h3 className="font-display font-bold text-lg leading-tight">{title}</h3>
      {subtitle && <p className="text-sm text-ink/60 mt-1.5 leading-snug">{subtitle}</p>}
      {ctaLabel && onCta && (
        <button
          type="button"
          onClick={onCta}
          className="btn-pop mt-4 px-5 py-2.5 bg-coral text-white font-extrabold rounded-xl uppercase tracking-wider text-xs border-[1.5px] border-ink shadow-pop"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

function StatChip({
  num,
  label,
  colorClass,
}: {
  num: number;
  label: string;
  colorClass: string;
}) {
  return (
    <div className="bg-white rounded-2xl border-[1.5px] border-ink p-3 flex flex-col items-start shadow-pop-sm">
      <span className={`font-display font-black text-3xl leading-none ${colorClass}`}>{num}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-ink/70 mt-1">{label}</span>
    </div>
  );
}

// ─── Feed Familia ─────────────────────────────────────────────────────────────

type FiltroFamilia = 'activas' | 'votando' | 'cumplidas' | 'todas';

const ESTADOS_INACTIVOS = new Set<NecesidadEstado>(['completada', 'cancelada']);

function FeedFamilia() {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: necesidades = [], isLoading, error } = useFeedFamilia();
  const [filtro, setFiltro] = useState<FiltroFamilia>('activas');
  const [query, setQuery] = useState('');

  const activas = necesidades.filter((n) => !ESTADOS_INACTIVOS.has(n.estado)).length;
  const enVotacion = necesidades.filter((n) => n.estado === 'en_votacion').length;
  const totalOfertas = necesidades.reduce((acc, n) => acc + n.ofertas_count, 0);

  const porEstado = (() => {
    if (filtro === 'votando') return necesidades.filter((n) => n.estado === 'en_votacion');
    if (filtro === 'cumplidas') return necesidades.filter((n) => n.estado === 'completada');
    if (filtro === 'todas') return necesidades;
    return necesidades.filter((n) => !ESTADOS_INACTIVOS.has(n.estado));
  })();

  const q = query.trim().toLowerCase();
  const filtradas = q
    ? porEstado.filter(
        (n) =>
          n.titulo.toLowerCase().includes(q) ||
          n.zona.toLowerCase().includes(q) ||
          (n.categorias?.nombre ?? '').toLowerCase().includes(q),
      )
    : porEstado;

  const nombreCorto =
    profile?.nombre ?? profile?.email?.split('@')[0] ?? '';

  return (
    <Shell>
      <div className="anim-in">
        {/* Header */}
        <div className="mb-6">
          <p className="text-xs uppercase font-bold tracking-[0.2em] text-coral">
            Hola, {nombreCorto}
          </p>
          <h1 className="font-display font-black text-[2.6rem] leading-[0.95] mt-2">
            Necesidades <em className="not-italic" style={{ fontStyle: 'italic' }}>activas</em>
          </h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <StatChip num={activas} label="activas" colorClass="text-coral" />
          <StatChip num={enVotacion} label="votando" colorClass="text-violet" />
          <StatChip num={totalOfertas} label="ofertas" colorClass="text-sage" />
        </div>

        {/* Búsqueda */}
        <div className="mb-3">
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); }}
            placeholder="Buscar por título, zona o categoría…"
            className="w-full px-4 py-2.5 rounded-xl border-[1.5px] border-ink bg-white text-sm placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-coral/40"
          />
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-4 px-4">
          <FilterPill active={filtro === 'activas'} onClick={() => { setFiltro('activas'); }} label="Activas" />
          <FilterPill active={filtro === 'votando'} onClick={() => { setFiltro('votando'); }} label="Votando" />
          <FilterPill active={filtro === 'cumplidas'} onClick={() => { setFiltro('cumplidas'); }} label="Cumplidas" />
          <FilterPill active={filtro === 'todas'} onClick={() => { setFiltro('todas'); }} label="Todas" />
        </div>

        {/* Lista */}
        {error ? (
          <p className="text-sm text-coral font-semibold text-center py-8">
            Error al cargar necesidades.
          </p>
        ) : isLoading ? (
          <SkeletonList count={3} />
        ) : necesidades.length === 0 ? (
          <EmptyState
            title="Todavía no hay necesidades"
            subtitle="Tocá el botón + para publicar la primera y recibir ofertas de pymes cercanas."
            ctaLabel="Publicar"
            onCta={() => { void navigate('/publicar'); }}
          />
        ) : filtradas.length === 0 ? (
          <EmptyState
            title={q ? 'Sin resultados' : 'No hay nada en este filtro'}
            subtitle={
              q
                ? `Ningún resultado para "${query}". Probá otra búsqueda.`
                : 'Probá otro filtro o publicá una nueva necesidad.'
            }
          />
        ) : (
          <div className="space-y-3">
            {filtradas.map((n) => (
              <NecesidadCard key={n.id} n={n} mode="familia" />
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

// ─── Feed Pyme ────────────────────────────────────────────────────────────────

function FeedPyme() {
  const { data: pymeProfile } = usePymeProfile();
  const { data: items = [], isLoading, error } = useFeedPyme();
  const [filtroZona, setFiltroZona] = useState<string>('todas');
  const [soloMisCats, setSoloMisCats] = useState(false);

  const misCats = pymeProfile?.categorias_ids ?? [];

  const porZona = filtroZona === 'todas' ? items : items.filter((n) => n.zona === filtroZona);
  const filtradas =
    soloMisCats && misCats.length > 0
      ? porZona.filter((n) => misCats.includes(n.categoria_id))
      : porZona;
  const ocultadasPorCat = porZona.length - filtradas.length;

  // Zonas únicas presentes en los items
  const zonas = [...new Set(items.map((n) => n.zona))].sort();

  return (
    <Shell>
      <div className="anim-in">
        {/* Header */}
        <div className="mb-6">
          <p className="text-xs uppercase font-bold tracking-[0.2em] text-sage">Para tu pyme</p>
          <h1 className="font-display font-black text-[2.6rem] leading-[0.95] mt-2">
            Necesidades <em className="not-italic" style={{ fontStyle: 'italic' }}>cerca</em>
          </h1>
          <p className="text-ink/60 text-sm mt-2">
            Pedidos anonimizados — el grupo elige al final.
          </p>
        </div>

        {/* Filtro de zona */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 -mx-4 px-4">
          <FilterPill
            active={filtroZona === 'todas'}
            onClick={() => { setFiltroZona('todas'); }}
            label="Todas las zonas"
          />
          {zonas.map((z) => (
            <FilterPill
              key={z}
              active={filtroZona === z}
              onClick={() => { setFiltroZona(z); }}
              label={z}
            />
          ))}
        </div>

        {/* Toggle: solo mis categorías */}
        {misCats.length > 0 && (
          <div className="flex items-center justify-between bg-white rounded-2xl border-[1.5px] border-ink px-3 py-2 mb-3 shadow-pop-sm">
            <div className="text-xs">
              <span className="font-bold uppercase tracking-wider">Solo mis categorías</span>
              {soloMisCats && ocultadasPorCat > 0 && (
                <span className="text-[10px] text-ink/60 ml-1.5">
                  ({ocultadasPorCat} oculta{ocultadasPorCat === 1 ? '' : 's'})
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setSoloMisCats((v) => !v); }}
              aria-pressed={soloMisCats}
              className={`relative w-11 h-6 rounded-full border-[1.5px] border-ink transition-colors ${
                soloMisCats ? 'bg-sage' : 'bg-white'
              }`}
            >
              <span
                className={`absolute top-[2px] w-4 h-4 rounded-full bg-white border-[1.5px] border-ink transition-all ${
                  soloMisCats ? 'left-[22px]' : 'left-[2px]'
                }`}
              />
            </button>
          </div>
        )}

        {/* Lista */}
        {error ? (
          <p className="text-sm text-coral font-semibold text-center py-8">
            Error al cargar necesidades.
          </p>
        ) : isLoading ? (
          <SkeletonList count={3} />
        ) : filtradas.length === 0 ? (
          <EmptyState
            title={
              soloMisCats && porZona.length > 0
                ? 'Nada en tus categorías'
                : filtroZona === 'todas'
                  ? 'Sin necesidades por ahora'
                  : `Sin necesidades en ${filtroZona}`
            }
            subtitle={
              soloMisCats && porZona.length > 0
                ? 'Apagá "Solo mis categorías" para ver todo.'
                : filtroZona === 'todas'
                  ? 'Cuando un grupo publique algo cerca tuyo, aparece acá.'
                  : 'Probá con otra zona.'
            }
          />
        ) : (
          <div className="space-y-3">
            {filtradas.map((n) => (
              <NecesidadCard key={n.id} n={n} mode="pyme" />
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

// ─── Feed (entry point) ───────────────────────────────────────────────────────

export function Feed() {
  const { data: profile, isLoading } = useProfile();

  if (isLoading) {
    return (
      <Shell>
        <SkeletonList count={3} />
      </Shell>
    );
  }

  if (profile?.role === 'pyme') return <FeedPyme />;
  return <FeedFamilia />;
}
