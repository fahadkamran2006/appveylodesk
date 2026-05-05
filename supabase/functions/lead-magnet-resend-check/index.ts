// Verifies RESEND_AUDIENCE_ID points at a real Resend audience and returns
// the last lead-magnet webhook event we received from Resend.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RESEND_AUDIENCE_ID = Deno.env.get("RESEND_AUDIENCE_ID") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const result: any = {
    audience_id_present: !!RESEND_AUDIENCE_ID,
    audience_id: RESEND_AUDIENCE_ID || null,
    audience_valid: false,
    audience: null,
    contacts_count: null,
    last_webhook_event: null,
    webhook_events_24h: 0,
    error: null,
  };

  // 1. Validate audience id
  if (RESEND_AUDIENCE_ID) {
    try {
      const r = await fetch(
        `https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}`,
        { headers: { Authorization: `Bearer ${RESEND_API_KEY}` } },
      );
      if (r.ok) {
        const j = await r.json();
        result.audience_valid = true;
        result.audience = { id: j.id, name: j.name, created_at: j.created_at };

        const c = await fetch(
          `https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts`,
          { headers: { Authorization: `Bearer ${RESEND_API_KEY}` } },
        );
        if (c.ok) {
          const cj = await c.json();
          result.contacts_count = Array.isArray(cj?.data) ? cj.data.length : null;
        }
      } else {
        result.error = `Resend returned ${r.status}: ${await r.text()}`;
      }
    } catch (e) {
      result.error = String(e);
    }
  } else {
    result.error = "RESEND_AUDIENCE_ID secret is not set.";
  }

  // 2. Last webhook event (any) and 24h count
  const { data: latest } = await supabase
    .from("lead_magnet_email_events")
    .select("id, event_type, recipient_email, email_type, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  result.last_webhook_event = latest ?? null;

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabase
    .from("lead_magnet_email_events")
    .select("id", { count: "exact", head: true })
    .gte("occurred_at", since);
  result.webhook_events_24h = count ?? 0;

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
