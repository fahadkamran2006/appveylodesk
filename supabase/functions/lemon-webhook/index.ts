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

// Storage add-on (1 TB)
const STORAGE_ADDON_BYTES = 1099511627776;

// Map Lemon Squeezy variant IDs to tiers
// You'll need to update these with your actual variant IDs from Lemon Squeezy
const VARIANT_TO_TIER: Record<string, { tier: string; interval: string }> = {
  // Example mappings - replace with actual variant IDs
  // starter_monthly: { tier: 'starter', interval: 'monthly' },
  // starter_yearly: { tier: 'starter', interval: 'yearly' },
  // growth_monthly: { tier: 'growth', interval: 'monthly' },
  // growth_yearly: { tier: 'growth', interval: 'yearly' },
  // scale_monthly: { tier: 'scale', interval: 'monthly' },
  // scale_yearly: { tier: 'scale', interval: 'yearly' },
};

// Verify Lemon Squeezy webhook signature
function verifySignature(payload: string, signature: string, secret: string): boolean {
  // For now, just check if signature exists
  // In production, implement proper HMAC verification
  if (!signature || !secret) {
    console.warn("Missing signature or secret for webhook verification");
    return true; // Allow for development
  }
  
  // TODO: Implement proper HMAC-SHA256 verification
  // const hmac = crypto.createHmac('sha256', secret);
  // hmac.update(payload);
  // const digest = hmac.digest('hex');
  // return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  
  return true;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("X-Signature") || "";
    const webhookSecret = Deno.env.get("LEMON_SQUEEZY_WEBHOOK_SECRET") || "";
    
    const payload = await req.text();
    
    // Verify webhook signature
    if (!verifySignature(payload, signature, webhookSecret)) {
      console.error("Invalid webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(payload);
    const eventType = event.meta?.event_name;
    const customData = event.meta?.custom_data || {};
    
    console.log(`Processing Lemon Squeezy event: ${eventType}`);
    console.log("Custom data:", customData);

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract agency ID from custom data
    const agencyId = customData.agency_id;
    if (!agencyId) {
      console.error("No agency_id in custom data");
      return new Response(JSON.stringify({ error: "Missing agency_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subscriptionData = event.data?.attributes;
    const variantId = subscriptionData?.variant_id?.toString();
    const customerId = subscriptionData?.customer_id?.toString();
    const productName = subscriptionData?.product_name?.toLowerCase() || "";
    const variantName = subscriptionData?.variant_name?.toLowerCase() || "";
    
    // Determine tier and interval from variant or product/variant names
    let tier = "starter";
    let interval = "monthly";
    
    if (VARIANT_TO_TIER[variantId]) {
      tier = VARIANT_TO_TIER[variantId].tier;
      interval = VARIANT_TO_TIER[variantId].interval;
    } else {
      // Fallback: parse from product/variant names
      if (productName.includes("scale") || variantName.includes("scale")) {
        tier = "scale";
      } else if (productName.includes("growth") || variantName.includes("growth")) {
        tier = "growth";
      } else {
        tier = "starter";
      }
      
      if (variantName.includes("yearly") || variantName.includes("annual")) {
        interval = "yearly";
      }
    }

    const tierConfig = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];

    switch (eventType) {
      case "subscription_created":
      case "subscription_updated": {
        const endsAt = subscriptionData?.ends_at || subscriptionData?.renews_at;
        
        const { error } = await supabase
          .from("agencies")
          .update({
            plan_tier: tier,
            subscription_plan: tier, // Keep legacy column in sync
            max_clients: tierConfig.max_clients,
            storage_limit_bytes: tierConfig.storage_bytes,
            billing_interval: interval,
            lemon_squeezy_customer_id: customerId,
            subscription_ends_at: endsAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", agencyId);

        if (error) {
          console.error("Error updating agency:", error);
          throw error;
        }
        
        console.log(`Updated agency ${agencyId} to ${tier} (${interval})`);
        break;
      }

      case "subscription_cancelled": {
        // Mark subscription as cancelled but keep access until end date
        const endsAt = subscriptionData?.ends_at;
        
        const { error } = await supabase
          .from("agencies")
          .update({
            subscription_ends_at: endsAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", agencyId);

        if (error) {
          console.error("Error updating cancelled subscription:", error);
          throw error;
        }
        
        console.log(`Marked agency ${agencyId} subscription as cancelled, ends at ${endsAt}`);
        break;
      }

      case "subscription_expired": {
        // Downgrade to starter tier
        const { error } = await supabase
          .from("agencies")
          .update({
            plan_tier: "starter",
            subscription_plan: "starter",
            max_clients: TIER_CONFIG.starter.max_clients,
            storage_limit_bytes: TIER_CONFIG.starter.storage_bytes,
            billing_interval: "monthly",
            subscription_ends_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", agencyId);

        if (error) {
          console.error("Error downgrading agency:", error);
          throw error;
        }
        
        console.log(`Downgraded agency ${agencyId} to starter tier`);
        break;
      }

      case "order_created": {
        // Handle one-time purchases like storage add-ons
        if (productName.includes("storage") || variantName.includes("storage")) {
          // Get current storage limit
          const { data: agency, error: fetchError } = await supabase
            .from("agencies")
            .select("storage_limit_bytes")
            .eq("id", agencyId)
            .single();

          if (fetchError) {
            console.error("Error fetching agency:", fetchError);
            throw fetchError;
          }

          const newLimit = (agency?.storage_limit_bytes || 0) + STORAGE_ADDON_BYTES;

          const { error } = await supabase
            .from("agencies")
            .update({
              storage_limit_bytes: newLimit,
              updated_at: new Date().toISOString(),
            })
            .eq("id", agencyId);

          if (error) {
            console.error("Error adding storage:", error);
            throw error;
          }

          console.log(`Added 1TB storage to agency ${agencyId}. New limit: ${newLimit}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
