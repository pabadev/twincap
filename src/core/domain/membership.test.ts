import { describe, expect, it } from "vitest";
import { Membership } from "./membership";
import { ValidationError } from "./errors";

const DATE = new Date("2026-01-01T00:00:00Z");

describe("Membership entity", () => {
  it("creates a valid membership with defaults", () => {
    const membership = new Membership({
      id: "m1",
      userId: "u1",
      workspaceId: "w1",
      createdAt: DATE,
    });
    expect(membership.id).toBe("m1");
    expect(membership.userId).toBe("u1");
    expect(membership.workspaceId).toBe("w1");
    expect(membership.role).toBe("member");
    expect(membership.status).toBe("active");
    expect(membership.createdAt).toBe(DATE);
  });

  it("accepts explicit role and status", () => {
    const membership = new Membership({
      id: "m1",
      userId: "u1",
      workspaceId: "w1",
      role: "admin",
      status: "invited",
      createdAt: DATE,
    });
    expect(membership.role).toBe("admin");
    expect(membership.status).toBe("invited");
  });

  it("toJSON returns a plain object with expected fields", () => {
    const membership = new Membership({
      id: "m1",
      userId: "u1",
      workspaceId: "w1",
      role: "owner",
      status: "active",
      createdAt: DATE,
    });
    expect(membership.toJSON()).toEqual({
      id: "m1",
      userId: "u1",
      workspaceId: "w1",
      role: "owner",
      status: "active",
      createdAt: DATE,
    });
  });

  it("rejects empty id", () => {
    expect(() =>
      new Membership({ id: "", userId: "u1", workspaceId: "w1", createdAt: DATE }),
    ).toThrow(ValidationError);
  });

  it("rejects empty userId", () => {
    expect(() =>
      new Membership({ id: "m1", userId: "", workspaceId: "w1", createdAt: DATE }),
    ).toThrow(ValidationError);
  });

  it("rejects empty workspaceId", () => {
    expect(() =>
      new Membership({ id: "m1", userId: "u1", workspaceId: "", createdAt: DATE }),
    ).toThrow(ValidationError);
  });

  it("rejects invalid role", () => {
    expect(() =>
      new Membership({
        id: "m1",
        userId: "u1",
        workspaceId: "w1",
        role: "superuser" as "member",
        createdAt: DATE,
      }),
    ).toThrow(ValidationError);
  });

  it("rejects invalid status", () => {
    expect(() =>
      new Membership({
        id: "m1",
        userId: "u1",
        workspaceId: "w1",
        status: "banned" as "active",
        createdAt: DATE,
      }),
    ).toThrow(ValidationError);
  });
});
