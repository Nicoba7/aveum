import { Sun, Battery, Zap, Grid3X3, CheckCircle2, ExternalLink, AlertCircle } from "lucide-react";

interface DeviceStatus {
  id: string;
  name: string;
  category: string;
  connected: boolean;
  connectedAt?: Date;
  brand?: string;
  icon: React.ElementType;
  color: string;
  monthlyValue: number;
}

const DEVICES_STATUS: DeviceStatus[] = [
  { id: "solar", name: "Solar Inverter", category: "Generation", connected: true, connectedAt: new Date("2024-01-15"), brand: "GivEnergy", icon: Sun, color: "#F59E0B", monthlyValue: 35 },
  { id: "battery", name: "Home Battery", category: "Storage", connected: true, connectedAt: new Date("2024-01-15"), brand: "GivEnergy", icon: Battery, color: "#16A34A", monthlyValue: 32 },
  { id: "ev", name: "EV Charger", category: "Transport", connected: false, icon: Zap, color: "#38BDF8", monthlyValue: 26 },
  { id: "grid", name: "Smart Pricing", category: "Grid", connected: false, icon: Grid3X3, color: "#A78BFA", monthlyValue: 15 },
];

export default function DeviceManagement() {
  const connectedCount = DEVICES_STATUS.filter((d) => d.connected).length;
  const totalValue = DEVICES_STATUS.filter((d) => d.connected).reduce((sum, d) => sum + d.monthlyValue, 0);
  const potentialValue = DEVICES_STATUS.reduce((sum, d) => sum + d.monthlyValue, 0);

  return (
    <div style={{ background: "linear-gradient(135deg, #111827 0%, #0F1419 100%)", minHeight: "100vh", padding: "20px", color: "#F9FAFB", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto" }}>
      <div style={{ marginBottom: 24, marginTop: 12 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, letterSpacing: -0.5 }}>Your Devices</h1>
        <p style={{ fontSize: 14, color: "#9CA3AF" }}>Manage your energy system</p>
      </div>

      <div style={{ background: "#1F2937", border: "1px solid #374151", borderRadius: 12, padding: "16px", marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Connected</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#22C55E" }}>{connectedCount}/{DEVICES_STATUS.length}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Current Value</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#16A34A" }}>£{totalValue}</div>
            <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>per month</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Full Potential</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#F59E0B" }}>£{potentialValue}</div>
            <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>per month</div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Connected</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          {DEVICES_STATUS.filter((d) => d.connected).map((device) => {
            const Icon = device.icon;
            return (
              <div key={device.id} style={{ background: "#1F2937", border: `1px solid ${device.color}40`, borderRadius: 10, padding: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ background: `${device.color}20`, borderRadius: 8, padding: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={20} color={device.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#F9FAFB", marginBottom: 2 }}>{device.name}</div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>{device.brand} · Connected {device.connectedAt?.toLocaleDateString()}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: device.color }}>+£{device.monthlyValue}</div>
                  <CheckCircle2 size={20} color={device.color} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {DEVICES_STATUS.filter((d) => !d.connected).length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Available to Connect</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
            {DEVICES_STATUS.filter((d) => !d.connected).map((device) => {
              const Icon = device.icon;
              return (
                <button key={device.id} style={{ background: "#1F2937", border: "1px solid #374151", borderRadius: 10, padding: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ background: `${device.color}20`, borderRadius: 8, padding: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon size={20} color={device.color} />
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#F9FAFB", marginBottom: 2 }}>{device.name}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>Unlock +£{device.monthlyValue}/month</div>
                    </div>
                  </div>
                  <ExternalLink size={18} color={device.color} style={{ opacity: 0.6 }} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ background: "#0D1F14", border: "1px solid #16A34A40", borderRadius: 12, padding: "16px" }}>
        <div style={{ fontSize: 10, color: "#16A34A", fontWeight: 700, letterSpacing: 1.2, marginBottom: 12, textTransform: "uppercase" }}>Your Roadmap</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#22C55E", marginBottom: 8 }}>Phase 1: Foundation</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.6 }}>You've set up solar + battery. Next step: connect your EV charger for peak-rate management and smart charging from solar or cheap grid hours.</div>
          </div>
          <div style={{ paddingTop: 12, borderTop: "1px solid #16A34A20" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#F59E0B", marginBottom: 8 }}>Phase 2: Optimization</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.6 }}>Full system active. Your home is now avoiding peak pricing, capturing arbitrage, and exporting at peak rates.</div>
          </div>
          <div style={{ paddingTop: 12, borderTop: "1px solid #16A34A20" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#A78BFA", marginBottom: 8 }}>Phase 3: Grid Services (Coming 2025)</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.6 }}>Your system joins the National Grid's flexibility market for additional revenue streams.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
