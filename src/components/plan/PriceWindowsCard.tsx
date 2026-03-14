import { PriceWindowsViewModel, getBarColor } from "./planViewModels";
import { useState } from "react";

export default function PriceWindowsCard({
  viewModel,
  rates,
  currentSlot,
}: {
  viewModel: PriceWindowsViewModel;
  rates: { time: string; pence: number }[];
  currentSlot: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const maxPence = Math.max(...rates.map((r) => r.pence));
  const minPence = Math.min(...rates.map((r) => r.pence));

  return (
    <div style={{ margin: "0 20px 16px", background: "#0D1117", border: "1px solid #1F2937", borderRadius: 16, padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "#4B5563", fontWeight: 700, letterSpacing: 1 }}>ENERGY PRICES RIGHT NOW</div>
        <div style={{ fontSize: 12, color: "#9CA3AF" }}>
          Now: <span style={{ color: getBarColor(rates[currentSlot]?.pence ?? 0), fontWeight: 700 }}>{rates[currentSlot]?.pence ?? "—"}p</span>
        </div>
      </div>

      {hovered !== null && (
        <div style={{ fontSize: 11, color: "#F9FAFB", background: "#1F2937", borderRadius: 6, padding: "3px 8px", display: "inline-block", marginBottom: 6 }}>
          {rates[hovered].time} · <span style={{ color: getBarColor(rates[hovered].pence), fontWeight: 700 }}>{rates[hovered].pence}p</span>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 72 }}>
        {rates.map((r, i) => (
          <div
            key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", cursor: "pointer" }}
          >
            <div
              style={{
                width: "100%",
                height: Math.max(2, (r.pence / maxPence) * 72),
                background: r.pence === minPence ? "#22C55E" : i === currentSlot ? "#fff" : getBarColor(r.pence),
                opacity: hovered !== null && hovered !== i ? 0.3 : 1,
                borderRadius: "2px 2px 0 0",
                transition: "opacity 0.1s",
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: "flex", marginTop: 4 }}>
        {rates.map((r, i) => (
          <div key={i} style={{ flex: 1, fontSize: 8, textAlign: "center", color: i === currentSlot ? "#fff" : "#374151" }}>
            {i % 4 === 0 ? r.time.split(":")[0] : ""}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: "#4B5563" }}>
        <span>
          🟢 Cheapest: <span style={{ color: "#22C55E", fontWeight: 700 }}>{viewModel.cheapestRate}p</span> ({viewModel.cheapestWindow})
        </span>
        <span>
          🔴 Peak: <span style={{ color: "#EF4444", fontWeight: 700 }}>{viewModel.peakRate}p</span> ({viewModel.peakWindow})
        </span>
      </div>
      {viewModel.solarWindow && (
        <div style={{ marginTop: 8, fontSize: 10, color: "#4B5563" }}>
          ☀️ Solar peak around {viewModel.solarWindow} — {viewModel.solarStrength}
        </div>
      )}
    </div>
  );
}
