import sampleDay from "./sampleDay";
import normalWeekday from "./normalWeekday";
import negativePriceDay from "./negativePriceDay";
import eveningSpikeDay from "./eveningSpikeDay";

export { sampleDayScenario } from "./sampleDay";
export { normalWeekdayScenario } from "./normalWeekday";
export { negativePriceDayScenario } from "./negativePriceDay";
export { eveningSpikeDayScenario } from "./eveningSpikeDay";

export { default as sampleDay } from "./sampleDay";
export { default as normalWeekday } from "./normalWeekday";
export { default as negativePriceDay } from "./negativePriceDay";
export { default as eveningSpikeDay } from "./eveningSpikeDay";

export const allScenarios = [
  sampleDay,
  normalWeekday,
  negativePriceDay,
  eveningSpikeDay,
];
