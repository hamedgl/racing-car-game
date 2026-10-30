import * as THREE from 'three';

export interface SkidMarkSystem {
  mesh: THREE.Mesh;
  addMarkPair: (
    vehicleId: string,
    leftX: number,
    leftY: number,
    leftZ: number,
    rightX: number,
    rightY: number,
    rightZ: number,
    intensity: number,
    nowMs?: number
  ) => void;
  update: (dt: number) => void;
  clear: () => void;
}

interface VehicleSkidState {
  lx: number;
  ly: number;
  lz: number;
  rx: number;
  ry: number;
  rz: number;
  uDist: number;
  lastTimeMs: number;
}

let cachedSkidTexture: THREE.CanvasTexture | null = null;

function getSharedSkidTexture(): THREE.CanvasTexture {
  if (cachedSkidTexture) return cachedSkidTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);

  const latGrad = ctx.createLinearGradient(0, 0, 128, 0);
  latGrad.addColorStop(0.0, 'rgba(10, 10, 12, 0.0)');
  latGrad.addColorStop(0.12, 'rgba(10, 10, 12, 0.85)');
  latGrad.addColorStop(0.28, 'rgba(8, 8, 10, 0.95)');
  latGrad.addColorStop(0.46, 'rgba(15, 15, 18, 0.55)');
  latGrad.addColorStop(0.54, 'rgba(15, 15, 18, 0.55)');
  latGrad.addColorStop(0.72, 'rgba(8, 8, 10, 0.95)');
  latGrad.addColorStop(0.88, 'rgba(10, 10, 12, 0.85)');
  latGrad.addColorStop(1.0, 'rgba(10, 10, 12, 0.0)');
  ctx.fillStyle = latGrad;
  ctx.fillRect(0, 0, 128, 128);

  for (let i = 0; i < 160; i++) {
    const sx = 12 + Math.random() * 104;
    const sy = Math.random() * 128;
    ctx.fillStyle = Math.random() > 0.4 ? 'rgba(5, 5, 7, 0.45)' : 'rgba(40, 40, 46, 0.25)';
    ctx.fillRect(sx, sy, 2 + Math.random() * 2, 12 + Math.random() * 20);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.userData = { shared: true };
  cachedSkidTexture = tex;
  return tex;
}

/**
 * High-performance, zero-GC circular buffer for rendering dual tire skid marks
 * on the 3D track surface under hard braking, handbrake turns, and power drifts.
 *
 * Uses independent per-segment quads (8 vertices = 2 quads per segment) and
 * per-vehicle state tracking so separate drifts and multiple cars NEVER cross-connect.
 */
export function createSkidMarkSystem(maxSegments = 750): SkidMarkSystem {
  // Each segment has 2 independent quads (Left tire quad: 4 verts, Right tire quad: 4 verts = 8 verts total)
  const vertexCount = maxSegments * 8;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 4); // RGBA
  const uvs = new Float32Array(vertexCount * 2);
  const indexCount = maxSegments * 12; // 2 quads * 6 indices
  const indices = new Uint16Array(indexCount);

  let idxCursor = 0;
  for (let i = 0; i < maxSegments; i++) {
    const vBase = i * 8;
    // Left tire quad (vBase + 0..3)
    indices[idxCursor++] = vBase + 0;
    indices[idxCursor++] = vBase + 1;
    indices[idxCursor++] = vBase + 2;
    indices[idxCursor++] = vBase + 1;
    indices[idxCursor++] = vBase + 3;
    indices[idxCursor++] = vBase + 2;

    // Right tire quad (vBase + 4..7)
    indices[idxCursor++] = vBase + 4;
    indices[idxCursor++] = vBase + 5;
    indices[idxCursor++] = vBase + 6;
    indices[idxCursor++] = vBase + 5;
    indices[idxCursor++] = vBase + 7;
    indices[idxCursor++] = vBase + 6;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  const tex = getSharedSkidTexture();

  const material = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    vertexColors: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;

  let segWriteHead = 0;
  let activeSegmentCount = 0;
  let internalClockMs = 0;
  let fadeAccumulator = 0;
  const vehicleStates = new Map<string, VehicleSkidState>();

  const halfTireWidth = 0.15; // 0.30m wide racing tire patch
  const surfaceOffset = 0.025; // sits cleanly above asphalt

  const writeTireQuad = (
    vOffset: number,
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    u0: number,
    u1: number,
    alpha: number
  ) => {
    // Compute perpendicular vector to the tire's travel direction (x0,z0) -> (x1,z1)
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz) || 1;
    const px = (-dz / len) * halfTireWidth;
    const pz = (dx / len) * halfTireWidth;

    const pBase = vOffset * 3;
    // Vertex 0: prev outer
    positions[pBase + 0] = x0 - px;
    positions[pBase + 1] = y0 + surfaceOffset;
    positions[pBase + 2] = z0 - pz;
    // Vertex 1: prev inner
    positions[pBase + 3] = x0 + px;
    positions[pBase + 4] = y0 + surfaceOffset;
    positions[pBase + 5] = z0 + pz;
    // Vertex 2: curr outer
    positions[pBase + 6] = x1 - px;
    positions[pBase + 7] = y1 + surfaceOffset;
    positions[pBase + 8] = z1 - pz;
    // Vertex 3: curr inner
    positions[pBase + 9] = x1 + px;
    positions[pBase + 10] = y1 + surfaceOffset;
    positions[pBase + 11] = z1 + pz;

    const uvBase = vOffset * 2;
    uvs[uvBase + 0] = 0;
    uvs[uvBase + 1] = u0;
    uvs[uvBase + 2] = 1;
    uvs[uvBase + 3] = u0;
    uvs[uvBase + 4] = 0;
    uvs[uvBase + 5] = u1;
    uvs[uvBase + 6] = 1;
    uvs[uvBase + 7] = u1;

    const cBase = vOffset * 4;
    for (let c = 0; c < 4; c++) {
      colors[cBase + c * 4 + 0] = 0.06;
      colors[cBase + c * 4 + 1] = 0.06;
      colors[cBase + c * 4 + 2] = 0.07;
      colors[cBase + c * 4 + 3] = alpha;
    }
  };

  const addMarkPair = (
    vehicleId: string,
    leftX: number,
    leftY: number,
    leftZ: number,
    rightX: number,
    rightY: number,
    rightZ: number,
    intensity: number,
    nowMs?: number
  ) => {
    const timestamp = nowMs !== undefined ? nowMs : internalClockMs;
    const prev = vehicleStates.get(vehicleId);

    // If this vehicle wasn't skidding in the last 180ms, start a fresh chain without connecting to old marks
    if (!prev || timestamp - prev.lastTimeMs > 180) {
      vehicleStates.set(vehicleId, {
        lx: leftX,
        ly: leftY,
        lz: leftZ,
        rx: rightX,
        ry: rightY,
        rz: rightZ,
        uDist: 0,
        lastTimeMs: timestamp,
      });
      return;
    }

    const distL = Math.hypot(leftX - prev.lx, leftZ - prev.lz);
    const distR = Math.hypot(rightX - prev.rx, rightZ - prev.rz);
    const stepDist = Math.max(distL, distR);

    // Wait until the car moves at least 0.22m to emit a segment
    if (stepDist < 0.22) {
      prev.lastTimeMs = timestamp;
      return;
    }

    // Guard against teleports/resets (> 3.0m jump)
    if (stepDist > 3.0) {
      vehicleStates.set(vehicleId, {
        lx: leftX,
        ly: leftY,
        lz: leftZ,
        rx: rightX,
        ry: rightY,
        rz: rightZ,
        uDist: 0,
        lastTimeMs: timestamp,
      });
      return;
    }

    const clampedIntensity = Math.min(1.0, Math.max(0.12, intensity));
    const alpha = clampedIntensity * 0.82;

    const u0 = prev.uDist;
    const u1 = u0 + stepDist * 0.8;

    const vBase = segWriteHead * 8;
    // Left tire segment quad
    writeTireQuad(vBase, prev.lx, prev.ly, prev.lz, leftX, leftY, leftZ, u0, u1, alpha);
    // Right tire segment quad
    writeTireQuad(vBase + 4, prev.rx, prev.ry, prev.rz, rightX, rightY, rightZ, u0, u1, alpha);

    // Update vehicle state for next continuous segment
    prev.lx = leftX;
    prev.ly = leftY;
    prev.lz = leftZ;
    prev.rx = rightX;
    prev.ry = rightY;
    prev.rz = rightZ;
    prev.uDist = u1;
    prev.lastTimeMs = timestamp;

    segWriteHead = (segWriteHead + 1) % maxSegments;
    if (activeSegmentCount < maxSegments) {
      activeSegmentCount++;
    }

    geometry.setDrawRange(0, activeSegmentCount * 12);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.uv.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  };

  const update = (dt: number) => {
    internalClockMs += dt * 1000;
    if (activeSegmentCount === 0) return;

    fadeAccumulator += dt;
    if (fadeAccumulator < 0.25) return;
    const stepDt = fadeAccumulator;
    fadeAccumulator = 0;

    let anyFaded = false;
    const decay = stepDt * 0.014; // Fades smoothly over ~60 seconds, uploaded at 4Hz instead of 60Hz
    const vertLimit = activeSegmentCount * 8;
    for (let v = 0; v < vertLimit; v++) {
      const aIdx = v * 4 + 3;
      if (colors[aIdx] > 0) {
        colors[aIdx] = Math.max(0, colors[aIdx] - decay);
        anyFaded = true;
      }
    }
    if (anyFaded) {
      geometry.attributes.color.needsUpdate = true;
    }
  };

  const clear = () => {
    segWriteHead = 0;
    activeSegmentCount = 0;
    vehicleStates.clear();
    colors.fill(0);
    positions.fill(0);
    uvs.fill(0);
    geometry.setDrawRange(0, 0);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.uv.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  };

  return { mesh, addMarkPair, update, clear };
}
