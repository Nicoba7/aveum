import { PlanSummaryViewModel } from "./planViewModels";

export default function AIPlanSummaryCard({ viewModel }: { viewModel: PlanSummaryViewModel }) {
  return (
    <div style={{ margin: "0 20px 16px", background: "#0D1117", border: "1px solid #1F2937", borderRadius: 16, padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: "#93C5FD", fontWeight: 700, letterSpacing: 1.5 }}>{viewModel.title}</div>
        <div style={{ fontSize: 10, color: "#F9FAFB", background: "#111827", border: "1px solid #374151", borderRadius: 999, padding: "4px 8px", fontWeight: 700 }}>
          {viewModel.modeTag}
        </div>
      </div>
      <div style={{ fontSize: 13, color: "#9CA3AF", lineHeight: 1.6 }}>{viewModel.summary}</div>
      <div style={{ marginTop: 12, display: "grid", gap: 7 }}>
        {viewModel.highlights.map((highlight, index) => (
          <div key={index} style={{ fontSize: 11, color: "#94A3B8" }}>
            • {highlight}
          </div>
        ))}
      </div>
    </div>
  );
}
