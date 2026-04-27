import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shell } from '@/components/Shell';
import { Button } from '@/components/ui';
import { useMisGrupos } from '@/lib/queries/useMisGrupos';
import { useCategorias } from '@/lib/queries/useCategorias';
import { usePublicarNecesidad } from '@/lib/mutations/usePublicarNecesidad';
import type { CampoSchema, NecesidadModalidad } from '@/lib/database.types';

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string | undefined; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1.5">
        {label}
      </span>
      {children}
      {hint && <p className="text-[10px] text-ink/55 mt-1 leading-snug">{hint}</p>}
    </label>
  );
}

const INPUT_CLS =
  'w-full px-4 py-3 rounded-xl border-[1.5px] border-ink bg-white text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-coral/30';

const SELECT_CLS =
  'w-full px-4 py-3 rounded-xl border-[1.5px] border-ink bg-white text-[15px] font-medium focus:outline-none';

// ─── Campos dinámicos según categoría ────────────────────────────────────────

function CamposDinamicos({
  schema,
  valores,
  onChange,
}: {
  schema: CampoSchema[];
  valores: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  if (schema.length === 0) return null;

  return (
    <div className="rounded-2xl border-[1.5px] border-ink/20 bg-mist p-4 space-y-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink/70">
        Detalle del pedido
      </div>
      {schema.map((campo) => (
        <Field
          key={campo.key}
          label={campo.label + (campo.required ? ' *' : '')}
          hint={campo.help}
        >
          {campo.type === 'int' && (
            <input
              type="number"
              min={campo.min ?? 0}
              required={campo.required}
              placeholder={campo.placeholder ?? ''}
              value={valores[campo.key] ?? ''}
              onChange={(e) => { onChange(campo.key, e.target.value); }}
              className={INPUT_CLS + ' font-mono'}
            />
          )}
          {campo.type === 'text' && (
            <input
              type="text"
              required={campo.required}
              placeholder={campo.placeholder ?? ''}
              value={valores[campo.key] ?? ''}
              onChange={(e) => { onChange(campo.key, e.target.value); }}
              className={INPUT_CLS}
            />
          )}
          {campo.type === 'date' && (
            <input
              type="date"
              required={campo.required}
              value={valores[campo.key] ?? ''}
              onChange={(e) => { onChange(campo.key, e.target.value); }}
              className={INPUT_CLS}
            />
          )}
        </Field>
      ))}
    </div>
  );
}

// ─── Foto picker ──────────────────────────────────────────────────────────────

function FotoPicker({
  preview,
  onPick,
  onRemove,
}: {
  preview: string | null;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onPick(file);
    // Limpiar input para permitir re-seleccionar el mismo archivo
    if (inputRef.current) inputRef.current.value = '';
  };

  if (preview) {
    return (
      <div className="relative">
        <img
          src={preview}
          alt="Vista previa"
          className="w-full max-h-60 object-cover rounded-xl border-[1.5px] border-ink"
        />
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 px-3 py-1 rounded-full bg-white border-[1.5px] border-ink text-[10px] font-bold uppercase tracking-wider shadow-pop-sm"
        >
          Quitar
        </button>
      </div>
    );
  }

  return (
    <label className="block w-full p-4 rounded-xl border-[1.5px] border-dashed border-ink/40 bg-white text-center cursor-pointer hover:bg-mist transition-colors">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
      <span className="text-sm text-ink/70 font-semibold">Subir foto</span>
      <p className="text-[10px] text-ink/50 mt-1">JPG / PNG · máx 5 MB</p>
    </label>
  );
}

// ─── Publicar ─────────────────────────────────────────────────────────────────

export function Publicar() {
  const navigate = useNavigate();
  const { data: misGrupos = [], isLoading: loadingGrupos } = useMisGrupos();
  const { data: categorias = [], isLoading: loadingCats } = useCategorias();
  const publicar = usePublicarNecesidad();

  // Solo grupos donde el usuario es admin o creador
  const gruposAdmin = misGrupos.filter(
    (g) => g.rol_en_grupo === 'creador' || g.rol_en_grupo === 'admin',
  );

  const [grupoId, setGrupoId] = useState<string>('');
  const [categoriaId, setCategoriaId] = useState<string>('');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [camposValues, setCamposValues] = useState<Record<string, string>>({});
  const [modalidad, setModalidad] = useState<NecesidadModalidad>('grupal');
  const [cantidadPorAlumno, setCantidadPorAlumno] = useState('');
  const [composicion, setComposicion] = useState<
    { nombre: string; cantidad: string; descripcion: string; foto_url: string; link_url: string }[]
  >([]);

  // Auto-calculo de la cantidad por alumno = suma de los items del desglose.
  // Solo se usa cuando modalidad=individual y hay items cargados.
  const composicionTotal = composicion.reduce((acc, c) => {
    const n = Number(c.cantidad);
    return acc + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
  const tieneDesglose = composicion.some(
    (c) => c.nombre.trim().length > 0 && Number(c.cantidad) > 0,
  );
  const [presupuestoMin, setPresupuestoMin] = useState('');
  const [presupuestoMax, setPresupuestoMax] = useState('');
  const [fechaInscripcion, setFechaInscripcion] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [linkReferencia, setLinkReferencia] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- defaults desde datos async y reset al cambiar categoría */
  useEffect(() => {
    const primero = gruposAdmin[0];
    if (gruposAdmin.length > 0 && !grupoId && primero) setGrupoId(primero.id);
  }, [gruposAdmin, grupoId]);

  useEffect(() => {
    const primera = categorias[0];
    if (categorias.length > 0 && !categoriaId && primera) setCategoriaId(primera.id);
  }, [categorias, categoriaId]);

  useEffect(() => {
    setCamposValues({});
  }, [categoriaId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const categoriaActual = categorias.find((c) => c.id === categoriaId);
  const schemaCampos = (categoriaActual?.campos_obligatorios as CampoSchema[] | undefined) ?? [];
  const grupoActual = gruposAdmin.find((g) => g.id === grupoId);

  const setCampo = useCallback((key: string, value: string) => {
    setCamposValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const onPickFoto = useCallback((file: File) => {
    if (file.size > 5 * 1024 * 1024) { setFormError('La foto no puede pesar más de 5 MB.'); return; }
    if (!file.type.startsWith('image/')) { setFormError('Solo se aceptan imágenes.'); return; }
    setFormError(null);
    setFoto(file);
    setFotoPreview(URL.createObjectURL(file));
  }, []);

  const onRemoveFoto = useCallback(() => {
    setFoto(null);
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoPreview(null);
  }, [fotoPreview]);

  const validate = (): string | null => {
    const tituloTrim = titulo.trim();
    if (tituloTrim.length < 8 || tituloTrim.length > 140)
      return 'El título debe tener entre 8 y 140 caracteres.';

    const descTrim = descripcion.trim();
    if (tieneDesglose) {
      // Con desglose, la descripción es una observación general opcional.
      if (descTrim.length > 1200)
        return 'La observación general no puede tener más de 1200 caracteres.';
    } else {
      if (descTrim.length < 10 || descTrim.length > 1200)
        return 'La descripción debe tener entre 10 y 1200 caracteres.';
    }

    // Si el publicador cargó desglose estructurado, los campos dinámicos
    // de la categoría quedan ocultos y no se validan (información cubierta
    // por los items del desglose).
    for (const campo of schemaCampos) {
      if (!campo.required) continue;
      if (tieneDesglose) continue;
      const v = camposValues[campo.key];
      if (v == null || v === '') return `Falta completar: ${campo.label}`;
      if (campo.type === 'int' && (Number.isNaN(Number(v)) || Number(v) < (campo.min ?? 0)))
        return `${campo.label}: debe ser un número${campo.min != null ? ` mayor o igual a ${campo.min}` : ''}.`;
    }

    const min = presupuestoMin ? Number(presupuestoMin) : null;
    const max = presupuestoMax ? Number(presupuestoMax) : null;
    if (min != null && max != null && min > max)
      return 'El presupuesto mínimo no puede ser mayor que el máximo.';

    // Link de referencia general (solo cuando no hay desglose).
    const linkTrim = linkReferencia.trim();
    if (!tieneDesglose && linkTrim && !/^https?:\/\//i.test(linkTrim))
      return 'El link debe comenzar con http:// o https://.';

    // Fechas obligatorias para que la pyme y la familia tengan deadlines firmes.
    if (!fechaInscripcion) return 'Cargá la fecha límite de inscripción.';
    if (!fechaEntrega) return 'Cargá la fecha límite de entrega.';
    if (new Date(fechaInscripcion) > new Date(fechaEntrega))
      return 'La fecha de inscripción no puede ser posterior a la de entrega.';

    if (modalidad === 'individual' && !tieneDesglose) {
      if (!cantidadPorAlumno || Number(cantidadPorAlumno) < 1)
        return 'Definí cuántas unidades suma cada alumno (o cargá items en el desglose).';
    }

    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const error = validate();
    if (error) { setFormError(error); return; }

    // Convertir campos int a número. Si hay desglose, el bloque está oculto
    // y mandamos {} para que la necesidad guarde solo la composición.
    const camposClean: Record<string, string | number> = {};
    if (!tieneDesglose) {
      for (const campo of schemaCampos) {
        const v = camposValues[campo.key];
        if (v == null || v === '') continue;
        camposClean[campo.key] = campo.type === 'int' ? Number(v) : v;
      }
    }

    try {
      const composicionClean = composicion
        .map((c) => {
          const item: {
            nombre: string;
            cantidad: number;
            descripcion?: string;
            foto_url?: string;
            link_url?: string;
          } = {
            nombre: c.nombre.trim(),
            cantidad: Number(c.cantidad),
          };
          const desc = c.descripcion.trim();
          const foto = c.foto_url.trim();
          const link = c.link_url.trim();
          if (desc) item.descripcion = desc;
          if (foto) item.foto_url = foto;
          if (link) item.link_url = link;
          return item;
        })
        .filter((c) => c.nombre.length > 0 && Number.isFinite(c.cantidad) && c.cantidad > 0);

      // Si modalidad=individual con desglose, cantidad_por_alumno se deriva de la suma.
      const cantidadPorAlumnoFinal =
        modalidad === 'individual'
          ? composicionClean.length > 0
            ? composicionClean.reduce((s, c) => s + c.cantidad, 0)
            : Number(cantidadPorAlumno)
          : null;

      await publicar.mutateAsync({
        grupoId,
        zona: grupoActual?.zona ?? '',
        categoriaId,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        campos: camposClean,
        modalidad,
        cantidadPorAlumno: cantidadPorAlumnoFinal,
        composicion: composicionClean.length > 0 ? composicionClean : null,
        presupuestoMinCentavos: presupuestoMin ? Math.round(Number(presupuestoMin) * 100) : null,
        presupuestoMaxCentavos: presupuestoMax ? Math.round(Number(presupuestoMax) * 100) : null,
        fechaLimiteInscripcion: fechaInscripcion ? new Date(fechaInscripcion).toISOString() : null,
        fechaLimiteEntrega: fechaEntrega ? new Date(fechaEntrega).toISOString() : null,
        linkReferencia: tieneDesglose ? null : linkReferencia.trim() || null,
        fotoFile: foto,
      });
      void navigate('/feed');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al publicar. Intentá de nuevo.');
    }
  };

  const isLoading = loadingGrupos || loadingCats;

  // ── Sin grupos admin ──────────────────────────────────────────────────────

  if (!isLoading && gruposAdmin.length === 0) {
    return (
      <Shell>
        <div className="anim-in space-y-4">
          <button
            type="button"
            onClick={() => { void navigate(-1); }}
            className="text-[11px] font-bold uppercase tracking-wider text-ink/50 hover:text-ink"
          >
            ← Volver
          </button>
          <h1 className="font-display font-black text-3xl">Solo admins</h1>
          <p className="text-sm text-ink/70 leading-relaxed">
            Necesitás ser <strong>creador o admin</strong> de un grupo para publicar necesidades.
            Pedile al creador del grupo que te promueva.
          </p>
          <Button variant="secondary" onClick={() => { void navigate('/grupos'); }}>
            Ir a Grupos
          </Button>
        </div>
      </Shell>
    );
  }

  // ── Formulario principal ──────────────────────────────────────────────────

  return (
    <Shell>
      <div className="anim-in">
        <button
          type="button"
          onClick={() => { void navigate(-1); }}
          className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-ink/50 hover:text-ink mb-4"
        >
          ← Cancelar
        </button>

        <h1 className="font-display font-black text-4xl leading-none">
          Publicar <span className="font-display-italic">necesidad</span>
        </h1>
        <p className="text-sm text-ink/60 mt-2">
          Las pymes lo verán anonimizado por zona.
        </p>

        <div className="squiggle my-5" />

        {/* Selector de grupo */}
        <div className="mb-5 rounded-2xl border-[1.5px] border-ink bg-sun/40 p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink/70 mb-2">
            Publicando para
          </div>
          {isLoading ? (
            <div className="h-8 bg-white/60 rounded-lg animate-pulse" />
          ) : gruposAdmin.length > 1 ? (
            <select
              value={grupoId}
              onChange={(e) => { setGrupoId(e.target.value); }}
              className={SELECT_CLS}
            >
              {gruposAdmin.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nombre} · {g.zona}
                </option>
              ))}
            </select>
          ) : grupoActual ? (
            <div>
              <div className="font-display font-bold text-lg leading-tight">{grupoActual.nombre}</div>
              <div className="text-xs text-ink/70 mt-0.5">{grupoActual.zona}</div>
            </div>
          ) : null}
        </div>

        {formError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">
            {formError}
          </div>
        )}

        <form onSubmit={(e) => { void onSubmit(e); }} className="space-y-4">
          {/* Título */}
          <Field label="Título *">
            <input
              type="text"
              required
              minLength={8}
              maxLength={140}
              placeholder="ej: 25 mapas políticos plastificados"
              value={titulo}
              onChange={(e) => { setTitulo(e.target.value); }}
              className={INPUT_CLS}
            />
          </Field>

          {/* Categoría */}
          <Field label="Categoría *">
            <select
              required
              value={categoriaId}
              onChange={(e) => { setCategoriaId(e.target.value); }}
              className={SELECT_CLS}
            >
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </Field>

          {/* Modalidad */}
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-2">
              ¿Cómo se compra? *
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(['grupal', 'individual'] as NecesidadModalidad[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setModalidad(m); }}
                  className={`text-left p-3 rounded-xl border-[1.5px] transition-colors ${
                    modalidad === m
                      ? 'border-ink bg-sun'
                      : 'border-ink/30 bg-white hover:border-ink/60'
                  }`}
                >
                  <div className="text-sm font-bold capitalize">{m}</div>
                  <div className="text-[11px] text-ink/70 mt-0.5 leading-snug">
                    {m === 'grupal'
                      ? 'Cantidad fija para todo el grupo (ej: 50 vasos).'
                      : 'Cada familia se anota — la cantidad sube con inscriptos.'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Items del pedido — para individual, cargás items para 1 alumno y se multiplica */}
          <Field
            label={
              modalidad === 'individual'
                ? '¿Qué necesita cada alumno?'
                : '¿Qué necesita el grupo?'
            }
            hint={
              modalidad === 'individual'
                ? 'Cargá los items para 1 solo alumno. La pyme verá el total multiplicado por la cantidad de inscriptos.'
                : 'Cargá la cantidad total para todo el grupo (ej: 50 vasos rojos).'
            }
          >
            <ComposicionEditor items={composicion} onChange={setComposicion} />
            {modalidad === 'individual' && tieneDesglose && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-sage/15 border border-sage/40 text-[11px] font-bold">
                ✓ Cada alumno suma{' '}
                <span className="font-mono">{composicionTotal}</span> unidad
                {composicionTotal === 1 ? '' : 'es'} en total
              </div>
            )}
          </Field>

          {/* Fallback: si no cargaron desglose, pedimos cantidad por alumno (modalidad=individual) */}
          {modalidad === 'individual' && !tieneDesglose && (
            <Field
              label="Cantidad por alumno *"
              hint="O cargá items en el desglose de arriba — se calcula sola."
            >
              <input
                type="number"
                min={1}
                required
                placeholder="2"
                value={cantidadPorAlumno}
                onChange={(e) => { setCantidadPorAlumno(e.target.value); }}
                className={INPUT_CLS + ' font-mono'}
              />
            </Field>
          )}

          {/* Campos dinámicos de categoría — se ocultan cuando el desglose ya cubre la info */}
          {!tieneDesglose && (
            <CamposDinamicos
              schema={schemaCampos}
              valores={camposValues}
              onChange={setCampo}
            />
          )}

          {/* Foto general — solo cuando NO hay desglose (cada item tiene la suya) */}
          {!tieneDesglose && (
            <Field label="Foto de referencia (opcional)">
              <FotoPicker preview={fotoPreview} onPick={onPickFoto} onRemove={onRemoveFoto} />
            </Field>
          )}

          {/* Presupuesto */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Presupuesto mín ($)">
              <input
                type="number"
                min={0}
                placeholder="30000"
                value={presupuestoMin}
                onChange={(e) => { setPresupuestoMin(e.target.value); }}
                className={INPUT_CLS + ' font-mono'}
              />
            </Field>
            <Field label="Presupuesto máx ($)">
              <input
                type="number"
                min={0}
                placeholder="50000"
                value={presupuestoMax}
                onChange={(e) => { setPresupuestoMax(e.target.value); }}
                className={INPUT_CLS + ' font-mono'}
              />
            </Field>
          </div>

          {/* Fechas */}
          <Field
            label="Cierre de inscripción *"
            hint="Hasta cuándo las familias del grupo pueden anotarse."
          >
            <input
              type="datetime-local"
              required
              value={fechaInscripcion}
              onChange={(e) => { setFechaInscripcion(e.target.value); }}
              className={INPUT_CLS}
            />
          </Field>

          <Field
            label="Fecha de entrega *"
            hint="Cuándo se necesita en mano. Las pymes lo ven al ofertar."
          >
            <input
              type="datetime-local"
              required
              value={fechaEntrega}
              onChange={(e) => { setFechaEntrega(e.target.value); }}
              className={INPUT_CLS}
            />
          </Field>

          {/* Link de referencia general — solo cuando NO hay desglose (cada item tiene su link) */}
          {!tieneDesglose && (
            <Field
              label="Link de referencia (opcional)"
              hint="Mercado Libre, foto online o cualquier referencia que aclare el pedido."
            >
              <input
                type="url"
                placeholder="https://articulo.mercadolibre.com.ar/..."
                value={linkReferencia}
                onChange={(e) => { setLinkReferencia(e.target.value); }}
                className={INPUT_CLS}
              />
            </Field>
          )}

          {/* Descripción / Observación general según si hay desglose */}
          <Field
            label={tieneDesglose ? 'Observaciones generales (opcional)' : 'Descripción *'}
            hint={
              tieneDesglose
                ? 'Aclaraciones que aplican a todo el pedido (ej: para el acto del 25 de mayo, entregar en horario de salida).'
                : undefined
            }
          >
            <textarea
              required={!tieneDesglose}
              minLength={tieneDesglose ? undefined : 10}
              maxLength={1200}
              rows={tieneDesglose ? 3 : 4}
              placeholder={
                tieneDesglose
                  ? 'Algo que la pyme tenga que saber del pedido en general (opcional).'
                  : 'Detalle del pedido. Sin nombres de institución ni datos de contacto.'
              }
              value={descripcion}
              onChange={(e) => { setDescripcion(e.target.value); }}
              className={INPUT_CLS + ' resize-none'}
            />
          </Field>

          {/* Aviso de privacidad */}
          <div className="bg-mist rounded-2xl p-3 text-xs text-ink/75 leading-snug">
            <span className="font-bold">Privacidad:</span> no incluyas teléfonos, emails ni el nombre
            de la institución. La información viaja anonimizada a las pymes.
          </div>

          <Button
            type="submit"
            variant="danger"
            size="lg"
            fullWidth
            loading={publicar.isPending}
          >
            Publicar →
          </Button>
        </form>
      </div>
    </Shell>
  );
}

// ─── ComposicionEditor ────────────────────────────────────────────────────────

interface ComposicionRow {
  nombre: string;
  cantidad: string;
  descripcion: string;
  foto_url: string;
  link_url: string;
}

function ComposicionEditor({
  items,
  onChange,
}: {
  items: ComposicionRow[];
  onChange: (next: ComposicionRow[]) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const update = (i: number, patch: Partial<ComposicionRow>) => {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };
  const remove = (i: number) => {
    onChange(items.filter((_, idx) => idx !== i));
    if (expanded === i) setExpanded(null);
  };
  const add = () => {
    onChange([
      ...items,
      { nombre: '', cantidad: '1', descripcion: '', foto_url: '', link_url: '' },
    ]);
  };

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <button
          type="button"
          onClick={add}
          className="w-full px-3 py-2.5 rounded-xl border-[1.5px] border-dashed border-ink/30 text-xs font-bold uppercase tracking-wider text-ink/55 hover:border-ink hover:text-ink transition"
        >
          + Agregar item
        </button>
      ) : (
        <>
          {items.map((it, i) => {
            const isOpen = expanded === i;
            const hasExtras =
              it.descripcion.trim().length > 0 ||
              it.foto_url.trim().length > 0 ||
              it.link_url.trim().length > 0;
            return (
              <div
                key={i}
                className="rounded-xl border-[1.5px] border-ink/20 bg-white/60 p-2 space-y-2"
              >
                <div className="flex gap-2 items-start">
                  <input
                    type="text"
                    placeholder="Ej: Lápiz Negro"
                    value={it.nombre}
                    onChange={(e) => { update(i, { nombre: e.target.value }); }}
                    className="flex-1 px-3 py-2 rounded-lg border-[1.5px] border-ink/30 text-sm focus:outline-none focus:border-ink"
                  />
                  <input
                    type="number"
                    min={1}
                    placeholder="1"
                    value={it.cantidad}
                    onChange={(e) => { update(i, { cantidad: e.target.value }); }}
                    className="w-16 px-2 py-2 rounded-lg border-[1.5px] border-ink/30 text-sm font-mono text-center focus:outline-none focus:border-ink"
                  />
                  <button
                    type="button"
                    onClick={() => { setExpanded(isOpen ? null : i); }}
                    className={`px-2 py-2 text-lg ${
                      hasExtras ? 'text-sage' : 'text-ink/40'
                    } hover:text-ink`}
                    aria-label="Foto / link"
                    title={hasExtras ? 'Tiene foto/link' : 'Agregar foto/link'}
                  >
                    📎
                  </button>
                  <button
                    type="button"
                    onClick={() => { remove(i); }}
                    className="px-2 py-2 text-ink/40 hover:text-coral text-lg"
                    aria-label="Quitar item"
                  >
                    ✕
                  </button>
                </div>
                {isOpen && (
                  <div className="grid gap-2 px-1 pb-1">
                    <textarea
                      placeholder="Descripción del item (marca, calidad, especificaciones...) — opcional"
                      rows={2}
                      maxLength={400}
                      value={it.descripcion}
                      onChange={(e) => { update(i, { descripcion: e.target.value }); }}
                      className="w-full px-3 py-2 rounded-lg border-[1.5px] border-ink/20 text-xs focus:outline-none focus:border-ink resize-none"
                    />
                    <input
                      type="url"
                      placeholder="URL de foto del producto (opcional)"
                      value={it.foto_url}
                      onChange={(e) => { update(i, { foto_url: e.target.value }); }}
                      className="w-full px-3 py-2 rounded-lg border-[1.5px] border-ink/20 text-xs focus:outline-none focus:border-ink"
                    />
                    <input
                      type="url"
                      placeholder="Link de referencia (ej: ML, sitio del fabricante) — opcional"
                      value={it.link_url}
                      onChange={(e) => { update(i, { link_url: e.target.value }); }}
                      className="w-full px-3 py-2 rounded-lg border-[1.5px] border-ink/20 text-xs focus:outline-none focus:border-ink"
                    />
                  </div>
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={add}
            className="text-[11px] font-bold uppercase tracking-wider text-coral hover:underline"
          >
            + Agregar otro item
          </button>
        </>
      )}
    </div>
  );
}
