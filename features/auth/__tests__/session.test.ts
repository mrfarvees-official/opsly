import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createSessionToken,
  verifySessionToken,
} from "../infrastructure/session";

describe("session token", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "x".repeat(40));
  });

  it("round-trips a session", () => {
    const token = createSessionToken({ userId: "u1", tenantId: "t1" });

    expect(verifySessionToken(token)).toMatchObject({
      userId: "u1",
      tenantId: "t1",
    });
  });

  it("rejects a tampered token", () => {
    const token = createSessionToken({ userId: "u1", tenantId: "t1" });
    const [, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ userId: "u2", tenantId: "t1", exp: 9999999999 }),
    ).toString("base64url");

    expect(verifySessionToken(`${forged}.${signature}`)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = createSessionToken({ userId: "u1", tenantId: "t1" }, 0);

    expect(verifySessionToken(token, Date.now())).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const token = createSessionToken({ userId: "u1", tenantId: "t1" });
    vi.stubEnv("SESSION_SECRET", "y".repeat(40));

    expect(verifySessionToken(token)).toBeNull();
  });

  it("requires a long enough secret", () => {
    vi.stubEnv("SESSION_SECRET", "short");

    expect(() => createSessionToken({ userId: "u", tenantId: "t" })).toThrow(
      "SESSION_SECRET",
    );
  });
});
