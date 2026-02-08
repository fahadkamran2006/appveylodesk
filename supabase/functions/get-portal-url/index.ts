import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lemonApiKey = Deno.env.get("LEMON_SQUEEZY_API_KEY");

    if (!lemonApiKey) {
      console.error("LEMON_SQUEEZY_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Billing service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create authenticated Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user token
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("Token verification failed:", claimsError);
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log("Authenticated user:", userId);

    // Get user's agency_id from profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("agency_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile?.agency_id) {
      console.error("Profile fetch error:", profileError);
      return new Response(
        JSON.stringify({ error: "No agency found for user" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get agency's Lemon Squeezy customer ID using service role for security
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: agency, error: agencyError } = await adminClient
      .from("agencies")
      .select("lemon_squeezy_customer_id")
      .eq("id", profile.agency_id)
      .single();

    if (agencyError) {
      console.error("Agency fetch error:", agencyError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch agency data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const customerId = agency?.lemon_squeezy_customer_id;
    
    if (!customerId) {
      console.log("No Lemon Squeezy customer ID found for agency:", profile.agency_id);
      // Return fallback URL for agencies without a customer ID (not yet subscribed)
      return new Response(
        JSON.stringify({ 
          url: "https://veylodesk.lemonsqueezy.com/billing",
          fallback: true,
          message: "No subscription found. Please subscribe first."
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Fetching portal URL for customer:", customerId);

    // Fetch customer data from Lemon Squeezy to get portal URL
    const lemonResponse = await fetch(
      `https://api.lemonsqueezy.com/v1/customers/${customerId}`,
      {
        method: "GET",
        headers: {
          "Accept": "application/vnd.api+json",
          "Content-Type": "application/vnd.api+json",
          "Authorization": `Bearer ${lemonApiKey}`,
        },
      }
    );

    if (!lemonResponse.ok) {
      const errorText = await lemonResponse.text();
      console.error("Lemon Squeezy API error:", lemonResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch billing portal" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lemonData = await lemonResponse.json();
    const portalUrl = lemonData.data?.attributes?.urls?.customer_portal;

    if (!portalUrl) {
      console.warn("No portal URL in customer data, using fallback");
      // Fallback to store billing page
      return new Response(
        JSON.stringify({ 
          url: "https://veylodesk.lemonsqueezy.com/billing",
          fallback: true 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Successfully retrieved portal URL for customer:", customerId);

    return new Response(
      JSON.stringify({ url: portalUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Portal URL error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
