import { describe, expect, it } from "vitest";
import {
  TeslaSingleRunBootstrapError,
  bootstrapTeslaSingleRunRuntimeFromSource,
  parseTeslaSingleRunRuntimeConfig,
} from "../application/runtime/teslaSingleRunBootstrap";

describe("parseTeslaSingleRunRuntimeConfig", () => {
  it("parses valid runtime source and applies timeout default", () => {
    const config = parseTeslaSingleRunRuntimeConfig({
      TESLA_ACCESS_TOKEN: "token-123",
      TESLA_VEHICLE_ID: "vehicle-abc",
    });

    expect(config).toEqual({
      accessToken: "token-123",
      vehicleId: "vehicle-abc",
      baseUrl: undefined,
      timeoutMs: 10_000,
    });
  });

  it("throws when token is missing", () => {
    expect(() =>
      parseTeslaSingleRunRuntimeConfig({
        TESLA_VEHICLE_ID: "vehicle-abc",
      }),
    ).toThrowError(new TeslaSingleRunBootstrapError("MISSING_ACCESS_TOKEN", "TESLA_ACCESS_TOKEN is required."));
  });

  it("throws when vehicle id is missing", () => {
    expect(() =>
      parseTeslaSingleRunRuntimeConfig({
        TESLA_ACCESS_TOKEN: "token-123",
      }),
    ).toThrowError(new TeslaSingleRunBootstrapError("MISSING_VEHICLE_ID", "TESLA_VEHICLE_ID is required."));
  });

  it("throws for invalid timeout", () => {
    expect(() =>
      parseTeslaSingleRunRuntimeConfig({
        TESLA_ACCESS_TOKEN: "token-123",
        TESLA_VEHICLE_ID: "vehicle-abc",
        TESLA_TIMEOUT_MS: "invalid",
      }),
    ).toThrowError(new TeslaSingleRunBootstrapError("INVALID_TIMEOUT_MS", "TESLA_TIMEOUT_MS must be a positive number."));
  });

  it("throws for invalid base url", () => {
    expect(() =>
      parseTeslaSingleRunRuntimeConfig({
        TESLA_ACCESS_TOKEN: "token-123",
        TESLA_VEHICLE_ID: "vehicle-abc",
        TESLA_BASE_URL: "not-a-url",
      }),
    ).toThrowError(new TeslaSingleRunBootstrapError("INVALID_BASE_URL", "TESLA_BASE_URL must be a valid URL."));
  });
});

describe("bootstrapTeslaSingleRunRuntimeFromSource", () => {
  it("constructs runtime dependencies and binds vehicle id for runCycle", async () => {
    const runtime = bootstrapTeslaSingleRunRuntimeFromSource({
      TESLA_ACCESS_TOKEN: "token-123",
      TESLA_VEHICLE_ID: "vehicle-abc",
      TESLA_BASE_URL: "https://fleet-api.prd.vn.cloud.tesla.com",
      TESLA_TIMEOUT_MS: "15000",
    });

    expect(runtime.config).toEqual({
      accessToken: "token-123",
      vehicleId: "vehicle-abc",
      baseUrl: "https://fleet-api.prd.vn.cloud.tesla.com",
      timeoutMs: 15_000,
    });

    expect(typeof runtime.runCycle).toBe("function");
    expect(runtime.teslaAdapter.adapterId).toBe("tesla-charging-real-adapter.v1");
  });
});
