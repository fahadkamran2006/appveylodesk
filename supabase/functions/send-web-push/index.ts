import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Convert a URL-safe base64 string to a Uint8Array.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * Import VAPID private key as a CryptoKey (ECDSA P-256).
 */
async function importPrivateKey(base64Key: string): Promise<CryptoKey> {
  const raw = urlBase64ToUint8Array(base64Key);
  // Raw private key is 32 bytes; wrap it in PKCS8
  return await crypto.subtle.importKey(
    "pkcs8",
    buildPkcs8(raw),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

/**
 * Build a PKCS8 wrapper around a raw 32-byte EC private key.
 */
function buildPkcs8(rawKey: Uint8Array): ArrayBuffer {
  // ASN.1 prefix for PKCS8 EC P-256 private key
  const prefix = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86,
    0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  // Suffix with the public key parameter (empty — not needed for signing)
  const suffix = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00,
  ]);
  // We don't have the public key here, so we'll use importKey with JWK instead
  // Actually, let's use JWK approach which is simpler

  const result = new Uint8Array(prefix.length + rawKey.length + suffix.length + 65);
  result.set(prefix);
  result.set(rawKey, prefix.length);
  return result.buffer;
}

/**
 * Create a signed JWT for VAPID authentication.
 */
async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64: string,
  publicKeyBase64: string
): Promise<{ authorization: string; cryptoKey: string }> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: subject,
  };

  const encHeader = btoa(JSON.stringify(header))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const encPayload = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const unsignedToken = `${encHeader}.${encPayload}`;

  // Import private key as JWK
  const rawPrivate = urlBase64ToUint8Array(privateKeyBase64);
  
  // For ECDSA P-256, we need to derive public key x,y from the public key
  const rawPublic = urlBase64ToUint8Array(publicKeyBase64);
  // Uncompressed public key: 0x04 || x (32 bytes) || y (32 bytes)
  const x = rawPublic.slice(1, 33);
  const y = rawPublic.slice(33, 65);
  
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: btoa(String.fromCharCode(...x)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    y: btoa(String.fromCharCode(...y)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    d: btoa(String.fromCharCode(...rawPrivate)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  };
  
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format if needed
  const sigArray = new Uint8Array(signature);
  let rawSig: Uint8Array;
  if (sigArray.length === 64) {
    rawSig = sigArray;
  } else {
    // Parse DER
    rawSig = derToRaw(sigArray);
  }

  const encSignature = btoa(String.fromCharCode(...rawSig))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${unsignedToken}.${encSignature}`;

  return {
    authorization: `vapid t=${jwt}, k=${publicKeyBase64}`,
    cryptoKey: `p256ecdsa=${publicKeyBase64}`,
  };
}

function derToRaw(der: Uint8Array): Uint8Array {
  // DER: 0x30 <len> 0x02 <rlen> <r> 0x02 <slen> <s>
  const raw = new Uint8Array(64);
  let offset = 2; // skip 0x30 <len>
  
  // r
  offset++; // skip 0x02
  const rLen = der[offset++];
  const rStart = offset + (rLen > 32 ? rLen - 32 : 0);
  const rDst = 32 - Math.min(rLen, 32);
  raw.set(der.slice(rStart, offset + rLen), rDst);
  offset += rLen;
  
  // s
  offset++; // skip 0x02
  const sLen = der[offset++];
  const sStart = offset + (sLen > 32 ? sLen - 32 : 0);
  const sDst = 32 + 32 - Math.min(sLen, 32);
  raw.set(der.slice(sStart, offset + sLen), sDst);
  
  return raw;
}

/**
 * Send a web push notification to a single subscription.
 */
async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ success: boolean; statusCode?: number; endpoint: string }> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;

    const vapid = await createVapidJwt(
      audience,
      vapidSubject,
      vapidPrivateKey,
      vapidPublicKey
    );

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapid.authorization,
        "Content-Type": "application/octet-stream",
        TTL: "86400",
      },
      body: payload,
    });

    return {
      success: response.status >= 200 && response.status < 300,
      statusCode: response.status,
      endpoint: subscription.endpoint,
    };
  } catch (error) {
    console.error("Push send error:", error);
    return { success: false, endpoint: subscription.endpoint };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { user_id, title, message, link, type } = await req.json();

    if (!user_id || !title || !message) {
      return new Response(
        JSON.stringify({ error: "user_id, title, and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all push subscriptions for this user
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No subscriptions found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = JSON.stringify({ title, body: message, link, type });
    const vapidSubject = "mailto:support@veylodesk.com";

    const results = await Promise.all(
      subscriptions.map((sub) =>
        sendPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          vapidPublicKey,
          vapidPrivateKey,
          vapidSubject
        )
      )
    );

    // Clean up expired/invalid subscriptions (410 Gone or 404)
    const expiredEndpoints = results
      .filter((r) => r.statusCode === 410 || r.statusCode === 404)
      .map((r) => r.endpoint);

    if (expiredEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user_id)
        .in("endpoint", expiredEndpoints);
    }

    const successCount = results.filter((r) => r.success).length;

    return new Response(
      JSON.stringify({ sent: successCount, total: subscriptions.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Web push error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
