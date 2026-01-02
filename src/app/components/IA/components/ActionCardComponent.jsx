import React from "react";

const ActionCardComponent = ({
  ranking,
  title,
  category,
  description,
  impact = {},
  effort,
  timeline,
  confidence,
  steps = [],
  metrics = [],
}) => {
  return (
    <div className="action-card-component">
      <div className="action-ranking">#{ranking}</div>

      <div className="action-header">
        <div className="action-category">{category}</div>
        <h3 className="action-title">{title}</h3>
        <p className="action-description">{description}</p>
      </div>

      <div className="action-metrics-grid">
        <div className="metric-box impact">
          <div className="metric-label">Impacto</div>
          <div className="metric-value">
            {typeof impact.revenue === "number"
              ? `+€${impact.revenue.toFixed(2)}`
              : impact.revenue}
          </div>
          {impact.percentage && (
            <div className="metric-sub">{impact.percentage}</div>
          )}
        </div>

        <div className="metric-box effort">
          <div className="metric-label">Esforço</div>
          <div className={`metric-value effort-${effort}`}>{effort}</div>
        </div>

        <div className="metric-box timeline">
          <div className="metric-label">Prazo</div>
          <div className="metric-value">{timeline}</div>
        </div>

        <div className="metric-box confidence">
          <div className="metric-label">Confiança</div>
          <div className={`metric-value confidence-${confidence}`}>
            {confidence}
          </div>
        </div>
      </div>

      {steps.length > 0 && (
        <div className="action-steps">
          <h4>Passos de Implementação</h4>
          <ol>
            {steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {metrics.length > 0 && (
        <div className="action-success-metrics">
          <h4>Métricas de Sucesso</h4>
          <ul>
            {metrics.map((metric, index) => (
              <li key={index}>{metric}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ActionCardComponent;
