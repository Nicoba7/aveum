// api/wallbox.ts — Wallbox EV charger
// Read status and control charging
// Deploy to: /api/wallbox.ts in repo root

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  const email = process.env.WALLBOX_EMAIL;
  const password = process.env.WALLBOX_PASSWORD;
  const chargerId = process.env.WALLBOX_CHARGER_ID;

  if (!email || !password || !chargerId) {
    return res.status(500).json({ error: "WALLBOX_EMAIL, WALLBOX_PASSWORD or WALLBOX_CHARGER_ID not set" });
  }

  const BASE = "https://api.wall-box.com";

  try {
    // Authenticate first
    const authRes = await fetch(`${BASE}/auth/token/user`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${email}:${password}`).toString("base64")}`,
        "Content-Type": "application/json",
        Partner: "wallbox",
      },
    });

    if (!authRes.ok) {
      return res.status(401).json({ error: "Wallbox authentication failed" });
    }

    const authData = await authRes.json();
    const token = authData.data?.attributes?.token;

    if (!token) {
      return res.status(401).json({ error: "No token received from Wallbox" });
    }

    // GET — read charger status
    if (req.method === "GET") {
      const statusRes = await fetch(`${BASE}/v2/charger/${chargerId}/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!statusRes.ok) {
        return res.status(statusRes.status).json({ error: "Wallbox status error" });
      }

      const data = await statusRes.json();

      const STATUS_LABELS: Record<number, string> = {
        0: "Disconnected",
        14: "Error",
        15: "Error",
        161: "Ready",
        162: "Ready",
        163: "Disconnected",
        164: "Waiting",
        165: "Locked",
        166: "Updating",
        177: "Scheduled",
        178: "Paused",
        179: "Scheduled",
        180: "Waiting",
        181: "Waiting",
        182: "Paused",
        183: "Waiting",
        184: "Waiting",
        185: "Locked",
        186: "Updating",
        187: "Error",
        188: "Error",
        189: "Error",
        193: "Charging",
        194: "Charging",
        195: "Charging",
        196: "Discharging",
        209: "Locked",
        210: "Locked",
      };

      return res.status(200).json({
        chargerId,
        isCharging: data.status_id === 193 || data.status_id === 194 || data.status_id === 195,
        chargeRateKw: data.charging_power ?? 0,
        statusId: data.status_id,
        statusLabel: STATUS_LABELS[data.status_id] ?? "Unknown",
        todayKwh: data.added_energy ?? 0,
        maxChargingCurrentA: data.max_charging_current ?? 0,
      });
    }

    // POST — start or stop charging
    // Body: { action: "start" | "stop" | "pause" }
    if (req.method === "POST") {
      const { action } = req.body;
      const actionMap: Record<string, number> = { start: 1, stop: 2, pause: 2 };
      const actionId = actionMap[action];

      if (!actionId) {
        return res.status(400).json({ error: "action must be start, stop or pause" });
      }

      const actionRes = await fetch(`${BASE}/v2/charger/${chargerId}/remote-action`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: actionId }),
      });

      if (!actionRes.ok) {
        return res.status(actionRes.status).json({ error: "Failed to control Wallbox" });
      }

      return res.status(200).json({
        success: true,
        action,
        message: `Wallbox ${action} command sent`,
      });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
