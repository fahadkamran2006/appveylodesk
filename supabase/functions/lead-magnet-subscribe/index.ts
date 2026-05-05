import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RESEND_AUDIENCE_ID = Deno.env.get("RESEND_AUDIENCE_ID") || "";
const SITE_URL = "https://veylodesk.com";

async function addToResendAudience(email: string, firstName: string) {
  if (!RESEND_AUDIENCE_ID) return;
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
          email,
          first_name: firstName,
          unsubscribed: false,
        }),
      },
    );
    if (!r.ok) {
      const txt = await r.text();
      // 409/422 = already exists — safe to ignore
      console.warn("Resend audience add non-2xx", r.status, txt);
    }
  } catch (e) {
    console.error("Resend audience add failed", e);
  }
}
const PDF_URL = "https://bwfnxidpifugpklczfyo.supabase.co/storage/v1/object/public/lead-magnet-assets/veylodesk-agency-guide.pdf";
const FROM = "Fahad Kamran <fahad@veylodesk.com>";
const REPLY_TO = "fahad@veylodesk.com";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function email1Html(firstName: string, unsubUrl: string) {
  const fn = escapeHtml(firstName);
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1d1d1f;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your free agency guide is ready — plus the one fix most editors never make.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;padding:36px 32px;line-height:1.6;font-size:16px;color:#1d1d1f;">
      <tr><td>
        <p style="margin:0 0 18px;">Hey ${fn},</p>
        <p style="margin:0 0 18px;">Your copy of <strong>"How to Run a Video Editing Agency Like a Pro"</strong> is ready.</p>
        <p style="margin:0 0 28px;">
          <a href="${PDF_URL}" style="display:inline-block;background:#4B4BE1;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;">Download the guide (PDF)</a>
        </p>
        <p style="margin:0 0 18px;">Save it somewhere you'll actually come back to.</p>
        <p style="margin:0 0 18px;">One quick thing while you read.</p>
        <p style="margin:0 0 18px;">Most editors who download this will nod along to every chapter. They'll think "yes, this is exactly my problem" on the feedback chaos section. They'll wince at the invoice chasing section. They'll finish the guide and feel motivated.</p>
        <p style="margin:0 0 18px;">Then they'll go back to Google Drive, WhatsApp, and spreadsheets — because setting up a new system feels like work.</p>
        <p style="margin:0 0 18px;">I built Veylodesk specifically for that moment. The platform that makes every chapter in this guide your reality in one afternoon, not one month.</p>
        <p style="margin:0 0 18px;">Client portal. Video approvals. Pay-to-download invoicing. Team management. One tab.</p>
        <p style="margin:0 0 18px;">I'll tell you more in a couple of days. For now — read the guide.</p>
        <p style="margin:0 0 6px;">Talk soon,<br>Fahad<br><span style="color:#6e6e73;">Founder, Veylodesk</span></p>
        <p style="margin:24px 0 0;color:#6e6e73;font-size:14px;">P.S. — I'm 19, ran a video editing agency for two years, and built this to fix my own problems. If you have questions about anything in the guide, just reply to this email. I read every one.</p>
      </td></tr>
      <tr><td style="padding-top:28px;border-top:1px solid #e5e5ea;margin-top:28px;font-size:12px;color:#86868b;">
        <p style="margin:18px 0 0;">You're getting this because you downloaded the free agency guide at veylodesk.com. <a href="${unsubUrl}" style="color:#86868b;">Unsubscribe</a>.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function email1Text(firstName: string, unsubUrl: string) {
  return `Hey ${firstName},

Your copy of "How to Run a Video Editing Agency Like a Pro" is ready:
${PDF_URL}

One quick thing while you read.

Most editors who download this will nod along to every chapter. They'll think "yes, this is exactly my problem" on the feedback chaos section. They'll wince at the invoice chasing section. They'll finish the guide and feel motivated.

Then they'll go back to Google Drive, WhatsApp, and spreadsheets — because setting up a new system feels like work.

I built Veylodesk for that moment. The platform that makes every chapter in this guide your reality in one afternoon, not one month.

Client portal. Video approvals. Pay-to-download invoicing. Team management. One tab.

I'll tell you more in a couple of days. For now — read the guide.

Talk soon,
Fahad
Founder, Veylodesk

P.S. — I'm 19, ran a video editing agency for two years, and built this to fix my own problems. If you have questions, just reply. I read every one.

—
Unsubscribe: ${unsubUrl}`;
}

async function sendEmail(to: string, subject: string, html: string, text: string, unsubUrl: string): Promise<string | null> {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      reply_to: REPLY_TO,
      subject,
      html,
      text,
      headers: {
        "List-Unsubscribe": `<${unsubUrl}>, <mailto:${REPLY_TO}?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      tags: [{ name: "category", value: "lead_magnet_email_1" }],
    }),
  });
  if (!r.ok) {
    const body = await r.text();
    console.error("Resend error", r.status, body);
    throw new Error(`Resend ${r.status}`);
  }
  const json = await r.json().catch(() => ({}));
  return json?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email: rawEmail, first_name } = await req.json();
    const email = String(rawEmail || "").trim().toLowerCase();
    const firstName = String(first_name || "").trim();
    if (!email || !firstName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existing } = await supabase
      .from("lead_magnet_subscribers")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ duplicate: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inserted, error } = await supabase
      .from("lead_magnet_subscribers")
      .insert({ email, first_name: firstName })
      .select("id, unsubscribe_token")
      .single();
    if (error) throw error;

    const unsubUrl = `${SITE_URL}/unsubscribe?token=${inserted.unsubscribe_token}`;
    const messageId = await sendEmail(
      email,
      `${firstName}, your agency guide is ready`,
      email1Html(firstName, unsubUrl),
      email1Text(firstName, unsubUrl),
      unsubUrl,
    );

    if (messageId) {
      await supabase
        .from("lead_magnet_subscribers")
        .update({ email_1_message_id: messageId })
        .eq("id", inserted.id);
      await supabase.from("lead_magnet_email_events").insert({
        subscriber_id: inserted.id,
        message_id: messageId,
        recipient_email: email,
        email_type: 1,
        event_type: "queued",
      });
    }

    // Add to Resend audience so the lead shows up in your Resend dashboard
    await addToResendAudience(email, firstName);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
