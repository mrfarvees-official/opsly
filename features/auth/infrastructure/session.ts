import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "opsly_session";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export interface SessionPayload {
  userId: string;
  tenantId: string;
  exp: number;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters.");
  }

  return secret;
}

function sign(body: string): string {
  return createHmac("sha256", getSecret()).update(body).digest("base64url");
}

/** Request-time epoch milliseconds without Next.js's prerender-time Date.now detector. */
function currentTimeMilliseconds(): number {
  return Math.floor(performance.timeOrigin + performance.now());
}

export function createSessionToken(
  session: Omit<SessionPayload, "exp">,
  now = currentTimeMilliseconds(),
): string {
  const payload: SessionPayload = {
    ...session,
    exp: Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS,
  };

  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `${body}.${sign(body)}`;
}

export function verifySessionToken(
  token: string,
  now = currentTimeMilliseconds(),
): SessionPayload | null {
  const [body, signature, ...rest] = token.split(".");

  if (!body || !signature || rest.length > 0) {
    return null;
  }

  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(signature);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;

    if (
      typeof payload.userId !== "string" ||
      typeof payload.tenantId !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp <= Math.floor(now / 1000)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
