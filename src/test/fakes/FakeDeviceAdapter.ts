import type {
  DeviceAdapter,
  DeviceAdapterExecutionContext,
  DeviceAdapterExecutionResult,
  DeviceAdapterExecutionStatus,
} from "../../adapters/deviceAdapter";
import type { CanonicalDeviceCommand } from "../../application/controlLoopExecution/canonicalCommand";

export interface FakeDeviceAdapterOptions {
  supportedDeviceIds: string[];
  status?: DeviceAdapterExecutionStatus;
  message?: string;
}

export class FakeDeviceAdapter implements DeviceAdapter {
  readonly received: Array<{
    command: CanonicalDeviceCommand;
    context?: DeviceAdapterExecutionContext;
  }> = [];

  private readonly supportedDeviceIds: Set<string>;
  private readonly status: DeviceAdapterExecutionStatus;
  private readonly message?: string;

  constructor(options: FakeDeviceAdapterOptions) {
    this.supportedDeviceIds = new Set(options.supportedDeviceIds);
    this.status = options.status ?? "accepted";
    this.message = options.message;
  }

  canHandle(targetDeviceId: string): boolean {
    return this.supportedDeviceIds.has(targetDeviceId);
  }

  async executeCanonicalCommand(
    command: CanonicalDeviceCommand,
    context?: DeviceAdapterExecutionContext,
  ): Promise<DeviceAdapterExecutionResult> {
    this.received.push({ command, context });

    if (!this.canHandle(command.targetDeviceId)) {
      return {
        targetDeviceId: command.targetDeviceId,
        status: "rejected",
        canonicalCommand: command,
        failureReasonCode: "UNSUPPORTED_DEVICE",
        message: "Fake adapter does not support this device.",
      };
    }

    return {
      targetDeviceId: command.targetDeviceId,
      status: this.status,
      canonicalCommand: command,
      failureReasonCode: this.status === "failed" ? "COMMAND_FAILED" : undefined,
      message: this.message,
    };
  }
}
