// =========================================================================
// mp_webhook — Edge Function (Deno)
// =========================================================================
// Recibe notificaciones de MP. MP manda el evento via POST con el shape:
//   { type: "payment", data: { id: "<payment_id>" }, ... }
// O en formato legacy via querystring: ?topic=payment&id=<payment_id>
//
// Flow:
//   1. Extrae el payment_id
//   2. Llama a GET /v1/payments/{id} con el access token
//   3. Encuentra el pago_mp por external_reference (= pago_mp.id)
//   4. Actualiza estado según el status de MP:
//        approved  -> pago_mp.estado = 'approved'
//        rejected  -> pago_mp.estado = 'rejected'
//        refunded  -> pago_mp.estado = 'refunded'
//        otros     -> mantiene pending pero guarda mp_status
//
// MP no firma los webhooks por default en sandbox; si activás "Notificación
// con clave secreta" tenés que validar el header x-signature. Por ahora lo
// dejamos abierto y la verificación es vía consultar el pago a MP (no
// confiamos en el body del webhook, lo usamos solo como trigger).
// =========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get("MP_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!accessToken) return new Response("MP_ACCESS_TOKEN no configurado", { status: 500 });

    // Extraer payment_id (de body JSON o querystring)
    let paymentId: string | null = null;
    const url = new URL(req.url);
    const qsTopic = url.searchParams.get("topic") || url.searchParams.get("type");
    const qsId = url.searchParams.get("id") || url.searchParams.get("data.id");

    if (qsTopic === "payment" && qsId) {
      paymentId = qsId;
    } else {
      try {
        const body = await req.json();
        if (body?.type === "payment" && body?.data?.id) {
          paymentId = String(body.data.id);
        } else if (body?.action?.startsWith("payment.") && body?.data?.id) {
          paymentId = String(body.data.id);
        }
      } catch {
        // body vacío o no-JSON, no es un evento de payment que nos interese
      }
    }

    if (!paymentId) {
      // Otros tipos de notificación los ignoramos pero respondemos 200
      // (MP reintenta si devolvemos 4xx/5xx)
      return new Response("ignored", { status: 200 });
    }

    // Consultar el pago a MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    if (!mpRes.ok) {
      return new Response("MP API error: " + mpRes.status, { status: 502 });
    }
    const payment = await mpRes.json();

    const externalRef = payment?.external_reference;
    if (!externalRef) {
      return new Response("sin external_reference", { status: 200 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Mapear status MP -> estado interno
    let nuevoEstado: string | null = null;
    let approvedAt: string | null = null;
    if (payment.status === "approved") {
      nuevoEstado = "approved";
      approvedAt = payment.date_approved ?? new Date().toISOString();
    } else if (payment.status === "rejected" || payment.status === "cancelled") {
      nuevoEstado = "rejected";
    } else if (payment.status === "refunded" || payment.status === "charged_back") {
      nuevoEstado = "refunded";
    }

    const updates: Record<string, unknown> = {
      mp_payment_id: String(payment.id),
      mp_status: payment.status,
      mp_status_detail: payment.status_detail,
    };
    if (nuevoEstado) updates.estado = nuevoEstado;
    if (approvedAt) updates.approved_at = approvedAt;

    // Solo actualizamos si todavía no quedó en estado terminal liberado/transferido
    const { error } = await admin
      .from("pago_mp")
      .update(updates)
      .eq("id", externalRef)
      .not("estado", "in", "(liberado,transferido,refunded)");

    if (error) {
      return new Response("DB error: " + error.message, { status: 500 });
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response("Excepción: " + (e as Error).message, { status: 500 });
  }
});
