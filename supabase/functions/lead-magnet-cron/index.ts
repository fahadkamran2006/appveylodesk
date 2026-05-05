import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SITE_URL = "https://veylodesk.com";
const FROM = "Fahad Kamran <fahad@veylodesk.com>";
const REPLY_TO = "fahad@veylodesk.com";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function shell(preheader: string, body: string, unsubUrl: string) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1d1d1f;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;padding:36px 32px;line-height:1.6;font-size:16px;color:#1d1d1f;">
      <tr><td>${body}</td></tr>
      <tr><td style="padding-top:28px;font-size:12px;color:#86868b;border-top:1px solid #e5e5ea;">
        <p style="margin:18px 0 0;">You're getting this because you downloaded the free agency guide. <a href="${unsubUrl}" style="color:#86868b;">Unsubscribe</a>.</p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

function email2Html(firstName: string, unsubUrl: string) {
  const fn = escapeHtml(firstName);
  const body = `
    <p style="margin:0 0 18px;">Hey ${fn},</p>
    <p style="margin:0 0 18px;">Hope you got a chance to read the guide.</p>
    <p style="margin:0 0 18px;">I want to tell you about the single change that had the biggest impact on how my clients perceived my agency — bigger than any editing technique, any new software, any rate increase.</p>
    <p style="margin:0 0 18px;"><strong>I gave them their own dashboard.</strong></p>
    <p style="margin:0 0 18px;">Not a Google Drive folder. Not a Notion board I shared access to. Their own branded portal — my agency name at the top, their projects listed with statuses, their approved files organized, their invoices in one place.</p>
    <p style="margin:0 0 18px;">The first client I onboarded this way sent me a message 10 minutes after logging in:</p>
    <blockquote style="margin:0 0 18px;padding:12px 18px;border-left:3px solid #4B4BE1;background:#f5f5f7;border-radius:6px;color:#1d1d1f;">"This is incredibly professional. I didn't expect this level of organization."</blockquote>
    <p style="margin:0 0 18px;">She referred two clients within the next month. Not because my editing got better. Because the experience of working with me felt like working with a real company.</p>
    <p style="margin:0 0 18px;">That's what Veylodesk does. It gives your clients a portal that makes your agency look enterprise-grade — whether you're a team of one or ten.</p>
    <p style="margin:0 0 10px;">We're onboarding our first 50 Founding Members right now:</p>
    <ul style="margin:0 0 18px;padding-left:20px;">
      <li>Lifetime pricing at 50% off. Locked forever.</li>
      <li>Direct access to me to shape the roadmap.</li>
      <li>Private Founding Members Discord.</li>
      <li>Priority support, always.</li>
    </ul>
    <p style="margin:0 0 22px;">When the 50th spot fills, the price doubles permanently.</p>
    <p style="margin:0 0 24px;">
      <a href="${SITE_URL}/founding-members" style="display:inline-block;background:#4B4BE1;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;">Claim your Founding Member spot</a>
    </p>
    <p style="margin:0 0 6px;">Either way — thanks for reading.</p>
    <p style="margin:0;">Fahad<br><span style="color:#6e6e73;">Founder, Veylodesk</span></p>
  `;
  return shell("The single change that made my clients see me as a real agency.", body, unsubUrl);
}

function email2Text(firstName: string, unsubUrl: string) {
  return `Hey ${firstName},

Hope you got a chance to read the guide.

I want to tell you about the single change that had the biggest impact on how my clients perceived my agency — bigger than any editing technique, any software, any rate increase.

I gave them their own dashboard.

Not a Google Drive folder. Not a Notion board. Their own branded portal — my agency name at the top, their projects listed with statuses, their approved files organized, their invoices in one place.

The first client I onboarded this way messaged me 10 minutes after logging in: "This is incredibly professional. I didn't expect this level of organization."

She referred two clients within the next month. Not because my editing got better. Because the experience felt like working with a real company.

That's what Veylodesk does.

We're onboarding our first 50 Founding Members:
— Lifetime pricing at 50% off, locked forever
— Direct access to me to shape the roadmap
— Private Founding Members Discord
— Priority support, always

When the 50th spot fills, the price doubles permanently.

Claim your spot: ${SITE_URL}/founding-members

Either way — thanks for reading.

Fahad
Founder, Veylodesk

—
Unsubscribe: ${unsubUrl}`;
}

function email3Html(firstName: string, unsubUrl: string) {
  const fn = escapeHtml(firstName);
  const body = `
    <p style="margin:0 0 18px;">Hey ${fn},</p>
    <p style="margin:0 0 18px;">This is the last email I'll send about the Founding Member offer. I said I'd keep it honest so here it is:</p>
    <p style="margin:0 0 18px;">When the spots are gone, the price doubles. That's not a countdown timer trick — it's just the actual deal structure.</p>
    <p style="margin:0 0 18px;">If you've been thinking about it — now is the moment.</p>
    <p style="margin:0 0 18px;">If Veylodesk isn't the right fit for you right now — no problem at all. The guide is yours, the advice stands on its own, and I hope it helps you build something.</p>
    <p style="margin:0 0 18px;">But if you're still chasing invoices, managing feedback over WhatsApp, and sending Google Drive links to clients you want to impress — the door is still open.</p>
    <p style="margin:0 0 24px;">
      <a href="${SITE_URL}/founding-members" style="display:inline-block;background:#4B4BE1;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;">Claim your Founding Member spot</a>
    </p>
    <p style="margin:0 0 18px;">After this email I'll only send useful content — agency tips, product updates, things I'm learning. Nothing pushy.</p>
    <p style="margin:0 0 6px;">Thanks for being here.</p>
    <p style="margin:0;">Fahad<br><span style="color:#6e6e73;">Founder, Veylodesk</span></p>
    <p style="margin:24px 0 0;color:#6e6e73;font-size:14px;">P.S. — If you have any questions about whether Veylodesk solves your specific situation, just reply. I'll give you a straight answer.</p>
  `;
  return shell("Last email about this — then I'll leave you alone.", body, unsubUrl);
}

function email3Text(firstName: string, unsubUrl: string) {
  return `Hey ${firstName},

This is the last email I'll send about the Founding Member offer.

When the spots are gone, the price doubles. That's not a countdown trick — it's just the actual deal structure.

If you've been thinking about it — now is the moment.

If Veylodesk isn't the right fit right now — no problem. The guide is yours and I hope it helps.

But if you're still chasing invoices, managing feedback over WhatsApp, and sending Google Drive links to clients you want to impress — the door is still open.

Claim your spot: ${SITE_URL}/founding-members

After this email I'll only send useful content. Nothing pushy.

Thanks for being here.

Fahad
Founder, Veylodesk

P.S. — Any questions about whether Veylodesk fits your situation? Just reply.

—
Unsubscribe: ${unsubUrl}`;
}

async function sendEmail(to: string, subject: string, html: string, text: string, unsubUrl: string, tag: string): Promise<string | null> {
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
      tags: [{ name: "category", value: tag }],
    }),
  });
  if (!r.ok) {
    console.error("Resend error", r.status, await r.text());
    return null;
  }
  const json = await r.json().catch(() => ({}));
  return json?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = Date.now();
  const day = 86400000;
  const cutoff2 = new Date(now - 3 * day).toISOString();
  const cutoff3 = new Date(now - 6 * day).toISOString();

  const results: any = { email2: 0, email3: 0 };

  const { data: e2list } = await supabase
    .from("lead_magnet_subscribers")
    .select("id, email, first_name, unsubscribe_token")
    .is("email_2_sent_at", null)
    .is("unsubscribed_at", null)
    .lte("downloaded_at", cutoff2);

  for (const s of e2list ?? []) {
    const unsub = `${SITE_URL}/unsubscribe?token=${s.unsubscribe_token}`;
    const msgId = await sendEmail(
      s.email,
      `${s.first_name}, the one change that changed everything`,
      email2Html(s.first_name, unsub),
      email2Text(s.first_name, unsub),
      unsub,
      "lead_magnet_email_2",
    );
    if (msgId) {
      await supabase
        .from("lead_magnet_subscribers")
        .update({ email_2_sent_at: new Date().toISOString(), email_2_message_id: msgId })
        .eq("id", s.id);
      await supabase.from("lead_magnet_email_events").insert({
        subscriber_id: s.id, message_id: msgId, recipient_email: s.email,
        email_type: 2, event_type: "queued",
      });
      results.email2++;
    }
  }

  const { data: e3list } = await supabase
    .from("lead_magnet_subscribers")
    .select("id, email, first_name, unsubscribe_token")
    .is("email_3_sent_at", null)
    .is("unsubscribed_at", null)
    .lte("downloaded_at", cutoff3);

  for (const s of e3list ?? []) {
    const unsub = `${SITE_URL}/unsubscribe?token=${s.unsubscribe_token}`;
    const msgId = await sendEmail(
      s.email,
      `Last note, ${s.first_name}`,
      email3Html(s.first_name, unsub),
      email3Text(s.first_name, unsub),
      unsub,
      "lead_magnet_email_3",
    );
    if (msgId) {
      await supabase
        .from("lead_magnet_subscribers")
        .update({ email_3_sent_at: new Date().toISOString(), email_3_message_id: msgId })
        .eq("id", s.id);
      await supabase.from("lead_magnet_email_events").insert({
        subscriber_id: s.id, message_id: msgId, recipient_email: s.email,
        email_type: 3, event_type: "queued",
      });
      results.email3++;
    }
  }

  return new Response(JSON.stringify({ ok: true, ...results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
