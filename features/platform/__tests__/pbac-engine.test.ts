import { describe, expect, it } from "vitest";

import { decide, type Policy } from "../application/pbac-engine";

const subject = {
  userId: "u1",
  email: "a@b.co",
  role: "member",
  teamIds: "t1",
};

const policy = (p: Partial<Policy>): Policy => ({
  id: "p",
  name: "p",
  description: null,
  effect: "allow",
  enabled: true,
  subjects: [{ kind: "everyone", value: null }],
  targets: [{ resource: "*", action: "*", resourceId: null }],
  conditions: [],
  ...p,
});

describe("decide", () => {
  it("denies by default", () => {
    expect(
      decide([], subject, { resource: "team", action: "view" }).allowed,
    ).toBe(false);
  });

  it("lets deny override allow", () => {
    const d = decide(
      [policy({ id: "a" }), policy({ id: "d", effect: "deny", name: "no" })],
      subject,
      { resource: "team", action: "delete" },
    );
    expect(d.allowed).toBe(false);
    expect(d.policyId).toBe("d");
  });

  it("evaluates attribute-to-attribute conditions", () => {
    const p = policy({
      conditions: [
        {
          attribute: "subject.teamIds",
          operator: "contains",
          value: "target.teamId",
          valueIsAttribute: true,
        },
      ],
    });
    expect(
      decide([p], subject, {
        resource: "team",
        action: "view",
        attributes: { teamId: "t1" },
      }).allowed,
    ).toBe(true);
    expect(
      decide([p], subject, {
        resource: "team",
        action: "view",
        attributes: { teamId: "t2" },
      }).allowed,
    ).toBe(false);
  });

  it("treats a missing attribute as a failed condition", () => {
    const p = policy({
      conditions: [
        {
          attribute: "target.teamId",
          operator: "eq",
          value: "t1",
          valueIsAttribute: false,
        },
      ],
    });
    expect(
      decide([p], subject, { resource: "team", action: "view" }).allowed,
    ).toBe(false);
  });
});
