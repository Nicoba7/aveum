import type { CanonicalDeviceObservedState } from "../domain/observedDeviceState";

export interface ObservedDeviceStateStore {
  getDeviceState(deviceId: string): CanonicalDeviceObservedState | undefined;
  setDeviceState(deviceId: string, state: CanonicalDeviceObservedState): void;
  getAllDeviceStates(): Record<string, CanonicalDeviceObservedState>;
}

export class InMemoryObservedDeviceStateStore implements ObservedDeviceStateStore {
  private readonly states = new Map<string, CanonicalDeviceObservedState>();

  getDeviceState(deviceId: string): CanonicalDeviceObservedState | undefined {
    const current = this.states.get(deviceId);
    return current ? { ...current } : undefined;
  }

  setDeviceState(deviceId: string, state: CanonicalDeviceObservedState): void {
    this.states.set(deviceId, { ...state });
  }

  getAllDeviceStates(): Record<string, CanonicalDeviceObservedState> {
    return [...this.states.entries()].reduce<Record<string, CanonicalDeviceObservedState>>((acc, [deviceId, state]) => {
      acc[deviceId] = { ...state };
      return acc;
    }, {});
  }
}
