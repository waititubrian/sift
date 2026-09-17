import { createHmac, timingSafeEqual } from "crypto";

/** Sources with no configured secret accept unsigned requests. */
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
