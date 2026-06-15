import { COMPUTE_SHADER, RENDER_SHADER } from "./shaders";

const GRID_H = 512;
const STEPS_PER_FRAME = 1; // one step per frame — avoids seed re-injection
const FEED = 0.0367; // contained "spots" pattern
const KILL = 0.0649;
const DU = 0.2097;
const DV = 0.105;
const DT = 0.7; // faster progress per step now that we're at 1 step/frame

export class RDEngine {
  private device: GPUDevice;
  private ctx: GPUCanvasContext;
  private textures: [GPUTexture, GPUTexture];
  private seedTex: GPUTexture;
  private seedData: Float32Array;
  private computePipe: GPUComputePipeline;
  private renderPipe: GPURenderPipeline;
  private compBG: [GPUBindGroup, GPUBindGroup];
  private rendBG: [GPUBindGroup, GPUBindGroup];
  private uniforms: GPUBuffer;
  private brushBuf: GPUBuffer;
  private frame = 0;
  private gridW: number;
  private gridH: number;
  private paused = false;

  private constructor(
    device: GPUDevice,
    ctx: GPUCanvasContext,
    textures: [GPUTexture, GPUTexture],
    seedTex: GPUTexture,
    seedData: Float32Array,
    computePipe: GPUComputePipeline,
    renderPipe: GPURenderPipeline,
    compBG: [GPUBindGroup, GPUBindGroup],
    rendBG: [GPUBindGroup, GPUBindGroup],
    uniforms: GPUBuffer,
    brushBuf: GPUBuffer,
    gridW: number,
    gridH: number,
  ) {
    this.device = device;
    this.ctx = ctx;
    this.textures = textures;
    this.seedTex = seedTex;
    this.seedData = seedData;
    this.computePipe = computePipe;
    this.renderPipe = renderPipe;
    this.compBG = compBG;
    this.rendBG = rendBG;
    this.uniforms = uniforms;
    this.brushBuf = brushBuf;
    this.gridW = gridW;
    this.gridH = gridH;
  }

  /* ───────── factory ───────── */

  static async create(canvas: HTMLCanvasElement): Promise<RDEngine> {
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) throw new Error("WebGPU not supported");
    const device = await adapter.requestDevice();

    const ctx = canvas.getContext("webgpu") as GPUCanvasContext;
    const fmt = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({
      device,
      format: fmt,
      alphaMode: "premultiplied",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });

    const aspect = canvas.width / canvas.height;
    const gridW = Math.round(GRID_H * aspect);
    const gridH = GRID_H;

    const texDesc: GPUTextureDescriptor = {
      size: [gridW, gridH],
      format: "rg32float",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_DST,
    };
    const tex: [GPUTexture, GPUTexture] = [
      device.createTexture(texDesc),
      device.createTexture(texDesc),
    ];

    // Start empty: U=1, V=0
    const initData = new Float32Array(gridW * gridH * 2);
    for (let i = 0; i < gridW * gridH; i++) {
      initData[i * 2] = 1.0;
      initData[i * 2 + 1] = 0.0;
    }
    for (const t of tex) {
      device.queue.writeTexture(
        { texture: t },
        initData.buffer,
        { bytesPerRow: gridW * 2 * 4 },
        { width: gridW, height: gridH },
      );
    }

    const seedTex = device.createTexture({
      size: [gridW, gridH],
      format: "r32float",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    const seedData = new Float32Array(gridW * gridH);
    // Initialise seed texture to zero on GPU
    device.queue.writeTexture(
      { texture: seedTex },
      seedData.buffer,
      { bytesPerRow: gridW * 4 },
      { width: gridW, height: gridH },
    );

    const ub = new ArrayBuffer(32);
    new Float32Array(ub, 0, 5).set([FEED, KILL, DU, DV, DT]);
    new Uint32Array(ub, 20, 2).set([gridW, gridH]);
    const uniforms = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Uint8Array(uniforms.getMappedRange()).set(new Uint8Array(ub));
    uniforms.unmap();

    const brushBuf = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      brushBuf,
      0,
      new Float32Array([0.91, 0.84, 0.72, 1]),
    );

    const cMod = device.createShaderModule({ code: COMPUTE_SHADER });
    const cBGL = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: "unfilterable-float" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: { access: "write-only", format: "rg32float" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: "unfilterable-float" },
        },
      ],
    });
    const computePipe = device.createComputePipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [cBGL] }),
      compute: { module: cMod, entryPoint: "main" },
    });
    const seedView = seedTex.createView();
    const compBG: [GPUBindGroup, GPUBindGroup] = [
      device.createBindGroup({
        layout: cBGL,
        entries: [
          { binding: 0, resource: tex[0].createView() },
          { binding: 1, resource: tex[1].createView() },
          { binding: 2, resource: { buffer: uniforms } },
          { binding: 3, resource: seedView },
        ],
      }),
      device.createBindGroup({
        layout: cBGL,
        entries: [
          { binding: 0, resource: tex[1].createView() },
          { binding: 1, resource: tex[0].createView() },
          { binding: 2, resource: { buffer: uniforms } },
          { binding: 3, resource: seedView },
        ],
      }),
    ];

    const rMod = device.createShaderModule({ code: RENDER_SHADER });
    const rBGL = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "unfilterable-float" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });
    const renderPipe = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [rBGL] }),
      vertex: { module: rMod, entryPoint: "vs" },
      fragment: {
        module: rMod,
        entryPoint: "fs",
        targets: [
          {
            format: fmt,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
              },
              alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
            },
          },
        ],
      },
      primitive: { topology: "triangle-strip" },
    });
    const rendBG: [GPUBindGroup, GPUBindGroup] = [
      device.createBindGroup({
        layout: rBGL,
        entries: [
          { binding: 0, resource: tex[0].createView() },
          { binding: 1, resource: { buffer: brushBuf } },
        ],
      }),
      device.createBindGroup({
        layout: rBGL,
        entries: [
          { binding: 0, resource: tex[1].createView() },
          { binding: 1, resource: { buffer: brushBuf } },
        ],
      }),
    ];

    console.log(
      "[RDEngine] ✅ Gray-Scott pipeline ready (%dx%d)",
      gridW,
      gridH,
    );
    return new RDEngine(
      device,
      ctx,
      tex,
      seedTex,
      seedData,
      computePipe,
      renderPipe,
      compBG,
      rendBG,
      uniforms,
      brushBuf,
      gridW,
      gridH,
    );
  }

  /* ───────── public controls ───────── */

  setDrawing(active: boolean) {
    this.paused = active;
  }

  seed(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    screenW: number,
    screenH: number,
    symmetry: number,
    brushRadius: number,
  ) {
    // Stamp continuously along the stroke segment, not just at endpoints
    const dist = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2);
    const steps = Math.max(1, Math.ceil(dist / 3));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = fromX + (toX - fromX) * t;
      const y = fromY + (toY - fromY) * t;
      this.stampSymmetric(x, y, screenW, screenH, symmetry, brushRadius);
    }
  }

  private stampSymmetric(
    x: number,
    y: number,
    screenW: number,
    screenH: number,
    symmetry: number,
    brushRadius: number,
  ) {
    const cx = screenW / 2;
    const cy = screenH / 2;
    const dx = x - cx;
    const dy = y - cy;
    const angleStep = (Math.PI * 2) / symmetry;
    // Scale up 3x and enforce a minimum of 5 grid-pixels so even small brushes
    // produce a viable seed (otherwise the reaction can't ignite)
    const gridRadius = Math.max(
      5,
      Math.round(brushRadius * (this.gridH / screenH) * 3),
    );

    for (let i = 0; i < symmetry; i++) {
      const cos = Math.cos(angleStep * i);
      const sin = Math.sin(angleStep * i);

      const ox = cx + dx * cos - dy * sin;
      const oy = cy + dx * sin + dy * cos;
      this.stampSeed(ox, oy, screenW, screenH, gridRadius);

      const mx = cx + -dx * cos - dy * sin;
      const my = cy + -dx * sin + dy * cos;
      this.stampSeed(mx, my, screenW, screenH, gridRadius);
    }
  }

  private stampSeed(
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    radius: number,
  ) {
    const gx = Math.round((sx / sw) * this.gridW);
    const gy = Math.round((sy / sh) * this.gridH);

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const x = gx + dx;
        const y = gy + dy;
        if (x < 0 || x >= this.gridW || y < 0 || y >= this.gridH) continue;
        const dist = Math.sqrt(dx * dx + dy * dy) / radius;
        // Stronger center, gentler falloff: 1.0 at centre → 0.8 at edge
        const intensity = 1.0 - dist * 0.2;
        const idx = y * this.gridW + x;
        this.seedData[idx] = Math.max(this.seedData[idx], intensity);
      }
    }
  }

  setColor(hex: string) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    this.device.queue.writeBuffer(
      this.brushBuf,
      0,
      new Float32Array([r, g, b, 1]),
    );
  }

  clear() {
    // Reset textures to U=1, V=0
    const empty = new Float32Array(this.gridW * this.gridH * 2);
    for (let i = 0; i < this.gridW * this.gridH; i++) empty[i * 2] = 1.0;
    for (const t of this.textures) {
      this.device.queue.writeTexture(
        { texture: t },
        empty.buffer,
        { bytesPerRow: this.gridW * 2 * 4 },
        { width: this.gridW, height: this.gridH },
      );
    }

    // Wipe seed buffer AND seed texture on GPU (the bug fix)
    this.seedData.fill(0);
    this.device.queue.writeTexture(
      { texture: this.seedTex },
      this.seedData.buffer,
      { bytesPerRow: this.gridW * 4 },
      { width: this.gridW, height: this.gridH },
    );

    this.frame = 0;
  }

  /* ───────── per-frame ───────── */

  tick() {
    const enc = this.device.createCommandEncoder();

    if (!this.paused) {
      // ALWAYS upload current seedData (zero unless user just drew this frame).
      // This makes seeds truly one-shot — the GPU forgets after each frame.
      this.device.queue.writeTexture(
        { texture: this.seedTex },
        this.seedData.buffer,
        { bytesPerRow: this.gridW * 4 },
        { width: this.gridW, height: this.gridH },
      );
      this.seedData.fill(0);

      for (let i = 0; i < STEPS_PER_FRAME; i++) {
        const pass = enc.beginComputePass();
        pass.setPipeline(this.computePipe);
        pass.setBindGroup(0, this.compBG[this.frame % 2]);
        pass.dispatchWorkgroups(
          Math.ceil(this.gridW / 8),
          Math.ceil(this.gridH / 8),
        );
        pass.end();
        this.frame++;
      }
    }

    // Always render current state (so canvas doesn't go black while paused)
    const pass = enc.beginRenderPass({
      colorAttachments: [
        {
          view: this.ctx.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    });
    pass.setPipeline(this.renderPipe);
    pass.setBindGroup(0, this.rendBG[this.frame % 2]);
    pass.draw(4);
    pass.end();

    this.device.queue.submit([enc.finish()]);
  }

  dispose() {
    this.textures[0].destroy();
    this.textures[1].destroy();
    this.seedTex.destroy();
    this.uniforms.destroy();
    this.brushBuf.destroy();
    this.device.destroy();
  }
}
