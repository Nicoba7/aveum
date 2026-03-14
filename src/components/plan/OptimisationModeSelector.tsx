import { OptimisationMode, OptimisationModeViewModel } from "./planViewModels";

export default function OptimisationModeSelector({
  viewModel,
  onChange,
}: {
  viewModel: OptimisationModeViewModel;
  onChange: (mode: OptimisationMode) => void;
}) {
  return (
    <div style={{ margin: "0 20px 16px", background: "#0D1117", border: "1px solid #1F2937", borderRadius: 16, padding: "14px 16px" }}>
      <div style={{ fontSize: 10, color: "#93C5FD", fontWeight: 700, letterSpacing: 1.5, marginBottom: 10 }}>OPTIMISATION MODE</div>
      <div style={{ display: "flex", gap: 8 }}>
        {viewModel.options.map((option) => (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            style={{
              flex: 1,
              background: viewModel.mode === option.id ? "#60A5FA" : "#0F172A",
              color: viewModel.mode === option.id ? "#FFFFFF" : "#94A3B8",
              border: "1px solid #334155",
              borderRadius: 16,
              padding: "10px 12px",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div>{option.label}</div>
            <div style={{ fontSize: 10, color: viewModel.mode === option.id ? "#E0F2FE" : "#6B7280" }}>{option.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
