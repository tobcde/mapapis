import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shell } from '@/components/Shell';
import { useMisGrupos, type MiGrupo } from '@/lib/queries/useMisGrupos';
import { useCrearGrupo } from '@/lib/mutations/useCrearGrupo';
import { useJoinGrupoByCode } from '@/lib/mutations/useJoinGrupoByCode';
import type { GrupoTipo } from '@/lib/database.types';

const rolColor: Record<MiGrupo['rol_en_grupo'], string> = {
  creador: 'text-sun',
  admin:   'text-violet',
  miembro: 'text-ink/50',
};

type Panel = 'none' | 'crear' | 'unirse';

export function Grupos() {
  const { data, isLoading, isFetching } = useMisGrupos();
  const [panel, setPanel] = useState<Panel>('none');

  const grupos = data ?? [];
  const sinGrupos = !isLoading && grupos.length === 0;

  return (
    <Shell>
      <div className="space-y-4 anim-in">

        {/* Header */}
        <div className="flex items-end justify-between">
          <h1 className="font-display font-black text-4xl leading-none">
            {sinGrupos
              ? <>Tu <span className="font-display-italic">grupo</span></>
              : <>Mis <span className="font-display-italic">grupos</span></>}
          </h1>
          {isFetching && !isLoading && (
            <span className="text-[10px] text-ink/50">actualizando…</span>
          )}
        </div>

        {/* Loading */}
        {isLoading && <SkeletonList />}

        {/* Empty state */}
        {sinGrupos && panel === 'none' && (
          <div
            className="bg-white rounded-3xl border-[1.5px] border-ink p-6"
            style={{ boxShadow: '4px 4px 0 var(--ink)' }}
          >
            <div className="text-5xl mb-3">👋</div>
            <h2 className="font-display font-bold text-2xl">Aún no estás en un grupo</h2>
            <p className="text-sm text-ink/70 mt-2">
              Creá uno para tu sala/aula, o sumate a uno existente con el código que te pasaron.
            </p>
            <div className="space-y-2 mt-5">
              <button
                type="button"
                onClick={() => { setPanel('crear'); }}
                className="btn-pop w-full py-3 bg-coral text-white font-extrabold rounded-xl uppercase tracking-wider text-xs"
              >
                Crear grupo
              </button>
              <button
                type="button"
                onClick={() => { setPanel('unirse'); }}
                className="btn-pop w-full py-3 bg-white text-ink font-extrabold rounded-xl uppercase tracking-wider text-xs border-[1.5px] border-ink"
              >
                Tengo un código
              </button>
            </div>
          </div>
        )}

        {/* Lista de grupos */}
        {grupos.length > 0 && (
          <div className="space-y-2">
            {grupos.map((g) => (
              <Link
                key={g.id}
                to={`/grupos/${g.id}`}
                className="block bg-white rounded-2xl border-[1.5px] border-ink p-4 text-left card-hover"
                style={{ boxShadow: 'var(--shadow-pop)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-display font-bold text-lg truncate">{g.nombre}</div>
                    <div className="text-xs text-ink/60 mt-0.5">📍 {g.zona} · {g.tipo}</div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${rolColor[g.rol_en_grupo]}`}>
                    {g.rol_en_grupo}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Paneles de crear / unirse */}
        {panel === 'unirse' && (
          <UnirseForm onDone={() => { setPanel('none'); }} />
        )}
        {panel === 'crear' && (
          <CrearForm onDone={() => { setPanel('none'); }} />
        )}

        {/* Botones de acción — solo cuando no hay panel abierto */}
        {!isLoading && panel === 'none' && grupos.length > 0 && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setPanel('crear'); }}
              className="btn-pop py-2.5 bg-ink text-white font-extrabold rounded-xl uppercase tracking-wider text-[11px]"
            >
              + Otro grupo
            </button>
            <button
              type="button"
              onClick={() => { setPanel('unirse'); }}
              className="btn-pop py-2.5 bg-white text-ink font-extrabold rounded-xl uppercase tracking-wider text-[11px] border-[1.5px] border-ink"
            >
              Pegar código
            </button>
          </div>
        )}

      </div>
    </Shell>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonList() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-white/60 rounded-2xl border-[1.5px] border-ink/10 p-4 h-[68px] animate-pulse"
        />
      ))}
    </div>
  );
}

// ─── Unirse por código ─────────────────────────────────────────────────────────

const joinSchema = z.object({
  code: z.string().trim().min(4, 'El código tiene al menos 4 caracteres').max(20, 'Código demasiado largo'),
});
type JoinValues = z.infer<typeof joinSchema>;

function UnirseForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const join = useJoinGrupoByCode();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<JoinValues>({
    resolver: zodResolver(joinSchema),
    defaultValues: { code: '' },
  });

  const onSubmit: SubmitHandler<JoinValues> = async (values) => {
    setErrorMsg(null);
    try {
      const result = await join.mutateAsync(values.code);
      onDone();
      void navigate(`/grupos/${result.grupo_id}`);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'No se pudo unir al grupo');
    }
  };

  return (
    <div className="bg-white rounded-2xl border-[1.5px] border-ink p-5 space-y-3" style={{ boxShadow: 'var(--shadow-pop)' }}>
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-xl">
          Pegá el <span className="font-display-italic">código</span>
        </h2>
        <button type="button" onClick={onDone} className="text-[11px] font-bold uppercase tracking-wider text-ink/50 hover:text-ink">
          Cancelar
        </button>
      </div>
      <p className="text-sm text-ink/70">El que te compartió el grupo te pasó un link o un código de 8 letras.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3">
        <div>
          <input
            type="text"
            autoFocus
            placeholder="Ej. AB12CD34"
            {...register('code')}
            className="w-full rounded-xl border-[1.5px] border-ink/30 px-4 py-3 text-sm font-mono uppercase tracking-wider focus:outline-none focus:border-ink"
          />
          {errors.code && <p className="text-[11px] text-coral mt-1">{errors.code.message}</p>}
        </div>
        {errorMsg && <p className="text-[11px] text-coral bg-coral/10 rounded-lg px-3 py-2">{errorMsg}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-pop py-3 bg-ink text-sun font-extrabold rounded-xl uppercase tracking-wider text-xs disabled:opacity-50"
        >
          {isSubmitting ? 'Uniéndote...' : 'Unirme al grupo'}
        </button>
      </form>
    </div>
  );
}

// ─── Crear grupo ──────────────────────────────────────────────────────────────

const tipos: { value: GrupoTipo; label: string }[] = [
  { value: 'sala', label: 'Sala (jardín)' },
  { value: 'aula', label: 'Aula' },
  { value: 'curso', label: 'Curso' },
  { value: 'comision', label: 'Comisión' },
];

const crearSchema = z.object({
  nombre: z.string().trim().min(2, 'Nombre del grupo'),
  zona: z.string().trim().min(2, 'Zona o barrio'),
  tipo: z.enum(['sala', 'aula', 'curso', 'comision'], { message: 'Elegí el tipo' }),
  rango_familias: z.string().trim().max(40).optional(),
});
type CrearValues = z.infer<typeof crearSchema>;

function CrearForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const crear = useCrearGrupo();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<CrearValues>({
    resolver: zodResolver(crearSchema),
    defaultValues: { nombre: '', zona: '', rango_familias: '' },
  });

  // eslint-disable-next-line react-hooks/incompatible-library -- RHF watch() no es memoizable; uso legítimo
  const tipoSel = watch('tipo');

  const onSubmit: SubmitHandler<CrearValues> = async (values) => {
    setErrorMsg(null);
    try {
      const grupo = await crear.mutateAsync({
        nombre: values.nombre,
        zona: values.zona,
        tipo: values.tipo,
        ...(values.rango_familias ? { rango_familias: values.rango_familias } : {}),
      });
      onDone();
      void navigate(`/grupos/${grupo.id}`);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'No se pudo crear el grupo');
    }
  };

  return (
    <div className="bg-white rounded-2xl border-[1.5px] border-ink p-5 space-y-4" style={{ boxShadow: 'var(--shadow-pop)' }}>
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-xl">
          Crear <span className="font-display-italic">grupo</span>
        </h2>
        <button type="button" onClick={onDone} className="text-[11px] font-bold uppercase tracking-wider text-ink/50 hover:text-ink">
          Cancelar
        </button>
      </div>
      <p className="text-sm text-ink/70">Vas a quedar como <span className="font-bold">creador</span>. Después invitás con un link de WhatsApp.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-ink/70">Nombre del grupo</label>
          <input
            type="text"
            autoFocus
            placeholder="Ej. Sala Naranja Jardín La Plaza"
            {...register('nombre')}
            className="mt-1 w-full rounded-xl border-[1.5px] border-ink/30 px-4 py-3 text-sm focus:outline-none focus:border-ink"
          />
          {errors.nombre && <p className="text-[11px] text-coral mt-1">{errors.nombre.message}</p>}
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-ink/70">Zona o barrio</label>
          <input
            type="text"
            placeholder="Ej. Belgrano CABA"
            {...register('zona')}
            className="mt-1 w-full rounded-xl border-[1.5px] border-ink/30 px-4 py-3 text-sm focus:outline-none focus:border-ink"
          />
          {errors.zona && <p className="text-[11px] text-coral mt-1">{errors.zona.message}</p>}
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-ink/70">Tipo</label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {tipos.map((t) => (
              <button
                type="button"
                key={t.value}
                onClick={() => { setValue('tipo', t.value, { shouldValidate: true }); }}
                className={`rounded-xl border-[1.5px] px-3 py-2 text-xs font-bold transition ${
                  tipoSel === t.value ? 'border-ink bg-sun/30' : 'border-ink/20 bg-white hover:border-ink/50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {errors.tipo && <p className="text-[11px] text-coral mt-1">{errors.tipo.message}</p>}
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-ink/70">
            Rango de familias <span className="text-ink/40 normal-case">(opcional)</span>
          </label>
          <input
            type="text"
            placeholder="Ej. 15-20"
            {...register('rango_familias')}
            className="mt-1 w-full rounded-xl border-[1.5px] border-ink/30 px-4 py-3 text-sm focus:outline-none focus:border-ink"
          />
        </div>

        {errorMsg && <p className="text-[11px] text-coral bg-coral/10 rounded-lg px-3 py-2">{errorMsg}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-pop py-3 bg-ink text-sun font-extrabold rounded-xl uppercase tracking-wider text-xs disabled:opacity-50"
        >
          {isSubmitting ? 'Creando...' : 'Crear grupo →'}
        </button>
      </form>
    </div>
  );
}
