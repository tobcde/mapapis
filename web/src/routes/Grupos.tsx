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

const rolBadge: Record<MiGrupo['rol_en_grupo'], string> = {
  creador: 'bg-sun text-ink',
  admin: 'bg-violet/20 text-ink',
  miembro: 'bg-mist/30 text-ink',
};

type Panel = 'none' | 'crear' | 'unirse';

export function Grupos() {
  const { data, isLoading, error, isFetching } = useMisGrupos();
  const [panel, setPanel] = useState<Panel>('none');

  return (
    <Shell>
      <div className="grid gap-3">
        <div className="flex items-end justify-between">
          <h1 className="font-display font-black text-4xl leading-none">
            Mis <span className="font-display-italic">grupos</span>
          </h1>
          {isFetching && !isLoading && <span className="text-[10px] text-ink/50">actualizando…</span>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => { setPanel(panel === 'unirse' ? 'none' : 'unirse'); }}
            className={`rounded-xl border-[1.5px] border-ink px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${
              panel === 'unirse' ? 'bg-ink text-sun' : 'bg-white hover:bg-cream'
            }`}
          >
            Unirme por código
          </button>
          <button
            type="button"
            onClick={() => { setPanel(panel === 'crear' ? 'none' : 'crear'); }}
            className={`rounded-xl border-[1.5px] border-ink px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${
              panel === 'crear' ? 'bg-ink text-sun' : 'bg-white hover:bg-cream'
            }`}
          >
            Crear grupo
          </button>
        </div>

        {panel === 'unirse' && <UnirseForm onDone={() => { setPanel('none'); }} />}
        {panel === 'crear' && <CrearForm onDone={() => { setPanel('none'); }} />}

        {isLoading && <SkeletonList />}

        {error && (
          <div className="bg-coral/10 text-coral text-sm rounded-xl border-[1.5px] border-coral px-4 py-3">
            No pudimos traer tus grupos. {error.message}
          </div>
        )}

        {!isLoading && !error && data?.length === 0 && panel === 'none' && (
          <EmptyState />
        )}

        {!isLoading && !error && data && data.length > 0 && (
          <ul className="grid gap-2">
            {data.map((g) => (
              <li key={g.id}>
                <Link
                  to={`/grupos/${g.id}`}
                  className="block bg-white rounded-2xl border-[1.5px] border-ink px-4 py-3 hover:bg-cream transition"
                  style={{ boxShadow: 'var(--shadow-pop)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{g.nombre}</div>
                      <div className="text-[11px] text-ink/60 mt-0.5">
                        {g.tipo} · {g.zona}
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${rolBadge[g.rol_en_grupo]}`}
                    >
                      {g.rol_en_grupo}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Shell>
  );
}

function SkeletonList() {
  return (
    <ul className="grid gap-2">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="bg-white/60 rounded-2xl border-[1.5px] border-ink/10 px-4 py-3 h-[60px] animate-pulse"
        />
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="bg-sun/30 rounded-2xl border-[1.5px] border-ink p-5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink/60">aun no tenes grupos</div>
      <p className="text-sm mt-2">
        Sumate a uno con el código que te pasaron, o creá el tuyo.
      </p>
    </div>
  );
}

const joinSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4, 'El código tiene al menos 4 caracteres')
    .max(20, 'Código demasiado largo'),
});
type JoinValues = z.infer<typeof joinSchema>;

function UnirseForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const join = useJoinGrupoByCode();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<JoinValues>({
    resolver: zodResolver(joinSchema),
    defaultValues: { code: '' },
  });

  const onSubmit: SubmitHandler<JoinValues> = async (values) => {
    setErrorMsg(null);
    setInfo(null);
    try {
      const result = await join.mutateAsync(values.code);
      if (result.ya_era_miembro) {
        setInfo(`Ya eras miembro de ${result.nombre}. Te llevamos al grupo.`);
      }
      onDone();
      void navigate(`/grupos/${result.grupo_id}`);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'No se pudo unir al grupo');
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white rounded-2xl border-[1.5px] border-ink p-4 grid gap-3"
      style={{ boxShadow: 'var(--shadow-pop)' }}
    >
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-ink/70">
          Código de invitación
        </label>
        <input
          type="text"
          autoFocus
          placeholder="Ej. AB12CD"
          {...register('code')}
          className="mt-1 w-full rounded-xl border-[1.5px] border-ink/30 px-4 py-3 text-sm font-mono uppercase tracking-wider focus:outline-none focus:border-ink"
        />
        {errors.code && <p className="text-[11px] text-coral mt-1">{errors.code.message}</p>}
      </div>

      {errorMsg && (
        <p className="text-[11px] text-coral bg-coral/10 rounded-lg px-3 py-2">{errorMsg}</p>
      )}
      {info && (
        <p className="text-[11px] text-ink bg-sun/30 rounded-lg px-3 py-2">{info}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-pop py-3 bg-ink text-sun font-extrabold rounded-xl uppercase tracking-wider text-xs disabled:opacity-50"
      >
        {isSubmitting ? 'Uniéndote...' : 'Unirme al grupo'}
      </button>
    </form>
  );
}

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

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CrearValues>({
    resolver: zodResolver(crearSchema),
    defaultValues: { nombre: '', zona: '', rango_familias: '' },
  });

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
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white rounded-2xl border-[1.5px] border-ink p-4 grid gap-3"
      style={{ boxShadow: 'var(--shadow-pop)' }}
    >
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-ink/70">
          Nombre del grupo
        </label>
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
        <label className="text-[10px] font-bold uppercase tracking-wider text-ink/70">
          Zona o barrio
        </label>
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
          {tipos.map((t) => {
            const active = tipoSel === t.value;
            return (
              <button
                type="button"
                key={t.value}
                onClick={() => { setValue('tipo', t.value, { shouldValidate: true }); }}
                className={`rounded-xl border-[1.5px] px-3 py-2 text-xs font-bold transition ${
                  active ? 'border-ink bg-sun/30' : 'border-ink/20 bg-white hover:border-ink/50'
                }`}
              >
                {t.label}
              </button>
            );
          })}
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
        {errors.rango_familias && (
          <p className="text-[11px] text-coral mt-1">{errors.rango_familias.message}</p>
        )}
      </div>

      {errorMsg && (
        <p className="text-[11px] text-coral bg-coral/10 rounded-lg px-3 py-2">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-pop py-3 bg-ink text-sun font-extrabold rounded-xl uppercase tracking-wider text-xs disabled:opacity-50"
      >
        {isSubmitting ? 'Creando...' : 'Crear grupo →'}
      </button>
    </form>
  );
}
