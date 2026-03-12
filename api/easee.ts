import type { VercelRequest, VercelResponse } from "@vercel/node";

const BASE = "https://api.easee.com/api";

async function getToken(): Promise<string> {
  const res = await fetch(`${BASE}/accounts/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userName: process.env.EASEE_EMAIL,
      password: process.env.EASEE_PASSWORD,
    }),
  });
  if (!res.ok) throw new Error("Easee auth failed");
  const data = await res.json();
  return data.accessToken;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const chargerId = process.env.EASEE_CHARGER_ID;
  if (!process.env.EASEE_EMAIL || !process.env.EASEE_PASSWORD || !chargerId) {
    return res.status(200).json({ error: "EASEE_EMAIL, EASEE_PASSWORD, EASEE_CHARGER_ID not set", mock: true, status: "disconnected", isCharging: false });
  }

  try {
    const token = await getToken();
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

    if (req.method === "POST") {
      const { action } = req.body || {};
      const endpoint = action === "start" ? "start_charging" : "stop_charging";
      await fetch(`${BASE}/chargers/${chargerId}/commands/${endpoint}`, { method: "POST", headers });
      return res.status(200).json({ success: true, action });
    }

    // GET — fetch charger state
    const stateRes = await fetch(`${BASE}/chargers/${chargerId}/state`, { headers });
    const state = await stateRes.json();

    // chargerOpMode: 1=Disconnected, 2=AwaitingStart, 3=Charging, 4=Completed, 5=Error, 6=ReadyToCharge
    const isCharging = state.chargerOpMode === 3;
    const isConnected = state.chargerOpMode !== 1;

    return res.status(200).json({
      chargerId,
      isCharging,
      isConnected,
      chargerOpMode: state.chargerOpMode,
      sessionEnergy: state.sessionEnergy ?? 0,      // kWh this session
      totalPower: state.totalPower ?? 0,             // kW current
      lifetimeEnergy: state.lifetimeEnergy ?? 0,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
