import { describe, it, expect, vi, beforeEach } from "vitest";
import { connectDb } from "./connection";
import mongoose from "mongoose";

const { connectMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
}));

vi.mock("mongoose", () => ({
  default: {
    connection: { readyState: 0 },
    connect: (...args: unknown[]) => connectMock(...args),
    disconnect: () => Promise.resolve(),
  },
}));

// The real env schema validates production variables (AUTH_SECRET, …) that are
// absent in the test environment; this test only exercises the connection
// promise, so env is a stub.
vi.mock("@/infrastructure/config/env", () => ({
  env: { MONGODB_URI: "mongodb://mock" },
}));

const mockedConnection = mongoose as unknown as {
  connection: { readyState: number };
};

describe("connectDb (R14 hotfix — shared connection promise)", () => {
  beforeEach(() => {
    connectMock.mockReset();
    mockedConnection.connection.readyState = 0;
  });

  it("shares ONE connect() across concurrent cold-start callers (race fix)", async () => {
    connectMock.mockResolvedValue({} as never);

    const [a, b] = await Promise.all([connectDb(), connectDb()]);

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(a).toBeDefined();
    expect(b).toBeDefined();
  });

  it("clears the shared promise on failure so the next caller retries", async () => {
    connectMock
      .mockRejectedValueOnce(new Error("queryTxt ETIMEOUT"))
      .mockResolvedValueOnce({} as never);

    await expect(connectDb()).rejects.toThrow("queryTxt ETIMEOUT");
    await expect(connectDb()).resolves.toBeDefined();

    expect(connectMock).toHaveBeenCalledTimes(2);
  });

  it("short-circuits when the connection is already established", async () => {
    mockedConnection.connection.readyState = 1;

    await connectDb();

    expect(connectMock).not.toHaveBeenCalled();
  });
});