// One-shot: push every existing lead_magnet_subscriber into the Resend audience.
// Safe to call repeatedly — Resend dedupes by email.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RESEND_AUDIENCE_ID = Deno.env.get("RESEND_AUDIENCE_ID") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!RESEND_AUDIENCE_ID) {
    return new Response(JSON.stringify({ error: "RESEND_AUDIENCE_ID not set" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: subs, error } = await supabase
    .from("lead_magnet_subscribers")
    .select("email, first_name, unsubscribed_at");
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let added = 0, skipped = 0, failed = 0;
  for (const s of subs ?? []) {
    try {
      const r = await fetch(
        `https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: s.email,
            first_name: s.first_name,
            unsubscribed: !!s.unsubscribed_at,
          }),
        },
      );
      if (r.ok) added++;
      else if (r.status === 409 || r.status === 422) skipped++;
      else { failed++; console.warn("backfill non-2xx", r.status, await r.text()); }
    } catch (e) {
      failed++;
      console.error("backfill error", e);
    }
  }

  return new Response(JSON.stringify({ total: subs?.length ?? 0, added, skipped, failed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
