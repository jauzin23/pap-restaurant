import React from "react";
import * as LucideIcons from "lucide-react";
import BadgeComponent from "./BadgeComponent";

const SectionComponent = ({ title, description, icon, badge, children }) => {
  const getIconComponent = (iconName) => {
    if (!iconName) return null;
    const Icon = LucideIcons[iconName];
    if (!Icon) {
      console.warn(`Icon "${iconName}" not found in lucide-react`);
      return null;
    }
    return <Icon size={24} strokeWidth={2} />;
  };

  return (
    <section className="section-component">
      <div className="section-header">
        <div className="section-title-group">
          {icon && (
            <span className="section-icon">{getIconComponent(icon)}</span>
          )}
          <h2>{title}</h2>
          {badge && <BadgeComponent {...badge} />}
        </div>
        {description && <p className="section-description">{description}</p>}
      </div>
      <div className="section-content">{children}</div>
    </section>
  );
};

export default SectionComponent;
