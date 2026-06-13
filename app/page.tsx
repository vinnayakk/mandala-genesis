"use client";

import { useState, useCallback } from "react";
import MandalaCanvas from "@/components/MandalaCanvas";
import Controls from "@/components/Controls";

export default function Home() {
  const [symmetry, setSymmetry] = useState(12);
  const [brushSize, setBrushSize] = useState(3);
  const [brushColor, setBrushColor] = useState("#e8d5b7");
  const [clearSignal, setClearSignal] = useState(0);

  const handleClear = useCallback(() => {
    setClearSignal((n) => n + 1);
  }, []);

  const handleSave = useCallback(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `mandala-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  return (
    <main className="w-screen h-screen overflow-hidden bg-neutral-950">
      <MandalaCanvas
        symmetry={symmetry}
        brushSize={brushSize}
        brushColor={brushColor}
        clearSignal={clearSignal}
      />
      <Controls
        symmetry={symmetry}
        setSymmetry={setSymmetry}
        brushSize={brushSize}
        setBrushSize={setBrushSize}
        brushColor={brushColor}
        setBrushColor={setBrushColor}
        onClear={handleClear}
        onSave={handleSave}
      />
    </main>
  );
}
