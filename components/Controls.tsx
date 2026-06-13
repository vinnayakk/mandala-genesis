"use client";

import { BlendMode } from "@/app/page";

type Props = {
  symmetry: number;
  setSymmetry: (n: number) => void;
  brushSize: number;
  setBrushSize: (n: number) => void;
  brushColor: string;
  setBrushColor: (c: string) => void;
  blendMode: BlendMode;
  setBlendMode: (m: BlendMode) => void;
  onClear: () => void;
  onSave: () => void;
};

const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: "source-over", label: "Ink" },
  { value: "screen", label: "Glow" },
  { value: "lighter", label: "Neon" },
];

export default function Controls({
  symmetry,
  setSymmetry,
  brushSize,
  setBrushSize,
  brushColor,
  setBrushColor,
  blendMode,
  setBlendMode,
  onClear,
  onSave,
}: Props) {
  return (
    <div className="fixed top-4 left-4 z-10 bg-neutral-900/80 backdrop-blur-md text-neutral-100 p-4 rounded-lg border border-neutral-700 w-64 space-y-3 font-mono text-xs">
      <div className="text-neutral-400 uppercase tracking-widest text-[10px] mb-2">
        Mandala Genesis · Phase 1
      </div>

      <label className="block">
        <div className="flex justify-between mb-1">
          <span>Symmetry</span>
          <span className="text-neutral-400">{symmetry}</span>
        </div>
        <input
          type="range"
          min={2}
          max={24}
          value={symmetry}
          onChange={(e) => setSymmetry(Number(e.target.value))}
          className="w-full"
        />
      </label>

      <label className="block">
        <div className="flex justify-between mb-1">
          <span>Brush size</span>
          <span className="text-neutral-400">{brushSize}px</span>
        </div>
        <input
          type="range"
          min={1}
          max={20}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="w-full"
        />
      </label>

      <label className="block">
        <div className="mb-1">Colour</div>
        <input
          type="color"
          value={brushColor}
          onChange={(e) => setBrushColor(e.target.value)}
          className="w-full h-8 bg-transparent border border-neutral-700 rounded cursor-pointer"
        />
      </label>

      <div className="block">
        <div className="mb-1">Stroke style</div>
        <div className="flex rounded border border-neutral-700 overflow-hidden">
          {BLEND_MODES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setBlendMode(value)}
              className={`flex-1 py-1.5 transition-colors text-center ${
                blendMode === value
                  ? "bg-neutral-100 text-neutral-900"
                  : "hover:bg-neutral-800 text-neutral-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onClear}
          className="flex-1 py-1.5 border border-neutral-700 hover:border-neutral-400 rounded transition-colors"
        >
          Clear
        </button>
        <button
          onClick={onSave}
          className="flex-1 py-1.5 border border-neutral-700 hover:border-neutral-400 rounded transition-colors"
        >
          Save PNG
        </button>
      </div>
    </div>
  );
}
