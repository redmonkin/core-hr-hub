import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.87.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Convert base64url to Uint8Array
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const rawData = atob(base64 + padding);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

// Import ECDSA key from raw VAPID private key
async function importPrivateKey(base64Key: string): Promise<CryptoKey> {
  // VAPID private key is 32 bytes (raw)
  const rawKey = base64UrlToUint8Array(base64Key);
  
  // Build JWK from raw private key bytes
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: base64Key,
    // We need x and y from the public key, derive from private
    x: "",
    y: "",
  };
  
  // For P-256, derive public key point from private key
  // Import as raw first to get the key, then re-export
  // Actually, let's use the JWK approach with the public key
  const pubKeyBytes = base64UrlToUint8Array(VAPID_PUBLIC_KEY);
  // Uncompressed public key: 0x04 || x (32 bytes) || y (32 bytes)
  const x = btoa(String.fromCharCode(...pubKeyBytes.slice(1, 33))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const y = btoa(String.fromCharCode(...pubKeyBytes.slice(33, 65))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  
  jwk.x = x;
  jwk.y = y;

  return await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

// Create JWT for VAPID
async function createVapidJwt(audience: string, privateKey: CryptoKey): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12 hours
    sub: "mailto:hr@peoplo.redmonk.in",
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    encoder.encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format for JWT
  const sigArray = new Uint8Array(signature);
  const sigB64 = btoa(String.fromCharCode(...sigArray)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return `${unsignedToken}.${sigB64}`;
}

// Send a single push notification
async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth_key: string },
  payload: { title: string; body: string; icon?: string; url?: string }
): Promise<boolean> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;

    const privateKey = await importPrivateKey(VAPID_PRIVATE_KEY);
    const jwt = await createVapidJwt(audience, privateKey);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Encoding": "identity",
        TTL: "86400",
        Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Push failed (${response.status}):`, text);
      return false;
    }
    await response.text();
    return true;
  } catch (error) {
    console.error("Push send error:", error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication: Verify the caller using a shared secret
    const pushSecret = req.headers.get("x-push-secret");
    const expectedSecret = Deno.env.get("CRON_SECRET");
    if (!expectedSecret || !pushSecret || pushSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: "Forbidden: invalid or missing x-push-secret" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user_ids, title, body, icon, url } = await req.json();

    if (!user_ids || !Array.isArray(user_ids) || !title || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_ids, title, body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending push to ${user_ids.length} users: "${title}"`);

    // Fetch push subscriptions for the given user_ids
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", user_ids);

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("No push subscriptions found for the given users");
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No subscriptions found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${subscriptions.length} subscriptions`);

    const payload = { title, body, icon: icon || "/pwa-192x192.png", url: url || "/" };
    let sent = 0;
    let failed = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subscriptions) {
      const success = await sendPushNotification(sub, payload);
      if (success) {
        sent++;
      } else {
        failed++;
        expiredEndpoints.push(sub.endpoint);
      }
    }

    // Clean up expired/invalid subscriptions
    if (expiredEndpoints.length > 0) {
      const { error: deleteError } = await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);

      if (deleteError) {
        console.error("Error cleaning up expired subscriptions:", deleteError);
      } else {
        console.log(`Cleaned up ${expiredEndpoints.length} expired subscriptions`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, failed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-push-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
