import type { CanonicalDeviceCommand } from "../../application/controlLoopExecution/canonicalCommand";
import type { DeviceAdapterExecutionContext } from "../deviceAdapter";
import {
  BaseRealDeviceAdapter,
  type CanonicalAdapterCommandResult,
  type CanonicalAdapterError,
} from "../realDeviceAdapterContract";

export interface ExampleVendorCommandResult {
  accepted: boolean;
  providerStatus: "ok" | "rejected";
  providerCode?: string;
  detail?: string;
}

export interface ExampleVendorTelemetryPayload {
  deviceId: string;
  ts: string;
  batterySocPercent?: number;
  batteryPowerW?: number;
  evChargingPowerW?: number;
}

export interface ExampleVendorError {
  code?: string;
  message?: string;
}

export interface ExampleRealDeviceAdapterOptions {
  supportedDeviceIds: string[];
}

export class ExampleRealDeviceAdapter extends BaseRealDeviceAdapter<
  ExampleVendorCommandResult,
  ExampleVendorTelemetryPayload,
  ExampleVendorError
> {
  readonly adapterId = "example-real-adapter.v1";
  private readonly supportedDeviceIds: Set<string>;

  constructor(options: ExampleRealDeviceAdapterOptions) {
    super();
    this.supportedDeviceIds = new Set(options.supportedDeviceIds);
  }

  canHandle(targetDeviceId: string): boolean {
    return this.supportedDeviceIds.has(targetDeviceId);
  }

  async dispatchVendorCommand(
    command: CanonicalDeviceCommand,
    _context?: DeviceAdapterExecutionContext,
  ): Promise<ExampleVendorCommandResult> {
    if (!this.canHandle(command.targetDeviceId)) {
      throw {
        code: "UNSUPPORTED_DEVICE",
        message: "Target device is not handled by this adapter.",
      } satisfies ExampleVendorError;
    }

    if (command.kind === "set_mode" && command.mode === "eco") {
      return {
        accepted: false,
        providerStatus: "rejected",
        providerCode: "MODE_NOT_ALLOWED",
        detail: "Provider rejected requested mode.",
      };
    }

    return {
      accepted: true,
      providerStatus: "ok",
      providerCode: "ACCEPTED",
      detail: "Provider accepted command.",
    };
  }

  mapVendorCommandResultToCanonical(
    command: CanonicalDeviceCommand,
    vendorResult: ExampleVendorCommandResult,
    _context?: DeviceAdapterExecutionContext,
  ): CanonicalAdapterCommandResult {
    if (vendorResult.accepted && vendorResult.providerStatus === "ok") {
      return {
        targetDeviceId: command.targetDeviceId,
        status: "accepted",
        canonicalCommand: command,
        message: vendorResult.detail,
      };
    }

    return {
      targetDeviceId: command.targetDeviceId,
      status: "rejected",
      canonicalCommand: command,
      failureReasonCode: "COMMAND_REJECTED",
      message: vendorResult.detail,
      adapterError: {
        code: "COMMAND_REJECTED",
        operation: "command_dispatch",
        retryable: false,
        message: vendorResult.detail,
        vendorCode: vendorResult.providerCode,
      },
    };
  }

  mapVendorTelemetryToCanonicalTelemetry(payload: ExampleVendorTelemetryPayload) {
    return [
      {
        deviceId: payload.deviceId,
        timestamp: payload.ts,
        batterySocPercent: payload.batterySocPercent,
        batteryPowerW: payload.batteryPowerW,
        evChargingPowerW: payload.evChargingPowerW,
        schemaVersion: "telemetry.v1",
      },
    ];
  }

  mapVendorErrorToCanonical(error: ExampleVendorError, operation: "command_dispatch" | "telemetry_translation"): CanonicalAdapterError {
    if (error.code === "UNSUPPORTED_DEVICE") {
      return {
        code: "UNSUPPORTED_DEVICE",
        operation,
        retryable: false,
        message: error.message,
        vendorCode: error.code,
      };
    }

    return {
      code: "UNKNOWN",
      operation,
      retryable: true,
      message: error.message ?? "Unknown vendor error.",
      vendorCode: error.code,
    };
  }
}
