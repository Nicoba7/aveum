import { Battery, TrendingUp, Zap, Moon, Sun, Pause } from "lucide-react";

// ── PLAN DATA (swap for real engine output later) ─────────────────────────
const PLAN = [
  {
    time: "11:30pm",
    action: "CHARGE",
    title: "Charging your battery",
    reason: "Cheap rate — best price of the night",
    price: 4.8,
    color: "#22C55E",
    icon: Battery,
    highlight: true,
  },
  {
    time: "2:00am",
    action: "HOLD",
    title: "Battery full, resting",
    reason: "Holding until morning — nothing to do",
    price: 5.1,
    color: "#6B7280",
    icon: Moon,
    highlight: false,
  },
  {
    time: "6:00am",
    action: "HOLD",
    title: "Morning peak coming",
    reason: "Keeping battery ready to power your home",
    price: 12.4,
    color: "#6B7280",
    icon: Pause,
    highlight: false,
  },
  {
    time: "8:00am",
    action: "EXPORT",
    title: "Selling to the grid",
    reason: "Price is high — earning 31p for every unit sold",
    price: 31.2,
    color: "#F59E0B",
    icon: TrendingUp,
    highlight: true,
  },
  {
    time: "11:00am",
    action: "SOLAR",
    title: "Solar taking over",
    reason: "Sun is generating — powering your home for free",
    price: 9.6,
    color: "#F59E0B",
    icon: Sun,
    highlight: false,
  },
  {
    time: "5:30pm",
    action: "EXPORT",
    title: "Peak earnings window",
    reason: "Best price of the day — selling everything you have",
    price: 38.6,
    color: "#F59E0B",
    icon: TrendingUp,
    highlight: true,
  },
  {
    time: "8:00pm",
    action: "CHARGE",
    title: "Topping up for tomorrow",
    reason: "Price dropping — refilling ready for the morning",
    price: 11.8,
    color: "#22C55E",
    icon: Battery,
    highlight: false,
  },
];

// ── SUMMARY STATS ─────────────────────────────────────────────────────────
const SUMMARY = {
  projectedEarnings: 2.84,
  projectedSavings: 1.92,
  cheapestSlot: "11:30pm",
  cheapestPrice: 4.8,
  peakSlot: "5:30pm",
  peakPrice: 38.6,
};

function getActionLabel(action: string) {
  switch (action) {
    case "CHARGE": return "Charging";
    case "EXPORT": return "Selling";
    case "HOLD": return "Resting";
    case "SOLAR": return "Solar";
    default: return action;
  }
}

function getActionBg(action: string) {
  switch (action) {
    case "CHARGE": return { bg: "#16A34A20", border: "#22C55E40", badge: "#16A34A", badgeText: "#22C55E" };
    case "EXPORT": return { bg: "#92400E20", border: "#F59E0B40", badge: "#92400E", badgeText: "#F59E0B" };
    case "HOLD": return { bg: "#11182720", border: "#37415140", badge: "#374151", badgeText: "#9CA3AF" };
    case "SOLAR": return { bg: "#92400E15", border: "#F59E0B30", badge: "#78350F", badgeText: "#FCD34D" };
    default: return { bg: "#11182720", border: "#37415140", badge: "#374151", badgeText: "#9CA3AF" };
  }
}

export default function NightlyPlan() {
  const net = (SUMMARY.projectedEarnings + SUMMARY.projectedSavings).toFixed(2);

  return (
    <div style={{ background: "#0D1117", border: "1px solid #1F2937", borderRadius: 12, padding: "16px", marginBottom: 16 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", letterSpacing: 1, marginBottom: 4 }}>GRIDLY'S PLAN FOR TONIGHT</div>
          <div style={{ fontSize: 13, color: "#9CA3AF" }}>Already sorted — nothing you need to do</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 2 }}>Projected value</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#22C55E", letterSpacing: -0.5 }}>+£{net}</div>
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1, background: "#16A34A15", border: "1px solid #16A34A30", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 10, color: "#6B7280", marginBottom: 2 }}>Cheapest slot</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#22C55E" }}>{SUMMARY.cheapestPrice}p</div>
          <div style={{ fontSize: 10, color: "#4B5563" }}>{SUMMARY.cheapestSlot}</div>
        </div>
        <div style={{ flex: 1, background: "#92400E15", border: "1px solid #F59E0B30", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 10, color: "#6B7280", marginBottom: 2 }}>Best selling slot</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#F59E0B" }}>{SUMMARY.peakPrice}p</div>
          <div style={{ fontSize: 10, color: "#4B5563" }}>{SUMMARY.peakSlot}</div>
        </div>
        <div style={{ flex: 1, background: "#1E3A5F15", border: "1px solid #3B82F630", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 10, color: "#6B7280", marginBottom: 2 }}>You earn</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#60A5FA" }}>£{SUMMARY.projectedEarnings}</div>
          <div style={{ fontSize: 10, color: "#4B5563" }}>grid export</div>
        </div>
      </div>

      {/* Plan timeline */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {PLAN.map((slot, i) => {
          const Icon = slot.icon;
          const style = getActionBg(slot.action);
          const isLast = i === PLAN.length - 1;
          return (
            <div key={i} style={{ display: "flex", gap: 12, position: "relative" }}>

              {/* Timeline line */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 32, flexShrink: 0 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: style.bg, border: `1.5px solid ${style.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 1 }}>
                  <Icon size={13} color={slot.color} />
                </div>
                {!isLast && <div style={{ width: 1.5, flex: 1, background: "#1F2937", minHeight: 16 }} />}
              </div>

              {/* Content */}
              <div style={{ flex: 1, paddingBottom: isLast ? 0 : 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: slot.highlight ? "#F9FAFB" : "#9CA3AF" }}>
                    {slot.title}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: slot.color }}>{slot.price}p</span>
                    <span style={{ fontSize: 9, background: style.badge, color: style.badgeText, padding: "1px 5px", borderRadius: 4, fontWeight: 700, letterSpacing: 0.5 }}>
                      {getActionLabel(slot.action)}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#4B5563", marginBottom: 2 }}>{slot.reason}</div>
                <div style={{ fontSize: 10, color: "#374151" }}>{slot.time}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #1F2937", fontSize: 11, color: "#4B5563", textAlign: "center" }}>
        Plan updates every 30 minutes as prices change · You don't need to do anything
      </div>
    </div>
  );
}
