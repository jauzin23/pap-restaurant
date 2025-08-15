"use client";

export default function GridBackground() {
  return (
    <div className="fixed inset-0 -z-50 pointer-events-none select-none">
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
    </div>
  );
}
