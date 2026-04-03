import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";

interface UserDeviceConfig {
  deviceId: string;
  kind: "battery" | "ev_charger" | "solar_inverter" | "smart_meter" | "gateway";
  brand?: string;
  v2hCapable?: boolean;
  v2hMinSocPercent?: number;
}

interface UserSettings {
  userName?: string;
  notifyEmail?: string;
  departureTime?: string;
  targetSocPercent?: number;
  targetChargePct?: number;
  v2hCapable?: boolean;
  v2hMinSocPercent?: number;
  deviceConfigs?: UserDeviceConfig[];
}

const DEFAULT_V2H_MIN_SOC_PERCENT = 30;
const V2H_SUPPORTED_EV_BRANDS = new Set(["wallbox", "indra"]);

const FIELD: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.8,
  color: "#6B7280",
};

const INPUT: React.CSSProperties = {
  background: "#0B1120",
  border: "1px solid #1F2937",
  borderRadius: 10,
  padding: "12px 14px",
  color: "#F9FAFB",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

export default function Settings() {
  const navigate = useNavigate();
  const userId =
    typeof window !== "undefined" ? localStorage.getItem("aveum_user_id") : null;

  const [settings, setSettings] = useState<UserSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autosaveTick, setAutosaveTick] = useState(0);

  // Load current settings
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    fetch(`/api/users?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setSettings({
            ...data.user,
            targetSocPercent: data.user.targetSocPercent ?? data.user.targetChargePct,
            v2hMinSocPercent: data.user.v2hMinSocPercent ?? DEFAULT_V2H_MIN_SOC_PERCENT,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (!userId || autosaveTick === 0) {
      return;
    }

    const timer = window.setTimeout(async () => {
      setSaving(true);
      setError(null);
      setSaved(false);

      try {
        const res = await fetch("/api/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            departureTime: settings.departureTime || undefined,
            targetSocPercent:
              settings.targetSocPercent != null
                ? Number(settings.targetSocPercent)
                : undefined,
            notifyEmail: settings.notifyEmail || undefined,
            v2hCapable: Boolean(settings.v2hCapable),
            v2hMinSocPercent: settings.v2hCapable
              ? Number(settings.v2hMinSocPercent ?? DEFAULT_V2H_MIN_SOC_PERCENT)
              : DEFAULT_V2H_MIN_SOC_PERCENT,
            deviceConfigs: settings.deviceConfigs,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Save failed");
        } else {
          setSaved(true);
          window.setTimeout(() => setSaved(false), 2000);
        }
      } catch {
        setError("Network error — please try again");
      } finally {
        setSaving(false);
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [autosaveTick, settings, userId]);

  const updateSettings = (updater: (current: UserSettings) => UserSettings) => {
    setSettings((current) => updater(current));
    setAutosaveTick((current) => current + 1);
  };

  const hasSupportedV2hCharger =
    settings.deviceConfigs?.some(
      (deviceConfig) =>
        deviceConfig.kind === "ev_charger" &&
        Boolean(deviceConfig.brand) &&
        V2H_SUPPORTED_EV_BRANDS.has(deviceConfig.brand.toLowerCase()),
    ) ?? false;

  const displayedTargetSocPercent = settings.targetSocPercent ?? settings.targetChargePct ?? 80;

  const displayedV2hMinSocPercent =
    settings.v2hMinSocPercent ?? DEFAULT_V2H_MIN_SOC_PERCENT;

  const syncV2hDeviceConfig = (patch: Partial<UserDeviceConfig>) => {
    updateSettings((current) => {
      const nextDeviceConfigs = [...(current.deviceConfigs ?? [])];
      const evConfigIndex = nextDeviceConfigs.findIndex((deviceConfig) => deviceConfig.kind === "ev_charger");

      if (evConfigIndex >= 0) {
        nextDeviceConfigs[evConfigIndex] = {
          ...nextDeviceConfigs[evConfigIndex],
          ...patch,
        };
      }

      return {
        ...current,
        deviceConfigs: nextDeviceConfigs,
        ...(patch.v2hCapable !== undefined ? { v2hCapable: patch.v2hCapable } : {}),
        ...(patch.v2hMinSocPercent !== undefined ? { v2hMinSocPercent: patch.v2hMinSocPercent } : {}),
      };
    });
  };

  if (!userId) {
    return (
      <div
        style={{
          background: "#030712",
          minHeight: "100vh",
          color: "#F9FAFB",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto",
          maxWidth: 480,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 12,
          padding: 24,
        }}
      >
        <div style={{ fontSize: 14, color: "#6B7280", textAlign: "center" }}>
          No account found. Complete onboarding first.
        </div>
        <button
          onClick={() => navigate("/onboarding")}
          style={{
            background: "#22C55E",
            border: "none",
            borderRadius: 10,
            padding: "10px 20px",
            color: "#030712",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Get started
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#030712",
        minHeight: "100vh",
        color: "#F9FAFB",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto",
        maxWidth: 480,
        margin: "0 auto",
        paddingBottom: 40,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "20px 20px 0",
          marginBottom: 28,
        }}
      >
        <button
          onClick={() => navigate("/dashboard")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            color: "#6B7280",
            display: "flex",
            alignItems: "center",
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.8,
              color: "#6B7280",
              marginBottom: 2,
            }}
          >
            AVEUM
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#F9FAFB" }}>
            Settings
          </div>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            padding: "60px 20px",
            textAlign: "center",
            color: "#4B5563",
            fontSize: 13,
          }}
        >
          Loading…
        </div>
      ) : (
        <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 0 }}>
          {/* Account section */}
          <div
            style={{
              background: "#0B1120",
              border: "1px solid #1F2937",
              borderRadius: 16,
              padding: "16px 16px",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.8,
                color: "#4B5563",
                marginBottom: 12,
              }}
            >
              ACCOUNT
            </div>
            <div style={{ fontSize: 14, color: "#9CA3AF" }}>
              {settings.userName || "—"}
            </div>
          </div>

          {/* EV settings */}
          <div
            style={{
              background: "#0B1120",
              border: "1px solid #1F2937",
              borderRadius: 16,
              padding: "16px 16px",
              marginBottom: 12,
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.8,
                color: "#4B5563",
              }}
            >
              EV CHARGING
            </div>

            <div style={FIELD}>
              <label style={LABEL}>DEPARTURE TIME</label>
              <input
                type="time"
                value={settings.departureTime ?? "07:30"}
                onChange={(e) =>
                  updateSettings((s) => ({ ...s, departureTime: e.target.value }))
                }
                style={INPUT}
              />
              <div style={{ fontSize: 11, color: "#4B5563" }}>
                Aveum finishes charging before this time each morning.
              </div>
            </div>

            <div style={FIELD}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <label style={LABEL}>TARGET CHARGE</label>
                <span
                  style={{ fontSize: 14, fontWeight: 800, color: "#38BDF8" }}
                >
                  {displayedTargetSocPercent}%
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                value={displayedTargetSocPercent}
                onChange={(e) =>
                  updateSettings((s) => ({
                    ...s,
                    targetSocPercent: Number(e.target.value),
                    targetChargePct: Number(e.target.value),
                  }))
                }
                style={{ width: "100%", accentColor: "#38BDF8", cursor: "pointer" }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 10,
                  color: "#374151",
                }}
              >
                <span>20%</span>
                <span>60%</span>
                <span>100%</span>
              </div>
            </div>

            {hasSupportedV2hCharger && (
              <div style={FIELD}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div>
                    <label style={LABEL}>VEHICLE TO HOME</label>
                    <div style={{ fontSize: 11, color: "#4B5563", marginTop: 4 }}>
                      Enable Vehicle to Home
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      syncV2hDeviceConfig({
                        v2hCapable: !settings.v2hCapable,
                        v2hMinSocPercent: displayedV2hMinSocPercent,
                      })
                    }
                    style={{
                      width: 50,
                      height: 30,
                      borderRadius: 999,
                      border: "none",
                      background: settings.v2hCapable ? "#22C55E" : "#374151",
                      position: "relative",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 3,
                        left: settings.v2hCapable ? 24 : 3,
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: "#F9FAFB",
                        transition: "left 0.15s ease",
                      }}
                    />
                  </button>
                </div>

                {settings.v2hCapable && (
                  <>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        marginTop: 8,
                      }}
                    >
                      <label style={LABEL}>MINIMUM EV CHARGE TO KEEP</label>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#38BDF8" }}>
                        {displayedV2hMinSocPercent}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={60}
                      step={5}
                      value={displayedV2hMinSocPercent}
                      onChange={(e) =>
                        syncV2hDeviceConfig({
                          v2hMinSocPercent: Number(e.target.value),
                        })
                      }
                      style={{ width: "100%", accentColor: "#38BDF8", cursor: "pointer" }}
                    />
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 10,
                        color: "#374151",
                      }}
                    >
                      <span>20%</span>
                      <span>40%</span>
                      <span>60%</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#4B5563" }}>
                      Aveum will never discharge your EV below this level.
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div
            style={{
              background: "#0B1120",
              border: "1px solid #1F2937",
              borderRadius: 16,
              padding: "16px 16px",
              marginBottom: 24,
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.8,
                color: "#4B5563",
              }}
            >
              NOTIFICATIONS
            </div>

            <div style={FIELD}>
              <label style={LABEL}>MORNING REPORT EMAIL</label>
              <input
                type="email"
                value={settings.notifyEmail ?? ""}
                onChange={(e) =>
                  updateSettings((s) => ({ ...s, notifyEmail: e.target.value }))
                }
                placeholder="you@example.com"
                style={INPUT}
              />
              <div style={{ fontSize: 11, color: "#4B5563" }}>
                Aveum sends a daily summary after each optimisation run.
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                background: "#1C0A0A",
                border: "1px solid #7F1D1D",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 12,
                color: "#FCA5A5",
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {/* Save button */}
          <div
            style={{
              width: "100%",
              background: saved ? "#166534" : "#111827",
              border: `1px solid ${saved ? "#166534" : "#1F2937"}`,
              borderRadius: 12,
              padding: "14px",
              color: saved ? "#86EFAC" : "#9CA3AF",
              fontSize: 13,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {saved ? (
              <>
                <Check size={16} />
                Changes saved automatically
              </>
            ) : saving ? (
              "Saving changes…"
            ) : (
              "Changes save automatically"
            )}
          </div>
        </div>
      )}
    </div>
  );
}
