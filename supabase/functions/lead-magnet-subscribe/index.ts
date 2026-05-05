import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SITE_URL = "https://veylodesk.com";
const PDF_URL = `${SITE_URL}/downloads/veylodesk-agency-guide.pdf`;
const FROM = "Fahad from Veylodesk <fahad@veylodesk.com>";

function email1(firstName: string, unsubUrl: string) {
  return `Hey ${firstName},

Your copy of "How to Run a Video Editing Agency Like a Pro" is ready. Download it here and save it somewhere you'll actually come back to:

${PDF_URL}

But before you dig in — one quick thing I want you to pay attention to while you read.

Most editors who download this guide will nod along to every chapter. They'll think "yes, this is exactly my problem" on the feedback chaos section. They'll wince at the invoice chasing section because they've lived it. They'll finish the guide and feel genuinely motivated.

And then they'll go back to Google Drive, WhatsApp, and spreadsheets. Because setting up a new system feels like too much work.

I built Veylodesk specifically for that moment — the moment between knowing what you need to do and actually doing it. It's the platform that makes every chapter in this guide your reality in one afternoon, not one month.

Client portal. Video approvals. Pay-to-download invoicing. Team management. One tab.

I'll tell you more about it in a couple of days. For now — read the guide.

Talk soon,
Fahad
Founder, Veylodesk

P.S. — I'm a 19 year old who ran a video editing agency for two years and built this platform to fix my own problems. If you have questions about anything in the guide, just reply to this email. I read every one.

---
Don't want these emails? Unsubscribe: ${unsubUrl}`;
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
    throw new Error(`Resend ${r.status}`);
  }
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
      .select("unsubscribe_token")
      .single();
    if (error) throw error;

    const unsubUrl = `${SITE_URL}/unsubscribe?token=${inserted.unsubscribe_token}`;
    await sendEmail(
      email,
      "Your free agency guide is here + one thing most editors never fix",
      email1(firstName, unsubUrl),
    );

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
