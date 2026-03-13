// api/tesla-auth.ts — Tesla Fleet API OAuth flow
// Step 1: Redirect user to Tesla login
import type { VercelRequest, VercelResponse } from "@vercel/node";
 
export default function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.VITE_TESLA_CLIENT_ID;
  const redirectUri = "https://gridlydashboard.vercel.app/api/tesla-callback";
 
  if (!clientId) {
    return res.status(500).json({ error: "VITE_TESLA_CLIENT_ID not set" });
  }
 
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid vehicle_charging_cmds offline_access",
    state: Math.random().toString(36).substring(2), // basic CSRF protection
  });
 
  res.redirect(`https://auth.tesla.com/oauth2/v3/authorize?${params.toString()}`);
}
