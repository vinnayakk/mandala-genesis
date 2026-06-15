export const COMPUTE_SHADER = /* wgsl */ `
struct Params {
  feed:   f32,
  kill:   f32,
  du:     f32,
  dv:     f32,
  dt:     f32,
  width:  u32,
  height: u32,
}

@group(0) @binding(0) var src:   texture_2d<f32>;
@group(0) @binding(1) var dst:   texture_storage_2d<rg32float, write>;
@group(0) @binding(2) var<uniform> p: Params;
@group(0) @binding(3) var seeds: texture_2d<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let x = i32(id.x);
  let y = i32(id.y);
  let w = i32(p.width);
  let h = i32(p.height);
  if (x >= w || y >= h) { return; }

  let pos = vec2<i32>(x, y);
  let c   = textureLoad(src, pos, 0).rg;
  var u   = c.r;
  var v   = c.g;

  // CRITICAL: keep BOTH u and v non-zero at seed so uv² > 0 and reaction ignites.
  // Pearson's standard ignition seed: u→0.5, v→0.5
  let seed = textureLoad(seeds, pos, 0).r;
  if (seed > 0.0) {
    u = mix(u, 0.5, seed);
    v = mix(v, 0.5, seed);
  }

  // 5-point Laplacian with clamped boundaries
  let xl = max(0, x - 1);
  let xr = min(w - 1, x + 1);
  let yt = max(0, y - 1);
  let yb = min(h - 1, y + 1);
  let l  = textureLoad(src, vec2<i32>(xl, y), 0).rg;
  let r  = textureLoad(src, vec2<i32>(xr, y), 0).rg;
  let t  = textureLoad(src, vec2<i32>(x, yt), 0).rg;
  let b  = textureLoad(src, vec2<i32>(x, yb), 0).rg;
  let lap = l + r + t + b - 4.0 * vec2<f32>(u, v);

  let uvv = u * v * v;
  let nu  = u + (p.du * lap.r - uvv + p.feed * (1.0 - u)) * p.dt;
  let nv  = v + (p.dv * lap.g + uvv - (p.feed + p.kill) * v) * p.dt;

  textureStore(dst, pos, vec4<f32>(clamp(nu, 0.0, 1.0), clamp(nv, 0.0, 1.0), 0.0, 1.0));
}
`;

export const RENDER_SHADER = /* wgsl */ `
struct VOut {
  @builtin(position) pos: vec4<f32>,
  @location(0)       uv:  vec2<f32>,
}

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VOut {
  var quad = array<vec2<f32>, 4>(
    vec2<f32>(-1, -1), vec2<f32>(1, -1),
    vec2<f32>(-1,  1), vec2<f32>(1,  1),
  );
  var o: VOut;
  o.pos = vec4<f32>(quad[i], 0, 1);
  o.uv  = quad[i] * 0.5 + 0.5;
  o.uv.y = 1.0 - o.uv.y;
  return o;
}

@group(0) @binding(0) var rd: texture_2d<f32>;
@group(0) @binding(1) var<uniform> brush: vec4<f32>;

@fragment
fn fs(in: VOut) -> @location(0) vec4<f32> {
  let dim   = textureDimensions(rd, 0);
  let coord = vec2<i32>(
    clamp(i32(in.uv.x * f32(dim.x)), 0, i32(dim.x) - 1),
    clamp(i32(in.uv.y * f32(dim.y)), 0, i32(dim.y) - 1),
  );
  let v = textureLoad(rd, coord, 0).g;

  // Low threshold so faint diffusion is visible
  let intensity = smoothstep(0.02, 0.3, v);
  let glow      = brush.rgb * intensity;
  let highlight = vec3<f32>(1.0) * pow(intensity, 4.0);
  let color     = glow + highlight * 0.15;

  // Premultiplied alpha — correct for both display AND save
  let alpha = intensity * 0.85;
  return vec4<f32>(color * alpha, alpha);
}
`;
