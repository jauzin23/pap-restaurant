import React from "react";

const ProgressBarComponent = ({
  value = 0,
  max = 100,
  label,
  variant = "default",
}) => {
  const percentage = (value / max) * 100;

  return (
    <div className="progress-bar-component">
      {label && <div className="progress-label">{label}</div>}
      <div className="progress-track">
        <div
          className={`progress-fill variant-${variant}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="progress-value">
        {value} / {max}
      </div>
    </div>
  );
};

export default ProgressBarComponent;
