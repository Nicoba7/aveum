import { PlanSummaryViewModel } from "./planViewModels";

export default function AIPlanSummaryCard({ viewModel }: { viewModel: PlanSummaryViewModel }) {
  return (
    <div style={{ margin: "0 20px 8px" }}>
      <div style={{ fontSize: 13, color: "#90A0B5", lineHeight: 1.62 }}>{viewModel.summary}</div>
    </div>
  );
}
