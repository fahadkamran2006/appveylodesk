import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the caller via JWT
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = claimsData.claims.email;
    if (email !== "hello@fahadkamran.com") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to read cross-tenant data
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch agency stats via security definer function
    const { data: agencies, error: agenciesErr } = await supabase.rpc(
      "get_admin_agency_stats"
    );
    if (agenciesErr) throw agenciesErr;

    // Calculate MRR
    const planPrices: Record<string, number> = {
      starter: 29,
      growth: 79,
      scale: 149,
    };

    let totalMrr = 0;
    let totalStorageUsed = 0;
    let activeCount = 0;
    let churnedCount = 0;

    const agencyList = (agencies || []).map((a: any) => {
      const price = planPrices[a.plan_tier] || 0;
      const isActive =
        !a.subscription_ends_at ||
        new Date(a.subscription_ends_at) > new Date();
      if (isActive) {
        totalMrr += price;
        activeCount++;
      } else {
        churnedCount++;
      }
      totalStorageUsed += Number(a.storage_used_bytes || 0);

      const storagePercent =
        a.storage_limit_bytes > 0
          ? (Number(a.storage_used_bytes) / Number(a.storage_limit_bytes)) * 100
          : 0;

      return {
        id: a.agency_id,
        name: a.agency_name,
        plan_tier: a.plan_tier,
        subscription_plan: a.subscription_plan,
        subscription_ends_at: a.subscription_ends_at,
        storage_used_bytes: Number(a.storage_used_bytes),
        storage_limit_bytes: Number(a.storage_limit_bytes),
        storage_percent: Math.round(storagePercent * 10) / 10,
        client_count: Number(a.client_count),
        editor_count: Number(a.editor_count),
        revenue: price,
        is_active: isActive,
        created_at: a.created_at,
      };
    });

    // Fetch recent system logs
    const { data: logs } = await supabase
      .from("system_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    return new Response(
      JSON.stringify({
        total_mrr: totalMrr,
        total_agencies: agencyList.length,
        total_storage_used_bytes: totalStorageUsed,
        active_agencies: activeCount,
        churned_agencies: churnedCount,
        agencies: agencyList,
        recent_logs: logs || [],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("super-admin-stats error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
