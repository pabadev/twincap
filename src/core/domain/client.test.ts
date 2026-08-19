import { describe, expect, it } from "vitest";
import { Client } from "./client";
import { ValidationError } from "./errors";

const DATE = new Date("2026-01-01T00:00:00Z");

describe("Client entity", () => {
  it("creates a valid client", () => {
    const client = new Client({
      id: "c1",
      userId: "u1",
      name: "Juan Pérez",
      phone: "+57 300 1234567",
      email: "juan@example.com",
      note: "Cliente frecuente",
      createdAt: DATE,
    });
    expect(client.id).toBe("c1");
    expect(client.userId).toBe("u1");
    expect(client.name).toBe("Juan Pérez");
    expect(client.phone).toBe("+57 300 1234567");
    expect(client.email).toBe("juan@example.com");
    expect(client.note).toBe("Cliente frecuente");
    expect(client.createdAt).toBe(DATE);
  });

  it("trims name and rejects empty", () => {
    const client = new Client({
      id: "c1",
      userId: "u1",
      name: "  Juan Pérez  ",
      phone: "",
      email: "",
      note: "",
      createdAt: DATE,
    });
    expect(client.name).toBe("Juan Pérez");

    expect(() =>
      new Client({
        id: "c2",
        userId: "u1",
        name: "   ",
        phone: "",
        email: "",
        note: "",
        createdAt: DATE,
      }),
    ).toThrow(ValidationError);
  });

  it("rejects empty id", () => {
    expect(() =>
      new Client({
        id: "",
        userId: "u1",
        name: "Juan",
        phone: "",
        email: "",
        note: "",
        createdAt: DATE,
      }),
    ).toThrow(ValidationError);
  });

  it("rejects empty userId", () => {
    expect(() =>
      new Client({
        id: "c1",
        userId: "",
        name: "Juan",
        phone: "",
        email: "",
        note: "",
        createdAt: DATE,
      }),
    ).toThrow(ValidationError);
  });

  it("allows empty phone, email, note", () => {
    const client = new Client({
      id: "c1",
      userId: "u1",
      name: "Juan",
      phone: "",
      email: "",
      note: "",
      createdAt: DATE,
    });
    expect(client.phone).toBe("");
    expect(client.email).toBe("");
    expect(client.note).toBe("");
  });

  it("trims phone, email, note", () => {
    const client = new Client({
      id: "c1",
      userId: "u1",
      name: "Juan",
      phone: "  +57 300 1234567  ",
      email: "  juan@example.com  ",
      note: "  notas  ",
      createdAt: DATE,
    });
    expect(client.phone).toBe("+57 300 1234567");
    expect(client.email).toBe("juan@example.com");
    expect(client.note).toBe("notas");
  });
});
