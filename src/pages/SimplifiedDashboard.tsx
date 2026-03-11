import { useState, useEffect } from "react";
import { Sun, Battery, Zap, TrendingUp, ChevronRight, AlertCircle, PoundSterling } from "lucide-react";

interface Device {
  id: string;
  name: string;
  connected: boolean;
  status: string;
  monthlyValue: number;
  icon: React.ElementType;
  color: string;
}

const ALL_DEVICES: Device[] = [
  { id: "solar", name: "Solar Inverter", connected: true, status: "2.8kW generating", monthlyValue: 35, icon: Sun, color: "#F59E0B" },
  { id: "battery", name: "Home Battery", connected: true, status: "62% charged", monthlyValue: 32, icon: Battery, color: "#16A34A" },
  { id: "ev", name: "EV Charger", connected: false, status: "Not connected", monthlyValue: 26, icon: Zap, color: "#38BDF8" },
];

// Sandbox data
const SANDBOX = {
  todaySolarKwh: 12.0,
  todayExportKwh: 4.2,
  todayImportKwh: 0.8,
  batteryPct: 62,
  evPct: 85,
};

// Realistic Octopus Agile prices (48 x 30-min slots)
const AGILE_RATES = [
  { time: "00:00", pence: 7.2 }, { time: "00:30", pence: 6.8 },
  { time: "01:00", pence: 6.1 }, { time: "01:30", pence: 5.9 },
  { time: "02:00", pence: 5.4 }, { time: "02:30", pence: 5.1 },
  { time: "03:00", pence: 4.8 }, { time: "03:30", pence: 4.6 },
  { time: "04:00", pence: 4.9 }, { time: "04:30", pence: 5.3 },
  { time: "05:00", pence: 6.2 }, { time: "05:30", pence: 8.1 },
  { time: "06:00", pence: 12.4 }, { time: "06:30", pence: 18.7 },
  { time: "07:00", pence: 24.3 }, { time: "07:30", pence: 28.9 },
  { time: "08:00", pence: 31.2 }, { time: "08:30", pence: 29.4 },
  { time: "09:00", pence: 24.1 }, { time: "09:30", pence: 19.8 },
  { time: "10:00", pence: 16.2 }, { time: "10:30", pence: 13.4 },
  { time: "11:00", pence: 11.8 }, { time: "11:30", pence: 10.2 },
  { time: "12:00", pence: 9.6 }, { time: "12:30", pence: 8.9 },
  { time: "13:00", pence: 9.1 }, { time: "13:30", pence: 10.4 },
  { time: "14:00", pence: 11.2 }, { time: "14:30", pence: 12.8 },
  { time: "15:00", pence: 14.6 }, { time: "15:30", pence: 17.3 },
  { time: "16:00", pence: 22.1 }, { time: "16:30", pence: 27.8 },
  { time: "17:00", pence: 34.2 }, { time: "17:30", pence: 38.6 },
  { time: "18:00", pence: 35.4 }, { time: "18:30", pence: 29.7 },
  { time: "19:00", pence: 22.3 }, { time: "19:30", pence: 17.6 },
  { time: "20:00", pence: 14.2 }, { time: "20:30", pence: 11.8 },
  { time: "21:00", pence: 10.1 }, { time: "21:30", pence: 9.4 },
  { time: "22:00", pence: 8.7 }, { time: "22:30", pence: 8.1 },
  { time: "23:00", pence: 7.6 }, { time: "23:30", pence: 7.1 },
];

function getCurrentSlotIndex() {
  const now = new Date();
  return Math.min(Math.floor((now.getHours() * 60 + now.getMinutes()) / 30), 47);
}

function getBarColor(pence: number) {
  if (pence < 0) return "#A78BFA";
  if (pence < 10) return "#22C55E";
  if (pence < 20) return "#F59E0B";
  if (pence < 30) return "#F97316";
  return "#EF4444";
}

function calcSavings() {
  const exportEarned = SANDBOX.todayExportKwh * 0.15;
  const importAvoided = SANDBOX.todaySolarKwh * 0.28;
  return (exportEarned + importAvoided).toFixed(2);
}

function calcEarned() {
  return (SANDBOX.todayExportKwh * 0.15).toFixed(2);
}

// ── AGILE CHART ───────────────────────────────────────────────────────────
function AgileChart() {
  const currentSlot = getCurrentSlotIndex();
  const maxPence = Math.max(...AGILE_RATES.map(r => r.pence));
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div style={{ background: "#0D1117", border: "1px solid #1F2937", borderRadius: 12, padding: "14px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", letterSpacing: 1, marginBottom: 2 }}>OCTOPUS AGILE — TODAY</div>
          <div style={{ fontSize: 12, color: "#9CA3AF" }}>
            Now: <span style={{ color: getBarColor(AGILE_RATES[currentSlot]?.pence), fontWeight: 700 }}>{AGILE_RATES[currentSlot]?.pence}p/kWh</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, fontSize: 10, color: "#6B7280" }}>
          <span style={{ color: "#22C55E" }}>● cheap</span>
          <span style={{ color: "#F59E0B" }}>● mid</span>
          <span style={{ color: "#EF4444" }}>● peak</span>
        </div>
      </div>

      {hovered !== null && (
        <div style={{ background: "#1F2937", border: "1px solid #374151", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "#F9FAFB", marginBottom: 6, display: "inline-block" }}>
          {AGILE_RATES[hovered].time} — <span style={{ color: getBarColor(AGILE_RATES[hovered].pence), fontWeight: 700 }}>{AGILE_RATES[hovered].pence}p</span>
          {hovered === currentSlot && " ← now"}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80 }}>
        {AGILE_RATES.map((rate, i) => {
          const height = Math.max(2, (rate.pence / maxPence) * 80);
          const isCurrent = i === currentSlot;
          const color = getBarColor(rate.pence);
          return (
            <div key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", cursor: "pointer" }}>
              <div style={{ width: "100%", height, background: isCurrent ? "#FFFFFF" : color, opacity: hovered !== null && hovered !== i ? 0.4 : 1, borderRadius: "2px 2px 0 0", transition: "opacity 0.15s ease", boxShadow: isCurrent ? `0 0 6px ${color}` : "none" }} />
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", marginTop: 4 }}>
        {AGILE_RATES.map((rate, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 8, color: i === currentSlot ? "#F9FAFB" : "#4B5563" }}>
            {i % 4 === 0 ? rate.time.replace(":00", "").replace(":30", "") : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MAIN DASHBOARD ────────────────────────────────────────────────────────
export default function SimplifiedDashboard() {
  const [devices] = useState(ALL_DEVICES);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const connectedDevices = devices.filter(d => d.connected);
  const nextDevice = devices.find(d => !d.connected);
  const monthlyTotal = connectedDevices.reduce((s, d) => s + d.monthlyValue, 0);
  const savedToday = calcSavings();
  const earnedToday = calcEarned();
  const currentSlot = AGILE_RATES[getCurrentSlotIndex()];

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ background: "#030712", minHeight: "100vh", padding: "0 0 40px", color: "#F9FAFB", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto", maxWidth: 480, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ padding: "48px 20px 16px" }}>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>{greeting} 👋</div>
        <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 2 }}>Here's how you're doing today</div>
      </div>

      {/* Saved + Earned hero */}
      <div style={{ margin: "0 20px 16px", background: "linear-gradient(135deg, #0D1F14 0%, #071510 100%)", border: "1px solid #16A34A40", borderRadius: 20, padding: "22px 20px" }}>
        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          {/* Saved */}
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Saved today</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#22C55E", letterSpacing: -1, lineHeight: 1 }}>£{savedToday}</div>
            <div style={{ fontSize: 10, color: "#4B5563", marginTop: 4 }}>{SANDBOX.todaySolarKwh} kWh solar</div>
          </div>
          <div style={{ width: 1, background: "#1F2937" }} />
          {/* Earned */}
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Earned today</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#F59E0B", letterSpacing: -1, lineHeight: 1 }}>£{earnedToday}</div>
            <div style={{ fontSize: 10, color: "#4B5563", marginTop: 4 }}>{SANDBOX.todayExportKwh} kWh exported</div>
          </div>
        </div>

        {/* Monthly + Annual */}
        <div style={{ borderTop: "1px solid #1F2937", paddingTop: 14, display: "flex", gap: 16, justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <PoundSterling size={13} color="#16A34A" />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#F9FAFB" }}>£{monthlyTotal}</div>
              <div style={{ fontSize: 10, color: "#6B7280" }}>this month</div>
            </div>
          </div>
          <div style={{ width: 1, background: "#1F2937" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <TrendingUp size={13} color="#F59E0B" />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#F9FAFB" }}>£{monthlyTotal * 12}</div>
              <div style={{ fontSize: 10, color: "#6B7280" }}>projected/yr</div>
            </div>
          </div>
        </div>
      </div>

      {/* Gridly decision */}
      <div style={{ margin: "0 20px 16px", background: "#111827", border: "1px solid #16A34A40", borderRadius: 16, padding: "12px 16px" }}>
        <div style={{ fontSize: 10, color: "#16A34A", fontWeight: 700, letterSpacing: 1.2, marginBottom: 4 }}>GRIDLY DECISION</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#22C55E", marginBottom: 3, letterSpacing: -0.5 }}>HOLDING</div>
        <div style={{ fontSize: 12, color: "#9CA3AF" }}>
          Price {currentSlot?.pence}p — waiting for cheaper slot at 03:00 (4.8p). Saving {(currentSlot?.pence - 4.8).toFixed(1)}p/kWh
        </div>
      </div>

      {/* Agile chart */}
      <div style={{ margin: "0 20px" }}>
        <AgileChart />
      </div>

      {/* Connected devices */}
      <div style={{ margin: "0 20px 16px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>Connected Devices</div>
        <div style={{ display: "grid", gap: 8 }}>
          {connectedDevices.map(device => {
            const Icon = device.icon;
            return (
              <div key={device.id} style={{ background: "#111827", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #1F2937" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ background: `${device.color}20`, borderRadius: 8, padding: 8 }}>
                    <Icon size={18} color={device.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#F9FAFB", marginBottom: 2 }}>{device.name}</div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>{device.status}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: device.color }}>+£{device.monthlyValue}/mo</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unlock next device */}
      {nextDevice && (
        <div style={{ margin: "0 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>Unlock More</div>
          <button style={{ width: "100%", background: `${nextDevice.color}10`, border: `2px solid ${nextDevice.color}40`, borderRadius: 10, padding: "14px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ background: `${nextDevice.color}30`, borderRadius: 8, padding: 8 }}>
                <AlertCircle size={18} color={nextDevice.color} />
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#F9FAFB", marginBottom: 2 }}>Add {nextDevice.name}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>Unlock +£{nextDevice.monthlyValue}/month</div>
              </div>
            </div>
            <ChevronRight size={20} color={nextDevice.color} />
          </button>
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 24, fontSize: 10, color: "#374151" }}>
        Gridly · Live
      </div>
    </div>
  );
}
