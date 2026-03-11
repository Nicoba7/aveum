// api/octopus-callback.ts — Octopus OAuth callback
// Step 2: Exchange code for token, fetch account details
// Deploy to: /api/octopus-callback.ts in repo root

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`/?error=octopus_auth_failed`);
  }

  if (!code) {
    return res.redirect(`/?error=no_code`);
  }

  try {
    const clientId = process.env.OCTOPUS_CLIENT_ID!;
    const clientSecret = process.env.OCTOPUS_CLIENT_SECRET!;
    const redirectUri = process.env.OCTOPUS_REDIRECT_URI || "https://gridlydashboard.vercel.app/api/octopus-callback";

    // Exchange code for token
    const tokenRes = await fetch("https://auth.octopus.energy/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const tokens = await tokenRes.json();

    if (!tokens.access_token) {
      return res.redirect(`/?error=token_exchange_failed`);
    }

    // Fetch Octopus account number
    const accountRes = await fetch("https://api.octopus.energy/v1/accounts/", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    const accountData = await accountRes.json();
    const accountNumber = accountData?.results?.[0]?.number ?? "";

    // Redirect to dashboard with token + account in URL params
    // In production: store in secure session/cookie instead
    const params = new URLSearchParams({
      octopus_connected: "true",
      octopus_account: accountNumber,
      octopus_token: tokens.access_token,
    });

    res.redirect(`/dashboard?${params.toString()}`);

  } catch (err: any) {
    res.redirect(`/?error=${encodeURIComponent(err.message)}`);
  }
}
