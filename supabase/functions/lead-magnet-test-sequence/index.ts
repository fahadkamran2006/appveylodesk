import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SITE_URL = "https://veylodesk.com";
const PDF_URL = "https://bwfnxidpifugpklczfyo.supabase.co/storage/v1/object/public/lead-magnet-assets/veylodesk-agency-guide.pdf";
const FROM = "Fahad Kamran <fahad@veylodesk.com>";
const REPLY_TO = "hello@fahadkamran.com";

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function shell(body: string, unsubUrl: string, banner: string) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1d1d1f;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;padding:36px 32px;line-height:1.6;font-size:16px;">
<tr><td><div style="background:#fff3cd;border:1px solid #ffe69c;color:#7a5d00;padding:8px 12px;border-radius:8px;font-size:12px;margin-bottom:18px;">${esc(banner)}</div>${body}</td></tr>
<tr><td style="padding-top:28px;font-size:12px;color:#86868b;border-top:1px solid #e5e5ea;"><p style="margin:18px 0 0;">Test send. <a href="${unsubUrl}" style="color:#86868b;">Unsubscribe</a>.</p></td></tr>
</table></td></tr></table></body></html>`;
}

function e1(fn: string, unsub: string, banner: string) {
  const body = `<p>Hey ${esc(fn)},</p>
<p>Your copy of "How to Run a Video Editing Agency Like a Pro" is ready.</p>
<p><a href="${PDF_URL}" style="display:inline-block;background:#4B4BE1;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;">Download the guide (PDF)</a></p>
<p>Talk soon,<br>Fahad</p>`;
  return shell(body, unsub, banner);
}
function e2(fn: string, unsub: string, banner: string) {
  const body = `<p>Hey ${esc(fn)},</p>
<p>Hope you got a chance to read the guide. Here's the one change that mattered most for my agency: I gave clients their own dashboard.</p>
<p><a href="${SITE_URL}/founding-members" style="display:inline-block;background:#4B4BE1;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;">Claim your Founding Member spot</a></p>
<p>Fahad</p>`;
  return shell(body, unsub, banner);
}
function e3(fn: string, unsub: string, banner: string) {
  const body = `<p>Hey ${esc(fn)},</p>
<p>Last note about the Founding Member offer — when spots are gone, the price doubles.</p>
<p><a href="${SITE_URL}/founding-members" style="display:inline-block;background:#4B4BE1;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;">Claim your spot</a></p>
<p>Fahad</p>`;
  return shell(body, unsub, banner);
}

async function send(to: string, subject: string, html: string, unsub: string, tag: string): Promise<string | null> {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM, to: [to], reply_to: REPLY_TO, subject, html,
      headers: {
        "List-Unsubscribe": `<${unsub}>, <mailto:${REPLY_TO}?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      tags: [{ name: "category", value: tag }],
    }),
  });
  if (!r.ok) {
    console.error("Resend error", r.status, await r.text());
    return null;
  }
  const j = await r.json().catch(() => ({}));
  return j?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email: rawEmail, first_name } = await req.json();
    const email = String(rawEmail || "").trim().toLowerCase();
    const firstName = String(first_name || "Test").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find or create a transient subscriber row so events can be tracked
    let subscriberId: string | null = null;
    let unsubscribeToken: string | null = null;
    const { data: existing } = await supabase
      .from("lead_magnet_subscribers")
      .select("id, unsubscribe_token")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      subscriberId = existing.id;
      unsubscribeToken = (existing as any).unsubscribe_token;
    } else {
      const { data: ins, error: insErr } = await supabase
        .from("lead_magnet_subscribers")
        .insert({ email, first_name: firstName })
        .select("id, unsubscribe_token")
        .single();
      if (insErr) throw insErr;
      subscriberId = ins.id;
      unsubscribeToken = (ins as any).unsubscribe_token;
    }

    const unsub = `${SITE_URL}/unsubscribe?token=${unsubscribeToken}`;
    const banner = "TEST RUN — sequence test from Super Admin";

    const results: { type: number; subject: string; message_id: string | null }[] = [];

    const sequence = [
      { type: 1, subject: `[TEST] ${firstName}, your agency guide is ready`, html: e1(firstName, unsub, banner), tag: "lead_magnet_test_1" },
      { type: 2, subject: `[TEST] ${firstName}, the one change that changed everything`, html: e2(firstName, unsub, banner), tag: "lead_magnet_test_2" },
      { type: 3, subject: `[TEST] Last note, ${firstName}`, html: e3(firstName, unsub, banner), tag: "lead_magnet_test_3" },
    ];

    for (const s of sequence) {
      const msgId = await send(email, s.subject, s.html, unsub, s.tag);
      results.push({ type: s.type, subject: s.subject, message_id: msgId });
      if (msgId) {
        await supabase.from("lead_magnet_email_events").insert({
          subscriber_id: subscriberId,
          message_id: msgId,
          recipient_email: email,
          email_type: s.type,
          event_type: "queued",
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, subscriber_id: subscriberId, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
