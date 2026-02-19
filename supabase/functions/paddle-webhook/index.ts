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

// Map Paddle Price IDs to tiers
const PRICE_TO_TIER: Record<string, { tier: string; interval: string }> = {
  "pri_01khrz050sv0w1a4ewyvv5arb1": { tier: "starter", interval: "monthly" },
  "pri_01khs05dqng1qr8xck4afwdf6y": { tier: "starter", interval: "yearly" },
  "pri_01khs06hcgeff068rncwjnqxns": { tier: "growth", interval: "monthly" },
  "pri_01khs0896ryegzxcpra0sxbnn6": { tier: "growth", interval: "yearly" },
  "pri_01khs09b0z4rm4mkz1wk3b38ms": { tier: "scale", interval: "monthly" },
  "pri_01khs0as29km3edtr84n7fxfbs": { tier: "scale", interval: "yearly" },
};

// Verify Paddle webhook signature using HMAC-SHA256
async function verifyPaddleSignature(
  signature: string,
  body: string,
  secret: string
): Promise<boolean> {
  try {
    // Parse Paddle-Signature header: ts=xxx;h1=xxx
    const parts: Record<string, string> = {};
    for (const part of signature.split(";")) {
      const [key, value] = part.split("=");
      if (key && value) parts[key.trim()] = value.trim();
    }

    const ts = parts["ts"];
    const h1 = parts["h1"];
    if (!ts || !h1) return false;

    // Build the signed payload
    const payload = `${ts}:${body}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payload)
    );

    const computedHex = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Timing-safe comparison
    if (computedHex.length !== h1.length) return false;
    let result = 0;
    for (let i = 0; i < computedHex.length; i++) {
      result |= computedHex.charCodeAt(i) ^ h1.charCodeAt(i);
    }
    return result === 0;
  } catch (err) {
    console.error("Signature verification error:", err);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const paddleSignature = req.headers.get("Paddle-Signature") || "";
    const webhookSecret = Deno.env.get("PADDLE_WEBHOOK_SECRET") || "";
    const body = await req.text();

    // Verify signature
    if (webhookSecret && paddleSignature) {
      const valid = await verifyPaddleSignature(paddleSignature, body, webhookSecret);
      if (!valid) {
        console.error("Invalid Paddle webhook signature");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const event = JSON.parse(body);
    const eventType = event.event_type;
    const subscriptionData = event.data;

    console.log(`Processing Paddle event: ${eventType}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract agency_id from custom_data
    const customData = subscriptionData?.custom_data || {};
    const customerId = subscriptionData?.customer_id;
    let agencyId = customData?.agency_id;

    // Fallback: look up by Paddle customer ID
    if (!agencyId && customerId) {
      console.log(`No agency_id in custom_data, looking up by customer_id: ${customerId}`);
      const { data: agency } = await supabase
        .from("agencies")
        .select("id")
        .eq("paddle_customer_id", customerId)
        .maybeSingle();
      agencyId = agency?.id;
    }

    if (!agencyId) {
      console.error("Could not determine agency_id");
      return new Response(JSON.stringify({ error: "Missing agency_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine tier from items price ID
    const items = subscriptionData?.items || [];
    let tier = "starter";
    let interval = "monthly";

    for (const item of items) {
      const priceId = item?.price?.id;
      if (priceId && PRICE_TO_TIER[priceId]) {
        tier = PRICE_TO_TIER[priceId].tier;
        interval = PRICE_TO_TIER[priceId].interval;
        break;
      }
    }

    const tierConfig = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];
    const status = subscriptionData?.status;

    switch (eventType) {
      case "subscription.created":
      case "subscription.updated":
      case "subscription.activated": {
        if (status === "canceled") {
          // Subscription was canceled
          const scheduledChange = subscriptionData?.scheduled_change;
          const endsAt = scheduledChange?.effective_at || subscriptionData?.current_billing_period?.ends_at;
          
          const { error } = await supabase
            .from("agencies")
            .update({
              subscription_ends_at: endsAt,
              paddle_customer_id: customerId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", agencyId);

          if (error) throw error;
          console.log(`Marked agency ${agencyId} as cancelled, ends at ${endsAt}`);
          break;
        }

        if (status === "past_due" || status === "paused") {
          console.log(`Subscription ${status} for agency ${agencyId}`);
          break;
        }

        // Active subscription
        const endsAt = subscriptionData?.current_billing_period?.ends_at ||
                       subscriptionData?.next_billed_at;

        const { error } = await supabase
          .from("agencies")
          .update({
            plan_tier: tier,
            subscription_plan: tier,
            max_clients: tierConfig.max_clients,
            storage_limit_bytes: tierConfig.storage_bytes,
            billing_interval: interval,
            paddle_customer_id: customerId,
            subscription_ends_at: endsAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", agencyId);

        if (error) throw error;
        console.log(`Updated agency ${agencyId} to ${tier} (${interval}), status: ${status}`);
        break;
      }

      case "subscription.canceled": {
        // Downgrade to starter
        const { error } = await supabase
          .from("agencies")
          .update({
            plan_tier: "starter",
            subscription_plan: "starter",
            max_clients: TIER_CONFIG.starter.max_clients,
            storage_limit_bytes: TIER_CONFIG.starter.storage_bytes,
            billing_interval: "monthly",
            subscription_ends_at: null,
            paddle_customer_id: customerId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", agencyId);

        if (error) throw error;
        console.log(`Downgraded agency ${agencyId} to starter (cancelled)`);
        break;
      }

      case "subscription.past_due": {
        console.log(`Subscription past due for agency ${agencyId}`);
        break;
      }

      case "transaction.completed": {
        console.log(`Transaction completed for agency ${agencyId}`);
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
