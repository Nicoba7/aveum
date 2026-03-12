import type { VercelRequest, VercelResponse } from "@vercel/node";

const BASE = "https://api.pod-point.com/v4";

async function getToken(): Promise<{ token: string; userId: string }> {
  const res = await fetch(`${BASE}/users/sign_in`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Gridly/1.0" },
    body: JSON.stringify({ email: process.env.PODPOINT_EMAIL, password: process.env.PODPOINT_PASSWORD }),
  });
  if (!res.ok) throw new Error("Pod Point auth failed");
  const data = await res.json();
  return { token: data.access_token, userId: data.id };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!process.env.PODPOINT_EMAIL || !process.env.PODPOINT_PASSWORD || !process.env.PODPOINT_UNIT_ID) {
    return res.status(200).json({ error: "PODPOINT_EMAIL, PODPOINT_PASSWORD, PODPOINT_UNIT_ID not set", mock: true, isCharging: false });
  }

  try {
    const { token, userId } = await getToken();
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "Gridly/1.0" };
    const unitId = process.env.PODPOINT_UNIT_ID;

    if (req.method === "POST") {
      const { action } = req.body || {};
      if (action === "start") {
        // Enable schedule = allow charging (clear 1-second blocking schedule)
        await fetch(`${BASE}/users/${userId}/units/${unitId}/schedules`, { method: "DELETE", headers });
      } else if (action === "stop") {
        // Set a 1-second schedule to block charging (unofficial method used by HA integration)
        await fetch(`${BASE}/users/${userId}/units/${unitId}/schedules`, {
          method: "POST", headers,
          body: JSON.stringify({ schedules: [{ start_time: "00:00:00", end_time: "00:00:01", status: "active" }] }),
        });
      }
      return res.status(200).json({ success: true, action });
    }

    // GET — fetch unit status
    const unitRes = await fetch(`${BASE}/users/${userId}/units/${unitId}`, { headers });
    const unit = await unitRes.json();
    const pod = unit.units?.[0];

    const isCharging = pod?.statuses?.[0]?.key_name === "charging";
    const isConnected = pod?.statuses?.[0]?.key_name !== "available";

    return res.status(200).json({
      unitId,
      isCharging,
      isConnected,
      status: pod?.statuses?.[0]?.key_name ?? "unknown",
      model: pod?.model ?? "Pod Point",
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
