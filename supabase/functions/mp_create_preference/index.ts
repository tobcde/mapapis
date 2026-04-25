// =========================================================================
// mp_create_preference — Edge Function (Deno)
// =========================================================================
// Llamada por el FE cuando una familia toca "Pagar con MP". Hace:
//   1. Verifica auth del caller
//   2. Verifica que la necesidad esté adjudicada y la oferta ganadora
//   3. Calcula el monto (precio total / total_esperados de inscripciones)
//   4. Inserta row pending en pago_mp
//   5. Crea preference en MP con back_urls + notification_url
//   6. Actualiza el row con preference_id e init_point
//   7. Devuelve { init_point, sandbox_init_point, pago_id }
//
// Env vars requeridas:
//   MP_ACCESS_TOKEN          — access token de la app (TEST o PROD)
//   APP_BASE_URL             — base URL del FE (para back_urls), ej:
//                              https://magalotti.github.io/MaPaPis/mapapis
//   SUPABASE_URL             — auto-set por Supabase
//   SUPABASE_SERVICE_ROLE_KEY — auto-set por Supabase
// =========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface ReqBody {
  necesidad_id: string;
  alumno_id?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get("MP_ACCESS_TOKEN");
    const appBaseUrl = Deno.env.get("APP_BASE_URL") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!accessToken) {
      return json({ error: "MP_ACCESS_TOKEN no configurado" }, 500);
    }

    // Cliente con el JWT del usuario para identificarlo
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "No autenticado" }, 401);
    }
    const userId = userData.user.id;
    const userEmail = userData.user.email ?? "";

    const body = (await req.json()) as ReqBody;
    if (!body.necesidad_id) return json({ error: "necesidad_id requerido" }, 400);

    // Cliente con service role para queries internas
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Validar necesidad + ganadora
    const { data: nec, error: necErr } = await admin
      .from("necesidades")
      .select("id, titulo, estado, grupo_id")
      .eq("id", body.necesidad_id)
      .maybeSingle();
    if (necErr || !nec) return json({ error: "Necesidad no encontrada" }, 404);
    if (!["adjudicada", "en_curso"].includes(nec.estado)) {
      return json({ error: `Estado inválido: ${nec.estado}` }, 400);
    }

    const { data: ganadora } = await admin
      .from("ofertas")
      .select("id, pyme_id, precio_total_centavos")
      .eq("necesidad_id", nec.id)
      .eq("estado", "ganadora")
      .maybeSingle();
    if (!ganadora) return json({ error: "No hay oferta ganadora" }, 400);

    // Verificar que el caller sea miembro del grupo
    const { data: miembro } = await admin
      .from("grupo_miembros")
      .select("profile_id")
      .eq("grupo_id", nec.grupo_id)
      .eq("profile_id", userId)
      .maybeSingle();
    if (!miembro) return json({ error: "No sos miembro del grupo" }, 403);

    // Calcular monto: precio total / total_esperados (inscripciones cerradas)
    const { data: progreso } = await admin
      .rpc("necesidad_progreso", { p_necesidad: nec.id });
    const totalEsperados = (progreso?.[0]?.inscriptos as number) || 1;
    const montoCentavos = Math.round(
      Number(ganadora.precio_total_centavos) / totalEsperados,
    );
    if (montoCentavos < 100) {
      return json({ error: "Monto inválido (< $1 ARS)" }, 400);
    }

    // Insert row pending en pago_mp (usando service role)
    const { data: pago, error: pagoErr } = await admin
      .from("pago_mp")
      .insert({
        necesidad_id: nec.id,
        profile_id: userId,
        alumno_id: body.alumno_id ?? null,
        monto_centavos: montoCentavos,
        estado: "pending",
        mp_payer_email: userEmail,
      })
      .select("id")
      .single();
    if (pagoErr || !pago) {
      return json({ error: "No se pudo crear el pago: " + pagoErr?.message }, 500);
    }

    // Crear preference en MP
    const monto = montoCentavos / 100;
    const titulo = `MaPaPis · ${nec.titulo ?? "Compra grupal"}`;
    const preferenceBody = {
      items: [{
        title: titulo,
        quantity: 1,
        unit_price: monto,
        currency_id: "ARS",
      }],
      payer: { email: userEmail || undefined },
      external_reference: pago.id,
      back_urls: {
        success: `${appBaseUrl}?mp=success&pago=${pago.id}`,
        failure: `${appBaseUrl}?mp=failure&pago=${pago.id}`,
        pending: `${appBaseUrl}?mp=pending&pago=${pago.id}`,
      },
      auto_return: "approved",
      notification_url: `${supabaseUrl}/functions/v1/mp_webhook`,
      statement_descriptor: "MAPAPIS",
      metadata: {
        necesidad_id: nec.id,
        pago_id: pago.id,
        alumno_id: body.alumno_id ?? null,
      },
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preferenceBody),
    });
    const mpJson = await mpRes.json();
    if (!mpRes.ok) {
      // Marcar pago como rejected y devolver error
      await admin.from("pago_mp").update({
        estado: "rejected",
        mp_status_detail: mpJson?.message ?? "MP error",
      }).eq("id", pago.id);
      return json({
        error: "MP rechazó la preference",
        detail: mpJson,
      }, 502);
    }

    // Update con preference data
    await admin.from("pago_mp").update({
      mp_preference_id: mpJson.id,
      mp_init_point: mpJson.init_point,
      mp_sandbox_init_point: mpJson.sandbox_init_point,
    }).eq("id", pago.id);

    return json({
      pago_id: pago.id,
      preference_id: mpJson.id,
      init_point: mpJson.init_point,
      sandbox_init_point: mpJson.sandbox_init_point,
    });
  } catch (e) {
    return json({ error: "Excepción: " + (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
