import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PaddleTransaction {
  id: string;
  status: string;
  invoice_number?: string | null;
  invoice_id?: string | null;
  billed_at?: string | null;
  created_at: string;
  currency_code: string;
  origin?: string;
  details?: {
    totals?: {
      grand_total?: string;
      tax?: string;
      subtotal?: string;
    };
  };
  items?: Array<{ price?: { description?: string; name?: string } }>;
}

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

    // Get user's agency: try profiles, fall back to user_roles
    const { data: profile } = await supabase
      .from("profiles")
      .select("agency_id")
      .eq("id", userId)
      .maybeSingle();

    let agencyId: string | null = profile?.agency_id ?? null;
    let role: string | null = null;

    if (!agencyId) {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("agency_id, role")
        .eq("user_id", userId)
        .not("agency_id", "is", null)
        .limit(1)
        .maybeSingle();
      agencyId = roleRow?.agency_id ?? null;
      role = roleRow?.role ?? null;
    }

    if (!agencyId) {
      return new Response(
        JSON.stringify({ transactions: [], message: "No billing history yet" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!role) {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("agency_id", agencyId)
        .maybeSingle();
      role = roleRow?.role ?? null;
    }

    if (role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: agency } = await adminClient
      .from("agencies")
      .select("paddle_customer_id")
      .eq("id", agencyId)
      .single();

    const customerId = agency?.paddle_customer_id;
    if (!customerId) {
      return new Response(
        JSON.stringify({ transactions: [], message: "No billing history yet" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch transactions from Paddle
    const url = new URL("https://api.paddle.com/transactions");
    url.searchParams.set("customer_id", customerId);
    url.searchParams.set("per_page", "50");
    url.searchParams.set("order_by", "billed_at[DESC]");

    const txResponse = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${paddleApiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!txResponse.ok) {
      const errorText = await txResponse.text();
      console.error("Paddle transactions error:", txResponse.status, errorText);
      // Return 200 with empty list so the UI doesn't crash. Common cause:
      // stale/invalid paddle_customer_id (e.g. sandbox vs. live mismatch).
      const isInvalidCustomer =
        txResponse.status === 400 && errorText.includes("customer_id");
      return new Response(
        JSON.stringify({
          transactions: [],
          error: isInvalidCustomer
            ? "Paddle customer not found. Try syncing your subscription."
            : "Could not load billing history from Paddle.",
          fallback: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const txData = await txResponse.json();
    const transactions: PaddleTransaction[] = txData?.data ?? [];

    // For each completed/billed transaction, fetch the hosted invoice PDF URL
    const enriched = await Promise.all(
      transactions.map(async (tx) => {
        let invoiceUrl: string | null = null;

        // Only completed/billed transactions have invoices available
        if (tx.status === "completed" || tx.status === "billed" || tx.status === "paid") {
          try {
            const invResponse = await fetch(
              `https://api.paddle.com/transactions/${tx.id}/invoice`,
              {
                method: "GET",
                headers: {
                  "Authorization": `Bearer ${paddleApiKey}`,
                  "Content-Type": "application/json",
                },
              }
            );
            if (invResponse.ok) {
              const invData = await invResponse.json();
              invoiceUrl = invData?.data?.url ?? null;
            }
          } catch (err) {
            console.warn(`Failed to fetch invoice for ${tx.id}:`, err);
          }
        }

        const description =
          tx.items?.[0]?.price?.description ||
          tx.items?.[0]?.price?.name ||
          "Subscription payment";

        return {
          id: tx.id,
          status: tx.status,
          invoice_number: tx.invoice_number ?? null,
          billed_at: tx.billed_at ?? tx.created_at,
          currency: tx.currency_code,
          grand_total: tx.details?.totals?.grand_total ?? "0",
          tax: tx.details?.totals?.tax ?? "0",
          subtotal: tx.details?.totals?.subtotal ?? "0",
          description,
          invoice_url: invoiceUrl,
          origin: tx.origin ?? null,
        };
      })
    );

    return new Response(
      JSON.stringify({ transactions: enriched }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Billing history error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
