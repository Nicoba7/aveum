// api/octopus-auth.ts — Octopus Energy OAuth flow
// Step 1: Redirect user to Octopus login
// Deploy to: /api/octopus-auth.ts in repo root

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.OCTOPUS_CLIENT_ID;
  const redirectUri = process.env.OCTOPUS_REDIRECT_URI || "https://gridlydashboard.vercel.app/api/octopus-callback";

  if (!clientId) {
    return res.status(500).json({ error: "OCTOPUS_CLIENT_ID not set" });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
  });

  res.redirect(`https://auth.octopus.energy/authorize?${params.toString()}`);
}
