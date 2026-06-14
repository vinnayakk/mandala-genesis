"use client";

import { useEffect, useRef } from "react";

export default function RDCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderer: any;
    let frameId: number;
    const startTime = Date.now();

    (async () => {
      // @ts-expect-error - three/webgpu has no published type declarations yet
      const mod = await import("three/webgpu");
      const { WebGPURenderer, Color, Scene, OrthographicCamera } = mod;

      renderer = new WebGPURenderer({ canvas, antialias: false, alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(1);

      await renderer.init();

      const scene = new Scene();
      const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

      const animate = () => {
        frameId = requestAnimationFrame(animate);
        const t = ((Date.now() - startTime) / 8000) % 1;
        renderer.setClearColor(new Color().setHSL(t, 1.0, 0.5));
        renderer.render(scene, camera);
      };

      animate();
      console.log("[RDCanvas] ✅ WebGPU renderer live");
    })().catch((e) => console.error("[RDCanvas] ❌ init failed:", e));

    return () => {
      cancelAnimationFrame(frameId);
      renderer?.dispose();
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
        opacity: 0.08,
      }}
    />
  );
}
