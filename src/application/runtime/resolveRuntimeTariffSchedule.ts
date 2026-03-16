import type { TariffRate, TariffSchedule } from "../../domain";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type RuntimeTariffSource = "simulated" | "octopus_live";

export interface RuntimeTariffSourceEnv {
  GRIDLY_TARIFF_SOURCE?: string;
  GRIDLY_OCTOPUS_REGION?: string;
  GRIDLY_OCTOPUS_PRODUCT?: string;
  GRIDLY_OCTOPUS_EXPORT_PRODUCT?: string;
  GRIDLY_OCTOPUS_EXPORT_TARIFF_CODE?: string;
}

export interface ResolveRuntimeTariffScheduleInput {
  now: Date;
  fallbackTariffSchedule: TariffSchedule;
  sourceEnv: RuntimeTariffSourceEnv;
  fetchFn?: FetchLike;
}

export interface RuntimeTariffResolution {
  tariffSchedule: TariffSchedule;
  source: RuntimeTariffSource;
  caveats: string[];
}

interface OctopusRateResult {
  valid_from: string;
  valid_to: string;
  value_inc_vat: number;
}

interface OctopusRatesResponse {
  results?: OctopusRateResult[];
}

function alignToHalfHour(input: Date): Date {
  const aligned = new Date(input);
  const minutes = aligned.getMinutes();
  const alignedMinutes = minutes < 30 ? 0 : 30;
  aligned.setMinutes(alignedMinutes, 0, 0);
  return aligned;
}

function toRuntimeTariffSource(raw: string | undefined): RuntimeTariffSource {
  if (!raw || raw.trim() === "") {
    return "simulated";
  }

  return raw.trim().toLowerCase() === "octopus_live" ? "octopus_live" : "simulated";
}

function buildOctopusUrl(now: Date, region: string, product: string): string {
  const from = alignToHalfHour(now);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  const tariffCode = `E-1R-${product}-${region}`;

  return `https://api.octopus.energy/v1/products/${product}/electricity-tariffs/${tariffCode}/standard-unit-rates/?period_from=${from.toISOString()}&period_to=${to.toISOString()}&page_size=96`;
}

function buildOctopusExportUrl(
  now: Date,
  region: string,
  product: string,
  explicitTariffCode?: string,
): string {
  const from = alignToHalfHour(now);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  const tariffCode = explicitTariffCode?.trim() || `G-1R-${product}-${region}`;

  return `https://api.octopus.energy/v1/products/${product}/electricity-tariffs/${tariffCode}/standard-unit-rates/?period_from=${from.toISOString()}&period_to=${to.toISOString()}&page_size=96`;
}

function mapOctopusImportRates(results: OctopusRateResult[]): TariffRate[] {
  return [...results]
    .sort((a, b) => new Date(a.valid_from).getTime() - new Date(b.valid_from).getTime())
    .map((rate) => ({
      startAt: rate.valid_from,
      endAt: rate.valid_to,
      unitRatePencePerKwh: Number(rate.value_inc_vat),
      source: "live" as const,
    }));
}

async function fetchOctopusLiveTariffSchedule(
  now: Date,
  env: RuntimeTariffSourceEnv,
  fallbackTariffSchedule: TariffSchedule,
  fetchFn?: FetchLike,
): Promise<{ tariffSchedule: TariffSchedule; caveats: string[] }> {
  const caveats: string[] = [];
  const region = env.GRIDLY_OCTOPUS_REGION?.trim() || "C";
  const product = env.GRIDLY_OCTOPUS_PRODUCT?.trim() || "AGILE-FLEX-22-11-25";
  const response = await (fetchFn ?? fetch)(buildOctopusUrl(now, region, product));

  if (!response.ok) {
    throw new Error(`Octopus tariff request failed (${response.status})`);
  }

  const payload = (await response.json()) as OctopusRatesResponse;
  const results = payload.results ?? [];

  if (!results.length) {
    throw new Error("Octopus tariff response did not include any rates.");
  }

  const exportProduct = env.GRIDLY_OCTOPUS_EXPORT_PRODUCT?.trim() || product;
  let exportRates: TariffRate[] | undefined;

  try {
    const exportResponse = await (fetchFn ?? fetch)(
      buildOctopusExportUrl(now, region, exportProduct, env.GRIDLY_OCTOPUS_EXPORT_TARIFF_CODE),
    );

    if (!exportResponse.ok) {
      throw new Error(`Octopus export tariff request failed (${exportResponse.status})`);
    }

    const exportPayload = (await exportResponse.json()) as OctopusRatesResponse;
    const exportResults = exportPayload.results ?? [];

    if (!exportResults.length) {
      throw new Error("Octopus export tariff response did not include any rates.");
    }

    exportRates = mapOctopusImportRates(exportResults);
    caveats.push("Using live Octopus export rates for this run.");
  } catch (error) {
    if (fallbackTariffSchedule.exportRates?.length) {
      exportRates = fallbackTariffSchedule.exportRates;
      caveats.push("Live Octopus export tariff fetch failed; using fallback export tariff schedule.");
    } else {
      caveats.push("Live Octopus export tariff fetch failed; export rates are unavailable for this run.");
    }

    caveats.push(error instanceof Error ? error.message : "Unknown export tariff fetch error.");
  }

  return {
    tariffSchedule: {
      tariffId: `octopus-agile-${region.toLowerCase()}`,
      provider: "Octopus",
      name: `Agile ${product}`,
      regionCode: region,
      currency: "GBP",
      updatedAt: now.toISOString(),
      importRates: mapOctopusImportRates(results),
      exportRates,
    },
    caveats,
  };
}

/**
 * Resolve runtime tariff schedule for canonical optimizer input.
 *
 * Uses live Octopus rates when requested, otherwise simulated tariff input.
 * If live fetch fails, falls back to simulated tariffs with explicit caveat.
 */
export async function resolveRuntimeTariffSchedule(
  input: ResolveRuntimeTariffScheduleInput,
): Promise<RuntimeTariffResolution> {
  const source = toRuntimeTariffSource(input.sourceEnv.GRIDLY_TARIFF_SOURCE);
  if (source !== "octopus_live") {
    return {
      tariffSchedule: input.fallbackTariffSchedule,
      source: "simulated",
      caveats: ["Using simulated tariff schedule for this run."],
    };
  }

  try {
    const liveResolution = await fetchOctopusLiveTariffSchedule(
      input.now,
      input.sourceEnv,
      input.fallbackTariffSchedule,
      input.fetchFn,
    );

    return {
      tariffSchedule: liveResolution.tariffSchedule,
      source: "octopus_live",
      caveats: ["Using live Octopus Agile import rates for this run.", ...liveResolution.caveats],
    };
  } catch (error) {
    return {
      tariffSchedule: input.fallbackTariffSchedule,
      source: "simulated",
      caveats: [
        "Live Octopus tariff fetch failed; fell back to simulated tariff schedule.",
        error instanceof Error ? error.message : "Unknown tariff fetch error.",
      ],
    };
  }
}
