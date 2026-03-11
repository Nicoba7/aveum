// api/ohme.ts — Ohme EV charger
// Read status and control charging
// Deploy to: /api/ohme.ts in repo root
// Note: Ohme API is reverse-engineered, may change

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  const email = process.env.OHME_EMAIL;
  const password = process.env.OHME_PASSWORD;

  if (!email || !password) {
    return res.status(500).json({ error: "OHME_EMAIL or OHME_PASSWORD not set" });
  }

  const BASE = "https://api.ohme.io/v1";

  try {
    // Authenticate
    const authRes = await fetch(`${BASE}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!authRes.ok) {
      return res.status(401).json({ error: "Ohme authentication failed" });
    }

    const authData = await authRes.json();
    const token = authData.token;
    const chargerUid = authData.chargeDevices?.[0]?.uid;

    if (!token || !chargerUid) {
      return res.status(401).json({ error: "No token or charger found" });
    }

    // GET — read charge session
    if (req.method === "GET") {
      const sessionRes = await fetch(`${BASE}/charge-sessions/ongoing?chargeDeviceUid=${chargerUid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const session = sessionRes.ok ? await sessionRes.json() : null;

      return res.status(200).json({
        chargerUid,
        isCharging: session?.mode === "SMART_CHARGE" || session?.mode === "MAX_CHARGE",
        chargeRateW: session?.power ?? 0,
        mode: session?.mode ?? "DISCONNECTED",
        todayKwh: session?.energyAdded ?? 0,
        targetSoc: session?.targetSoc ?? null,
      });
    }

    // POST — set charge mode
    // Body: { mode: "MAX_CHARGE" | "SMART_CHARGE" | "STOP_CHARGE" }
    if (req.method === "POST") {
      const { mode } = req.body;
      const validModes = ["MAX_CHARGE", "SMART_CHARGE", "STOP_CHARGE"];

      if (!validModes.includes(mode)) {
        return res.status(400).json({ error: "mode must be MAX_CHARGE, SMART_CHARGE or STOP_CHARGE" });
      }

      const controlRes = await fetch(`${BASE}/charge-sessions/ongoing?chargeDeviceUid=${chargerUid}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode }),
      });

      if (!controlRes.ok) {
        return res.status(controlRes.status).json({ error: "Failed to set Ohme mode" });
      }

      return res.status(200).json({
        success: true,
        mode,
        message: `Ohme set to ${mode}`,
      });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
