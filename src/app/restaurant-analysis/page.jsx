"use client";

import React, { useState } from "react";
import "./restaurant-analysis.scss";
import ComponentRenderer from "./ComponentRenderer";

export default function RestaurantAnalysisPage() {
  const [jsonInput, setJsonInput] = useState("");
  const [parsedData, setParsedData] = useState(null);
  const [error, setError] = useState(null);

  const handleJsonSubmit = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setParsedData(parsed);
      setError(null);
    } catch (err) {
      setError(`Erro ao processar JSON: ${err.message}`);
      setParsedData(null);
    }
  };

  const handleClear = () => {
    setJsonInput("");
    setParsedData(null);
    setError(null);
  };

  return (
    <div className="restaurant-analysis-page">
      <div className="input-section">
        <h1>🧪 Test System - Restaurant Analysis Components</h1>
        <p>
          Cole o JSON de resposta do AI no campo abaixo para visualizar os
          componentes:
        </p>

        <textarea
          className="json-input"
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder='Cole aqui o JSON... Exemplo: {"metadata": {...}, "components": [...]}'
          rows={10}
        />

        <div className="button-group">
          <button onClick={handleJsonSubmit} className="btn-primary">
            Renderizar Componentes
          </button>
          <button onClick={handleClear} className="btn-secondary">
            Limpar
          </button>
        </div>

        {error && (
          <div className="error-message">
            <strong>❌ Erro:</strong> {error}
          </div>
        )}
      </div>

      {parsedData && (
        <div className="rendered-section">
          <div className="metadata-header">
            <h2>{parsedData.metadata?.titulo || "Análise de Restaurante"}</h2>
            {parsedData.metadata?.subtitulo && (
              <p className="subtitle">{parsedData.metadata.subtitulo}</p>
            )}
            {parsedData.metadata?.periodo && (
              <span className="periodo-badge">
                {parsedData.metadata.periodo}
              </span>
            )}
            {parsedData.metadata?.resumo_executivo && (
              <p className="resumo">{parsedData.metadata.resumo_executivo}</p>
            )}
          </div>

          <div className="components-container">
            {parsedData.components?.map((component, index) => (
              <ComponentRenderer
                key={component.id || index}
                component={component}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
