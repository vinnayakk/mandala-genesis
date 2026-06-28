"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import MandalaCanvas from "@/components/MandalaCanvas";
import RDCanvas from "@/components/RDCanvas";
import type { RDHandle } from "@/components/RDCanvas";
import Controls from "@/components/Controls";
import { AudioEngine } from "@/lib/audio-engine";

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
  const audioRef = useRef<AudioEngine | null>(null);
  const [micOn, setMicOn] = useState(false);
  const ampBarRef = useRef<HTMLDivElement>(null);
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

  // ── Audio polling loop ──────────────────────────────────────────────
  useEffect(() => {
    if (!micOn) return;
    let frameId: number;
    const poll = () => {
      frameId = requestAnimationFrame(poll);
      const amplitude = audioRef.current?.getAmplitude() ?? 0;
      rdRef.current?.setAmplitude(amplitude);
      if (ampBarRef.current)
        ampBarRef.current.style.height = `${Math.max(2, amplitude * 64)}px`;
    };
    frameId = requestAnimationFrame(poll);
    const rd = rdRef.current;
    return () => {
      cancelAnimationFrame(frameId);
      rd?.resetAudioEffect();
    };
  }, [micOn]);

  const handleMicToggle = useCallback(async () => {
    if (!audioRef.current) {
      audioRef.current = new AudioEngine();
    }
    if (audioRef.current.active) {
      audioRef.current.stop();
      setMicOn(false);
    } else {
      try {
        await audioRef.current.start();
        setMicOn(true);
      } catch {
        // Permission denied or no mic — button stays off, no crash
        setMicOn(false);
      }
    }
  }, []);

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
      {micOn && (
        <div className="fixed bottom-4 left-4 z-10 flex items-end h-16 bg-neutral-900/80 backdrop-blur-md p-2 rounded border border-neutral-700">
          <div
            ref={ampBarRef}
            className="w-3 bg-emerald-400 rounded-sm"
            style={{ height: "2px" }}
            title="Amplitude"
          />
        </div>
      )}
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
        micOn={micOn}
        onMicToggle={handleMicToggle}
        onClear={handleClear}
        onSave={() => handleSave(true)}
        onSaveMandalaOnly={() => handleSave(false)}
      />
    </main>
  );
}
