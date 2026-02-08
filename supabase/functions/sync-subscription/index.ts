import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tier configuration mapping
const TIER_CONFIG = {
  starter: {
    max_clients: 5,
    storage_bytes: 214748364800, // 200 GB
  },
  growth: {
    max_clients: 25,
    storage_bytes: 1099511627776, // 1 TB
  },
  scale: {
    max_clients: 999999, // Unlimited
    storage_bytes: 3298534883328, // 3 TB
  },
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Client for user auth verification
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    // Service client for database updates
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's agency
    const { data: userRole, error: roleError } = await adminClient
      .from("user_roles")
      .select("agency_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError || !userRole?.agency_id) {
      return new Response(
        JSON.stringify({ error: "Could not find agency" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    if (userRole.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only admins can sync subscription" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get agency's Lemon Squeezy customer ID
    const { data: agency, error: agencyError } = await adminClient
      .from("agencies")
      .select("lemon_squeezy_customer_id, plan_tier, storage_limit_bytes, max_clients, subscription_ends_at")
      .eq("id", userRole.agency_id)
      .single();

    if (agencyError || !agency) {
      return new Response(
        JSON.stringify({ error: "Could not find agency" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!agency.lemon_squeezy_customer_id) {
      return new Response(
        JSON.stringify({ 
          error: "No subscription found", 
          message: "This agency does not have an active subscription linked yet."
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch customer subscriptions from Lemon Squeezy API
    const lemonApiKey = Deno.env.get("LEMON_SQUEEZY_API_KEY");
    if (!lemonApiKey) {
      console.error("LEMON_SQUEEZY_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Billing API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Query subscriptions for this customer
    const subscriptionsUrl = `https://api.lemonsqueezy.com/v1/subscriptions?filter[customer_id]=${agency.lemon_squeezy_customer_id}`;
    
    const lemonResponse = await fetch(subscriptionsUrl, {
      headers: {
        "Authorization": `Bearer ${lemonApiKey}`,
        "Accept": "application/vnd.api+json",
      },
    });

    if (!lemonResponse.ok) {
      console.error("Lemon Squeezy API error:", await lemonResponse.text());
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscription from billing provider" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lemonData = await lemonResponse.json();
    const subscriptions = lemonData.data || [];

    console.log(`Found ${subscriptions.length} subscriptions for customer ${agency.lemon_squeezy_customer_id}`);

    // Find the active subscription (or most recent)
    const activeSubscription = subscriptions.find(
      (sub: any) => sub.attributes.status === "active" || sub.attributes.status === "on_trial"
    ) || subscriptions[0];

    if (!activeSubscription) {
      // No active subscription - downgrade to starter or mark as expired
      const { error: updateError } = await adminClient
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

      if (updateError) {
        console.error("Error updating agency:", updateError);
        throw updateError;
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No active subscription found. Account has been set to Starter tier.",
          tier: "starter"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse subscription data
    const subAttributes = activeSubscription.attributes;
    const productName = (subAttributes.product_name || "").toLowerCase();
    const variantName = (subAttributes.variant_name || "").toLowerCase();
    const status = subAttributes.status;
    const endsAt = subAttributes.ends_at || subAttributes.renews_at;

    // Determine tier from product/variant name
    let tier = "starter";
    if (productName.includes("scale") || variantName.includes("scale")) {
      tier = "scale";
    } else if (productName.includes("growth") || variantName.includes("growth")) {
      tier = "growth";
    }

    // Determine billing interval
    let interval = "monthly";
    if (variantName.includes("yearly") || variantName.includes("annual")) {
      interval = "yearly";
    }

    const tierConfig = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];

    // Update agency
    const { error: updateError } = await adminClient
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

    if (updateError) {
      console.error("Error updating agency:", updateError);
      throw updateError;
    }

    console.log(`Synced agency ${userRole.agency_id} to ${tier} (${interval}), status: ${status}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Subscription synced successfully. Plan: ${tier.charAt(0).toUpperCase() + tier.slice(1)}`,
        tier,
        interval,
        status,
        renewsAt: endsAt
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Sync subscription error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
