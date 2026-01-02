import React from "react";

const MetricCardComponent = ({
  title,
  value,
  subtitle,
  variant = "default",
  footer,
  trend,
}) => {
  return (
    <div className={`metric-card-component variant-${variant}`}>
      <div className="metric-card-header">
        <h4>{title}</h4>
      </div>
      <div className="metric-card-body">
        <div className="metric-value">
          {value}
          {trend && (
            <span className={`trend-indicator trend-${trend}`}>
              {trend === "up" && "↑"}
              {trend === "down" && "↓"}
            </span>
          )}
        </div>
        {subtitle && <div className="metric-subtitle">{subtitle}</div>}
      </div>
      {footer && <div className="metric-card-footer">{footer}</div>}
    </div>
  );
};

export default MetricCardComponent;
