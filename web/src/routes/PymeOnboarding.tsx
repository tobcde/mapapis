import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { useCategorias } from '@/lib/queries/useCategorias';
import { usePymeProfile } from '@/lib/queries/usePymeProfile';
import { useActualizarPyme } from '@/lib/mutations/useActualizarPyme';
// ─── Constantes ───────────────────────────────────────────────────────────────

const ZONAS_BY_REGION: Record<string, string[]> = {
  'GBA Norte': [
    'Olivos', 'Vicente López', 'Florida', 'La Lucila', 'Munro', 'Carapachay',
    'Villa Adelina', 'Villa Martelli', 'Martínez', 'Acassuso', 'San Isidro',
    'Beccar', 'Boulogne', 'Tigre', 'Don Torcuato', 'El Talar', 'Pacheco',
    'Nordelta', 'Pilar', 'Del Viso',
  ],
  'CABA': [
    'Belgrano', 'Núñez', 'Saavedra', 'Villa Urquiza', 'Coghlan', 'Colegiales',
    'Palermo', 'Recoleta', 'Caballito', 'Almagro', 'Villa Crespo',
    'Flores', 'Floresta', 'Villa Devoto', 'Villa del Parque',
    'Barracas', 'Boedo', 'San Telmo', 'Puerto Madero',
  ],
  'GBA Oeste': ['Castelar', 'Morón', 'Ituzaingó', 'Haedo', 'Ramos Mejía', 'San Justo', 'Hurlingham'],
  'GBA Sur': ['Avellaneda', 'Lanús', 'Quilmes', 'Lomas de Zamora', 'Banfield', 'Adrogué', 'Temperley'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validarCuit(cuit: string): boolean {
  const clean = cuit.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = mult.reduce((acc, m, i) => acc + m * Number(clean[i]), 0);
  const resto = sum % 11;
  const verificador = resto === 0 ? 0 : 11 - resto;
  return verificador === Number(clean[10]);
}

const INPUT_CLS =
  'w-full px-4 py-3 rounded-xl border-[1.5px] border-ink bg-white text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-sage/30';

// ─── Sub-componentes de UI ───────────────────────────────────────────────────

function SectionLabel({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-center gap-2 pb-1 border-b border-ink/10">
      <span className="w-6 h-6 rounded-full bg-ink text-white flex items-center justify-center text-[11px] font-black shrink-0">
        {n}
      </span>
      <span className="text-[11px] font-bold uppercase tracking-wider text-ink/70">{text}</span>
    </div>
  );
}

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[12px] font-bold px-3 py-1.5 rounded-full border-[1.5px] transition-colors ${
        active
          ? 'bg-sage text-white border-ink'
          : 'bg-white text-ink border-ink/30 hover:border-ink/60'
      }`}
    >
      {label}
    </button>
  );
}

// ─── PymeOnboarding ───────────────────────────────────────────────────────────

export function PymeOnboarding() {
  const navigate = useNavigate();
  const { data: pyme } = usePymeProfile();
  const { data: categoriasData = [] } = useCategorias();
  const actualizarPyme = useActualizarPyme();

  const isEdit = Boolean(pyme?.nombre_comercial);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [nombre, setNombre] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [cuit, setCuit] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [aniosRubro, setAniosRubro] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [zonasSel, setZonasSel] = useState<string[]>([]);
  const [catsSel, setCatsSel] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- hidratar formulario desde row de pyme al editar */
  useEffect(() => {
    if (!pyme) return;
    setNombre(pyme.nombre_comercial ?? '');
    setRazonSocial(pyme.razon_social ?? '');
    setCuit(pyme.cuit ?? '');
    setDescripcion(pyme.descripcion ?? '');
    setTelefono(pyme.telefono ?? '');
    setAniosRubro(pyme.anios_rubro != null ? String(pyme.anios_rubro) : '');
    setWebUrl(pyme.web_url ?? '');
    setInstagram(pyme.instagram ?? '');
    setFacebook(pyme.facebook ?? '');
    setZonasSel(Array.isArray(pyme.zonas) ? pyme.zonas : []);
    setCatsSel(Array.isArray(pyme.categorias_ids) ? pyme.categorias_ids : []);
  }, [pyme]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const cuitOk = cuit.trim() === '' || validarCuit(cuit);
  const algunLink = [webUrl, instagram, facebook].some((s) => s.trim().length > 0);

  const toggleZona = (z: string) => {
    setZonasSel((prev) => (prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z]));
  };

  const toggleCat = (id: string) => {
    setCatsSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (nombre.trim().length < 2) {
      setErr('El nombre comercial es obligatorio.');
      return;
    }
    if (cuit.trim() && !cuitOk) {
      setErr('CUIT inválido (verificá el dígito verificador).');
      return;
    }
    if (!algunLink) {
      setErr('Sumá al menos un link (web, Instagram o Facebook) para que las familias puedan verificar tu negocio.');
      return;
    }
    if (catsSel.length === 0) {
      setErr('Elegí al menos una categoría que cubrís.');
      return;
    }
    if (zonasSel.length === 0) {
      setErr('Elegí al menos una zona donde operás.');
      return;
    }

    try {
      await actualizarPyme.mutateAsync({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        telefono: telefono.trim() || null,
        zonas: zonasSel,
        cuit: cuit.trim() || null,
        razonSocial: razonSocial.trim() || null,
        categoriasIds: catsSel,
        webUrl: webUrl.trim() || null,
        instagram: instagram.trim() || null,
        facebook: facebook.trim() || null,
        aniosRubro: aniosRubro ? Number(aniosRubro) : null,
        cbu: null,
        aliasCbu: null,
      });
      void navigate(isEdit ? '/perfil' : '/feed', { replace: true });
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Error al guardar');
    }
  };

  return (
    <main className="min-h-screen bg-cream">
      <div className="px-6 pt-12 pb-6 max-w-md mx-auto anim-in">
        <button
          type="button"
          onClick={() => {
            if (isEdit) void navigate('/perfil');
            else void navigate(-1);
          }}
          className="text-xs font-bold uppercase tracking-wider text-ink/60 mb-4 flex items-center gap-1 hover:text-ink"
        >
          ← Volver
        </button>
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-sage">
          <span className="inline-block w-6 h-[2px] bg-sage" />
          <span>{isEdit ? 'Pyme · Editar perfil' : 'Pyme · Onboarding'}</span>
        </div>
        <h1 className="font-display font-black text-4xl leading-tight tracking-tight mt-4">
          {isEdit ? 'Editá tu negocio' : 'Contanos de tu negocio'}
        </h1>
        <p className="text-[15px] text-ink/70 mt-3">
          {isEdit
            ? 'Actualizá los datos de tu pyme.'
            : 'Pedimos esta info para validar que la pyme es real. Los datos sensibles no se muestran a las familias salvo que ganes la oferta.'}
        </p>
      </div>

      <div className="px-6 pb-20 max-w-md mx-auto">
        <form
          onSubmit={(e) => { void onSubmit(e); }}
          className="bg-white rounded-3xl border-[1.5px] border-ink p-6 space-y-6 shadow-pop"
        >
          {err && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {err}
            </div>
          )}

          {/* 1 — Identidad */}
          <div className="space-y-4">
            <SectionLabel n={1} text="Identidad" />

            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1.5">
                Nombre comercial *
              </span>
              <input
                type="text"
                required
                minLength={2}
                maxLength={80}
                value={nombre}
                onChange={(e) => { setNombre(e.target.value); }}
                placeholder="Ej: Imprenta Olivos"
                className={INPUT_CLS}
              />
            </label>

            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1.5">
                Razón social (opcional)
              </span>
              <input
                type="text"
                maxLength={120}
                value={razonSocial}
                onChange={(e) => { setRazonSocial(e.target.value); }}
                placeholder="Tal como figura en AFIP"
                className={INPUT_CLS}
              />
            </label>

            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1.5">
                CUIT (opcional)
              </span>
              <input
                type="text"
                maxLength={13}
                value={cuit}
                onChange={(e) => { setCuit(e.target.value); }}
                placeholder="30-12345678-9"
                className={
                  INPUT_CLS +
                  ' font-mono' +
                  (cuit.trim() && !cuitOk ? ' border-rose-500' : '')
                }
              />
              {cuit.trim() && !cuitOk && (
                <p className="text-[11px] text-rose-700 mt-1">CUIT inválido</p>
              )}
              {cuit.trim() && cuitOk && (
                <p className="text-[11px] text-sage mt-1">✓ formato válido</p>
              )}
            </label>
          </div>

          {/* 2 — Qué ofrecés */}
          <div className="space-y-4">
            <SectionLabel n={2} text="Qué ofrecés" />

            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-2">
                Categorías que cubrís *
              </span>
              {categoriasData.length === 0 ? (
                <span className="text-xs text-ink/50">Preparando categorías…</span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {categoriasData.map((c) => (
                    <ToggleChip
                      key={c.id}
                      label={c.nombre}
                      active={catsSel.includes(c.id)}
                      onClick={() => { toggleCat(c.id); }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-2">
                Zonas donde operás *
              </span>
              <div className="space-y-3">
                {Object.entries(ZONAS_BY_REGION).map(([region, zonas]) => (
                  <div key={region}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-ink/40 mb-1.5">
                      {region}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {zonas.map((z) => (
                        <ToggleChip
                          key={z}
                          label={z}
                          active={zonasSel.includes(z)}
                          onClick={() => { toggleZona(z); }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1.5">
                Descripción (opcional)
              </span>
              <textarea
                maxLength={600}
                rows={3}
                value={descripcion}
                onChange={(e) => { setDescripcion(e.target.value); }}
                placeholder="Especialidad, diferenciales. Sin teléfono ni links."
                className={INPUT_CLS + ' resize-none'}
              />
            </label>

            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1.5">
                Años en el rubro (opcional)
              </span>
              <input
                type="number"
                min={0}
                max={100}
                value={aniosRubro}
                onChange={(e) => { setAniosRubro(e.target.value); }}
                placeholder="Ej: 5"
                className={INPUT_CLS}
              />
            </label>
          </div>

          {/* 3 — Presencia online */}
          <div className="space-y-4">
            <SectionLabel n={3} text="Presencia online (al menos uno) *" />

            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1.5">
                Sitio web
              </span>
              <input
                type="url"
                maxLength={200}
                value={webUrl}
                onChange={(e) => { setWebUrl(e.target.value); }}
                placeholder="https://miempresa.com.ar"
                className={INPUT_CLS}
              />
            </label>

            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1.5">
                Instagram
              </span>
              <input
                type="text"
                maxLength={100}
                value={instagram}
                onChange={(e) => { setInstagram(e.target.value); }}
                placeholder="@miempresa"
                className={INPUT_CLS}
              />
            </label>

            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1.5">
                Facebook
              </span>
              <input
                type="text"
                maxLength={200}
                value={facebook}
                onChange={(e) => { setFacebook(e.target.value); }}
                placeholder="https://facebook.com/..."
                className={INPUT_CLS}
              />
            </label>
          </div>

          {/* 4 — Contacto */}
          <div className="space-y-4">
            <SectionLabel n={4} text="Contacto" />

            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1.5">
                Teléfono / WhatsApp (opcional)
              </span>
              <input
                type="tel"
                maxLength={30}
                value={telefono}
                onChange={(e) => { setTelefono(e.target.value); }}
                placeholder="+54 9 11 ..."
                className={INPUT_CLS + ' font-mono'}
              />
            </label>
          </div>

          {/* 5 — Cobros */}
          <div className="space-y-4">
            <SectionLabel n={5} text="Cobros" />
            <div className="rounded-xl border-[1.5px] border-dashed border-ink/30 bg-cream p-4 text-[12px] text-ink/75 leading-relaxed">
              Las familias pagan dentro de MaPaPis con{' '}
              <span className="font-bold">Mercado Pago</span>. La plata se
              acredita en tu cuenta MP asociada al CUIT/CUIL que cargaste — no
              necesitamos CBU ni alias.
              <br />
              <br />
              Sos responsable de tu situación fiscal y de emitir factura al
              comprador.
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={actualizarPyme.isPending}
          >
            {isEdit ? 'Guardar cambios →' : 'Guardar y empezar a ofertar →'}
          </Button>

          {!isEdit && (
            <p className="text-[11px] text-ink/50 text-center">
              Al guardar quedás como <span className="font-bold">Tier 0 — Registrada</span>.
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
