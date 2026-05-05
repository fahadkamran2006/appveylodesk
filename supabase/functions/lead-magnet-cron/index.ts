import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SITE_URL = "https://veylodesk.com";
const FROM = "Fahad from Veylodesk <fahad@veylodesk.com>";

function email2(firstName: string, unsubUrl: string) {
  return `Hey ${firstName},

Hope you got a chance to read the guide.

I want to tell you about the single change that had the biggest impact on how my clients perceived my agency — bigger than any editing technique, any new software, any rate increase.

I gave them their own dashboard.

Not a Google Drive folder. Not a Notion board I shared access to. Their own branded portal — my agency name at the top, their projects listed with statuses, their approved files organized, their invoices in one place.

The first client I onboarded this way sent me a message 10 minutes after logging in. She said: "This is incredibly professional. I didn't expect this level of organization."

She referred two clients to me within the next month. Not because my editing got better. Because the experience of working with me felt like working with a real company.

That's what Veylodesk does. It gives your clients a portal that makes your agency look enterprise-grade — regardless of whether you're a team of one or a team of ten.

We're onboarding our first 50 Founding Members right now. Here's what that means:
— Lifetime pricing at 50% off. Locked forever, no matter how we scale.
— Direct access to me to request features and shape the roadmap.
— Private Founding Members Discord where we build this together.
— Priority support, always.

When the 50th spot fills, the price doubles permanently.

If the guide resonated with you — this is how you implement it.

Claim your Founding Member spot: ${SITE_URL}/founding-members

Either way — thanks for reading. Building something people actually find useful is the only thing that matters to me right now.

Fahad
Founder, Veylodesk

---
Unsubscribe: ${unsubUrl}`;
}

function email3(firstName: string, unsubUrl: string) {
  return `Hey ${firstName},

This is the last email I'll send about the Founding Member offer. I said I'd keep it honest so here it is:

When the spots are gone, the price doubles. That's not a countdown timer trick — it's just the actual deal structure.

If you've been thinking about it — now is the moment.

If Veylodesk isn't the right fit for you right now — no problem at all. The guide is yours, the advice stands on its own, and I hope it genuinely helps you build something.

But if you're still chasing invoices, managing feedback over WhatsApp, and sending Google Drive links to clients you want to impress — the door is still open.

Claim your Founding Member spot: ${SITE_URL}/founding-members

After this email I'll only send you useful content — agency tips, product updates, and things I'm learning building Veylodesk. Nothing pushy.

Thanks for being here.

Fahad
Founder, Veylodesk

P.S. — If you have any questions about whether Veylodesk solves your specific situation, just reply. I'll give you a straight answer.

---
Unsubscribe: ${unsubUrl}`;
}

async function sendEmail(to: string, subject: string, text: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      reply_to: "fahad@veylodesk.com",
      subject,
      text,
    }),
  });
  if (!r.ok) {
    const body = await r.text();
    console.error("Resend error", r.status, body);
    return false;
  }
  return true;
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

  // Email 2
  const { data: e2list } = await supabase
    .from("lead_magnet_subscribers")
    .select("id, email, first_name, unsubscribe_token")
    .is("email_2_sent_at", null)
    .is("unsubscribed_at", null)
    .lte("downloaded_at", cutoff2);

  for (const s of e2list ?? []) {
    const unsub = `${SITE_URL}/unsubscribe?token=${s.unsubscribe_token}`;
    const ok = await sendEmail(
      s.email,
      "The one thing that changed how my clients see me",
      email2(s.first_name, unsub),
    );
    if (ok) {
      await supabase
        .from("lead_magnet_subscribers")
        .update({ email_2_sent_at: new Date().toISOString() })
        .eq("id", s.id);
      results.email2++;
    }
  }

  // Email 3
  const { data: e3list } = await supabase
    .from("lead_magnet_subscribers")
    .select("id, email, first_name, unsubscribe_token")
    .is("email_3_sent_at", null)
    .is("unsubscribed_at", null)
    .lte("downloaded_at", cutoff3);

  for (const s of e3list ?? []) {
    const unsub = `${SITE_URL}/unsubscribe?token=${s.unsubscribe_token}`;
    const ok = await sendEmail(
      s.email,
      "Last email about this — then I'll leave you alone",
      email3(s.first_name, unsub),
    );
    if (ok) {
      await supabase
        .from("lead_magnet_subscribers")
        .update({ email_3_sent_at: new Date().toISOString() })
        .eq("id", s.id);
      results.email3++;
    }
  }

  return new Response(JSON.stringify({ ok: true, ...results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
