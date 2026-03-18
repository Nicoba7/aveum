import { describe, expect, it } from "vitest";
import type { CanonicalDeviceCommand } from "../../application/controlLoopExecution/canonicalCommand";
import type { RealDeviceAdapterContract } from "../../adapters/realDeviceAdapterContract";

export interface RealDeviceAdapterContractHarnessConfig<
  TVendorCommandResult,
  TVendorTelemetryPayload,
  TVendorError,
> {
  suiteName: string;
  createAdapter: () => RealDeviceAdapterContract<TVendorCommandResult, TVendorTelemetryPayload, TVendorError>;
  supportedDeviceId: string;
  unsupportedDeviceId: string;
  canonicalCommand: CanonicalDeviceCommand;
  vendorTelemetryPayload: TVendorTelemetryPayload;
  vendorErrorSample: TVendorError;
}

export function runRealDeviceAdapterContractHarness<
  TVendorCommandResult,
  TVendorTelemetryPayload,
  TVendorError,
>(
  config: RealDeviceAdapterContractHarnessConfig<
    TVendorCommandResult,
    TVendorTelemetryPayload,
    TVendorError
  >,
): void {
  describe(config.suiteName, () => {
    it("supports deterministic device capability routing", () => {
      const adapter = config.createAdapter();

      expect(adapter.canHandle(config.supportedDeviceId)).toBe(true);
      expect(adapter.canHandle(config.unsupportedDeviceId)).toBe(false);
    });

    it("maps vendor command dispatch result into canonical adapter command result shape", async () => {
      const adapter = config.createAdapter();
      const vendorResult = await adapter.dispatchVendorCommand(config.canonicalCommand, {
        executionRequestId: "exec-1",
        idempotencyKey: "idem-1",
      });
      const mapped = adapter.mapVendorCommandResultToCanonical(
        config.canonicalCommand,
        vendorResult,
      );

      expect(mapped.targetDeviceId).toBe(config.canonicalCommand.targetDeviceId);
      expect(mapped.canonicalCommand).toBe(config.canonicalCommand);
      expect(["accepted", "rejected", "failed"]).toContain(mapped.status);
    });

    it("translates vendor telemetry payload into canonical telemetry events", () => {
      const adapter = config.createAdapter();
      const telemetry = adapter.mapVendorTelemetryToCanonicalTelemetry(config.vendorTelemetryPayload);

      expect(Array.isArray(telemetry)).toBe(true);
      expect(telemetry.length).toBeGreaterThan(0);
      telemetry.forEach((event) => {
        expect(event.deviceId).toBeTruthy();
        expect(event.timestamp).toBeTruthy();
        expect(event.schemaVersion).toBeTruthy();
      });
    });

    it("maps vendor errors into canonical adapter errors", () => {
      const adapter = config.createAdapter();
      const mappedError = adapter.mapVendorErrorToCanonical(
        config.vendorErrorSample,
        "command_dispatch",
      );

      expect(mappedError.code).toBeTruthy();
      expect(mappedError.operation).toBe("command_dispatch");
      expect(typeof mappedError.retryable).toBe("boolean");
    });

    it("returns canonical failure result when execution throws vendor error", async () => {
      const adapter = config.createAdapter();
      const unsupportedCommand = {
        ...config.canonicalCommand,
        targetDeviceId: config.unsupportedDeviceId,
      };

      const result = await adapter.executeCanonicalCommand(unsupportedCommand);

      expect(result.status).toBe("failed");
      expect(result.canonicalCommand).toEqual(unsupportedCommand);
      expect(result.failureReasonCode).toBeDefined();
    });
  });
}
