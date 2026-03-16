import type {
  DeviceAdapter,
  DeviceAdapterExecutionContext,
  DeviceAdapterExecutionResult,
} from "../../adapters/deviceAdapter";
import type { CanonicalDeviceCommand } from "../../application/controlLoopExecution/canonicalCommand";

export type SimulatedOutcome = "accepted" | "failed" | "rejected";

export interface SimulatedEnergyAdapterTraceEntry {
  cycleLabel: string;
  targetDeviceId: string;
  commandKind: CanonicalDeviceCommand["kind"];
  outcome: SimulatedOutcome;
}

export interface SimulatedEnergyAdapterScenario {
  cycleLabel: string;
  outcomesByDeviceId?: Record<string, SimulatedOutcome>;
}

export class SimulatedEnergyAdapter implements DeviceAdapter {
  private activeCycleLabel = "A";
  public readonly trace: SimulatedEnergyAdapterTraceEntry[] = [];

  constructor(
    private readonly handledDeviceIds: Set<string>,
    private readonly scenarioByCycleLabel: Map<string, SimulatedEnergyAdapterScenario>,
  ) {}

  setActiveCycle(cycleLabel: string): void {
    this.activeCycleLabel = cycleLabel;
  }

  canHandle(targetDeviceId: string): boolean {
    return this.handledDeviceIds.has(targetDeviceId);
  }

  async executeCanonicalCommand(
    command: CanonicalDeviceCommand,
    _context?: DeviceAdapterExecutionContext,
  ): Promise<DeviceAdapterExecutionResult> {
    const scenario = this.scenarioByCycleLabel.get(this.activeCycleLabel);
    const outcome = scenario?.outcomesByDeviceId?.[command.targetDeviceId] ?? "accepted";

    this.trace.push({
      cycleLabel: this.activeCycleLabel,
      targetDeviceId: command.targetDeviceId,
      commandKind: command.kind,
      outcome,
    });

    if (outcome === "accepted") {
      return {
        targetDeviceId: command.targetDeviceId,
        status: "accepted",
        canonicalCommand: command,
      };
    }

    if (outcome === "rejected") {
      return {
        targetDeviceId: command.targetDeviceId,
        status: "rejected",
        canonicalCommand: command,
        failureReasonCode: "COMMAND_REJECTED",
        message: "Command rejected by simulated adapter scenario.",
      };
    }

    return {
      targetDeviceId: command.targetDeviceId,
      status: "failed",
      canonicalCommand: command,
      failureReasonCode: "COMMAND_FAILED",
      message: "Command failed in simulated adapter scenario.",
    };
  }
}
