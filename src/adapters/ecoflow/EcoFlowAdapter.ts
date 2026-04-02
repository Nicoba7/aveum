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
  EcoFlowTransportError,
  type EcoFlowApiClient,
  type EcoFlowCommandResult,
  type EcoFlowDeviceQuota,
} from "./EcoFlowApiClient";

export type EcoFlowCapability = "read_soc" | "read_power" | "schedule_window";

export interface EcoFlowAdapterConfig {
  deviceId: string;
  accessKey: string;
  secretKey: string;
  deviceSn: string;
  client: EcoFlowApiClient;
}

export class EcoFlowAdapter extends BaseRealDeviceAdapter<
  EcoFlowCommandResult,
  EcoFlowDeviceQuota,
  EcoFlowTransportError
> {
  readonly adapterId = "ecoflow-adapter.v1";

  readonly capabilities: EcoFlowCapability[] = ["read_soc", "read_power", "schedule_window"];

  private readonly deviceId: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly deviceSn: string;
  private readonly client: EcoFlowApiClient;

  constructor(config: EcoFlowAdapterConfig) {
    super();
    this.deviceId = config.deviceId;
    this.accessKey = config.accessKey;
    this.secretKey = config.secretKey;
    this.deviceSn = config.deviceSn;
    this.client = config.client;
  }

  canHandle(targetDeviceId: string): boolean {
    return targetDeviceId === this.deviceId;
  }

  async readTelemetry(): Promise<CanonicalDeviceTelemetry[]> {
    this.assertCredentialsPresent();
    const quota = await this.client.getDeviceQuota(this.deviceSn);
    return this.mapVendorTelemetryToCanonicalTelemetry(quota);
  }

  async dispatchVendorCommand(
    command: CanonicalDeviceCommand,
    _context?: DeviceAdapterExecutionContext,
  ): Promise<EcoFlowCommandResult> {
    if (!this.canHandle(command.targetDeviceId)) {
      throw new EcoFlowTransportError(
        "UNSUPPORTED_DEVICE",
        `EcoFlow adapter does not handle device "${command.targetDeviceId}".`,
        undefined,
        false,
      );
    }

    this.assertCredentialsPresent();

    if (command.kind !== "schedule_window") {
      return {
        success: true,
        message: `Command kind "${command.kind}" acknowledged but not actioned by EcoFlow adapter.`,
      };
    }

    const startAt = new Date(command.effectiveWindow.startAt).getTime();
    const endAt = new Date(command.effectiveWindow.endAt).getTime();

    this.scheduleChargingSwitch(startAt, true);
    this.scheduleChargingSwitch(endAt, false);

    return {
      success: true,
      message: `Scheduled EcoFlow AC charging on at ${command.effectiveWindow.startAt} and off at ${command.effectiveWindow.endAt}.`,
    };
  }

  mapVendorCommandResultToCanonical(
    command: CanonicalDeviceCommand,
    vendorResult: EcoFlowCommandResult,
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
      message: vendorResult.message ?? "EcoFlow command rejected.",
      adapterError: {
        code: "COMMAND_REJECTED",
        operation: "command_dispatch",
        retryable: false,
        message: vendorResult.message,
      },
    };
  }

  mapVendorTelemetryToCanonicalTelemetry(quota: EcoFlowDeviceQuota): CanonicalDeviceTelemetry[] {
    const chargingState = quota.acChargingEnabled
      ? ("charging" as const)
      : ("idle" as const);

    return [
      {
        deviceId: this.deviceId,
        timestamp: new Date().toISOString(),
        batterySocPercent: quota.batterySocPercent,
        batteryPowerW: quota.acChargingEnabled ? Math.max(0, quota.gridPowerW) : undefined,
        chargingState,
        gridImportPowerW: quota.gridPowerW > 0 ? quota.gridPowerW : undefined,
        gridExportPowerW: quota.gridPowerW < 0 ? Math.abs(quota.gridPowerW) : undefined,
        schemaVersion: "telemetry.v1",
      },
    ];
  }

  mapVendorErrorToCanonical(
    error: EcoFlowTransportError,
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
    return { code: "UNKNOWN", operation, retryable: true, message: error.message ?? "Unknown EcoFlow error.", vendorCode: error.code };
  }

  private assertCredentialsPresent(): void {
    if (!this.accessKey.trim() || !this.secretKey.trim()) {
      throw new EcoFlowTransportError(
        "AUTH_FAILURE",
        "EcoFlow credentials are missing.",
        undefined,
        false,
      );
    }
  }

  private scheduleChargingSwitch(targetMs: number, enabled: boolean): void {
    const delayMs = Math.max(0, targetMs - Date.now());

    const runSwitch = () => {
      void this.client.setChargingSwitch(this.deviceSn, enabled).catch((error) => {
        console.error("EcoFlow charging switch failed", {
          deviceSn: this.deviceSn,
          enabled,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    };

    if (delayMs === 0) {
      runSwitch();
      return;
    }

    globalThis.setTimeout(runSwitch, delayMs);
  }
}
