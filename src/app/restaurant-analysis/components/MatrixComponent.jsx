import React from "react";
import * as LucideIcons from "lucide-react";

const MatrixComponent = ({ title, medians, quadrants }) => {
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
      console.warn(
        `Icon "${iconName}" not found in lucide-react. Available chess icons:`,
        Object.keys(LucideIcons).filter(
          (key) =>
            key.toLowerCase().includes("chess") ||
            key.toLowerCase().includes("knight")
        )
      );
      return null;
    }

    return <Icon size={20} strokeWidth={2} />;
  };

  const renderQuadrant = (quadrant, position) => {
    if (!quadrant) {
      console.warn(`Quadrant for position "${position}" is undefined`);
      return null;
    }

    if (!quadrant.items || !Array.isArray(quadrant.items)) {
      console.warn(`Quadrant "${position}" has no items array`);
      return null;
    }

    return (
      <div className={`matrix-quadrant quadrant-${position}`}>
        <div
          className="quadrant-header"
          style={{ borderColor: quadrant.color }}
        >
          <h4>
            {quadrant.icon && (
              <span className="quadrant-icon">
                {getIconComponent(quadrant.icon)}
              </span>
            )}
            {quadrant.label}
          </h4>
          <p>{quadrant.description}</p>
        </div>
        <div className="quadrant-items">
          {quadrant.items.map((item, index) => (
            <div key={index} className="quadrant-item">
              <div className="item-name">{item.nome}</div>
              <div className="item-stats">
                <span>€{item.preco.toFixed(2)}</span>
                <span>{item.vendas} vendas</span>
                <span>€{item.receita.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!quadrants) {
    console.error("MatrixComponent: quadrants prop is required");
    return (
      <div className="matrix-component">
        <div style={{ padding: "2rem", textAlign: "center", color: "#ef4444" }}>
          Error: Matrix data is missing
        </div>
      </div>
    );
  }

  return (
    <div className="matrix-component">
      {title && <h4 className="matrix-title">{title}</h4>}

      {medians && (
        <div className="matrix-info">
          <span>Mediana Vendas: {medians.vendas}</span>
          <span>Mediana Preço: €{medians.preco.toFixed(2)}</span>
        </div>
      )}

      <div className="matrix-grid">
        <div className="matrix-labels">
          <div className="label-vertical">← Baixo Preço | Alto Preço →</div>
          <div className="label-horizontal">
            ↑ Alta Popularidade | Baixa Popularidade ↓
          </div>
        </div>

        <div className="matrix-quadrants">
          {renderQuadrant(quadrants.plowhorses, "top-left")}
          {renderQuadrant(quadrants.stars, "top-right")}
          {renderQuadrant(quadrants.dogs, "bottom-left")}
          {renderQuadrant(quadrants.puzzles, "bottom-right")}
        </div>
      </div>
    </div>
  );
};

export default MatrixComponent;
