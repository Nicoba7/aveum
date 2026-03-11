// api/givenergy.ts — Vercel serverless function
// Reads real-time solar, battery and grid data from GivEnergy inverter
// Deploy to: /api/givenergy.ts in your GitHub repo root

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  try {
    const apiKey = process.env.GIVENERGY_API_KEY;
    const serial = process.env.GIVENERGY_SERIAL;

    if (!apiKey || !serial) {
      return res.status(500).json({ error: "GIVENERGY_API_KEY or GIVENERGY_SERIAL not set" });
    }

    const response = await fetch(
      `https://api.givenergy.cloud/v1/inverter/${serial}/system-data/latest`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: "GivEnergy API error", status: response.status });
    }

    const raw = await response.json();
    const d = raw.data;

    // Normalise into Gridly's internal format
    return res.status(200).json({
      solar: {
        w: d.solar?.power ?? 0,
        todayKwh: d.solar?.today ?? 0,
      },
      battery: {
        pct: d.battery?.percent ?? 0,
        w: d.battery?.power ?? 0,          // positive = charging, negative = discharging
        temperatureC: d.battery?.temperature ?? null,
      },
      grid: {
        w: d.grid?.power ?? 0,             // positive = importing, negative = exporting
        todayImportKwh: d.grid?.today_import ?? 0,
        todayExportKwh: d.grid?.today_export ?? 0,
      },
      home: {
        w: d.consumption?.power ?? 0,
        todayKwh: d.consumption?.today ?? 0,
      },
      timestamp: d.time ?? new Date().toISOString(),
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
