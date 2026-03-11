import { useEffect, useState } from "react";
import { Sun, Home, Battery, Zap } from "lucide-react";

// ── SANDBOX DATA (swap for real API later) ────────────────────────────────
const FLOW = {
  solarW: 2840,
  homeW: 1200,
  batteryW: 820,       // positive = charging, negative = discharging
  batteryPct: 62,
  gridW: -420,         // negative = exporting, positive = importing
  evW: 0,              // 0 = not charging
};

function fmt(w: number) {
  if (w >= 1000) return `${(w / 1000).toFixed(1)}kW`;
  return `${Math.round(w)}W`;
}

// ── ANIMATED ARROW ────────────────────────────────────────────────────────
function Arrow({ active, color, vertical = false, reverse = false }: {
  active: boolean; color: string; vertical?: boolean; reverse?: boolean;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setTick(n => (n + 1) % 4), 400);
    return () => clearInterval(t);
  }, [active]);

  if (!active) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.15, flexDirection: vertical ? "column" : "row" }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: vertical ? 2 : 6, height: vertical ? 6 : 2, background: "#6B7280", margin: vertical ? "1px 0" : "0 1px", borderRadius: 1 }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: vertical ? "column" : "row", gap: vertical ? 2 : 3 }}>
      {[0, 1, 2, 3].map(i => {
        const idx = reverse ? 3 - i : i;
        const lit = idx === tick || idx === (tick + 1) % 4;
        return (
          <div key={i} style={{
            width: vertical ? 4 : 8,
            height: vertical ? 8 : 4,
            background: lit ? color : `${color}30`,
            borderRadius: 2,
            transition: "background 0.15s ease",
          }} />
        );
      })}
    </div>
  );
}

// ── NODE ──────────────────────────────────────────────────────────────────
function Node({ icon: Icon, label, value, sub, color, size = 56 }: {
  icon: any; label: string; value: string; sub?: string; color: string; size?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 72 }}>
      <div style={{ width: size, height: size, background: `${color}15`, border: `1.5px solid ${color}40`, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={size * 0.4} color={color} />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#F9FAFB", letterSpacing: -0.3 }}>{value}</div>
        <div style={{ fontSize: 10, color: "#6B7280" }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: color, fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function EnergyFlow() {
  const f = FLOW;

  const solarActive = f.solarW > 50;
  const batteryCharging = f.batteryW > 50;
  const batteryDischarging = f.batteryW < -50;
  const gridExporting = f.gridW < -50;
  const gridImporting = f.gridW > 50;
  const evCharging = f.evW > 50;

  // Solar → Home always if solar active
  const solarToHome = solarActive;
  // Solar → Battery if charging
  const solarToBattery = batteryCharging;
  // Battery → Home if discharging
  const batteryToHome = batteryDischarging;
  // Grid → Home if importing
  const gridToHome = gridImporting;
  // Home → Grid (export) if exporting
  const homeToGrid = gridExporting;

  const gridColor = gridExporting ? "#F59E0B" : gridImporting ? "#EF4444" : "#6B7280";
  const gridValue = gridExporting ? `-${fmt(Math.abs(f.gridW))}` : gridImporting ? `+${fmt(f.gridW)}` : "0W";
  const gridSub = gridExporting ? "exporting" : gridImporting ? "importing" : "idle";

  return (
    <div style={{ background: "#0D1117", border: "1px solid #1F2937", borderRadius: 12, padding: "16px 12px", marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", letterSpacing: 1, marginBottom: 16 }}>LIVE ENERGY FLOW</div>

      {/* Row 1: Solar — arrow — Home — arrow — Grid */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}>
        <Node icon={Sun} label="Solar" value={solarActive ? fmt(f.solarW) : "0W"} color="#F59E0B" />
        <Arrow active={solarToHome} color="#F59E0B" />
        <Node icon={Home} label="Home" value={fmt(f.homeW)} color="#E5E7EB" />
        <Arrow active={homeToGrid || gridToHome} color={gridColor} reverse={gridToHome} />
        <Node icon={Zap} label="Grid" value={gridValue} sub={gridSub} color={gridColor} />
      </div>

      {/* Vertical arrow: Solar/Home → Battery */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginRight: 80 }}>
          <Arrow active={solarToBattery || batteryToHome} color="#16A34A" vertical reverse={batteryToHome} />
        </div>
      </div>

      {/* Row 2: Battery */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ marginRight: 80 }}>
          <Node
            icon={Battery}
            label="Battery"
            value={`${f.batteryPct}%`}
            sub={batteryCharging ? `charging ${fmt(f.batteryW)}` : batteryDischarging ? `discharging ${fmt(Math.abs(f.batteryW))}` : "idle"}
            color="#16A34A"
          />
          {/* Battery bar */}
          <div style={{ width: 72, height: 4, background: "#1F2937", borderRadius: 99, marginTop: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${f.batteryPct}%`, background: f.batteryPct > 50 ? "#22C55E" : f.batteryPct > 20 ? "#F59E0B" : "#EF4444", borderRadius: 99, transition: "width 0.5s ease" }} />
          </div>
        </div>
      </div>

      {/* Status line */}
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #1F2937", display: "flex", justifyContent: "space-between", fontSize: 10, color: "#6B7280" }}>
        <span>{solarActive ? `☀️ ${fmt(f.solarW)} generating` : "☁️ No solar"}</span>
        <span>{batteryCharging ? "🔋 Storing" : batteryDischarging ? "🔋 Releasing" : "🔋 Idle"}</span>
        <span>{gridExporting ? `💰 Earning ${fmt(Math.abs(f.gridW))}` : gridImporting ? `⚡ Drawing ${fmt(f.gridW)}` : "⚡ Grid idle"}</span>
      </div>
    </div>
  );
}
