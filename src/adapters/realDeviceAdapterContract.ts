import type { CanonicalDeviceCommand } from "../application/controlLoopExecution/canonicalCommand";
import type { CanonicalDeviceTelemetry } from "../domain/telemetry";
import type {
  DeviceAdapter,
  DeviceAdapterExecutionContext,
  DeviceAdapterExecutionResult,
  DeviceAdapterFailureReasonCode,
} from "./deviceAdapter";

export type AdapterOperation = "command_dispatch" | "telemetry_translation";

export type CanonicalAdapterErrorCode =
  | "UNSUPPORTED_DEVICE"
  | "COMMAND_REJECTED"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "UNAVAILABLE"
  | "INVALID_VENDOR_RESPONSE"
  | "UNKNOWN";

export interface CanonicalAdapterError {
  code: CanonicalAdapterErrorCode;
  operation: AdapterOperation;
  retryable: boolean;
  message?: string;
  vendorCode?: string;
}

export interface CanonicalAdapterCommandResult extends DeviceAdapterExecutionResult {
  adapterError?: CanonicalAdapterError;
}

/**
 * Strict contract for real hardware adapters.
 *
 * Boundaries:
 * - dispatchVendorCommand: provider I/O call only
 * - mapVendorCommandResultToCanonical: provider response -> canonical result mapping
 * - mapVendorTelemetryToCanonicalTelemetry: provider telemetry -> canonical telemetry mapping
 * - mapVendorErrorToCanonical: provider errors -> canonical adapter error mapping
 */
export interface RealDeviceAdapterContract<
  TVendorCommandResult = unknown,
  TVendorTelemetryPayload = unknown,
  TVendorError = unknown,
> extends DeviceAdapter {
  readonly adapterId: string;
  dispatchVendorCommand(
    command: CanonicalDeviceCommand,
    context?: DeviceAdapterExecutionContext,
  ): Promise<TVendorCommandResult>;
  mapVendorCommandResultToCanonical(
    command: CanonicalDeviceCommand,
    vendorResult: TVendorCommandResult,
    context?: DeviceAdapterExecutionContext,
  ): CanonicalAdapterCommandResult;
  mapVendorTelemetryToCanonicalTelemetry(payload: TVendorTelemetryPayload): CanonicalDeviceTelemetry[];
  mapVendorErrorToCanonical(error: TVendorError, operation: AdapterOperation): CanonicalAdapterError;
}

function mapAdapterErrorCodeToFailureReason(code: CanonicalAdapterErrorCode): DeviceAdapterFailureReasonCode {
  if (code === "UNSUPPORTED_DEVICE") {
    return "UNSUPPORTED_DEVICE";
  }

  if (code === "COMMAND_REJECTED") {
    return "COMMAND_REJECTED";
  }

  if (code === "INVALID_VENDOR_RESPONSE") {
    return "INVALID_COMMAND";
  }

  if (code === "UNKNOWN") {
    return "UNKNOWN_ERROR";
  }

  return "COMMAND_FAILED";
}

/**
 * Reusable base implementation that enforces canonical execute boundary behavior.
 */
export abstract class BaseRealDeviceAdapter<
  TVendorCommandResult = unknown,
  TVendorTelemetryPayload = unknown,
  TVendorError = unknown,
> implements RealDeviceAdapterContract<TVendorCommandResult, TVendorTelemetryPayload, TVendorError> {
  abstract readonly adapterId: string;

  abstract canHandle(targetDeviceId: string): boolean;

  abstract dispatchVendorCommand(
    command: CanonicalDeviceCommand,
    context?: DeviceAdapterExecutionContext,
  ): Promise<TVendorCommandResult>;

  abstract mapVendorCommandResultToCanonical(
    command: CanonicalDeviceCommand,
    vendorResult: TVendorCommandResult,
    context?: DeviceAdapterExecutionContext,
  ): CanonicalAdapterCommandResult;

  abstract mapVendorTelemetryToCanonicalTelemetry(payload: TVendorTelemetryPayload): CanonicalDeviceTelemetry[];

  abstract mapVendorErrorToCanonical(error: TVendorError, operation: AdapterOperation): CanonicalAdapterError;

  async executeCanonicalCommand(
    command: CanonicalDeviceCommand,
    context?: DeviceAdapterExecutionContext,
  ): Promise<DeviceAdapterExecutionResult> {
    try {
      const vendorResult = await this.dispatchVendorCommand(command, context);
      const canonicalResult = this.mapVendorCommandResultToCanonical(command, vendorResult, context);

      return {
        ...canonicalResult,
        targetDeviceId: command.targetDeviceId,
        canonicalCommand: command,
      };
    } catch (error) {
      const canonicalError = this.mapVendorErrorToCanonical(error as TVendorError, "command_dispatch");

      return {
        targetDeviceId: command.targetDeviceId,
        status: "failed",
        canonicalCommand: command,
        failureReasonCode: mapAdapterErrorCodeToFailureReason(canonicalError.code),
        message: canonicalError.message,
      };
    }
  }
}
