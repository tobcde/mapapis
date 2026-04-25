# Validación de CUIT contra AFIP — Plan de implementación

> Documento técnico para integrar validación oficial de CUIT contra AFIP en el alta de pyme. Pendiente de implementar; el alta actual valida solo formato + dígito verificador en cliente y server (`validar_cuit()` en SQL).

---

## 1. Por qué no se puede llamar AFIP desde el frontend

AFIP no expone un endpoint REST público sin autenticación. Todos los servicios oficiales (Padrón, WS Constancia de Inscripción) requieren:

- **Certificado X.509** emitido por AFIP a nombre de un CUIT habilitante.
- **Token + Sign** firmado con ese certificado, vigente 12hs (WSAA — Web Service de Autenticación y Autorización).
- Llamadas SOAP/XML, no REST.

**Conclusión**: la llamada tiene que ir desde un backend nuestro que tenga el certificado. No desde el navegador de la pyme. Tampoco desde Postgres.

---

## 2. Arquitectura propuesta

```
PymeOnboardingScreen (browser)
  ↓ ingresa CUIT
  ↓ validamos formato + DV en cliente (validarCuit) → feedback inmediato
  ↓ submit → actualizar_pyme RPC → guarda con cuit y verificada_at = null
  ↓
Trigger / cron → encola job en pyme_verificaciones (estado=pendiente, tipo=afip)
  ↓
Supabase Edge Function `verificar-cuit-afip` (Deno)
  ↓ levanta cert AFIP de Supabase secrets
  ↓ pide token WSAA si no tiene uno cacheado válido
  ↓ llama WS Padrón A4: getPersona(cuit)
  ↓ guarda payload crudo en pyme_verificaciones.payload
  ↓ si OK + nombre coincide: pymes.verificada_at = now(), tier = 1
  ↓ si rechaza: estado = "rechazada" + motivo
  ↓
Frontend: PerfilPyme polea o subscribe-realtime a pymes.verificada_at
```

Por qué Edge Function y no un job propio:
- Supabase Edge Functions corren en Deno con acceso a secrets nativos (cert AFIP).
- Tienen logs y se pueden invocar desde un trigger SQL (`pg_net.http_post`) o desde el FE.
- Cero infra extra que mantener.

---

## 3. Pasos previos (lado AFIP)

1. **Sacar Clave Fiscal nivel 3** del CUIT que va a operar como cliente del WS (idealmente el de la sociedad MaPaPis cuando se constituya, mientras tanto el de Pablo/socio).
2. **Habilitar el servicio** "WS Padrón A4" (o A5, ver sección 4) en AFIP → Administrador de Relaciones de Clave Fiscal.
3. **Generar certificado X.509**:
   - Crear par de claves: `openssl genrsa -out mapapis.key 2048`
   - CSR: `openssl req -new -key mapapis.key -subj "/C=AR/O=MaPaPis/CN=mapapis-ws/serialNumber=CUIT XX-XXXXXXXX-X" -out mapapis.csr`
   - Subir el .csr en AFIP, descargar el .crt firmado.
4. **Asociar el certificado al servicio** (Administrador de Relaciones → Adherir servicio → MaPaPis con el certificado).
5. Probar primero contra **homologación** (`wsaahomo.afip.gov.ar`) antes de prod.

Tiempo estimado total: ~1–2 horas si tenés clave fiscal nivel 3 lista. Sin ella: ~3 días hábiles para conseguirla.

---

## 4. Servicios AFIP candidatos

| Servicio | Qué devuelve | Nota |
|----------|--------------|------|
| **WS Padrón A4** | Datos básicos: nombre/razón social, estado (activo/inactivo), domicilio fiscal, condición frente a IVA y monotributo | Recomendado para validar identidad — gratuito, alta disponibilidad |
| **WS Padrón A5** | Igual que A4 + más datos de actividad | Reemplazo moderno de A4 |
| **WS Constancia de Inscripción** | Solo PDF de constancia | Más restrictivo; requiere consentimiento del titular |

**Recomendación**: empezar con A5. Si AFIP saca de servicio A4 (lo viene amenazando hace años), la migración a A5 es trivial.

---

## 5. Modelo de datos (incremental)

Sobre lo que ya creó `db/014_pymes_validacion.sql`, agregar en una `015_pyme_verificaciones.sql`:

```sql
create table public.pyme_verificaciones (
  id uuid primary key default gen_random_uuid(),
  pyme_profile_id uuid not null references public.pymes(profile_id) on delete cascade,
  tipo text not null check (tipo in ('afip','renaper','manual')),
  estado text not null default 'pendiente' check (estado in ('pendiente','en_proceso','ok','rechazada','error')),
  payload jsonb,                  -- respuesta cruda
  motivo_rechazo text,
  intentos int not null default 0,
  proximo_intento_at timestamptz,
  created_at timestamptz default now(),
  resuelta_at timestamptz
);

create index pyme_verificaciones_pendientes
  on public.pyme_verificaciones (estado, proximo_intento_at)
  where estado in ('pendiente','error');

-- Cuando se carga CUIT, encolar verificacion
create or replace function public.enqueue_verificacion_afip()
returns trigger language plpgsql as $$
begin
  if new.cuit is not null and (old.cuit is null or old.cuit <> new.cuit) then
    insert into public.pyme_verificaciones (pyme_profile_id, tipo, estado)
    values (new.profile_id, 'afip', 'pendiente');
  end if;
  return new;
end; $$;

create trigger trg_pymes_enqueue_afip
  after insert or update of cuit on public.pymes
  for each row execute function public.enqueue_verificacion_afip();
```

Después se necesita un cron (Supabase Scheduled Edge Function, ej cada 5 min) que toma jobs pendientes y los procesa.

---

## 6. Edge Function — esqueleto

`supabase/functions/verificar-cuit-afip/index.ts`:

```ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 1. WSAA: obtener Token+Sign valido (cachear 11h en KV)
async function obtenerWSAA(): Promise<{ token: string, sign: string }> {
  // - leer cert + key de Deno.env.get("AFIP_CERT") / "AFIP_KEY"
  // - armar TRA (XML) con uniqueId, generationTime, expirationTime, service="ws_sr_padron_a5"
  // - firmar con CMS/PKCS7 usando cert+key (deno-pkijs o subprocess openssl)
  // - POST al WSAA, parsear LoginCmsResponse, devolver token+sign
  throw new Error("TODO: implementar WSAA");
}

// 2. WS Padron A5: getPersona(token, sign, cuit)
async function consultarPadron(cuit: string, wsaa: { token: string, sign: string }) {
  // - SOAP envelope con token, sign, cuitRepresentada, idPersona=cuit
  // - POST a https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5
  // - parsear respuesta XML, devolver { razonSocial, estado, domicilio, condicionIva }
  throw new Error("TODO: implementar consulta padron");
}

serve(async (req) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Tomar job pendiente
  const { data: job } = await sb.from("pyme_verificaciones")
    .select("*, pymes(cuit, razon_social, nombre_comercial)")
    .eq("estado", "pendiente")
    .eq("tipo", "afip")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!job) return new Response("nada pendiente", { status: 200 });

  await sb.from("pyme_verificaciones").update({ estado: "en_proceso" }).eq("id", job.id);

  try {
    const wsaa = await obtenerWSAA();
    const persona = await consultarPadron(job.pymes.cuit, wsaa);

    // Reglas: activo + nombre coincide (fuzzy) con razon_social o nombre_comercial
    const ok = persona.estado === "ACTIVO";  // + match de nombre
    if (ok) {
      await sb.from("pymes").update({ verificada_at: new Date().toISOString(), tier: 1 }).eq("profile_id", job.pyme_profile_id);
      await sb.from("pyme_verificaciones").update({ estado: "ok", payload: persona, resuelta_at: new Date().toISOString() }).eq("id", job.id);
    } else {
      await sb.from("pyme_verificaciones").update({ estado: "rechazada", payload: persona, motivo_rechazo: "CUIT inactivo o nombre no coincide" }).eq("id", job.id);
    }
  } catch (e) {
    await sb.from("pyme_verificaciones").update({
      estado: "error",
      motivo_rechazo: String(e?.message || e),
      intentos: job.intentos + 1,
      proximo_intento_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    }).eq("id", job.id);
  }

  return new Response("ok", { status: 200 });
});
```

Tiempo de implementación realista de la function: **3–5 días** la primera vez (WSAA + firma CMS son la parte molesta). Después es boilerplate.

---

## 7. Alternativas si AFIP cuesta

1. **Servicios third-party que ya hablan con AFIP**:
   - `tangoafip.com`, `arca-api.com`, `afipsdk.com` — REST sobre SOAP, ~$10–30 USD por 1000 consultas.
   - Más rápido para arrancar; perdés control y agregás dependencia.
2. **Validación manual**: dashboard interno donde el equipo MaPaPis revisa CUITs nuevos contra el padrón online de AFIP. Funciona hasta ~50 pymes/mes, después no escala.
3. **Confianza diferida**: dejar la pyme operar como Tier 0 con cap bajo de monto. La validación AFIP la hacemos cuando tenga su primera adjudicación grande. Esto reduce 80% del trabajo manual sin reducir seguridad efectiva.

**Mi recomendación**: combinar (3) + (2). Tier 0 opera con tope; la primera transacción > $200k dispara revisión manual; cuando la cantidad de revisiones manuales por mes pase de ~30, recién ahí invertir en el WS oficial o un third-party.

---

## 8. Checklist para arrancar (el día que decidamos hacerlo)

- [ ] Pablo / socio sacan clave fiscal nivel 3 (si no la tienen)
- [ ] Generar certificado X.509 y guardarlo en Supabase secrets (`AFIP_CERT`, `AFIP_KEY`)
- [ ] Adherir servicio "ws_sr_padron_a5" en AFIP
- [ ] Probar contra homologación
- [ ] Crear migración `015_pyme_verificaciones.sql`
- [ ] Crear Edge Function `verificar-cuit-afip`
- [ ] Configurar Scheduled Function (cron cada 5 min)
- [ ] Mostrar en `PymeOnboardingScreen` el estado de verificación post-submit (polling a `pyme_verificaciones`)
- [ ] Mostrar badge tier en `OfertaCard` y `PerfilPyme`
- [ ] Documentar el flujo en CLAUDE.md o README de pymes

---

## 9. Decisiones pendientes

- ¿Empezamos con AFIP oficial o con third-party? (impacto en costo y tiempo de arranque).
- ¿Threshold exacto de monto que dispara verificación obligatoria?
- ¿Mostramos el motivo de rechazo a la pyme o solo "no pudimos verificar, contactanos"? (UX vs. anti-fraude).
- ¿Cuánto vive la verificación antes de re-validar? (sugerencia: 90 días).
