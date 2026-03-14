import { useState, useEffect } from "react";

export type AgileRate = {
  time: string;
  pence: number;
};

export const AGILE_RATES: AgileRate[] = [
  { time: "00:00", pence: 7.2 }, { time: "00:30", pence: 6.8 },
  { time: "01:00", pence: 6.1 }, { time: "01:30", pence: 5.9 },
  { time: "02:00", pence: 5.4 }, { time: "02:30", pence: 5.1 },
  { time: "03:00", pence: 4.8 }, { time: "03:30", pence: 4.6 },
  { time: "04:00", pence: 4.9 }, { time: "04:30", pence: 5.3 },
  { time: "05:00", pence: 6.2 }, { time: "05:30", pence: 8.1 },
  { time: "06:00", pence: 12.4 }, { time: "06:30", pence: 18.7 },
  { time: "07:00", pence: 24.3 }, { time: "07:30", pence: 28.9 },
  { time: "08:00", pence: 31.2 }, { time: "08:30", pence: 29.4 },
  { time: "09:00", pence: 24.1 }, { time: "09:30", pence: 19.8 },
  { time: "10:00", pence: 16.2 }, { time: "10:30", pence: 13.4 },
  { time: "11:00", pence: 11.8 }, { time: "11:30", pence: 10.2 },
  { time: "12:00", pence: 9.6 },  { time: "12:30", pence: 8.9 },
  { time: "13:00", pence: 9.1 },  { time: "13:30", pence: 10.4 },
  { time: "14:00", pence: 11.2 }, { time: "14:30", pence: 12.8 },
  { time: "15:00", pence: 14.6 }, { time: "15:30", pence: 17.3 },
  { time: "16:00", pence: 22.1 }, { time: "16:30", pence: 27.8 },
  { time: "17:00", pence: 34.2 }, { time: "17:30", pence: 38.6 },
  { time: "18:00", pence: 35.4 }, { time: "18:30", pence: 29.7 },
  { time: "19:00", pence: 22.3 }, { time: "19:30", pence: 17.6 },
  { time: "20:00", pence: 14.2 }, { time: "20:30", pence: 11.8 },
  { time: "21:00", pence: 10.1 }, { time: "21:30", pence: 9.4 },
  { time: "22:00", pence: 8.7 },  { time: "22:30", pence: 8.1 },
  { time: "23:00", pence: 7.6 },  { time: "23:30", pence: 7.1 },
];
 
export type PricingState = "loading" | "live" | "fallback_live" | "sandbox";

// Octopus Agile public API — no auth required
// DNO region codes: A=Eastern, B=East Midlands, C=London, D=North Wales,
// E=West Midlands, F=North East, G=North West, H=Southern, J=South East,
// K=South Wales, L=South West, M=Yorkshire, N=South Scotland, P=North Scotland
const REGION = import.meta.env.VITE_OCTOPUS_REGION ?? "C"; // default London
const PRODUCT = "AGILE-FLEX-22-11-25";
 
function toHHMM(dateStr: string): string {
  const d = new Date(dateStr);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
 
export function useAgileRates(): { rates: AgileRate[]; loading: boolean; error: string | null; status: PricingState } {
  const [rates, setRates] = useState<AgileRate[]>(AGILE_RATES); // start with sandbox fallback
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<PricingState>("sandbox");
 
  useEffect(() => {
    const controller = new AbortController();
 
    async function fetchRates() {
      try {
        const today = new Date();
        const from = new Date(today);
        from.setHours(0, 0, 0, 0);
        const to = new Date(today);
        to.setHours(23, 30, 0, 0);
 
        const url = `https://api.octopus.energy/v1/products/${PRODUCT}/electricity-tariffs/E-1R-${PRODUCT}-${REGION}/standard-unit-rates/?period_from=${from.toISOString()}&period_to=${to.toISOString()}&page_size=48`;
 
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Octopus API error (${res.status})`);
 
        const data = await res.json();
        const results = data?.results ?? [];
 
        if (!results.length) throw new Error("No rates returned");
 
        // Octopus returns newest first — reverse and map to AgileRate
        const parsed: AgileRate[] = [...results]
          .reverse()
          .map((r: { valid_from: string; value_inc_vat: number }) => ({
            time: toHHMM(r.valid_from),
            pence: Math.round(r.value_inc_vat * 10) / 10,
          }));
 
        setRates(parsed);
        setError(null);
        setStatus("live");
      } catch (err: any) {
        if (err.name === "AbortError") return;
        // Silently fall back to sandbox data — user never sees a broken app
        setError("Using estimated prices — live prices unavailable right now");
        setStatus("fallback_live");
      } finally {
        setLoading(false);
      }
    }
 
    fetchRates();
    // Refresh every 30 minutes to catch new half-hour slots
    const interval = setInterval(fetchRates, 30 * 60 * 1000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);
 
  return { rates, loading, error, status };
}
