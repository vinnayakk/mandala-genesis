"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import type { RDEngine } from "@/lib/rd-engine";

export type RDHandle = {
  seed: (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    sw: number,
    sh: number,
    sym: number,
    r: number,
  ) => void;
  setColor: (hex: string) => void;
  clear: () => void;
  setDrawing: (active: boolean) => void;
};

const RDCanvas = forwardRef<RDHandle>(function RDCanvas(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RDEngine | null>(null);

  useImperativeHandle(ref, () => ({
    seed: (fx, fy, tx, ty, sw, sh, sym, r) =>
      engineRef.current?.seed(fx, fy, tx, ty, sw, sh, sym, r),
    setColor: (hex) => engineRef.current?.setColor(hex),
    clear: () => engineRef.current?.clear(),
    setDrawing: (active) => engineRef.current?.setDrawing(active),
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let frameId: number;
    let disposed = false;

    (async () => {
      const { RDEngine } = await import("@/lib/rd-engine");

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const engine = await RDEngine.create(canvas);
      engineRef.current = engine;

      const animate = () => {
        if (disposed) return;
        frameId = requestAnimationFrame(animate);
        engine.tick();
      };
      animate();
    })().catch((e) => console.error("[RDCanvas] ❌ init failed:", e));

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 2,
        width: "100vw",
        height: "100vh",
        mixBlendMode: "screen",
      }}
    />
  );
});

export default RDCanvas;
