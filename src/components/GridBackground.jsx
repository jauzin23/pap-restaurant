"use client";

export default function GridBackground() {
  return (
    <div className="fixed inset-0 -z-50 pointer-events-none select-none">
      {/* Fine grid pattern */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(64, 64, 70, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(64, 64, 70, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: "28px 28px",
          backgroundColor: "#0a0a0a",
        }}
      />

      {/* Larger grid overlay */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(76, 76, 82, 0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(76, 76, 82, 0.12) 1px, transparent 1px)
          `,
          backgroundSize: "112px 112px",
        }}
      />

      {/* Subtle radial gradient for depth */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.02) 0%, transparent 50%),
            radial-gradient(circle at 20% 20%, rgba(168, 85, 247, 0.015) 0%, transparent 40%),
            radial-gradient(circle at 80% 80%, rgba(34, 197, 94, 0.015) 0%, transparent 40%)
          `,
        }}
      />
    </div>
  );
}
