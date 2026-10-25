"use client";

import React from "react";

export const CosmicBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
      {/* Nebulosas Luminosas */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-purple-900/20 blur-[130px]" />
      <div className="absolute top-[20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-900/20 blur-[150px]" />
      <div className="absolute bottom-[-10%] left-[20%] w-[700px] h-[700px] rounded-full bg-amber-900/15 blur-[160px]" />

      {/* Partículas Estelares Cósmicas */}
      <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:32px_32px]" />
    </div>
  );
};
