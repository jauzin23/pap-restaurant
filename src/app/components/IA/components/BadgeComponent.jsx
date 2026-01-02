import React from "react";
import * as LucideIcons from "lucide-react";

const BadgeComponent = ({ text, icon, variant = "default" }) => {
  const getIconComponent = (iconName) => {
    if (!iconName) return null;
    const Icon = LucideIcons[iconName];
    if (!Icon) {
      console.warn(`Icon "${iconName}" not found in lucide-react`);
      return null;
    }
    return <Icon size={14} strokeWidth={2} />;
  };

  return (
    <span className={`badge-component variant-${variant}`}>
      {icon && <span className="badge-icon">{getIconComponent(icon)}</span>}
      {text}
    </span>
  );
};

export default BadgeComponent;
