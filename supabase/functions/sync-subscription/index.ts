import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIER_CONFIG = {
  starter: { max_clients: 5, storage_bytes: 214748364800 },
  growth: { max_clients: 25, storage_bytes: 1099511627776 },
  scale: { max_clients: 999999, storage_bytes: 3298534883328 },
};

const PRICE_TO_TIER: Record<string, { tier: string; interval: string }> = {
  "pri_01khrz050sv0w1a4ewyvv5arb1": { tier: "starter", interval: "monthly" },
  "pri_01khs05dqng1qr8xck4afwdf6y": { tier: "starter", interval: "yearly" },
  "pri_01khs06hcgeff068rncwjnqxns": { tier: "growth", interval: "monthly" },
  "pri_01khwaq26mchmtmw4w9d0ffgrz": { tier: "growth", interval: "yearly" },
  "pri_01khs09b0z4rm4mkz1wk3b38ms": { tier: "scale", interval: "monthly" },
  "pri_01khs0as29km3edtr84n7fxfbs": { tier: "scale", interval: "yearly" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const paddleApiKey = Deno.env.get("PADDLE_API_KEY");

    if (!paddleApiKey) {
      return new Response(
        JSON.stringify({ error: "Billing API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userRole } = await adminClient
      .from("user_roles")
      .select("agency_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!userRole?.agency_id || userRole.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only admins can sync subscription" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: agency } = await adminClient
      .from("agencies")
      .select("paddle_customer_id")
      .eq("id", userRole.agency_id)
      .single();

    if (!agency?.paddle_customer_id) {
      return new Response(
        JSON.stringify({ error: "No subscription linked yet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch subscriptions from Paddle API
    const subsResponse = await fetch(
      `https://api.paddle.com/subscriptions?customer_id=${agency.paddle_customer_id}&status=active,trialing,past_due`,
      {
        headers: {
          "Authorization": `Bearer ${paddleApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!subsResponse.ok) {
      console.error("Paddle API error:", await subsResponse.text());
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscription" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subsData = await subsResponse.json();
    const subscriptions = subsData.data || [];

    const activeSub = subscriptions.find(
      (sub: any) => sub.status === "active" || sub.status === "trialing"
    ) || subscriptions[0];

    if (!activeSub) {
      // No active subscription - downgrade
      await adminClient
        .from("agencies")
        .update({
          plan_tier: "starter",
          subscription_plan: "starter",
          max_clients: TIER_CONFIG.starter.max_clients,
          storage_limit_bytes: TIER_CONFIG.starter.storage_bytes,
          subscription_ends_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userRole.agency_id);

      return new Response(
        JSON.stringify({ success: true, message: "No active subscription. Set to Starter.", tier: "starter" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine tier from price IDs
    let tier = "starter";
    let interval = "monthly";
    const items = activeSub.items || [];
    for (const item of items) {
      const priceId = item?.price?.id;
      if (priceId && PRICE_TO_TIER[priceId]) {
        tier = PRICE_TO_TIER[priceId].tier;
        interval = PRICE_TO_TIER[priceId].interval;
        break;
      }
    }

    const tierConfig = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];
    const endsAt = activeSub.current_billing_period?.ends_at || activeSub.next_billed_at;

    await adminClient
      .from("agencies")
      .update({
        plan_tier: tier,
        subscription_plan: tier,
        max_clients: tierConfig.max_clients,
        storage_limit_bytes: tierConfig.storage_bytes,
        billing_interval: interval,
        subscription_ends_at: endsAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userRole.agency_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Subscription synced. Plan: ${tier.charAt(0).toUpperCase() + tier.slice(1)}`,
        tier,
        interval,
        status: activeSub.status,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
