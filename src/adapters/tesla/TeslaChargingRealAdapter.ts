import type { CanonicalDeviceCommand } from "../../application/controlLoopExecution/canonicalCommand";
import type { DeviceAdapterExecutionContext } from "../deviceAdapter";
import {
  BaseRealDeviceAdapter,
  type CanonicalAdapterCommandResult,
  type CanonicalAdapterError,
} from "../realDeviceAdapterContract";
import type {
  TeslaApiClient,
  TeslaChargeCommandTransportResponse,
  TeslaChargingTelemetryTransportResponse,
  TeslaTransportError,
} from "./TeslaApiClient";

export type TeslaChargeCommand = "START_CHARGE" | "STOP_CHARGE";

export interface TeslaChargingRealAdapterOptions {
  supportedVehicleIds: string[];
  client: TeslaApiClient;
}

function toTeslaChargeCommand(command: CanonicalDeviceCommand): TeslaChargeCommand | undefined {
  if (command.kind === "start_charging") {
    return "START_CHARGE";
  }

  if (command.kind === "stop_charging") {
    return "STOP_CHARGE";
  }

  return undefined;
}

/**
 * Narrow first Tesla real adapter for charging control + telemetry translation.
 *
 * Scope:
 * - commands: start_charging / stop_charging
 * - telemetry: charging status, connected state, charging power, SOC, timestamp
 */
export class TeslaChargingRealAdapter extends BaseRealDeviceAdapter<
  TeslaChargeCommandTransportResponse,
  TeslaChargingTelemetryTransportResponse,
  TeslaTransportError
> {
  readonly adapterId = "tesla-charging-real-adapter.v1";

  private readonly supportedVehicleIds: Set<string>;
  private readonly client: TeslaApiClient;

  constructor(options: TeslaChargingRealAdapterOptions) {
    super();
    this.supportedVehicleIds = new Set(options.supportedVehicleIds);
    this.client = options.client;
  }

  canHandle(targetDeviceId: string): boolean {
    return this.supportedVehicleIds.has(targetDeviceId);
  }

  async dispatchVendorCommand(
    command: CanonicalDeviceCommand,
    _context?: DeviceAdapterExecutionContext,
  ): Promise<TeslaChargeCommandTransportResponse> {
    if (!this.canHandle(command.targetDeviceId)) {
      throw {
        code: "UNSUPPORTED_DEVICE",
        message: "Vehicle not supported by Tesla charging adapter.",
      } as TeslaTransportError;
    }

    const teslaCommand = toTeslaChargeCommand(command);
    if (!teslaCommand) {
      return {
        result: false,
        reason: "UNSUPPORTED_COMMAND",
      };
    }

    if (teslaCommand === "START_CHARGE") {
      return this.client.startCharging({ vehicleId: command.targetDeviceId });
    }

    return this.client.stopCharging({ vehicleId: command.targetDeviceId });
  }

  mapVendorCommandResultToCanonical(
    command: CanonicalDeviceCommand,
    vendorResult: TeslaChargeCommandTransportResponse,
    _context?: DeviceAdapterExecutionContext,
  ): CanonicalAdapterCommandResult {
    if (vendorResult.result) {
      return {
        targetDeviceId: command.targetDeviceId,
        status: "accepted",
        canonicalCommand: command,
        message: vendorResult.reason,
      };
    }

    return {
      targetDeviceId: command.targetDeviceId,
      status: "rejected",
      canonicalCommand: command,
      failureReasonCode: "COMMAND_REJECTED",
      message: vendorResult.reason ?? "Tesla command rejected.",
      adapterError: {
        code: "COMMAND_REJECTED",
        operation: "command_dispatch",
        retryable: false,
        message: vendorResult.reason,
        vendorCode: vendorResult.reason,
      },
    };
  }

  mapVendorTelemetryToCanonicalTelemetry(payload: TeslaChargingTelemetryTransportResponse) {
    const chargingStateRaw = payload.chargingState;
    const chargingState = chargingStateRaw === "Charging"
      ? "charging"
      : chargingStateRaw === "Stopped" || chargingStateRaw === "Complete"
        ? "idle"
        : chargingStateRaw === "Disconnected"
          ? "unknown"
          : undefined;

    const powerKw = payload.chargerPowerKw;
    const chargingPowerW = powerKw !== undefined ? powerKw * 1000 : undefined;

    const portLatch = payload.chargePortLatch;
    const evConnected = portLatch === "Engaged"
      ? true
      : portLatch === "Disengaged"
        ? false
        : undefined;

    return [
      {
        deviceId: payload.vehicleId,
        timestamp: payload.timestamp,
        batterySocPercent: payload.batteryLevel,
        evChargingPowerW: chargingPowerW,
        chargingState,
        evConnected,
        schemaVersion: "telemetry.v1",
      },
    ];
  }

  async readVendorChargingTelemetry(vehicleId: string): Promise<TeslaChargingTelemetryTransportResponse> {
    return this.client.readChargingTelemetry({ vehicleId });
  }

  mapVendorErrorToCanonical(error: TeslaTransportError, operation: "command_dispatch" | "telemetry_translation"): CanonicalAdapterError {
    if (error.code === "UNSUPPORTED_DEVICE") {
      return {
        code: "UNSUPPORTED_DEVICE",
        operation,
        retryable: false,
        message: error.message,
        vendorCode: error.code,
      };
    }

    if (error.code === "AUTH_FAILURE") {
      return {
        code: "UNAUTHORIZED",
        operation,
        retryable: false,
        message: error.message,
        vendorCode: error.code,
      };
    }

    if (error.code === "RATE_LIMIT") {
      return {
        code: "RATE_LIMITED",
        operation,
        retryable: true,
        message: error.message,
        vendorCode: error.code,
      };
    }

    if (error.code === "TIMEOUT") {
      return {
        code: "TIMEOUT",
        operation,
        retryable: true,
        message: error.message,
        vendorCode: error.code,
      };
    }

    if (error.code === "TEMPORARY_UNAVAILABLE") {
      return {
        code: "UNAVAILABLE",
        operation,
        retryable: true,
        message: error.message,
        vendorCode: error.code,
      };
    }

    if (error.code === "MALFORMED_RESPONSE") {
      return {
        code: "INVALID_VENDOR_RESPONSE",
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
      message: error.message ?? "Unknown Tesla vendor error.",
      vendorCode: error.code,
    };
  }
}
