// Constant-time secret comparison helpers.

const encoder = new TextEncoder();

// Compares two strings in constant time with respect to their contents.
// Both values are hashed first so that differing lengths don't short-circuit
// the comparison (and the length of the secret isn't leaked).
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

// True only when CRON_SECRET is configured and the request's x-cron-secret
// header matches it. Refuses everything when CRON_SECRET is unset.
export async function verifyCronSecret(req: Request): Promise<boolean> {
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected) return false;
  const provided = req.headers.get("x-cron-secret");
  if (!provided) return false;
  return await timingSafeEqual(provided, expected);
}
