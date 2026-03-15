import { AIInsightViewModel } from "./planViewModels";

export default function AIInsightCard({ viewModel }: { viewModel: AIInsightViewModel }) {
  return (
    <div style={{ margin: "8px 20px 4px" }}>
      <div style={{ fontSize: 12, color: "#7A8CA5", lineHeight: 1.55 }}>{viewModel.insight}</div>
    </div>
  );
}
