// Shared-secret check for the database webhook (no Deno APIs, so it is unit-testable).

const encoder = new TextEncoder();

/** Constant-time string comparison (time depends only on the lengths). */
export function safeEqual(a: string, b: string): boolean {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** True when the Authorization header is `Bearer <secret>` and a secret is configured. */
export function isAuthorized(authorization: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  const bearer = (authorization ?? "").replace(/^Bearer\s+/i, "");
  return safeEqual(bearer, secret);
}
