// api/octopus.ts — Vercel serverless function
// Fetches real Octopus Agile half-hourly prices for the next 24 hours
// Deploy to: /api/octopus.ts in your GitHub repo root

import type { VercelRequest, VercelResponse } from "@vercel/node";

const AGILE_PRODUCT = "AGILE-FLEX-22-11-25";
const AGILE_TARIFF = "E-1R-AGILE-FLEX-22-11-25-C";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow browser to call this endpoint
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  try {
    const apiKey = process.env.OCTOPUS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "OCTOPUS_API_KEY not set in environment" });
    }

    // Get tomorrow's date range for prices
    const now = new Date();
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 2);

    const url = `https://api.octopus.energy/v1/products/${AGILE_PRODUCT}/electricity-tariffs/${AGILE_TARIFF}/standard-unit-rates/?period_from=${from.toISOString()}&period_to=${to.toISOString()}&page_size=96`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: "Octopus API error", status: response.status });
    }

    const data = await response.json();

    // Transform into clean format sorted by time ascending
    const rates = data.results
      .map((r: any) => ({
        time: new Date(r.valid_from).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        validFrom: r.valid_from,
        validTo: r.valid_to,
        pence: parseFloat(r.value_inc_vat.toFixed(2)),
      }))
      .sort((a: any, b: any) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime());

    return res.status(200).json({
      rates,
      cheapest: rates.reduce((min: any, r: any) => r.pence < min.pence ? r : min, rates[0]),
      peak: rates.reduce((max: any, r: any) => r.pence > max.pence ? r : max, rates[0]),
      average: parseFloat((rates.reduce((s: number, r: any) => s + r.pence, 0) / rates.length).toFixed(2)),
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
