// Welcome email sequence: signup (email 1), cron (emails 2 & 3)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = "https://veylodesk.com";
const FROM = "Fahad from Veylodesk <fahad@veylodesk.com>";
const REPLY_TO = "hello@fahadkamran.com";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function esc(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function unsubUrl(userId: string) {
  const token = btoa(userId).replace(/=+$/, "");
  return `${SITE_URL}/unsubscribe?token=${token}`;
}

function shell(inner: string, unsub: string) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:#0D0D1F;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;color:#BBBBDD;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D1F;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#16162E;border-radius:12px;padding:40px;">
<tr><td>
<div style="text-align:center;margin-bottom:28px;"><span style="color:#4B4BE1;font-weight:800;font-size:20px;letter-spacing:2px;">VEYLODESK</span></div>
${inner}
</td></tr>
<tr><td style="padding-top:32px;border-top:1px solid #2A2A4A;margin-top:24px;">
<p style="color:#555577;font-size:12px;line-height:1.6;margin:16px 0 0;text-align:center;">
<a href="${unsub}" style="color:#666688;text-decoration:underline;">Unsubscribe</a>
</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

const btn = (href: string, label: string) =>
  `<div style="text-align:center;margin:28px 0;"><a href="${href}" style="display:inline-block;background:#4B4BE1;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;">${label}</a></div>`;

const stepCard = (n: number, title: string, body: string) =>
  `<div style="background:#1E1E3A;border-left:3px solid #4B4BE1;padding:14px 18px;border-radius:6px;margin:14px 0;">
    <div style="color:#ffffff;font-weight:700;font-size:15px;margin-bottom:6px;">Step ${n} — ${esc(title)}</div>
    <div style="color:#BBBBDD;font-size:14px;line-height:1.6;">${body}</div>
  </div>`;

const footerNote = (text: string) =>
  `<p style="color:#666688;font-size:12px;line-height:1.6;margin:24px 0 0;">${text}</p>`;

const h1 = (text: string) =>
  `<h1 style="color:#ffffff;font-weight:700;font-size:22px;line-height:1.35;margin:0 0 18px;">${esc(text)}</h1>`;

const p = (text: string) =>
  `<p style="color:#BBBBDD;font-size:15px;line-height:1.7;margin:0 0 14px;">${text}</p>`;

function email1(firstName: string, unsub: string) {
  const inner = `
${h1("Welcome. You are officially in.")}
${p(`Hey ${esc(firstName)},`)}
${p(`My name is Fahad. I built Veylodesk after two years of running my own video editing agency and getting completely fed up with the chaos — files scattered across Google Drive, feedback lost in WhatsApp threads, invoices ignored for weeks.`)}
${p(`Veylodesk fixes all of that. Here is how to get the most out of it in the next 10 minutes:`)}
${stepCard(1, "Set up your agency profile", "Add your name and logo so your client portal looks professional from day one.")}
${stepCard(2, "Add your first client", "You can add clients privately without disturbing their workflow — they will not receive any notification until you choose to give them dashboard access. Take your time getting everything set up first.")}
${stepCard(3, "Create your first project and upload a video for review", "Your client gets a review link, leaves timestamped comments directly on the video timeline, and can approve with one click — exactly like Frame.io, built in.")}
${p(`If anything feels confusing or broken — just reply to this email and it comes straight to me personally. I read every single one.`)}
${btn(`${SITE_URL}/dashboard`, "Open Veylodesk →")}
${footerNote("You are on the free plan — one client, 2GB storage, forever free. When you are ready for more, founding member pricing is available at 50% off for life. — Fahad Kamran, Founder of Veylodesk")}
`;
  return shell(inner, unsub);
}

function email2(firstName: string, unsub: string) {
  const inner = `
${h1("The moment everything clicks.")}
${p(`Hey ${esc(firstName)},`)}
${p(`Just checking in — have you added your first client to Veylodesk yet?`)}
${p(`Here is something I want you to know about the new client flow. You do not have to disturb your client at all to get started. You can add them privately, set up their projects, organize everything on your end — and only give them dashboard access when you are ready. They will not know a thing until you decide to invite them in.`)}
${p(`That means you can have a fully professional setup ready before your client ever sees it. The first impression they get is a polished branded portal — not a half-finished onboarding experience.`)}
${p(`When that moment happens — when a client logs into their own branded portal for the first time — something shifts. They stop thinking of you as a freelancer. They start thinking of you as an agency.`)}
${p(`Same editing work. Completely different perception. That perception is what gets you rehired and referred.`)}
${p(`If something stopped you from getting started — a confusing step, a missing feature, something that did not work — reply to this email and tell me. I am actively building this and your feedback goes directly into what gets fixed next week.`)}
${btn(`${SITE_URL}/dashboard`, "Add your first client →")}
${footerNote("Founding member spots are still available — 50% off for life, limited to 50 agencies. Reply to this email if you want details.")}
`;
  return shell(inner, unsub);
}

function email3(firstName: string, unsub: string) {
  const inner = `
${h1("One week in. Honest question.")}
${p(`Hey ${esc(firstName)},`)}
${p(`It has been a week since you signed up for Veylodesk. I want to ask you something directly.`)}
${p(`<strong style="color:#ffffff;">Did you actually try it?</strong>`)}
${p(`If yes — what did you think? What is missing? What did not make sense? Reply and tell me. Genuinely.`)}
${p(`If no — what stopped you? Time? A confusing step? Not sure it would work for your situation? Reply and tell me that too.`)}
${p(`I am not asking to be polite. I am 19 years old, I built this from scratch after running my own agency, and every piece of honest feedback I get this week directly shapes what I build next month.`)}
${p(`Here is one thing that might change your mind if you have not tried yet — you can set up your entire agency inside Veylodesk before a single client ever knows it exists. Add clients privately. Build out their projects. Organize everything. Then when you are ready — one click gives them access to their branded dashboard.`)}
${p(`No disruption to your current workflow. No commitment. Just a more professional system ready when you need it.`)}
${p(`And if you tried it and liked what you saw — we still have founding member spots open. 50% off for life, direct access to me, private Discord community where we build this together.`)}
${btn(`${SITE_URL}/founding-members`, "Claim a founding member spot →")}
<div style="text-align:center;margin:-12px 0 16px;"><a href="${SITE_URL}/dashboard" style="color:#4B4BE1;text-decoration:underline;font-size:13px;">Or log back into Veylodesk →</a></div>
${footerNote("After this email I will only contact you with product updates and useful content. Nothing pushy. — Fahad Kamran, Founder of Veylodesk")}
`;
  return shell(inner, unsub);
}

async function sendResend(to: string, subject: string, html: string, unsub: string, tag: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      reply_to: REPLY_TO,
      subject,
      html,
      headers: {
        "Reply-To": REPLY_TO,
        "List-Unsubscribe": `<${unsub}>, <mailto:${REPLY_TO}?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      tags: [{ name: "category", value: tag }],
    }),
  });
  if (!r.ok) {
    console.error("Resend error", r.status, await r.text());
    return false;
  }
  return true;
}

async function getFirstName(userId: string): Promise<string> {
  const { data } = await admin.from("profiles").select("first_name, full_name").eq("id", userId).maybeSingle();
  const fn = (data?.first_name as string) || (data?.full_name as string)?.split(" ")[0] || "there";
  return fn || "there";
}

async function getEmail(userId: string): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

async function handleSignup(userId: string, agencyId: string | null) {
  // Upsert sequence row (no-op if exists)
  const { data: existing } = await admin
    .from("email_sequences")
    .select("id, email_1_sent_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.email_1_sent_at) {
    return { ok: true, skipped: "already_sent" };
  }

  if (!existing) {
    await admin.from("email_sequences").insert({ user_id: userId, agency_id: agencyId });
  } else if (agencyId) {
    await admin.from("email_sequences").update({ agency_id: agencyId }).eq("user_id", userId);
  }

  const email = await getEmail(userId);
  if (!email) return { ok: false, error: "no_email" };
  const firstName = await getFirstName(userId);
  const unsub = unsubUrl(userId);
  const ok = await sendResend(
    email,
    "You are in — here is how to get started with Veylodesk",
    email1(firstName, unsub),
    unsub,
    "welcome-1",
  );
  if (ok) {
    await admin.from("email_sequences").update({ email_1_sent_at: new Date().toISOString() }).eq("user_id", userId);
  }
  return { ok };
}

async function processCron() {
  const now = new Date();
  const threeDays = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDays = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Email 2 candidates
  const { data: e2rows } = await admin
    .from("email_sequences")
    .select("user_id")
    .is("unsubscribed_at", null)
    .not("email_1_sent_at", "is", null)
    .is("email_2_sent_at", null)
    .lte("created_at", threeDays)
    .limit(200);

  let sent2 = 0;
  for (const row of e2rows ?? []) {
    const email = await getEmail(row.user_id);
    if (!email) continue;
    const firstName = await getFirstName(row.user_id);
    const unsub = unsubUrl(row.user_id);
    const ok = await sendResend(email, "Have you invited your first client yet?", email2(firstName, unsub), unsub, "welcome-2");
    if (ok) {
      await admin.from("email_sequences").update({ email_2_sent_at: new Date().toISOString() }).eq("user_id", row.user_id);
      sent2++;
    }
  }

  // Email 3 candidates
  const { data: e3rows } = await admin
    .from("email_sequences")
    .select("user_id")
    .is("unsubscribed_at", null)
    .not("email_2_sent_at", "is", null)
    .is("email_3_sent_at", null)
    .lte("created_at", sevenDays)
    .limit(200);

  let sent3 = 0;
  for (const row of e3rows ?? []) {
    const email = await getEmail(row.user_id);
    if (!email) continue;
    const firstName = await getFirstName(row.user_id);
    const unsub = unsubUrl(row.user_id);
    const ok = await sendResend(email, "Honest question — did you try it?", email3(firstName, unsub), unsub, "welcome-3");
    if (ok) {
      await admin.from("email_sequences").update({ email_3_sent_at: new Date().toISOString() }).eq("user_id", row.user_id);
      sent3++;
    }
  }

  return { ok: true, sent2, sent3 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action || url.searchParams.get("action") || "cron";

    if (action === "signup") {
      // Validate JWT to get user_id
      const auth = req.headers.get("Authorization") || "";
      const token = auth.replace("Bearer ", "");
      const { data: userData } = await admin.auth.getUser(token);
      const userId = userData?.user?.id;
      if (!userId) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await handleSignup(userId, body.agency_id ?? null);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // cron
    const result = await processCron();
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("welcome-sequence error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
