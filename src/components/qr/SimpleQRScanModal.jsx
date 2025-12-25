import React from "react";
import { QrReader } from "react-qr-reader";

export default function SimpleQRScanModal({
  open,
  onClose,
  onScan,
  errorText,
}) {
  return open ? (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.5)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="modal-container"
        style={{
          maxWidth: 400,
          minHeight: 320,
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          padding: 24,
          position: "relative",
          width: "90vw",
          maxHeight: "90vh",
          overflow: "auto",
        }}
      >
        <div className="modal-header">
          <h2>Scan QR Code</h2>
          <button onClick={onClose}>&times;</button>
        </div>
        <div className="modal-content" style={{ textAlign: "center" }}>
          <QrReader
            constraints={{ facingMode: "environment" }}
            onResult={(result, error) => {
              if (!!result) {
                onScan(result?.text);
              }
            }}
            style={{ width: "100%" }}
          />
          {errorText && (
            <div style={{ color: "#ef4444", marginTop: 8 }}>{errorText}</div>
          )}
          <div style={{ marginTop: 12, color: "#64748b" }}>
            Aponte a câmara para o QR code enviado por email.
          </div>
        </div>
        <div className="modal-footer">
          <button className="footer-button cancel" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  ) : null;
}
