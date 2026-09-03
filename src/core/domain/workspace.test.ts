import { describe, expect, it } from "vitest";
import { Workspace } from "./workspace";
import { ValidationError } from "./errors";

const DATE = new Date("2026-01-01T00:00:00Z");

describe("Workspace entity", () => {
  it("creates a valid workspace with defaults", () => {
    const workspace = new Workspace({
      id: "w1",
      ownerId: "u1",
      name: "Mi negocio",
      createdAt: DATE,
    });
    expect(workspace.id).toBe("w1");
    expect(workspace.ownerId).toBe("u1");
    expect(workspace.name).toBe("Mi negocio");
    expect(workspace.country).toBeUndefined();
    expect(workspace.currency).toBeUndefined();
    expect(workspace.status).toBe("active");
    expect(workspace.createdAt).toBe(DATE);
  });

  it("accepts all optional fields and explicit status", () => {
    const workspace = new Workspace({
      id: "w1",
      ownerId: "u1",
      name: "Mi negocio",
      country: "CO",
      currency: "COP",
      status: "suspended",
      createdAt: DATE,
    });
    expect(workspace.country).toBe("CO");
    expect(workspace.currency).toBe("COP");
    expect(workspace.status).toBe("suspended");
  });

  it("trims name and optional country/currency", () => {
    const workspace = new Workspace({
      id: "w1",
      ownerId: "u1",
      name: "  Mi negocio  ",
      country: "  CO  ",
      currency: "  COP  ",
      createdAt: DATE,
    });
    expect(workspace.name).toBe("Mi negocio");
    expect(workspace.country).toBe("CO");
    expect(workspace.currency).toBe("COP");
  });

  it("toJSON returns a plain object with expected fields", () => {
    const workspace = new Workspace({
      id: "w1",
      ownerId: "u1",
      name: "Mi negocio",
      country: "CO",
      currency: "COP",
      status: "active",
      createdAt: DATE,
    });
    expect(workspace.toJSON()).toEqual({
      id: "w1",
      ownerId: "u1",
      name: "Mi negocio",
      country: "CO",
      currency: "COP",
      status: "active",
      createdAt: DATE,
    });
  });

  it("rejects empty id", () => {
    expect(() =>
      new Workspace({ id: "", ownerId: "u1", name: "Mi negocio", createdAt: DATE }),
    ).toThrow(ValidationError);
  });

  it("rejects empty ownerId", () => {
    expect(() =>
      new Workspace({ id: "w1", ownerId: "", name: "Mi negocio", createdAt: DATE }),
    ).toThrow(ValidationError);
  });

  it("rejects empty name", () => {
    expect(() =>
      new Workspace({ id: "w1", ownerId: "u1", name: "   ", createdAt: DATE }),
    ).toThrow(ValidationError);
  });

  it("rejects invalid status", () => {
    expect(() =>
      new Workspace({
        id: "w1",
        ownerId: "u1",
        name: "Mi negocio",
        status: "deleted" as "active",
        createdAt: DATE,
      }),
    ).toThrow(ValidationError);
  });
});
