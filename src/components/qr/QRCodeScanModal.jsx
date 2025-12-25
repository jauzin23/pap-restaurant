import React, { useRef, useEffect, useState } from "react";
// Import jsQR from local file
import jsQR from "./jsQR";

export default function QRCodeScanModal({ open, onClose, onScan, errorText }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [stream, setStream] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError("");
    setPermissionDenied(false);
    setScanning(true);
    // Start camera
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((mediaStream) => {
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play();
        }
        scanLoop();
      })
      .catch(() => {
        setPermissionDenied(true);
        setError(
          "Permissão da câmara negada. Tente novamente e permita o acesso à câmara."
        );
        setScanning(false);
      });
    return () => {
      setScanning(false);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
    // eslint-disable-next-line
  }, [open]);

  const scanLoop = () => {
    if (!scanning) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      const ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data) {
        setScanning(false);
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
        onScan(code.data);
        return;
      }
    }
    requestAnimationFrame(scanLoop);
  };

  return open ? (
    <div className="modal-overlay">
      <div
        className="modal-container"
        style={{ maxWidth: 400, minHeight: 320 }}
      >
        <div className="modal-header">
          <h2>Scan QR Code</h2>
          <button onClick={onClose}>&times;</button>
        </div>
        <div className="modal-content" style={{ textAlign: "center" }}>
          {permissionDenied ? (
            <div style={{ color: "#ef4444" }}>
              {error || errorText || "Permissão da câmara negada."}
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                style={{ width: "100%", maxHeight: 240 }}
                playsInline
                muted
              />
              <canvas ref={canvasRef} style={{ display: "none" }} />
              <div style={{ marginTop: 12, color: "#64748b" }}>
                Aponte a câmara para o QR code enviado por email.
              </div>
            </>
          )}
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
