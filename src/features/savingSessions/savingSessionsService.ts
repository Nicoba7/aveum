import type { DeviceState } from "../../domain/device";

const OCTOPUS_GRAPHQL_ENDPOINT = "https://api.octopus.energy/v1/graphql/";

export interface SavingSession {
  id: string;
  startAt: string;
  endAt: string;
  rewardPerKwhInOctopoints: number;
  joinStatus: string;
}

export interface SavingSessionAction {
  deviceId: string;
  action: "discharge_battery" | "pause_ev_charging";
  startAt: string;
  endAt: string;
  reason: string;
}

export interface SavingSessionActionPlan {
  actions: SavingSessionAction[];
  explanation: string;
}

interface GraphQlError {
  message?: string;
}

interface SavingSessionsGraphQlResponse {
  data?: {
    savingSessions?: {
      events?: Array<{
        id?: string;
        startAt?: string;
        endAt?: string;
        rewardPerKwhInOctopoints?: number;
        joinStatus?: string;
      }>;
    };
  };
  errors?: GraphQlError[];
}

function toAuthorizationHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

async function postGraphQl<TResponse>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<TResponse> {
  const response = await fetch(OCTOPUS_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: toAuthorizationHeader(apiKey),
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Octopus GraphQL request failed (${response.status})`);
  }

  return response.json() as Promise<TResponse>;
}

function assertNoGraphQlErrors(errors: GraphQlError[] | undefined, fallback: string): void {
  if (!errors || errors.length === 0) {
    return;
  }

  const details = errors
    .map((error) => error.message)
    .filter((message): message is string => Boolean(message))
    .join("; ");

  throw new Error(details || fallback);
}

function normalizeSessions(response: SavingSessionsGraphQlResponse): SavingSession[] {
  assertNoGraphQlErrors(response.errors, "Saving Sessions GraphQL request failed.");

  const events = response.data?.savingSessions?.events ?? [];
  return events
    .map((event) => ({
      id: event.id ?? "",
      startAt: event.startAt ?? "",
      endAt: event.endAt ?? "",
      rewardPerKwhInOctopoints: Number(event.rewardPerKwhInOctopoints ?? 0),
      joinStatus: event.joinStatus ?? "unknown",
    }))
    .filter((event) => {
      const startMs = new Date(event.startAt).getTime();
      const endMs = new Date(event.endAt).getTime();
      return event.id.length > 0 && Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;
    })
    .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime());
}

export async function getUpcomingSavingSessions(
  apiKey: string,
  accountNumber: string,
): Promise<SavingSession[]> {
  const query = `query getSavingSessions($accountNumber: String!) {
  savingSessions(accountNumber: $accountNumber) {
    events {
      id
      startAt
      endAt
      rewardPerKwhInOctopoints
      joinStatus
    }
  }
}`;

  const response = await postGraphQl<SavingSessionsGraphQlResponse>(apiKey, query, {
    accountNumber,
  });

  const nowMs = Date.now();
  return normalizeSessions(response).filter((session) => new Date(session.startAt).getTime() > nowMs);
}

export async function joinSavingSession(
  apiKey: string,
  accountNumber: string,
  sessionId: string,
): Promise<{ joined: boolean; message: string }> {
  const mutation = `mutation joinSavingSession($input: JoinSavingSessionInput!) {
  joinSavingSession(input: $input) {
    possibleErrors {
      message
    }
  }
}`;

  const response = await postGraphQl<{
    data?: {
      joinSavingSession?: {
        possibleErrors?: Array<{ message?: string }>;
      };
    };
    errors?: GraphQlError[];
  }>(apiKey, mutation, {
    input: {
      accountNumber,
      eventId: sessionId,
    },
  });

  assertNoGraphQlErrors(response.errors, "Join Saving Session mutation failed.");

  const possibleErrors = response.data?.joinSavingSession?.possibleErrors ?? [];
  if (possibleErrors.length > 0) {
    const message = possibleErrors
      .map((error) => error.message)
      .filter((value): value is string => Boolean(value))
      .join("; ");
    return { joined: false, message: message || "Unable to join saving session." };
  }

  return { joined: true, message: "Joined saving session successfully." };
}

export function calculateSavingSessionActions(
  session: SavingSession,
  userDevices: DeviceState[],
): SavingSessionActionPlan {
  const actions: SavingSessionAction[] = [];

  for (const device of userDevices) {
    if (device.connectionStatus !== "online" && device.connectionStatus !== "degraded") {
      continue;
    }

    if (device.kind === "battery") {
      actions.push({
        deviceId: device.deviceId,
        action: "discharge_battery",
        startAt: session.startAt,
        endAt: session.endAt,
        reason: "Maximize Saving Session reward by reducing grid import.",
      });
    }

    if (device.kind === "ev_charger") {
      actions.push({
        deviceId: device.deviceId,
        action: "pause_ev_charging",
        startAt: session.startAt,
        endAt: session.endAt,
        reason: "Pause EV charging during Saving Session to avoid import spikes.",
      });
    }
  }

  const batteryCount = actions.filter((action) => action.action === "discharge_battery").length;
  const evCount = actions.filter((action) => action.action === "pause_ev_charging").length;

  const explanation =
    actions.length === 0
      ? "Aveum found no controllable battery or EV charger actions for this session."
      : `Aveum will discharge ${batteryCount} battery${batteryCount === 1 ? "" : "ies"} and pause charging on ${evCount} EV charger${evCount === 1 ? "" : "s"} during the session window.`;

  return {
    actions,
    explanation,
  };
}

export function formatSavingSessionEmail(
  session: SavingSession,
  actions: SavingSessionAction[],
  estimatedEarningPounds: number,
): string {
  const startLabel = new Date(session.startAt).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const endLabel = new Date(session.endAt).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const actionRows = actions
    .map(
      (action) => `<li><strong>${action.deviceId}</strong>: ${action.action === "discharge_battery" ? "discharge battery" : "pause EV charging"} (${action.reason})</li>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Saving Session Planned</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#f3f4f6;padding:24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <tr><td style="background:#0f172a;color:#ffffff;padding:18px 24px;font-size:18px;font-weight:700;">Aveum · Saving Session</td></tr>
    <tr>
      <td style="padding:24px;">
        <p style="margin:0 0 12px;font-size:15px;color:#111827;">Octopus Saving Session detected for <strong>${startLabel}-${endLabel}</strong>.</p>
        <p style="margin:0 0 12px;font-size:14px;color:#374151;">Aveum has joined automatically and will run the following actions:</p>
        <ul style="margin:0 0 16px 20px;padding:0;color:#374151;font-size:14px;line-height:1.6;">
          ${actionRows || "<li>No controllable actions available.</li>"}
        </ul>
        <p style="margin:0;font-size:14px;color:#111827;">Estimated earning: <strong>£${estimatedEarningPounds.toFixed(2)}</strong>.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function getRecentSavingSessions(
  apiKey: string,
  accountNumber: string,
): Promise<SavingSession[]> {
  const query = `query getSavingSessions($accountNumber: String!) {
  savingSessions(accountNumber: $accountNumber) {
    events {
      id
      startAt
      endAt
      rewardPerKwhInOctopoints
      joinStatus
    }
  }
}`;

  const response = await postGraphQl<SavingSessionsGraphQlResponse>(apiKey, query, {
    accountNumber,
  });

  return normalizeSessions(response);
}
