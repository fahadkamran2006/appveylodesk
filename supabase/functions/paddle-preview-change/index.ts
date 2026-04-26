import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Mirror of Price IDs from src/hooks/useSubscription.tsx — keep in sync
const PADDLE_PRICES: Record<string, Record<string, string>> = {
  starter: {
    monthly: "pri_01khrz050sv0w1a4ewyvv5arb1",
    yearly: "pri_01khs05dqng1qr8xck4afwdf6y",
  },
  growth: {
    monthly: "pri_01khs06hcgeff068rncwjnqxns",
    yearly: "pri_01khwaq26mchmtmw4w9d0ffgrz",
  },
  scale: {
    monthly: "pri_01khs09b0z4rm4mkz1wk3b38ms",
    yearly: "pri_01khs0as29km3edtr84n7fxfbs",
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const paddleApiKey = Deno.env.get("PADDLE_API_KEY");

    if (!paddleApiKey) {
      return new Response(
        JSON.stringify({ error: "Billing service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = claimsData.claims.sub;

    // Validate body
    let body: { plan?: string; interval?: string; proration_mode?: string } = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const plan = String(body.plan || "");
    const interval = String(body.interval || "");
    const prorationMode = body.proration_mode === "do_not_bill"
      ? "do_not_bill"
      : "prorated_immediately";

    if (!PADDLE_PRICES[plan] || !PADDLE_PRICES[plan][interval]) {
      return new Response(
        JSON.stringify({ error: "Invalid plan or interval" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const targetPriceId = PADDLE_PRICES[plan][interval];

    // Lookup user agency + verify admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("agency_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.agency_id) {
      return new Response(
        JSON.stringify({ error: "No agency found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("agency_id", profile.agency_id)
      .maybeSingle();

    if (roleRow?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the active Paddle subscription for this customer
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: agency } = await adminClient
      .from("agencies")
      .select("paddle_customer_id")
      .eq("id", profile.agency_id)
      .single();

    const customerId = agency?.paddle_customer_id;
    if (!customerId) {
      return new Response(
        JSON.stringify({ error: "no_subscription", message: "No active subscription found." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch subscriptions for this customer
    const subListUrl = new URL("https://api.paddle.com/subscriptions");
    subListUrl.searchParams.set("customer_id", customerId);
    subListUrl.searchParams.set("status", "active,past_due,trialing");
    subListUrl.searchParams.set("per_page", "20");

    const subListRes = await fetch(subListUrl.toString(), {
      headers: { Authorization: `Bearer ${paddleApiKey}` },
    });

    if (!subListRes.ok) {
      const t = await subListRes.text();
      console.error("Paddle subscriptions list error:", subListRes.status, t);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscription" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subListData = await subListRes.json();
    const subs: Array<{ id: string; status: string }> = subListData?.data ?? [];
    const activeSub = subs.find((s) => s.status === "active")
      ?? subs.find((s) => s.status === "trialing")
      ?? subs[0];

    if (!activeSub) {
      return new Response(
        JSON.stringify({ error: "no_subscription", message: "No active subscription found." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Paddle's preview update endpoint
    const previewRes = await fetch(
      `https://api.paddle.com/subscriptions/${activeSub.id}/preview`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${paddleApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [{ price_id: targetPriceId, quantity: 1 }],
          proration_billing_mode: prorationMode,
        }),
      }
    );

    if (!previewRes.ok) {
      const errText = await previewRes.text();
      console.error("Paddle preview error:", previewRes.status, errText);
      return new Response(
        JSON.stringify({
          error: "preview_failed",
          message: "Could not generate a proration preview. You can still continue to the customer portal.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const preview = await previewRes.json();
    const data = preview?.data ?? {};
    const immediate = data?.immediate_transaction ?? null;
    const nextTx = data?.next_transaction ?? null;
    const totals = immediate?.details?.totals ?? null;
    const lineItems = immediate?.details?.line_items ?? [];

    // Sum proration amounts (negative = credit, positive = charge)
    const grandTotal = totals?.grand_total ?? null; // minor units string
    const currency = immediate?.currency_code ?? nextTx?.details?.totals?.currency_code ?? "USD";

    return new Response(
      JSON.stringify({
        subscription_id: activeSub.id,
        currency,
        immediate: immediate
          ? {
              grand_total_minor: grandTotal,
              subtotal_minor: totals?.subtotal ?? null,
              tax_minor: totals?.tax ?? null,
              billing_period: immediate?.billing_period ?? null,
              line_items: lineItems.map((li: any) => ({
                description: li?.price?.description ?? li?.price?.name ?? "Line item",
                proration: li?.proration ?? null,
                totals: li?.totals ?? null,
              })),
            }
          : null,
        next_billing: nextTx
          ? {
              grand_total_minor: nextTx?.details?.totals?.grand_total ?? null,
              billed_at: nextTx?.billing_period?.starts_at ?? null,
              currency: nextTx?.currency_code ?? currency,
            }
          : null,
        proration_mode: prorationMode,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Preview change error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
