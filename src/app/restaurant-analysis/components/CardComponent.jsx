import React from "react";
import ComponentRenderer from "../ComponentRenderer";

const CardComponent = ({
  variant = "default",
  title,
  subtitle,
  content,
  priceChange,
  impact,
  confidence,
  reasoning,
  data,
  items,
  pricing,
}) => {
  return (
    <div className={`card-component variant-${variant}`}>
      {title && (
        <div className="card-header">
          <h3 className="card-title">{title}</h3>
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
      )}

      <div className="card-body">
        {/* Price Change Card */}
        {priceChange && (
          <div
            className={`price-change-section ${
              Number(priceChange.percentage) < 0
                ? "price-decrease"
                : "price-increase"
            }`}
          >
            <div className="price-row">
              <span className="price-from">
                {typeof priceChange.from === "number"
                  ? `€${Number(priceChange.from).toFixed(2)}`
                  : priceChange.from}
              </span>
              <span className="arrow">→</span>
              <span className="price-to">
                {typeof priceChange.to === "number"
                  ? `€${Number(priceChange.to).toFixed(2)}`
                  : priceChange.to}
              </span>
              <span className="percentage">
                {Number(priceChange.percentage) >= 0 ? "+" : ""}
                {priceChange.percentage}%
              </span>
            </div>
          </div>
        )}

        {/* Impact - Only show if NOT a combo card and impact is numeric */}
        {impact && !items && !pricing && typeof impact !== "string" && (
          <div
            className={`impact-section ${
              Number(impact.monthly || impact) < 0
                ? "impact-negative"
                : "impact-positive"
            }`}
          >
            <div className="impact-label">Impacto Mensal</div>
            <div className="impact-value">
              {Number(impact.monthly || impact) >= 0 ? "+" : ""}€
              {Number(impact.monthly || impact).toFixed(2)}
            </div>
            {impact.percentage && (
              <div className="impact-percentage">
                {Number(impact.percentage) >= 0 ? "+" : ""}
                {impact.percentage}% receita
              </div>
            )}
          </div>
        )}

        {/* Confidence */}
        {confidence && (
          <div className="confidence-section">
            <span className="confidence-badge confidence-{confidence}">
              {confidence}
            </span>
          </div>
        )}

        {/* Reasoning */}
        {reasoning && (
          <div className="reasoning-section">
            <p>{reasoning}</p>
          </div>
        )}

        {/* Data points */}
        {data && (
          <div className="data-points">
            {Object.entries(data).map(([key, value]) => (
              <div key={key} className="data-point">
                <span className="data-label">{key.replace(/_/g, " ")}:</span>
                <span className="data-value">{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Combo Card */}
        {items && pricing && (
          <div className="combo-section">
            <div className="combo-items">
              {items.map((item, index) => (
                <div key={index} className="combo-item">
                  {item}
                </div>
              ))}
            </div>
            <div className="combo-pricing">
              <div className="pricing-row">
                <span>Individual:</span>
                <span>€{pricing.individual.toFixed(2)}</span>
              </div>
              <div className="pricing-row combo-price">
                <span>Combo:</span>
                <span>€{pricing.combo.toFixed(2)}</span>
              </div>
              <div className="pricing-row discount">
                <span>Desconto:</span>
                <span>
                  €{pricing.discount.toFixed(2)} ({pricing.discountPercentage}%)
                </span>
              </div>
            </div>
            {impact && <div className="combo-impact">{impact}</div>}
          </div>
        )}

        {/* Generic content */}
        {content && typeof content === "string" && <p>{content}</p>}
        {content && typeof content === "object" && (
          <ComponentRenderer component={content} />
        )}
      </div>
    </div>
  );
};

export default CardComponent;
