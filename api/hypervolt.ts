// api/hypervolt.ts — Hypervolt EV charger
// Read charge status and set charge mode
// Deploy to: /api/hypervolt.ts in repo root

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  const apiKey = process.env.HYPERVOLT_API_KEY;
  const chargerId = process.env.HYPERVOLT_CHARGER_ID;

  if (!apiKey || !chargerId) {
    return res.status(500).json({ error: "HYPERVOLT_API_KEY or HYPERVOLT_CHARGER_ID not set" });
  }

  const BASE = "https://api.hypervolt.co.uk/v2";

  try {
    // GET — read charger status
    if (req.method === "GET") {
      const response = await fetch(`${BASE}/charger/${chargerId}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: "Hypervolt API error" });
      }

      const data = await response.json();

      return res.status(200).json({
        chargerId,
        isCharging: data.charging ?? false,
        chargeRateW: data.charge_rate_watts ?? 0,
        todayKwh: data.today_kwh ?? 0,
        locked: data.locked ?? false,
        status: data.status ?? "unknown",
      });
    }

    // POST — set charge mode
    // Body: { charging: true | false }
    if (req.method === "POST") {
      const { charging } = req.body;

      const response = await fetch(`${BASE}/charger/${chargerId}/session`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ charging }),
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to set Hypervolt charge state" });
      }

      return res.status(200).json({
        success: true,
        charging,
        message: charging ? "Hypervolt charging started" : "Hypervolt charging stopped",
      });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
