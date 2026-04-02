import type { CanonicalDeviceCommand } from "../../application/controlLoopExecution/canonicalCommand";
import type { CanonicalDeviceTelemetry } from "../../domain/telemetry";
import type { DeviceAdapterExecutionContext } from "../deviceAdapter";
import {
  BaseRealDeviceAdapter,
  type AdapterOperation,
  type CanonicalAdapterCommandResult,
  type CanonicalAdapterError,
} from "../realDeviceAdapterContract";
import {
  ZappiTransportError,
  type ZappiApiClient,
  type ZappiChargeMode,
  type ZappiCommandResult,
  type ZappiStatusPayload,
} from "./ZappiApiClient";

export type ZappiCapability = "read_power" | "schedule_window";

export interface ZappiAdapterConfig {
  deviceId: string;
  hubSerial: string;
  apiKey: string;
  zappiSerial: string;
  client: ZappiApiClient;
}

export class ZappiAdapter extends BaseRealDeviceAdapter<
  ZappiCommandResult,
  ZappiStatusPayload,
  ZappiTransportError
> {
  readonly adapterId = "zappi-adapter.v1";

  readonly capabilities: ZappiCapability[] = ["read_power", "schedule_window"];

  private readonly deviceId: string;
  private readonly hubSerial: string;
  private readonly apiKey: string;
  private readonly zappiSerial: string;
  private readonly client: ZappiApiClient;

  constructor(config: ZappiAdapterConfig) {
    super();
    this.deviceId = config.deviceId;
    this.hubSerial = config.hubSerial;
    this.apiKey = config.apiKey;
    this.zappiSerial = config.zappiSerial;
    this.client = config.client;
  }

  canHandle(targetDeviceId: string): boolean {
    return targetDeviceId === this.deviceId;
  }

  // myenergi's director URL can change over time. Always resolve it dynamically
  // via login() before issuing command/telemetry requests.
  async readTelemetry(): Promise<CanonicalDeviceTelemetry[]> {
    await this.ensureLogin();
    const status = await this.client.getStatus(this.hubSerial, this.zappiSerial);
    return this.mapVendorTelemetryToCanonicalTelemetry(status);
  }

  async dispatchVendorCommand(
    command: CanonicalDeviceCommand,
    _context?: DeviceAdapterExecutionContext,
  ): Promise<ZappiCommandResult> {
    if (!this.canHandle(command.targetDeviceId)) {
      throw new ZappiTransportError(
        "UNSUPPORTED_DEVICE",
        `Zappi adapter does not handle device "${command.targetDeviceId}".`,
        undefined,
        false,
      );
    }

    await this.ensureLogin();

    if (command.kind !== "schedule_window") {
      return {
        success: true,
        message: `Command kind "${command.kind}" acknowledged but not actioned by Zappi adapter.`,
      };
    }

    const startAt = new Date(command.effectiveWindow.start).getTime();
    const endAt = new Date(command.effectiveWindow.end).getTime();

    this.scheduleModeSet(startAt, 1);
    this.scheduleModeSet(endAt, 4);

    return {
      success: true,
      message: `Scheduled Zappi Fast mode at ${command.effectiveWindow.start} and Stopped mode at ${command.effectiveWindow.end}.`,
    };
  }

  mapVendorCommandResultToCanonical(
    command: CanonicalDeviceCommand,
    vendorResult: ZappiCommandResult,
    _context?: DeviceAdapterExecutionContext,
  ): CanonicalAdapterCommandResult {
    if (vendorResult.success) {
      return {
        targetDeviceId: command.targetDeviceId,
        status: "accepted",
        canonicalCommand: command,
        message: vendorResult.message,
      };
    }

    return {
      targetDeviceId: command.targetDeviceId,
      status: "rejected",
      canonicalCommand: command,
      failureReasonCode: "COMMAND_REJECTED",
      message: vendorResult.message ?? "Zappi command rejected.",
      adapterError: {
        code: "COMMAND_REJECTED",
        operation: "command_dispatch",
        retryable: false,
        message: vendorResult.message,
      },
    };
  }

  mapVendorTelemetryToCanonicalTelemetry(status: ZappiStatusPayload): CanonicalDeviceTelemetry[] {
    const chargingState = !status.connected
      ? ("idle" as const)
      : status.powerW > 0
        ? ("charging" as const)
        : status.chargeMode === 4
          ? ("idle" as const)
          : ("unknown" as const);

    return [
      {
        deviceId: this.deviceId,
        timestamp: new Date().toISOString(),
        evChargingPowerW: status.powerW,
        chargingState,
        evConnected: status.connected,
        schemaVersion: "telemetry.v1",
      },
    ];
  }

  mapVendorErrorToCanonical(
    error: ZappiTransportError,
    operation: AdapterOperation,
  ): CanonicalAdapterError {
    if (error.code === "UNSUPPORTED_DEVICE") {
      return { code: "UNSUPPORTED_DEVICE", operation, retryable: false, message: error.message, vendorCode: error.code };
    }
    if (error.code === "AUTH_FAILURE") {
      return { code: "UNAUTHORIZED", operation, retryable: false, message: error.message, vendorCode: error.code };
    }
    if (error.code === "RATE_LIMIT") {
      return { code: "RATE_LIMITED", operation, retryable: true, message: error.message, vendorCode: error.code };
    }
    if (error.code === "TIMEOUT") {
      return { code: "TIMEOUT", operation, retryable: true, message: error.message, vendorCode: error.code };
    }
    if (error.code === "TEMPORARY_UNAVAILABLE") {
      return { code: "UNAVAILABLE", operation, retryable: true, message: error.message, vendorCode: error.code };
    }
    if (error.code === "MALFORMED_RESPONSE") {
      return { code: "INVALID_VENDOR_RESPONSE", operation, retryable: false, message: error.message, vendorCode: error.code };
    }
    return { code: "UNKNOWN", operation, retryable: true, message: error.message ?? "Unknown Zappi error.", vendorCode: error.code };
  }

  private async ensureLogin(): Promise<void> {
    await this.client.login(this.hubSerial, this.apiKey);
  }

  private scheduleModeSet(targetMs: number, mode: ZappiChargeMode): void {
    const delayMs = Math.max(0, targetMs - Date.now());

    if (delayMs === 0) {
      void this.client.setChargeMode(this.hubSerial, this.zappiSerial, mode).catch((error) => {
        console.error("Zappi mode set failed", {
          zappiSerial: this.zappiSerial,
          mode,
          error: error instanceof Error ? error.message : String(error),
        });
      });
      return;
    }

    globalThis.setTimeout(() => {
      void this.client.setChargeMode(this.hubSerial, this.zappiSerial, mode).catch((error) => {
        console.error("Zappi mode set failed", {
          zappiSerial: this.zappiSerial,
          mode,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, delayMs);
  }
}