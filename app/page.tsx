"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import MandalaCanvas from "@/components/MandalaCanvas";
import RDCanvas from "@/components/RDCanvas";
import type { RDHandle } from "@/components/RDCanvas";
import Controls from "@/components/Controls";

export type BlendMode = "source-over" | "screen" | "lighter";

export default function Home() {
  const [symmetry, setSymmetry] = useState(12);
  const [brushSize, setBrushSize] = useState(3);
  const [brushColor, setBrushColor] = useState("#e8d5b7");
  const [clearSignal, setClearSignal] = useState(0);
  const [blendMode, setBlendMode] = useState<BlendMode>("source-over");
  const [growthDuration, setGrowthDuration] = useState(50000); // milliseconds (50 seconds)
  const [coralOn, setCoralOn] = useState(true);
  const [driftOn, setDriftOn] = useState(true);

  const rdRef = useRef<RDHandle>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    if (!driftOn) {
      main.style.backgroundColor = "#0a0a0a";
      return;
    }
    let hue = 0;
    let rafId: number;
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      hue = (hue + 0.008) % 360;
      main.style.backgroundColor = `hsl(${hue}, 30%, 4%)`;
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [driftOn]);

  const handleClear = useCallback(() => {
    setClearSignal((n) => n + 1);
    rdRef.current?.clear();
  }, []);

  const handleSave = useCallback(
    async (includeRD: boolean) => {
      const canvases = document.querySelectorAll("canvas");
      if (canvases.length < 2) return;
      const mandalaCanvas = canvases[0] as HTMLCanvasElement;
      const rdCanvas = canvases[1] as HTMLCanvasElement;

      const mandalaUrl = mandalaCanvas.toDataURL("image/png");
      const rdUrl =
        includeRD && coralOn ? rdCanvas.toDataURL("image/png") : null;

      const load = (src: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });

      const mandalaImg = await load(mandalaUrl);
      const rdImg = rdUrl ? await load(rdUrl) : null;

      const out = document.createElement("canvas");
      out.width = mandalaCanvas.width;
      out.height = mandalaCanvas.height;
      const ctx = out.getContext("2d");
      if (!ctx) return;

      // Dark background
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, out.width, out.height);

      // Mandala layer
      ctx.drawImage(mandalaImg, 0, 0, out.width, out.height);

      // RD layer with screen blend — only if requested
      if (rdImg) {
        ctx.globalCompositeOperation = "screen";
        ctx.drawImage(rdImg, 0, 0, out.width, out.height);
      }

      const link = document.createElement("a");
      link.download = `mandala-${Date.now()}.png`;
      link.href = out.toDataURL("image/png");
      link.click();
    },
    [coralOn],
  );

  const handleStroke = useCallback(
    (fromX: number, fromY: number, toX: number, toY: number) => {
      rdRef.current?.seed(
        fromX,
        fromY,
        toX,
        toY,
        window.innerWidth,
        window.innerHeight,
        symmetry,
        brushSize,
        growthDuration,
      );
    },
    [symmetry, brushSize, growthDuration],
  );

  const handleDrawingChange = useCallback((active: boolean) => {
    rdRef.current?.setDrawing(active);
  }, []);

  return (
    <main
      ref={mainRef}
      className="w-screen h-screen overflow-hidden bg-neutral-950"
    >
      <MandalaCanvas
        symmetry={symmetry}
        brushSize={brushSize}
        brushColor={brushColor}
        clearSignal={clearSignal}
        blendMode={blendMode}
        onStroke={handleStroke}
        onDrawingChange={handleDrawingChange}
      />
      <RDCanvas ref={rdRef} visible={coralOn} />
      <Controls
        symmetry={symmetry}
        setSymmetry={setSymmetry}
        brushSize={brushSize}
        setBrushSize={setBrushSize}
        brushColor={brushColor}
        setBrushColor={setBrushColor}
        blendMode={blendMode}
        setBlendMode={setBlendMode}
        growthDuration={growthDuration}
        setGrowthDuration={setGrowthDuration}
        coralOn={coralOn}
        setCoralOn={setCoralOn}
        driftOn={driftOn}
        setDriftOn={setDriftOn}
        onClear={handleClear}
        onSave={() => handleSave(true)}
        onSaveMandalaOnly={() => handleSave(false)}
      />
    </main>
  );
}
