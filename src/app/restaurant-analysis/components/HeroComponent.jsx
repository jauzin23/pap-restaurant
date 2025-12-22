import React from "react";
import * as LucideIcons from "lucide-react";
import BadgeComponent from "./BadgeComponent";

const HeroComponent = ({
  title,
  description,
  metrics = [],
  highlights = [],
}) => {
  const getTrendIcon = (trend) => {
    const iconProps = { size: 16, strokeWidth: 2.5 };
    switch (trend) {
      case "up":
        return <LucideIcons.TrendingUp {...iconProps} />;
      case "down":
        return <LucideIcons.TrendingDown {...iconProps} />;
      default:
        return <LucideIcons.Minus {...iconProps} />;
    }
  };

  const getIconComponent = (iconName) => {
    if (!iconName) return null;

    // Try the exact name first
    let Icon = LucideIcons[iconName];

    // If not found, try common variations
    if (!Icon) {
      // Try without 'Chess' prefix (e.g., ChessKnight -> Knight)
      const withoutPrefix = iconName.replace("Chess", "");
      Icon = LucideIcons[withoutPrefix];

      if (Icon) {
        console.log(`Icon "${iconName}" mapped to "${withoutPrefix}"`);
      }
    }

    if (!Icon) {
      console.warn(`Icon "${iconName}" not found in lucide-react`);
      return null;
    }

    return <Icon size={20} strokeWidth={2} />;
  };

  return (
    <div className="hero-component">
      <div className="hero-header">
        <h1>{title}</h1>
        {description && <p className="hero-description">{description}</p>}
      </div>

      {metrics.length > 0 && (
        <div className="hero-metrics">
          {metrics.map((metric, index) => (
            <div
              key={index}
              className={`metric-item trend-${metric.trend || "neutral"}`}
            >
              <span className="metric-label">{metric.label}</span>
              <span className="metric-value">
                {metric.value}
                {(metric.trend === "up" || metric.trend === "down") && (
                  <span className="metric-trend">
                    {getTrendIcon(metric.trend)}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {highlights.length > 0 && (
        <div className="hero-highlights">
          {highlights.map((highlight, index) => {
            const iconName = highlight.icon || "Info";
            return (
              <div key={index} className={`highlight-item`}>
                <span className="highlight-icon">
                  {getIconComponent(iconName)}
                </span>
                <span className="highlight-text">{highlight.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HeroComponent;
