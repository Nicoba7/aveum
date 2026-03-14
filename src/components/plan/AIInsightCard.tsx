import { AIInsightViewModel } from "./planViewModels";

export default function AIInsightCard({ viewModel }: { viewModel: AIInsightViewModel }) {
  return (
    <div style={{ margin: "0 20px 16px", background: "#0D1117", border: "1px solid #1F2937", borderRadius: 16, padding: "16px 20px" }}>
      <div style={{ fontSize: 10, color: "#93C5FD", fontWeight: 700, letterSpacing: 1.5, marginBottom: 10 }}>INSIGHT</div>
      <div style={{ fontSize: 13, color: "#9CA3AF", lineHeight: 1.6 }}>{viewModel.insight}</div>
    </div>
  );
}
