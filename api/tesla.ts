// api/tesla.ts — consolidated Tesla OAuth endpoint
//
// Routes:
//   GET /api/tesla?action=auth       → start Tesla OAuth (redirect to Tesla login)
//   GET /api/tesla?action=callback   → handle Tesla OAuth callback
//
// Replaces: api/tesla-auth.ts, api/tesla-callback.ts

import type { VercelRequest, VercelResponse } from "@vercel/node";

const REDIRECT_URI = "https://gridlydashboard.vercel.app/api/tesla?action=callback";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const action = req.query.action as string | undefined;

  // ── GET /api/tesla?action=auth ─────────────────────────────────────────────
  if (action === "auth") {
    const clientId = process.env.VITE_TESLA_CLIENT_ID;
    if (!clientId) return res.status(500).json({ error: "VITE_TESLA_CLIENT_ID not set" });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "openid vehicle_charging_cmds offline_access",
      state: Math.random().toString(36).substring(2),
    });

    return res.redirect(`https://auth.tesla.com/oauth2/v3/authorize?${params.toString()}`);
  }

  // ── GET /api/tesla?action=callback ─────────────────────────────────────────
  if (action === "callback") {
    const { code, error } = req.query;

    if (error) return res.redirect(`/?error=tesla_auth_failed`);
    if (!code) return res.redirect(`/?error=no_code`);

    try {
      const clientId = process.env.VITE_TESLA_CLIENT_ID!;
      const clientSecret = process.env.VITE_TESLA_CLIENT_SECRET!;

      const tokenRes = await fetch("https://auth.tesla.com/oauth2/v3/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code as string,
          redirect_uri: REDIRECT_URI,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      const tokens = await tokenRes.json();
      if (!tokens.access_token) return res.redirect(`/?error=token_exchange_failed`);

      const vehiclesRes = await fetch("https://fleet-api.prd.eu.vn.cloud.tesla.com/api/1/vehicles", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const vehicleData = await vehiclesRes.json();
      const vehicleId = vehicleData?.response?.[0]?.id_s ?? "";

      // Store tokens in HTTP-only cookies — never expose in URL parameters.
      const cookieOpts = "Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600";
      res.setHeader("Set-Cookie", [
        `tesla_token=${tokens.access_token}; ${cookieOpts}`,
        `tesla_vehicle_id=${vehicleId}; ${cookieOpts}`,
      ]);

      const params = new URLSearchParams({ tesla_connected: "true" });
      return res.redirect(`/dashboard?${params.toString()}`);
    } catch (err: any) {
      return res.redirect(`/?error=${encodeURIComponent(err.message)}`);
    }
  }

  return res.status(400).json({ error: "action param required: auth or callback" });
}
