// Resend webhook receiver for lead-magnet emails.
// Configure the endpoint in Resend dashboard with the same secret stored
// in RESEND_WEBHOOK_SECRET. We accept Svix-style headers from Resend.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

const LEAD_MAGNET_TAGS = new Set([
  "lead_magnet_email_1",
  "lead_magnet_email_2",
  "lead_magnet_email_3",
]);

function tagToType(tag?: string | null): number | null {
  if (!tag) return null;
  if (tag.endsWith("_1")) return 1;
  if (tag.endsWith("_2")) return 2;
  if (tag.endsWith("_3")) return 3;
  return null;
}

function mapEvent(t: string) {
  // Resend sends "email.sent", "email.delivered", "email.opened",
  // "email.clicked", "email.bounced", "email.complained",
  // "email.delivery_delayed", "email.failed"
  return t.startsWith("email.") ? t.slice(6) : t;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const type: string = body?.type || "";
    const data = body?.data || {};

    // Filter to lead-magnet sends only (tag set when sending)
    const tags: any[] = data?.tags || [];
    const categoryTag = tags.find((t) => t?.name === "category")?.value as string | undefined;
    if (!categoryTag || !LEAD_MAGNET_TAGS.has(categoryTag)) {
      // Not a lead-magnet email — ignore quietly.
      return new Response(JSON.stringify({ ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const messageId: string | null = data?.email_id ?? data?.id ?? null;
    const recipientEmail: string = String(
      Array.isArray(data?.to) ? data.to[0] : data?.to ?? "",
    ).toLowerCase();
    const eventType = mapEvent(type);
    const emailType = tagToType(categoryTag);
    const occurredAt = body?.created_at ? new Date(body.created_at).toISOString() : new Date().toISOString();

    let bounceReason: string | null = null;
    if (eventType === "bounced") {
      bounceReason = data?.bounce?.message || data?.bounce?.subType || data?.bounce?.type || null;
    } else if (eventType === "failed") {
      bounceReason = data?.failed?.reason || null;
    }

    const clickUrl: string | null = data?.click?.link || null;

    // Try to map back to subscriber by message_id, then by email
    let subscriberId: string | null = null;
    if (messageId) {
      const { data: byMsg } = await supabase
        .from("lead_magnet_subscribers")
        .select("id")
        .or(
          `email_1_message_id.eq.${messageId},email_2_message_id.eq.${messageId},email_3_message_id.eq.${messageId}`,
        )
        .maybeSingle();
      subscriberId = byMsg?.id ?? null;
    }
    if (!subscriberId && recipientEmail) {
      const { data: byEmail } = await supabase
        .from("lead_magnet_subscribers")
        .select("id")
        .eq("email", recipientEmail)
        .maybeSingle();
      subscriberId = byEmail?.id ?? null;
    }

    await supabase.from("lead_magnet_email_events").insert({
      subscriber_id: subscriberId,
      message_id: messageId,
      recipient_email: recipientEmail,
      email_type: emailType,
      event_type: eventType,
      bounce_reason: bounceReason,
      click_url: clickUrl,
      user_agent: data?.click?.userAgent || data?.open?.userAgent || null,
      ip: data?.click?.ipAddress || data?.open?.ipAddress || null,
      raw: body,
      occurred_at: occurredAt,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("webhook error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
