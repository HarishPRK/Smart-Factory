import type {
  ButtonHTMLAttributes,
  CSSProperties,
  ReactNode,
} from "react";

export type KpiCardStatusTone =
  | "neutral"
  | "positive"
  | "warning"
  | "critical";

type KpiCardStyle = CSSProperties & {
  "--kpi-accent": string;
  "--kpi-accent-rgb": string;
  "--kpi-enter-delay": string;
};

interface KpiCardProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  accent: string;
  accentRgb: string;
  actionCue?: "open" | "external";
  delayIndex?: number;
  icon: ReactNode;
  label: string;
  primary?: ReactNode;
  secondary?: ReactNode;
  selected?: boolean;
  status?: ReactNode;
  statusTone?: KpiCardStatusTone;
  visual?: ReactNode;
  variant?: "metric" | "module" | "live";
}

const LaunchArrow = ({ external }: { external: boolean }) => (
  <svg
    aria-hidden="true"
    className="kpi-card__launch-arrow"
    viewBox="0 0 16 16"
  >
    {external ? (
      <path d="M4 12 12 4M6 4h6v6" />
    ) : (
      <path d="m6 3 5 5-5 5" />
    )}
  </svg>
);

/**
 * Shared chrome for the KPI rail.
 *
 * Measurements expose their reading. Launchers and live feeds expose their
 * name and essential status; the destination carries the detailed content.
 */
const KpiCard = ({
  accent,
  accentRgb,
  actionCue = "open",
  "aria-label": ariaLabel,
  className = "",
  delayIndex = 0,
  icon,
  label,
  primary,
  secondary,
  selected = false,
  status,
  statusTone = "neutral",
  style,
  type = "button",
  visual,
  variant = "module",
  ...buttonProps
}: KpiCardProps) => {
  const cardStyle: KpiCardStyle = {
    "--kpi-accent": accent,
    "--kpi-accent-rgb": accentRgb,
    "--kpi-enter-delay": `${Math.min(delayIndex, 7) * 35}ms`,
    ...style,
  };

  return (
    <button
      {...buttonProps}
      type={type}
      aria-label={ariaLabel}
      aria-pressed={variant === "metric" ? selected : undefined}
      className={`kpi-card kpi-card--${variant}${selected ? " is-selected" : ""} ${className}`.trim()}
      style={cardStyle}
    >
      <span aria-hidden="true" className="kpi-card__signal" />

      <span className="kpi-card__header">
        <span className="kpi-card__identity">
          <span aria-hidden="true" className="kpi-card__icon">
            {icon}
          </span>
          <span className="kpi-card__label">{label}</span>
        </span>

        {status !== undefined && status !== null ? (
          <span
            className={`kpi-card__status kpi-card__status--${statusTone}`}
          >
            {status}
          </span>
        ) : null}

      </span>

      {variant === "metric" ? (
        <span className="kpi-card__body">
          <span className="kpi-card__reading">
            {primary !== undefined && primary !== null ? (
              <span className="kpi-card__primary">{primary}</span>
            ) : null}
            {secondary !== undefined && secondary !== null ? (
              <span className="kpi-card__secondary">{secondary}</span>
            ) : null}
          </span>
          {visual ? <span aria-hidden="true" className="kpi-card__visual">{visual}</span> : null}
        </span>
      ) : (
        <span className="kpi-card__workspace-body">
          {primary !== undefined && primary !== null ? <span className="kpi-card__workspace-reading">{primary}{secondary ? <small>{secondary}</small> : null}</span> : null}
          {visual ? <span className="kpi-card__workspace-visual" aria-hidden="true">{visual}</span> : null}
          <span aria-hidden="true" className="kpi-card__launch"><LaunchArrow external={actionCue === "external"} /></span>
        </span>
      )}
    </button>
  );
};

export default KpiCard;
