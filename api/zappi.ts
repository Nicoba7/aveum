// api/zappi.ts — Vercel serverless function
// Reads and WRITES Zappi charge mode via myenergi API
// Deploy to: /api/zappi.ts in your GitHub repo root
//
// Charge modes:
//   1 = Fast (always charge at full rate)
//   2 = Eco (use surplus solar first, top up from grid if needed)
//   3 = Eco+ (only charge from surplus solar, never grid)
//   4 = Stop (do not charge)

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac } from "crypto";

// myenergi uses digest auth — this builds the auth header
function buildDigestAuth(username: string, password: string, uri: string, method: string) {
  const ha1 = createHmac("md5", "").update(`${username}:myenergi:${password}`).digest("hex");
  const ha2 = createHmac("md5", "").update(`${method}:${uri}`).digest("hex");
  const nc = "00000001";
  const cnonce = Math.random().toString(36).substring(2, 10);
  const realm = "myenergi";
  const nonce = Math.random().toString(36).substring(2, 18);
  const response = createHmac("md5", "")
    .update(`${ha1}:${nonce}:${nc}:${cnonce}:auth:${ha2}`)
    .digest("hex");
  return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", qop=auth, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  const email = process.env.MYENERGI_EMAIL;
  const password = process.env.MYENERGI_PASSWORD;
  const serial = process.env.ZAPPI_SERIAL;

  if (!email || !password || !serial) {
    return res.status(500).json({ error: "MYENERGI_EMAIL, MYENERGI_PASSWORD or ZAPPI_SERIAL not set" });
  }

  const BASE = `https://s18.myenergi.net`;

  try {
    // GET — read current Zappi status
    if (req.method === "GET") {
      const uri = `/cgi-jstatus-Z${serial}`;
      const authHeader = buildDigestAuth(email, password, uri, "GET");

      const response = await fetch(`${BASE}${uri}`, {
        headers: { Authorization: authHeader },
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: "myenergi API error" });
      }

      const data = await response.json();
      const z = data[`zappi`]?.[0] ?? data?.[0];

      const MODE_LABELS: Record<number, string> = {
        1: "Fast",
        2: "Eco",
        3: "Eco+",
        4: "Stop",
      };

      return res.status(200).json({
        serial,
        chargeMode: z?.zmo ?? null,
        chargeModeLabel: MODE_LABELS[z?.zmo] ?? "Unknown",
        chargeRateW: z?.div ?? 0,
        status: z?.sta ?? null,         // 1=paused, 3=charging, 5=complete
        voltageV: z?.vol ? z.vol / 10 : null,
        frequencyHz: z?.frq ? z.frq / 100 : null,
        todayKwh: z?.che ?? 0,
      });
    }

    // POST — set charge mode
    // Body: { mode: 1 | 2 | 3 | 4 }
    if (req.method === "POST") {
      const { mode } = req.body;

      if (![1, 2, 3, 4].includes(mode)) {
        return res.status(400).json({ error: "mode must be 1 (Fast), 2 (Eco), 3 (Eco+) or 4 (Stop)" });
      }

      const uri = `/cgi-zappi-mode-Z${serial}-${mode}-0-0-0000`;
      const authHeader = buildDigestAuth(email, password, uri, "GET");

      const response = await fetch(`${BASE}${uri}`, {
        headers: { Authorization: authHeader },
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to set Zappi mode" });
      }

      const MODE_LABELS: Record<number, string> = { 1: "Fast", 2: "Eco", 3: "Eco+", 4: "Stop" };

      return res.status(200).json({
        success: true,
        mode,
        modeLabel: MODE_LABELS[mode],
        message: `Zappi set to ${MODE_LABELS[mode]} mode`,
      });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
