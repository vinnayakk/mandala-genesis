"use client";

import { useRef, useEffect } from "react";

type Point = { x: number; y: number };
type Props = {
  symmetry: number;
  brushSize: number;
  brushColor: string;
  clearSignal: number;
};

export default function MandalaCanvas({
  symmetry,
  brushSize,
  brushColor,
  clearSignal,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<Point | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }, [clearSignal]);

  const getPos = (e: React.PointerEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const drawStroke = (from: Point, to: Point) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const angleStep = (Math.PI * 2) / symmetry;

    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "screen";

    // The local stroke coords, relative to canvas center
    const fx = from.x - cx;
    const fy = from.y - cy;
    const tx = to.x - cx;
    const ty = to.y - cy;

    for (let i = 0; i < symmetry; i++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angleStep * i);

      // Original wedge
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      // Mirrored wedge (true kaleidoscope, like the Processing original)
      ctx.scale(-1, 1);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      ctx.restore();
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    isDrawing.current = true;
    lastPos.current = getPos(e);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDrawing.current || !lastPos.current) return;
    const pos = getPos(e);
    drawStroke(lastPos.current, pos);
    lastPos.current = pos;
  };

  const onPointerUp = () => {
    isDrawing.current = false;
    lastPos.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      style={{ cursor: "crosshair", touchAction: "none", display: "block" }}
    />
  );
}
