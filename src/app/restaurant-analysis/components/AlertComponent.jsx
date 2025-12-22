import React from "react";
import * as LucideIcons from "lucide-react";

const AlertComponent = ({ variant = "info", icon, title, description }) => {
  const getIcon = () => {
    const iconProps = { size: 24, strokeWidth: 2 };

    // If a specific icon is provided, use it
    if (icon) {
      const IconComponent = LucideIcons[icon];
      if (IconComponent) {
        return <IconComponent {...iconProps} className={`icon-${variant}`} />;
      }
      console.warn(`Icon "${icon}" not found in lucide-react`);
    }

    // Otherwise, use default icons based on variant
    switch (variant) {
      case "error":
        return (
          <LucideIcons.AlertCircle {...iconProps} className="icon-error" />
        );
      case "warning":
        return (
          <LucideIcons.AlertTriangle {...iconProps} className="icon-warning" />
        );
      case "success":
        return (
          <LucideIcons.CheckCircle {...iconProps} className="icon-success" />
        );
      case "info":
        return <LucideIcons.Info {...iconProps} className="icon-info" />;
      default:
        return <LucideIcons.Info {...iconProps} className="icon-info" />;
    }
  };

  return (
    <div className={`alert-component variant-${variant}`}>
      <div className="alert-icon">{getIcon()}</div>
      <div className="alert-content">
        {title && <h4 className="alert-title">{title}</h4>}
        {description && <p className="alert-description">{description}</p>}
      </div>
    </div>
  );
};

export default AlertComponent;
