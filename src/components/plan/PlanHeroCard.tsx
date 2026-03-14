import { PlanHeroViewModel } from "./planViewModels";

export default function PlanHeroCard({ viewModel }: { viewModel: PlanHeroViewModel }) {
  return (
    <div style={{ margin: "0 20px 16px", background: "#0D1F14", border: "1px solid #16A34A30", borderRadius: 16, padding: "18px 20px" }}>
      <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, letterSpacing: 1.5, marginBottom: 8 }}>{viewModel.title}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: "#22C55E", lineHeight: 1 }}>{viewModel.value}</div>
        {viewModel.statusNote && (
          <div style={{ fontSize: 10, color: "#94A3B8", opacity: 0.85 }}>{viewModel.statusNote}</div>
        )}
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: "#9CA3AF", lineHeight: 1.5 }}>
        {viewModel.outcomes.map((item, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            • {item}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: "#94A3B8" }}>{viewModel.trustNote}</div>
    </div>
  );
}
