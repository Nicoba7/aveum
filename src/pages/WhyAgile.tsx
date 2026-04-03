import { Link } from "react-router-dom";

const tableRows = [
  {
    tariff: "Standard tariff",
    pricing: "Flat ~28p all day",
    aveumFit: "No optimisation possible",
    savings: "~£50-£120/yr",
  },
  {
    tariff: "Octopus Go",
    pricing: "Cheap overnight window ~7p",
    aveumFit: "Aveum can schedule charging",
    savings: "~£180-£320/yr",
  },
  {
    tariff: "Octopus Agile",
    pricing: "Half-hourly dynamic prices 2p-40p",
    aveumFit: "Maximum optimisation — Aveum saves and earns",
    savings: "~£350-£700/yr",
  },
];

export default function WhyAgile() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#030712",
        color: "#F9FAFB",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto",
        padding: "24px 18px 40px",
      }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <Link to="/onboarding" style={{ color: "#93C5FD", fontSize: 13, textDecoration: "none" }}>
          ← Back to onboarding
        </Link>

        <h1 style={{ margin: "14px 0 8px", fontSize: 30, lineHeight: 1.15, letterSpacing: -0.6 }}>
          Why Octopus Agile works best with Aveum
        </h1>

        <p style={{ margin: 0, color: "#9CA3AF", fontSize: 15, lineHeight: 1.6 }}>
          Aveum makes decisions every half hour. The more flexible your tariff is, the more value Aveum can unlock by charging at the cheapest times and avoiding expensive imports.
        </p>

        <div
          style={{
            marginTop: 22,
            background: "#0B1120",
            border: "1px solid #1F2937",
            borderRadius: 14,
            padding: "16px 16px 10px",
          }}
        >
          <h2 style={{ margin: "0 0 12px", fontSize: 17 }}>Three simple comparisons</h2>
          <ul style={{ margin: 0, paddingLeft: 18, color: "#D1D5DB", lineHeight: 1.8, fontSize: 14 }}>
            <li>Standard tariff — flat 28p all day. No optimisation possible.</li>
            <li>Octopus Go — cheap overnight window 7p. Aveum can schedule charging.</li>
            <li>Octopus Agile — half-hourly dynamic prices 2p-40p. Maximum optimisation — Aveum saves and earns.</li>
          </ul>
        </div>

        <div
          style={{
            marginTop: 18,
            background: "#0B1120",
            border: "1px solid #1F2937",
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #1F2937", fontSize: 12, color: "#6B7280", fontWeight: 700, letterSpacing: 0.5 }}>
            ESTIMATED ANNUAL SAVINGS
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
              <thead>
                <tr style={{ background: "#0F172A" }}>
                  <th style={thStyle}>Tariff</th>
                  <th style={thStyle}>Price structure</th>
                  <th style={thStyle}>What Aveum can do</th>
                  <th style={thStyle}>Estimated savings</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, index) => (
                  <tr key={row.tariff} style={{ borderTop: index === 0 ? "none" : "1px solid #1F2937" }}>
                    <td style={tdStyle}>{row.tariff}</td>
                    <td style={tdStyle}>{row.pricing}</td>
                    <td style={tdStyle}>{row.aveumFit}</td>
                    <td style={{ ...tdStyle, color: "#86EFAC", fontWeight: 700 }}>{row.savings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <a
            href="https://share.octopus.energy/aveum"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              background: "#22C55E",
              color: "#030712",
              textDecoration: "none",
              fontWeight: 800,
              fontSize: 14,
              padding: "11px 16px",
              borderRadius: 10,
            }}
          >
            Switch to Octopus Agile →
          </a>
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 12,
  color: "#9CA3AF",
  fontWeight: 700,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  color: "#E5E7EB",
  verticalAlign: "top",
};
