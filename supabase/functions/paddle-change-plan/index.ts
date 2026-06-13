import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const paddleApiKey = Deno.env.get("PADDLE_API_KEY");

    if (!paddleApiKey) {
      return new Response(JSON.stringify({ error: "Billing service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    let body: { plan?: string; interval?: string; proration_mode?: string } = {};
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const plan = String(body.plan || "");
    const interval = String(body.interval || "");
    const prorationMode = body.proration_mode === "do_not_bill"
      ? "do_not_bill"
      : "prorated_immediately";

    if (!PADDLE_PRICES[plan]?.[interval]) {
      return new Response(JSON.stringify({ error: "Invalid plan or interval" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const targetPriceId = PADDLE_PRICES[plan][interval];

    // Resolve agency + verify admin
    const { data: roleRow } = await adminClient
      .from("user_roles")
      .select("agency_id, role")
      .eq("user_id", userId)
      .not("agency_id", "is", null)
      .limit(1)
      .maybeSingle();

    if (!roleRow?.agency_id) {
      return new Response(JSON.stringify({ error: "No agency found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (roleRow.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: agency } = await adminClient
      .from("agencies")
      .select("paddle_customer_id")
      .eq("id", roleRow.agency_id)
      .single();

    const customerId = agency?.paddle_customer_id;
    if (!customerId) {
      return new Response(JSON.stringify({
        error: "no_subscription",
        message: "No active subscription. Please subscribe first.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find active subscription
    const subListUrl = new URL("https://api.paddle.com/subscriptions");
    subListUrl.searchParams.set("customer_id", customerId);
    subListUrl.searchParams.set("status", "active,past_due,trialing");
    subListUrl.searchParams.set("per_page", "20");

    const subListRes = await fetch(subListUrl.toString(), {
      headers: { Authorization: `Bearer ${paddleApiKey}` },
    });

    if (!subListRes.ok) {
      const t = await subListRes.text();
      console.error("Paddle subs list error:", subListRes.status, t);
      return new Response(JSON.stringify({ error: "Failed to fetch subscription" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subListData = await subListRes.json();
    const subs: Array<{ id: string; status: string }> = subListData?.data ?? [];
    const activeSub = subs.find((s) => s.status === "active")
      ?? subs.find((s) => s.status === "trialing")
      ?? subs[0];

    if (!activeSub) {
      return new Response(JSON.stringify({
        error: "no_subscription",
        message: "No active subscription found.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update subscription items
    const updateRes = await fetch(
      `https://api.paddle.com/subscriptions/${activeSub.id}`,
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

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error("Paddle update error:", updateRes.status, errText);
      return new Response(JSON.stringify({
        error: "update_failed",
        message: "Could not update your plan. Please try again or contact support.",
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Plan changed to ${plan} (${interval}). Changes take effect immediately.`,
      subscription_id: activeSub.id,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    console.error("Change plan error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
