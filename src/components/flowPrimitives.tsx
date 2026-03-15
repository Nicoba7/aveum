import { ENERGY_CONNECTOR_TOKENS, ENERGY_NODE_TOKENS } from "./energyUiTokens";

type FlowConnectorProps = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  active: boolean;
  color: string;
  intensity?: "home" | "plan";
};

export function FlowConnector({
  x1,
  y1,
  x2,
  y2,
  active,
  color,
  intensity = "plan",
}: FlowConnectorProps) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={active ? `${color}${ENERGY_CONNECTOR_TOKENS.activeAlpha[intensity]}` : ENERGY_CONNECTOR_TOKENS.inactiveStroke}
      strokeWidth={active ? ENERGY_CONNECTOR_TOKENS.strokeWidth.active : ENERGY_CONNECTOR_TOKENS.strokeWidth.inactive}
      strokeDasharray={ENERGY_CONNECTOR_TOKENS.dasharray}
    />
  );
}

type FlowNodeProps = {
  x: number;
  y: number;
  radius: number;
  active: boolean;
  color: string;
  value: string;
  label: string;
  valueFontSize?: number;
  valueFontWeight?: number | string;
  valueActiveColor?: string;
  valueInactiveColor?: string;
  labelColor?: string;
  labelFontSize?: number;
  labelLetterSpacing?: string;
  showHalo?: boolean;
};

export function FlowNode({
  x,
  y,
  radius,
  active,
  color,
  value,
  label,
  valueFontSize = 11,
  valueFontWeight = 700,
  valueActiveColor,
  valueInactiveColor = "#6B7280",
  labelColor = "#374151",
  labelFontSize = 8,
  labelLetterSpacing = "0.6",
  showHalo = true,
}: FlowNodeProps) {
  return (
    <>
      {showHalo && active && (
        <circle cx={x} cy={y} r={radius + 6} fill="none" stroke={`${color}${ENERGY_NODE_TOKENS.haloAlpha}`} strokeWidth="6" />
      )}
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill={active ? `${color}${ENERGY_NODE_TOKENS.activeFillAlpha}` : ENERGY_NODE_TOKENS.inactiveFill}
        stroke={active ? `${color}${ENERGY_NODE_TOKENS.activeStrokeAlpha}` : ENERGY_NODE_TOKENS.inactiveStroke}
        strokeWidth="1.5"
      />
      <text
        x={x}
        y={y - 4}
        textAnchor="middle"
        fontSize={valueFontSize}
        fontWeight={valueFontWeight}
        fill={active ? (valueActiveColor ?? color) : valueInactiveColor}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {value}
      </text>
      <text
        x={x}
        y={y + 10}
        textAnchor="middle"
        fontSize={labelFontSize}
        fill={labelColor}
        fontFamily="system-ui, -apple-system, sans-serif"
        letterSpacing={labelLetterSpacing}
      >
        {label}
      </text>
    </>
  );
}

type FlowLabelProps = {
  x: number;
  y: number;
  value: string;
  size?: number;
  color?: string;
  weight?: number | string;
};

export function FlowLabel({ x, y, value, size = 8, color = "#374151", weight = 400 }: FlowLabelProps) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={size}
      fontWeight={weight}
      fill={color}
      fontFamily="system-ui, -apple-system, sans-serif"
    >
      {value}
    </text>
  );
}
