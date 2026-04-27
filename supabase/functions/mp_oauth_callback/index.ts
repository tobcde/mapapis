// =========================================================================
// mp_oauth_callback — Edge Function (Deno)
// =========================================================================
// Recibe el `code` que devuelve MP después del OAuth marketplace, lo
// intercambia por access_token + refresh_token, y guarda en
// mp_linked_accounts asociado al user autenticado.
//
// El FE llama a esta función POST con `{ code, redirect_uri }` después de
// haber sido redirigido a /oauth/mp/callback con ?code=XXX.
//
// Env vars requeridas:
//   MP_CLIENT_ID                 — Client ID de la app marketplace MaPaPis
//   MP_CLIENT_SECRET             — Client Secret (privado)
//   SUPABASE_URL                 — auto-set
//   LEGACY_SERVICE_ROLE_KEY      — service role key (bypassea RLS)
// =========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface ReqBody {
  code: string;
  redirect_uri: string;
}

interface MpTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number | string;
  public_key?: string;
  scope?: string;
  message?: string;
  error?: string;
  cause?: unknown;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get("MP_CLIENT_ID");
    const clientSecret = Deno.env.get("MP_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
    const serviceRoleKey = Deno.env.get("LEGACY_SERVICE_ROLE_KEY")
      ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
      ?? Deno.env.get("SB_SERVICE_ROLE_KEY")
      ?? "";

    if (!clientId || !clientSecret) {
      return json({ error: "MP_CLIENT_ID/MP_CLIENT_SECRET no configurados" }, 500);
    }
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "SUPABASE env vars no disponibles" }, 500);
    }

    // Verificar auth del caller (la persona que está vinculando es la que
    // queda asociada al token).
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Sin Authorization header" }, 401);

    const userClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "No autenticado" }, 401);
    }
    const userId = userData.user.id;

    const body = (await req.json()) as ReqBody;
    if (!body.code) return json({ error: "code requerido" }, 400);
    if (!body.redirect_uri) return json({ error: "redirect_uri requerido" }, 400);

    // Intercambiar code por tokens
    const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: body.code,
        redirect_uri: body.redirect_uri,
      }).toString(),
    });

    const tokenJson = (await tokenRes.json()) as MpTokenResponse;
    if (!tokenRes.ok || !tokenJson.access_token || !tokenJson.user_id) {
      console.error("[mp_oauth_callback] MP error:", tokenJson);
      return json({
        error: tokenJson.message ?? tokenJson.error ?? "MP rechazó el code",
        detail: tokenJson,
      }, 502);
    }

    const expiresAt = tokenJson.expires_in
      ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
      : null;

    // Guardar/actualizar via service role (bypassea RLS)
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { error: dbErr } = await admin
      .from("mp_linked_accounts")
      .upsert(
        {
          profile_id: userId,
          mp_user_id: String(tokenJson.user_id),
          access_token: tokenJson.access_token,
          refresh_token: tokenJson.refresh_token ?? null,
          expires_at: expiresAt,
          public_key: tokenJson.public_key ?? null,
          scopes: tokenJson.scope ?? null,
        },
        { onConflict: "profile_id" },
      );

    if (dbErr) {
      console.error("[mp_oauth_callback] DB error:", dbErr);
      return json({ error: "DB error: " + dbErr.message }, 500);
    }

    return json({
      ok: true,
      mp_user_id: String(tokenJson.user_id),
      expires_at: expiresAt,
    });
  } catch (e) {
    console.error("[mp_oauth_callback] excepcion:", e);
    return json({ error: "Excepción: " + (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
