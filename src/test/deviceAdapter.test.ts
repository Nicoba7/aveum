import { describe, expect, it } from "vitest";
import type { CanonicalDeviceCommand } from "../application/controlLoopExecution/canonicalCommand";
import { FakeDeviceAdapter } from "./fakes/FakeDeviceAdapter";

function buildCanonicalCommand(
  overrides?: Partial<CanonicalDeviceCommand>,
): CanonicalDeviceCommand {
  return {
    kind: "set_mode",
    targetDeviceId: "battery",
    effectiveWindow: {
      startAt: "2026-03-16T10:00:00.000Z",
      endAt: "2026-03-16T10:30:00.000Z",
    },
    mode: "charge",
    ...overrides,
  } as CanonicalDeviceCommand;
}

describe("DeviceAdapter", () => {
  it("accepts commands for supported device ids", async () => {
    const adapter = new FakeDeviceAdapter({ supportedDeviceIds: ["battery"] });
    const command = buildCanonicalCommand();

    expect(adapter.canHandle("battery")).toBe(true);

    const result = await adapter.executeCanonicalCommand(command, {
      executionRequestId: "req-1",
      idempotencyKey: "key-1",
    });

    expect(result.status).toBe("accepted");
    expect(result.targetDeviceId).toBe("battery");
    expect(result.canonicalCommand).toBe(command);
  });

  it("rejects unsupported device ids", async () => {
    const adapter = new FakeDeviceAdapter({ supportedDeviceIds: ["battery"] });
    const command = buildCanonicalCommand({ targetDeviceId: "ev" });

    expect(adapter.canHandle("ev")).toBe(false);

    const result = await adapter.executeCanonicalCommand(command);

    expect(result.status).toBe("rejected");
    expect(result.failureReasonCode).toBe("UNSUPPORTED_DEVICE");
    expect(result.canonicalCommand).toBe(command);
  });

  it("preserves the canonical execution result shape", async () => {
    const adapter = new FakeDeviceAdapter({
      supportedDeviceIds: ["battery"],
      status: "failed",
      message: "Simulated failure",
    });
    const command = buildCanonicalCommand();

    const result = await adapter.executeCanonicalCommand(command, {
      decisionId: "decision-1",
      requestedAt: "2026-03-16T10:00:00.000Z",
    });

    expect(result).toEqual({
      targetDeviceId: "battery",
      status: "failed",
      canonicalCommand: command,
      failureReasonCode: "COMMAND_FAILED",
      message: "Simulated failure",
    });
  });

  it("passes canonical commands through unchanged", async () => {
    const adapter = new FakeDeviceAdapter({ supportedDeviceIds: ["battery"] });
    const command = buildCanonicalCommand({ mode: "discharge" });
    const context = {
      executionRequestId: "req-2",
      idempotencyKey: "key-2",
      decisionId: "decision-2",
      requestedAt: "2026-03-16T10:05:00.000Z",
    };

    await adapter.executeCanonicalCommand(command, context);

    expect(adapter.received).toHaveLength(1);
    expect(adapter.received[0].command).toBe(command);
    expect(adapter.received[0].context).toEqual(context);
  });
});
