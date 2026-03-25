interface RuntimeGroundedExplanationParams {
  drivers: string[];
  confidence?: string;
}

function parsePenceValue(pattern: RegExp, drivers: string[]): string | undefined {
  for (const driver of drivers) {
    const match = driver.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
}

export function buildRuntimeGroundedExplanationLines(params: RuntimeGroundedExplanationParams): string[] {
  const lines: string[] = [];

  const batteryValue = parsePenceValue(
    /^Stored energy is worth\s*([+-]?\d+(?:\.\d+)?)\s*p\/kWh right now\.?$/i,
    params.drivers,
  );
  if (batteryValue) {
    lines.push(`Battery value: ${batteryValue}p/kWh`);
  }

  const gridImportCost = parsePenceValue(
    /^Avoiding grid imports is worth\s*([+-]?\d+(?:\.\d+)?)\s*p\/kWh right now\.?$/i,
    params.drivers,
  );
  if (gridImportCost) {
    lines.push(`Grid import cost: ${gridImportCost}p/kWh`);
  }

  if (params.confidence) {
    lines.push(`Confidence: ${params.confidence.toLowerCase()}`);
  }

  return lines;
}
