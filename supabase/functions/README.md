# MaPaPis — Edge Functions

## Setup local (Supabase CLI)

```bash
# Instalar Supabase CLI: https://supabase.com/docs/guides/cli
supabase login
supabase link --project-ref <tu-project-ref>
```

## Variables de entorno

Setear en el dashboard de Supabase (Project Settings → Edge Functions → Secrets):

- `MP_ACCESS_TOKEN` — Access token de tu app de MP (TEST_... para sandbox)
- `APP_BASE_URL` — URL base del FE para back_urls. En dev: `http://localhost:8090/github-pages/mapapis/index.html`. En prod: tu dominio.

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` se inyectan automáticamente.

## Deploy

```bash
supabase functions deploy mp_create_preference
supabase functions deploy mp_webhook
```

## Configurar webhook en MP

1. Ir a tu aplicación en developers.mercadopago.com.ar → Webhooks
2. Agregar URL: `https://<project-ref>.supabase.co/functions/v1/mp_webhook`
3. Eventos: marcar **Pagos** (`payment`)
4. Modo: Sandbox

## Tarjetas de prueba (sandbox)

| Tipo | Número | CVV | Fecha |
|---|---|---|---|
| Visa (aprobado) | 4509 9535 6623 3704 | 123 | 11/30 |
| Mastercard (aprobado) | 5031 7557 3453 0604 | 123 | 11/30 |
| Visa (rechazado) | 4000 0000 0000 0002 | 123 | 11/30 |

Nombre del titular: `APRO` (aprobado) / `OTHE` (rechazado por banco) / `CONT` (pendiente).
