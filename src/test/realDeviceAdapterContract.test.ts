import { describe, expect, it } from "vitest";
import { ExampleRealDeviceAdapter } from "../adapters/examples/ExampleRealDeviceAdapter";
import { runRealDeviceAdapterContractHarness } from "./harness/realDeviceAdapterContractHarness";

const command = {
  kind: "set_mode" as const,
  targetDeviceId: "battery",
  mode: "charge" as const,
  effectiveWindow: {
    startAt: "2026-03-16T10:00:00.000Z",
    endAt: "2026-03-16T10:30:00.000Z",
  },
};

runRealDeviceAdapterContractHarness({
  suiteName: "RealDeviceAdapterContract harness",
  createAdapter: () => new ExampleRealDeviceAdapter({ supportedDeviceIds: ["battery"] }),
  supportedDeviceId: "battery",
  unsupportedDeviceId: "ev",
  canonicalCommand: command,
  vendorTelemetryPayload: {
    deviceId: "battery",
    ts: "2026-03-16T10:05:00.000Z",
    batterySocPercent: 62,
  },
  vendorErrorSample: {
    code: "UNSUPPORTED_DEVICE",
    message: "unsupported",
  },
});

describe("ExampleRealDeviceAdapter", () => {
  it("maps provider command rejection into canonical COMMAND_REJECTED result", async () => {
    const adapter = new ExampleRealDeviceAdapter({ supportedDeviceIds: ["battery"] });
    const result = await adapter.executeCanonicalCommand({
      ...command,
      mode: "eco",
    });

    expect(result.status).toBe("rejected");
    expect(result.failureReasonCode).toBe("COMMAND_REJECTED");
  });

  it("maps vendor telemetry payload into canonical telemetry schema", () => {
    const adapter = new ExampleRealDeviceAdapter({ supportedDeviceIds: ["battery"] });
    const [event] = adapter.mapVendorTelemetryToCanonicalTelemetry({
      deviceId: "battery",
      ts: "2026-03-16T10:05:00.000Z",
      batterySocPercent: 63,
      batteryPowerW: -1200,
    });

    expect(event).toEqual({
      deviceId: "battery",
      timestamp: "2026-03-16T10:05:00.000Z",
      batterySocPercent: 63,
      batteryPowerW: -1200,
      evChargingPowerW: undefined,
      schemaVersion: "telemetry.v1",
    });
  });
});
