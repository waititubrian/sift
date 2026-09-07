import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifies a per-source HMAC signature (header: X-Sift-Signature, hex-encoded
 * HMAC-SHA256 of the raw request body). If no secret is configured for the
 * source, the request is accepted unsigned — that's the default for the demo
 * form, and the point at which a real external webhook should get a secret.
 */
export function verifySignature(source: string, rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env[`INTAKE_SECRET_${source.toUpperCase()}`];
  if (!secret) return true;
  if (!signatureHeader) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const givenBuf = Buffer.from(signatureHeader, "hex");
  if (expectedBuf.length !== givenBuf.length) return false;
  return timingSafeEqual(expectedBuf, givenBuf);
}
