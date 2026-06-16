// Unsubscribe endpoint: GET /unsubscribe?token=<base64 user_id>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function decodeToken(token: string): string | null {
  try {
    const padded = token + "==".slice(0, (4 - (token.length % 4)) % 4);
    const id = atob(padded);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    return id;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || (req.method === "POST" ? (await req.json().catch(() => ({}))).token : "");
    const userId = decodeToken(String(token || ""));
    if (!userId) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await admin
      .from("email_sequences")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("user_id", userId);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
