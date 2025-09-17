"use client";

import { useRef, useState, useCallback } from "react";
import {
  Cropper,
  CircleStencil,
  RectangleStencil,
} from "react-advanced-cropper";
import "react-advanced-cropper/dist/style.css";
import { Crop, X } from "lucide-react";

export default function ImageCropper({ imagePreview, onCropApply, onCancel }) {
  const cropperRef = useRef(null);
  const [shape, setShape] = useState("rectangle"); // "rectangle" | "circle"

  const applyCrop = useCallback(() => {
    const cropper = cropperRef.current;
    if (!cropper) return;

    try {
      // Exportar imagem já cortada do cropper
      const canvas = cropper.getCanvas();

      if (!canvas) {
        console.error("Falha ao gerar canvas");
        return;
      }

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], `cropped_${Date.now()}.jpg`, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            onCropApply(file);
          }
        },
        "image/jpeg",
        0.9
      );
    } catch (err) {
      console.error("Erro ao aplicar crop:", err);
    }
  }, [onCropApply]);

  return (
    <div>
      <Cropper
        ref={cropperRef}
        src={imagePreview}
        className="cropper"
        style={{
          height: 400,
          width: "100%",
          marginBottom: "16px",
        }}
        stencilComponent={shape === "circle" ? CircleStencil : RectangleStencil}
        stencilProps={{
          movable: true,
          resizable: true,
          lines: true,
          handlers: true,
          minWidth: 50,
          minHeight: 50,
        }}
        imageRestriction="stencil"
      />

      {/* Switch Shape */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          justifyContent: "center",
          marginBottom: "12px",
        }}
      >
        <button
          onClick={() => setShape("rectangle")}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            background: shape === "rectangle" ? "#3b82f6" : "#f1f5f9",
            color: shape === "rectangle" ? "white" : "#111",
            cursor: "pointer",
          }}
        >
          Quadrado/Retângulo
        </button>
        <button
          onClick={() => setShape("circle")}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            background: shape === "circle" ? "#3b82f6" : "#f1f5f9",
            color: shape === "circle" ? "white" : "#111",
            cursor: "pointer",
          }}
        >
          Círculo
        </button>
      </div>

      {/* Botões */}
      <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
        <button
          type="button"
          onClick={applyCrop}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            backgroundColor: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontWeight: "500",
            cursor: "pointer",
          }}
        >
          <Crop size={16} />
          Aplicar Corte
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            backgroundColor: "#6b7280",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontWeight: "500",
            cursor: "pointer",
          }}
        >
          <X size={16} />
          Cancelar
        </button>
      </div>

      {/* Estilos custom */}
      <style jsx>{`
        .cropper {
          max-width: 100%;
          height: 400px !important;
        }

        .cropper :global(.advanced-cropper-area) {
          border: 2px solid #3b82f6 !important;
          box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5) !important;
        }

        .cropper :global(.advanced-cropper-handler) {
          background-color: #3b82f6 !important;
          border: 2px solid white !important;
          border-radius: 50% !important;
          width: 14px !important;
          height: 14px !important;
        }

        .cropper :global(.advanced-cropper-image) {
          max-width: 100% !important;
          max-height: 100% !important;
          object-fit: contain !important;
        }

        .cropper-background {
          background-color: #f8fafc !important;
        }
      `}</style>
    </div>
  );
}
