// api/users.ts — consolidated user management endpoint
//
// Routes:
//   POST   /api/users                  → register a new user
//   POST   /api/users?action=waitlist  → add email to early-access waitlist
//   GET    /api/users?userId=<id>      → get user config (no passwords)
//   GET    /api/users?action=count     → count of registered users
//   PUT    /api/users                  → update user fields
//
// Replaces: api/register.ts, api/user.ts, api/waitlist.ts

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";
import * as crypto from "node:crypto";
import nodemailer from "nodemailer";

const KV_KEY = "aveum:users";

// ── Types ──────────────────────────────────────────────────────────────────────

interface RegisterRequestBody {
  userName: string;
  notifyEmail: string;
  octopusApiKey?: string;
  octopusAccountNumber?: string;
  region?: string;
  optimizationMode?: string;
  devices?: string[];
  deviceConfigs?: UserDeviceConfig[];
  ohmeEmail?: string;
  ohmePassword?: string;
  departureTime?: string;
  targetSocPercent?: number;
  v2hCapable?: boolean;
  v2hMinSocPercent?: number;
}

export interface UserDeviceConfig {
  deviceId: string;
  kind: "battery" | "ev_charger" | "solar_inverter" | "smart_meter" | "gateway";
  brand?: string;
  v2hCapable?: boolean;
  v2hMinSocPercent?: number;
}

export interface StoredUser {
  userId: string;
  registeredAt: string;
  userName: string;
  notifyEmail: string;
  octopusApiKey?: string;
  octopusAccountNumber?: string;
  region: string;
  optimizationMode: string;
  devices: string[];
  deviceConfigs?: UserDeviceConfig[];
  ohmeEmail?: string;
  ohmePassword?: string;
  departureTime?: string;
  targetSocPercent?: number;
  v2hCapable?: boolean;
  v2hMinSocPercent?: number;
}

interface UpdateableFields {
  departureTime?: string;
  targetSocPercent?: number;
  notifyEmail?: string;
  v2hCapable?: boolean;
  v2hMinSocPercent?: number;
  deviceConfigs?: UserDeviceConfig[];
}

interface UpdateRequestBody extends UpdateableFields {
  userId: string;
  targetChargePct?: number;
}

interface OctopusRateResult {
  valid_from: string;
  valid_to: string;
  value_inc_vat: number;
}

interface OctopusRatesResponse {
  results?: OctopusRateResult[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizeEnvValue(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? "";
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function createRedisClient(): { client: Redis } | { error: string } {
  const rawUrl = process.env.UPSTASH_REDIS_REST_URL;
  const rawToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const url = normalizeEnvValue(rawUrl);
  const token = normalizeEnvValue(rawToken);

  console.log("Redis config diagnostics", {
    hasUpstashRedisRestUrl: Boolean(rawUrl),
    hasUpstashRedisRestToken: Boolean(rawToken),
    trimmedUrlLength: url.length,
    trimmedUrlStartsWithHttps: url.startsWith("https://"),
    trimmedUrlPreview: url.slice(0, 30),
    tokenLength: token.length,
  });

  if (!url) {
    return { error: "Missing UPSTASH_REDIS_REST_URL" };
  }
  if (!token) {
    return { error: "Missing UPSTASH_REDIS_REST_TOKEN" };
  }
  if (!url.startsWith("https://")) {
    return { error: "UPSTASH_REDIS_REST_URL must start with https://" };
  }

  try {
    return {
      client: new Redis({
        url,
        token,
      }),
    };
  } catch (err: unknown) {
    return {
      error: `Failed to initialize Redis client: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function readAllUsers(redis: Redis): Promise<StoredUser[]> {
  const raw = await redis.lrange<string>(KV_KEY, 0, -1);
  return raw.map((entry) => JSON.parse(entry) as StoredUser);
}

async function writeAllUsers(redis: Redis, users: StoredUser[]): Promise<void> {
  const pipeline = redis.pipeline();
  pipeline.del(KV_KEY);
  for (const user of [...users].reverse()) {
    pipeline.lpush(KV_KEY, JSON.stringify(user));
  }
  await pipeline.exec();
}

function normalizeDeviceConfigs(deviceConfigs: UserDeviceConfig[] | undefined): UserDeviceConfig[] | undefined {
  if (!Array.isArray(deviceConfigs) || deviceConfigs.length === 0) {
    return undefined;
  }

  return deviceConfigs
    .filter((config) => config && typeof config.deviceId === "string" && typeof config.kind === "string")
    .map((config) => ({
      deviceId: config.deviceId.trim(),
      kind: config.kind,
      ...(config.brand?.trim() && { brand: config.brand.trim() }),
      ...(config.v2hCapable !== undefined && { v2hCapable: Boolean(config.v2hCapable) }),
      ...(config.v2hMinSocPercent !== undefined && {
        v2hMinSocPercent: Number(config.v2hMinSocPercent),
      }),
    }))
    .filter((config) => config.deviceId.length > 0);
}

function getLondonDateTimeParts(date: Date): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return {
    date: `${year}-${month}-${day}`,
    hour,
  };
}

function previousDateString(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function isOvernightHour(hour: number): boolean {
  return hour === 23 || (hour >= 0 && hour <= 6);
}

function formatLondonTime(dateIso: string): string {
  return new Date(dateIso).toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildAgileRatesUrl(region: string): string {
  const normalizedRegion = (region || "C").trim().toUpperCase() || "C";
  return `https://api.octopus.energy/v1/products/AGILE-24-10-01/electricity-tariffs/E-1R-AGILE-24-10-01-${normalizedRegion}/standard-unit-rates/?page_size=1500`;
}

function pickCheapestOvernightWindow(rates: OctopusRateResult[]): {
  startAt: string;
  endAt: string;
  averageRatePencePerKwh: number;
} | null {
  const parsed = rates
    .map((rate) => ({
      startAt: rate.valid_from,
      endAt: rate.valid_to,
      valueIncVat: Number(rate.value_inc_vat),
      startMs: new Date(rate.valid_from).getTime(),
      endMs: new Date(rate.valid_to).getTime(),
    }))
    .filter((rate) => Number.isFinite(rate.valueIncVat) && Number.isFinite(rate.startMs) && Number.isFinite(rate.endMs))
    .sort((a, b) => a.startMs - b.startMs);

  if (parsed.length < 6) return null;

  const groupedByNight = new Map<string, typeof parsed>();
  for (const slot of parsed) {
    const london = getLondonDateTimeParts(new Date(slot.startAt));
    if (!isOvernightHour(london.hour)) continue;

    const nightKey = london.hour === 23 ? london.date : previousDateString(london.date);
    const existing = groupedByNight.get(nightKey);
    if (existing) existing.push(slot);
    else groupedByNight.set(nightKey, [slot]);
  }

  let bestWindow: { startAt: string; endAt: string; averageRatePencePerKwh: number } | null = null;

  for (const slots of groupedByNight.values()) {
    slots.sort((a, b) => a.startMs - b.startMs);

    for (let i = 0; i <= slots.length - 6; i += 1) {
      const windowSlots = slots.slice(i, i + 6);
      let consecutive = true;

      for (let j = 1; j < windowSlots.length; j += 1) {
        if (windowSlots[j - 1].endMs !== windowSlots[j].startMs) {
          consecutive = false;
          break;
        }
      }

      if (!consecutive) continue;

      const averageRatePencePerKwh =
        windowSlots.reduce((sum, slot) => sum + slot.valueIncVat, 0) / windowSlots.length;

      if (!bestWindow || averageRatePencePerKwh < bestWindow.averageRatePencePerKwh) {
        bestWindow = {
          startAt: windowSlots[0].startAt,
          endAt: windowSlots[windowSlots.length - 1].endAt,
          averageRatePencePerKwh,
        };
      }
    }
  }

  return bestWindow;
}

function findCurrentRatePencePerKwh(rates: OctopusRateResult[]): number | null {
  const nowMs = Date.now();
  const active = rates.find((rate) => {
    const start = new Date(rate.valid_from).getTime();
    const end = new Date(rate.valid_to).getTime();
    return nowMs >= start && nowMs < end;
  });

  if (active && Number.isFinite(Number(active.value_inc_vat))) {
    return Number(active.value_inc_vat);
  }

  const next = rates
    .map((rate) => ({
      value: Number(rate.value_inc_vat),
      startMs: new Date(rate.valid_from).getTime(),
    }))
    .filter((rate) => Number.isFinite(rate.value) && Number.isFinite(rate.startMs) && rate.startMs >= nowMs)
    .sort((a, b) => a.startMs - b.startMs)[0];

  return next ? next.value : null;
}

async function sendWelcomeEmail(user: StoredUser): Promise<void> {
  const smtpHost = process.env.AVEUM_SMTP_HOST?.trim() ?? "";
  const smtpUser = process.env.AVEUM_SMTP_USER?.trim() ?? "";
  const smtpPass = process.env.AVEUM_SMTP_PASS?.trim() ?? "";
  const smtpPort = parseInt(process.env.AVEUM_SMTP_PORT ?? "587", 10);
  const fromEmail = process.env.AVEUM_FROM_EMAIL?.trim() || smtpUser;

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn("[Aveum] Welcome email skipped: missing SMTP configuration");
    return;
  }

  const agileUrl = buildAgileRatesUrl(user.region);
  const ratesResponse = await fetch(agileUrl);
  if (!ratesResponse.ok) {
    throw new Error(`Octopus rates fetch failed (${ratesResponse.status})`);
  }

  const data = (await ratesResponse.json()) as OctopusRatesResponse;
  const rates = data.results ?? [];
  const bestWindow = pickCheapestOvernightWindow(rates);
  if (!bestWindow) {
    throw new Error("Unable to determine a 3-hour overnight window from Octopus rates");
  }

  const currentRate = findCurrentRatePencePerKwh(rates);
  const savingPercent =
    currentRate && currentRate > 0
      ? Math.max(0, ((currentRate - bestWindow.averageRatePencePerKwh) / currentRate) * 100)
      : 0;

  const startTime = formatLondonTime(bestWindow.startAt);
  const endTime = formatLondonTime(bestWindow.endAt);
  const lowestRate = bestWindow.averageRatePencePerKwh.toFixed(1);
  const saving = Math.round(savingPercent);

  const sentence = `Welcome to Aveum, ${user.userName}. Tonight's plan: charge between ${startTime} and ${endTime} when rates drop to ${lowestRate}p/kWh. That's approximately ${saving}% cheaper than the current rate. Aveum runs automatically every night at 1am — nothing to do tonight except plug in.`;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number.isFinite(smtpPort) ? smtpPort : 587,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await transporter.sendMail({
    from: `"Aveum" <${fromEmail}>`,
    to: user.notifyEmail,
    subject: "Welcome to Aveum — tonight's plan",
    text: sentence,
    html: `<p>${escapeHtml(sentence)}</p>`,
  });
}

// ── Handler ────────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  const redisResult = createRedisClient();
  if ("error" in redisResult) {
    return res.status(500).json({ error: redisResult.error });
  }

  const { client: redis } = redisResult;

  const action = req.query.action as string | undefined;

  // ── POST /api/users?action=waitlist ────────────────────────────────────────
  if (req.method === "POST" && action === "waitlist") {
    const { email } = req.body ?? {};
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "A valid email is required." });
    }
    const normalizedEmail = email.trim().toLowerCase();

    try {
      await redis.lpush("aveum:waitlist", normalizedEmail);
      return res.status(200).json({ success: true });
    } catch (err: unknown) {
      const details = err instanceof Error ? err.message : String(err);
      console.error("Failed to write waitlist email to Redis", {
        email: normalizedEmail,
        error: err,
        details,
      });
      return res.status(500).json({ error: "Failed to save waitlist email", details });
    }
  }

  // ── POST /api/users  (register) ────────────────────────────────────────────
  if (req.method === "POST") {
    const body = req.body as RegisterRequestBody;
    if (!body?.userName?.trim()) return res.status(400).json({ error: "userName is required" });
    if (!body?.notifyEmail?.trim()) return res.status(400).json({ error: "notifyEmail is required" });

    const normalizedDeviceConfigs = normalizeDeviceConfigs(body.deviceConfigs);
    const targetSocPercent =
      body.targetSocPercent != null ? Number(body.targetSocPercent) : undefined;
    const v2hMinSocPercent =
      body.v2hMinSocPercent != null ? Number(body.v2hMinSocPercent) : undefined;

    if (
      targetSocPercent != null &&
      (!Number.isFinite(targetSocPercent) || targetSocPercent < 20 || targetSocPercent > 100)
    ) {
      return res.status(400).json({ error: "targetSocPercent must be 20–100" });
    }
    if (
      v2hMinSocPercent != null &&
      (!Number.isFinite(v2hMinSocPercent) || v2hMinSocPercent < 20 || v2hMinSocPercent > 60)
    ) {
      return res.status(400).json({ error: "v2hMinSocPercent must be 20–60" });
    }

    const userId = crypto.randomUUID();
    const newUser: StoredUser = {
      userId,
      registeredAt: new Date().toISOString(),
      userName: body.userName.trim(),
      notifyEmail: body.notifyEmail.trim(),
      ...(body.octopusApiKey?.trim() && { octopusApiKey: body.octopusApiKey.trim() }),
      ...(body.octopusAccountNumber?.trim() && { octopusAccountNumber: body.octopusAccountNumber.trim() }),
      region: body.region?.trim() || "C",
      optimizationMode: body.optimizationMode?.trim() || "balanced",
      devices: Array.isArray(body.devices) ? body.devices : [],
      ...(normalizedDeviceConfigs?.length ? { deviceConfigs: normalizedDeviceConfigs } : {}),
      ...(body.ohmeEmail?.trim() && { ohmeEmail: body.ohmeEmail.trim() }),
      ...(body.ohmePassword?.trim() && { ohmePassword: body.ohmePassword.trim() }),
      ...(body.departureTime?.trim() && { departureTime: body.departureTime.trim() }),
      ...(targetSocPercent != null && { targetSocPercent }),
      ...(body.v2hCapable !== undefined && { v2hCapable: Boolean(body.v2hCapable) }),
      ...(v2hMinSocPercent != null && { v2hMinSocPercent }),
    };

    try {
      await redis.lpush(KV_KEY, JSON.stringify(newUser));
    } catch (err: unknown) {
      return res.status(500).json({
        error: `Failed to save user: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    void sendWelcomeEmail(newUser).catch((err: unknown) => {
      console.error("Welcome email failed", {
        userId: newUser.userId,
        notifyEmail: newUser.notifyEmail,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return res.status(201).json({ success: true, userId });
  }

  // ── GET /api/users?action=count ────────────────────────────────────────────
  if (req.method === "GET" && action === "count") {
    try {
      const count = await redis.llen(KV_KEY);
      return res.status(200).json({ registeredUsers: count });
    } catch (err: unknown) {
      return res.status(500).json({
        error: `Failed to read user count: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // ── GET /api/users?userId=<id> ─────────────────────────────────────────────
  if (req.method === "GET") {
    const userId = req.query.userId as string | undefined;
    if (!userId?.trim()) {
      return res.status(400).json({ error: "userId query param is required" });
    }
    try {
      const users = await readAllUsers(redis);
      const user = users.find((u) => u.userId === userId.trim());
      if (!user) return res.status(404).json({ error: "User not found" });
      const { ohmePassword: _p, octopusApiKey: _k, ...safe } = user as any;
      return res.status(200).json({
        user: {
          ...safe,
          targetChargePct: safe.targetSocPercent,
        },
      });
    } catch (err: unknown) {
      return res.status(500).json({
        error: `Failed to read user: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // ── PUT /api/users  (update user fields) ───────────────────────────────────
  if (req.method === "PUT") {
    const body = req.body as UpdateRequestBody;
    if (!body?.userId?.trim()) return res.status(400).json({ error: "userId is required" });

    const updates: UpdateableFields = {};
    const normalizedDeviceConfigs = normalizeDeviceConfigs(body.deviceConfigs);
    if (body.departureTime !== undefined) {
      const t = String(body.departureTime).trim();
      if (!/^\d{1,2}:\d{2}$/.test(t)) return res.status(400).json({ error: "departureTime must be HH:MM" });
      updates.departureTime = t;
    }
    if (body.targetSocPercent !== undefined || body.targetChargePct !== undefined) {
      const pct = Number(body.targetSocPercent ?? body.targetChargePct);
      if (!Number.isFinite(pct) || pct < 20 || pct > 100)
        return res.status(400).json({ error: "targetSocPercent must be 20–100" });
      updates.targetSocPercent = pct;
    }
    if (body.notifyEmail !== undefined) {
      const email = String(body.notifyEmail).trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return res.status(400).json({ error: "notifyEmail is not a valid email" });
      updates.notifyEmail = email || undefined;
    }
    if (body.v2hCapable !== undefined) {
      updates.v2hCapable = Boolean(body.v2hCapable);
    }
    if (body.v2hMinSocPercent !== undefined) {
      const pct = Number(body.v2hMinSocPercent);
      if (!Number.isFinite(pct) || pct < 20 || pct > 60)
        return res.status(400).json({ error: "v2hMinSocPercent must be 20–60" });
      updates.v2hMinSocPercent = pct;
    }
    if (body.deviceConfigs !== undefined) {
      updates.deviceConfigs = normalizedDeviceConfigs ?? [];
    }
    if (Object.keys(updates).length === 0)
      return res.status(400).json({ error: "No valid fields to update" });

    try {
      const users = await readAllUsers(redis);
      const idx = users.findIndex((u) => u.userId === body.userId.trim());
      if (idx === -1) return res.status(404).json({ error: "User not found" });
      users[idx] = { ...users[idx], ...updates } as StoredUser;
      await writeAllUsers(redis, users);
      return res.status(200).json({ success: true });
    } catch (err: unknown) {
      return res.status(500).json({
        error: `Failed to update user: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
