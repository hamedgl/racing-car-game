import * as THREE from 'three';
import { TrackRubberState, TrackSpec, WeatherState } from './types';
import { findClosestTrackSample } from './tracks';

export interface ParticlePool {
  mesh: THREE.InstancedMesh;
  spawn: (
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    colorHex: number,
    size: number,
    life: number
  ) => void;
  update: (dt: number) => void;
}

export interface RainSystem {
  lines: THREE.LineSegments;
  update: (cameraPos: THREE.Vector3, weather: WeatherState, dt: number) => void;
}

export interface TrackEnvironmentRig {
  group: THREE.Group;
  roadMat: THREE.MeshStandardMaterial;
  racingLineMat: THREE.MeshStandardMaterial;
  kerbMat: THREE.MeshStandardMaterial;
  skyMat: THREE.MeshBasicMaterial;
  updateWeatherVisuals: (weather: WeatherState) => void;
  updateTrackRubberVisuals: (rubberState: TrackRubberState, weather: WeatherState) => void;
}

let cachedRacingLineTextures: {
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} | null = null;

function createRacingLineRubberTextures(maxAnisotropy: number): {
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  if (cachedRacingLineTextures) {
    return cachedRacingLineTextures;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 512, 1024);

  // Soft lateral alpha envelope with twin dark vulcanized tire tracks at u = 0.30 and u = 0.70
  const baseGrad = ctx.createLinearGradient(0, 0, 512, 0);
  baseGrad.addColorStop(0.0, 'rgba(8, 10, 14, 0.0)');
  baseGrad.addColorStop(0.14, 'rgba(10, 12, 16, 0.32)');
  baseGrad.addColorStop(0.28, 'rgba(6, 8, 11, 0.88)');
  baseGrad.addColorStop(0.5, 'rgba(12, 15, 20, 0.56)');
  baseGrad.addColorStop(0.72, 'rgba(6, 8, 11, 0.88)');
  baseGrad.addColorStop(0.86, 'rgba(10, 12, 16, 0.32)');
  baseGrad.addColorStop(1.0, 'rgba(8, 10, 14, 0.0)');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, 512, 1024);

  // Longitudinal tire-scrub striations and rubber weave streaks
  for (let s = 0; s < 140; s++) {
    const lane = s % 2 === 0 ? 145 : 365;
    const x = lane + (Math.random() - 0.5) * 115;
    const y = Math.random() * 1024;
    const w = 2 + Math.random() * 4;
    const h = 45 + Math.random() * 160;
    ctx.fillStyle = s % 3 === 0 ? 'rgba(4, 5, 8, 0.42)' : 'rgba(18, 22, 28, 0.28)';
    ctx.fillRect(x, y, w, h);
    if (y + h > 1024) {
      ctx.fillRect(x, y - 1024, w, h);
    }
  }

  // Coarse vulcanized rubber debris & tar pores along the groove
  for (let i = 0; i < 3200; i++) {
    const x = 48 + Math.random() * 416;
    const y = Math.random() * 1024;
    const edgeFade = Math.sin(((x - 48) / 416) * Math.PI);
    ctx.fillStyle =
      i % 2 === 0
        ? `rgba(4, 5, 8, ${(0.38 * edgeFade).toFixed(2)})`
        : `rgba(28, 33, 42, ${(0.24 * edgeFade).toFixed(2)})`;
    ctx.fillRect(x, y, 2 + (i % 3), 3 + (i % 4));
  }

  const colorMap = new THREE.CanvasTexture(canvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = THREE.ClampToEdgeWrapping;
  colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.anisotropy = maxAnisotropy;
  colorMap.userData = { shared: true };

  // High-contrast bump map simulating vulcanized rubber buildup & longitudinal tire grooves
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 512;
  const bctx = bumpCanvas.getContext('2d')!;
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 256, 512);

  for (let s = 0; s < 100; s++) {
    const x = 32 + Math.random() * 192;
    const y = Math.random() * 512;
    const h = 30 + Math.random() * 90;
    bctx.fillStyle = s % 2 === 0 ? '#b8b8b8' : '#484848';
    bctx.fillRect(x, y, 2, h);
  }
  for (let i = 0; i < 2800; i++) {
    const x = 24 + Math.random() * 208;
    const y = Math.random() * 512;
    bctx.fillStyle = i % 2 === 0 ? '#d0d0d0' : '#383838';
    bctx.fillRect(x, y, 2, 3);
  }

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.ClampToEdgeWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;
  bumpMap.userData = { shared: true };

  cachedRacingLineTextures = { colorMap, bumpMap };
  return cachedRacingLineTextures;
}

const asphaltTextureCache = new Map<
  string,
  { colorMap: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture }
>();

function createAsphaltTextures(
  asphaltHex: string,
  maxAnisotropy: number
): { colorMap: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const cached = asphaltTextureCache.get(asphaltHex);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = asphaltHex;
  ctx.fillRect(0, 0, 512, 512);

  // Fine multi-tone stone aggregate speckle
  for (let i = 0; i < 4800; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = Math.random();
    if (r > 0.6) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
    } else if (r > 0.25) {
      ctx.fillStyle = 'rgba(0,0,0,0.085)';
    } else {
      ctx.fillStyle = 'rgba(148,163,184,0.04)';
    }
    ctx.fillRect(x, y, 2 + (i % 2), 2 + ((i + 1) % 2));
  }

  // Subtle base asphalt aggregate variation
  const rubberGrad = ctx.createLinearGradient(0, 0, 512, 0);
  rubberGrad.addColorStop(0, 'rgba(0,0,0,0.07)');
  rubberGrad.addColorStop(0.22, 'rgba(0,0,0,0.02)');
  rubberGrad.addColorStop(0.5, 'rgba(0,0,0,0.08)');
  rubberGrad.addColorStop(0.78, 'rgba(0,0,0,0.02)');
  rubberGrad.addColorStop(1, 'rgba(0,0,0,0.07)');
  ctx.fillStyle = rubberGrad;
  ctx.fillRect(0, 0, 512, 512);

  // Longitudinal tarmac paving seams & subtle rubber skid streaks
  ctx.fillStyle = 'rgba(10,12,16,0.14)';
  ctx.fillRect(255, 0, 2, 512);
  for (let s = 0; s < 14; s++) {
    const sx = 120 + Math.random() * 270;
    const sy = Math.random() * 410;
    const len = 40 + Math.random() * 90;
    ctx.fillStyle = 'rgba(8,10,14,0.12)';
    ctx.fillRect(sx, sy, 3, len);
    ctx.fillRect(sx + 46, sy, 3, len);
  }

  // Crisp FIA historic white edge boundary lines
  ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
  ctx.fillRect(13, 0, 7, 512);
  ctx.fillRect(492, 0, 7, 512);

  // Subtle dashed center reference line
  ctx.fillStyle = 'rgba(248, 250, 252, 0.32)';
  ctx.fillRect(253, 30, 5, 170);
  ctx.fillRect(253, 285, 5, 170);

  const colorMap = new THREE.CanvasTexture(canvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.anisotropy = maxAnisotropy;
  colorMap.userData = { shared: true };

  // High-frequency bump map for asphalt grain micro-relief
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bctx = bumpCanvas.getContext('2d')!;
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3600; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    bctx.fillStyle = Math.random() > 0.5 ? '#a8a8a8' : '#585858';
    bctx.fillRect(x, y, 2, 2);
  }
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;
  bumpMap.userData = { shared: true };

  const pair = { colorMap, bumpMap };
  asphaltTextureCache.set(asphaltHex, pair);
  return pair;
}

const kerbTextureCache = new Map<string, THREE.CanvasTexture>();
function createKerbTexture(primaryHex: string, secondaryHex: string, maxAnisotropy: number): THREE.CanvasTexture {
  const key = `${primaryHex}|${secondaryHex}`;
  const cached = kerbTextureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = primaryHex;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = secondaryHex;
  ctx.fillRect(0, 256, 256, 256);

  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.fillRect(0, 246, 256, 14);
  ctx.fillRect(0, 500, 256, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(0, 0, 256, 10);
  ctx.fillRect(0, 260, 256, 10);

  const scrubGrad = ctx.createLinearGradient(0, 0, 256, 0);
  scrubGrad.addColorStop(0, 'rgba(15,15,15,0.28)');
  scrubGrad.addColorStop(0.35, 'rgba(15,15,15,0.06)');
  scrubGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = scrubGrad;
  ctx.fillRect(0, 0, 256, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  tex.userData = { shared: true };
  kerbTextureCache.set(key, tex);
  return tex;
}

let cachedArmcoRailTex: THREE.CanvasTexture | null = null;
function createArmcoRailTexture(maxAnisotropy: number): THREE.CanvasTexture {
  if (cachedArmcoRailTex) return cachedArmcoRailTex;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#94a3b8');
  grad.addColorStop(0.22, '#e2e8f0');
  grad.addColorStop(0.45, '#475569');
  grad.addColorStop(0.55, '#475569');
  grad.addColorStop(0.78, '#e2e8f0');
  grad.addColorStop(1, '#64748b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 128);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
  for (let x = 0; x < 256; x += 64) {
    ctx.fillRect(x, 0, 4, 128);
    ctx.fillRect(x + 6, 28, 4, 8);
    ctx.fillRect(x + 6, 92, 4, 8);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  tex.userData = { shared: true };
  cachedArmcoRailTex = tex;
  return tex;
}

const skyTextureCache = new Map<string, THREE.CanvasTexture>();
function createSkyDomeTexture(topHex: string, horizonHex: string, sunHex: string): THREE.CanvasTexture {
  const key = `${topHex}|${horizonHex}|${sunHex}`;
  const cached = skyTextureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, topHex);
  grad.addColorStop(0.48, horizonHex);
  grad.addColorStop(0.55, sunHex);
  grad.addColorStop(1, '#1e293b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  const sunGlow = ctx.createRadialGradient(360, 120, 6, 360, 120, 110);
  sunGlow.addColorStop(0, 'rgba(255, 251, 235, 0.9)');
  sunGlow.addColorStop(0.35, 'rgba(253, 224, 71, 0.28)');
  sunGlow.addColorStop(1, 'rgba(253, 224, 71, 0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, 512, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData = { shared: true };
  skyTextureCache.set(key, tex);
  return tex;
}

/**
 * High-performance 3D Rain streak particle system.
 * 750 continuous falling rain line segments tracking the active camera volume.
 */
export function createRainSystem(dropCount = 750): RainSystem {
  const positions = new Float32Array(dropCount * 6);
  const cubeSize = 65;
  const halfCube = cubeSize * 0.5;

  const dropsX = new Float32Array(dropCount);
  const dropsY = new Float32Array(dropCount);
  const dropsZ = new Float32Array(dropCount);
  const speeds = new Float32Array(dropCount);

  for (let i = 0; i < dropCount; i++) {
    dropsX[i] = (Math.random() - 0.5) * cubeSize;
    dropsY[i] = (Math.random() - 0.5) * cubeSize;
    dropsZ[i] = (Math.random() - 0.5) * cubeSize;
    speeds[i] = 42 + Math.random() * 22;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.LineBasicMaterial({
    color: 0x93c5fd,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });

  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  lines.visible = false;

  const update = (cameraPos: THREE.Vector3, weather: WeatherState, dt: number) => {
    if (weather.rainIntensity <= 0.02) {
      lines.visible = false;
      return;
    }
    lines.visible = true;
    material.opacity = Math.min(0.75, weather.rainIntensity * 0.7);

    const fallLen = 0.55;
    const wx = weather.windX * 0.04;
    const wz = weather.windZ * 0.04;

    for (let i = 0; i < dropCount; i++) {
      dropsY[i] -= speeds[i] * dt;
      dropsX[i] += weather.windX * dt * 0.6;
      dropsZ[i] += weather.windZ * dt * 0.6;

      if (dropsY[i] < -halfCube) {
        dropsY[i] = halfCube;
        dropsX[i] = (Math.random() - 0.5) * cubeSize;
        dropsZ[i] = (Math.random() - 0.5) * cubeSize;
      }

      const worldX = cameraPos.x + dropsX[i];
      const worldY = cameraPos.y + dropsY[i];
      const worldZ = cameraPos.z + dropsZ[i];

      const idx = i * 6;
      positions[idx] = worldX;
      positions[idx + 1] = worldY;
      positions[idx + 2] = worldZ;

      positions[idx + 3] = worldX - wx;
      positions[idx + 4] = worldY - fallLen;
      positions[idx + 5] = worldZ - wz;
    }
    geometry.attributes.position.needsUpdate = true;
  };

  return { lines, update };
}

/**
 * Builds the complete 3D Track Environment group with Pit Lane, Braking Boards,
 * Historic Sponsor Billboards, Grandstands, and real-time Weather Visual controls.
 */
export function buildTrackEnvironment(
  track: TrackSpec,
  isSoftwareGl: boolean,
  maxAnisotropy: number
): TrackEnvironmentRig {
  const envGroup = new THREE.Group();
  const samples = track.samples;
  const n = samples.length;

  // 0. Atmospheric Sky Dome
  const skyTex = createSkyDomeTexture(track.theme.skyTop, track.theme.skyHorizon, track.theme.sunColor);
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(760, 28, 16), skyMat);
  envGroup.add(skyDome);

  // 1. Extended Outdoor 3D Hills & Mountain Terrain Ground (64x64 grid, deeply recessed within 42m of the track)
  const groundGeo = new THREE.PlaneGeometry(1500, 1500, 64, 64);
  groundGeo.rotateX(-Math.PI / 2);
  const posAttr = groundGeo.attributes.position;
  const isAlpineTrack =
    track.id === 'stelvio_pass' || track.id === 'targa_madonie' || track.id === 'eifel_sprint';
  const hillScale = isAlpineTrack ? 28 : 16;

  for (let i = 0; i < posAttr.count; i++) {
    const gx = posAttr.getX(i);
    const gz = posAttr.getZ(i);
    const closest = findClosestTrackSample(track, gx, gz);
    const dist = Math.sqrt(closest.distSq);
    const safeCorridorHalfWidth = closest.sample.width * 0.5 + 42;
    if (dist < safeCorridorHalfWidth) {
      // Strictly 3.6m below the road surface inside the entire 42m track corridor so terrain triangles can NEVER poke through the road
      posAttr.setY(i, closest.surfaceY - 3.6);
    } else {
      const hillFactor = Math.min(1, (dist - safeCorridorHalfWidth) / 80);
      const smoothHill = hillFactor * hillFactor * (3 - 2 * hillFactor);
      const ridgeWave =
        Math.sin(gx * 0.015) * Math.cos(gz * 0.015) * hillScale +
        Math.sin((gx + gz) * 0.008) * (hillScale * 0.65) +
        hillScale * 0.45;
      posAttr.setY(i, closest.surfaceY - 3.2 + ridgeWave * smoothHill);
    }
  }
  groundGeo.computeVertexNormals();

  const groundMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(track.theme.groundColor),
    roughness: 0.92,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: 4,
    polygonOffsetUnits: 4,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.receiveShadow = !isSoftwareGl;
  envGroup.add(groundMesh);

  // 2. Continuous 3D Crowned Asphalt Ribbon, Raised 3D Rumble Kerbs, Non-Overlapping Grass Verges & Armco Guardrails
  const roadPositions: number[] = [];
  const roadUvs: number[] = [];
  const roadIndices: number[] = [];

  const kerbPositions: number[] = [];
  const kerbUvs: number[] = [];
  const kerbIndices: number[] = [];

  const shoulderPositions: number[] = [];
  const shoulderIndices: number[] = [];

  const railPositions: number[] = [];
  const railUvs: number[] = [];
  const railIndices: number[] = [];

  const kerbWidth = 1.45;
  const guardrailOffset = 1.85;
  const vergeWidth = 5.2; // Compact trackside verge so inner corners never self-intersect across the road
  const skirtWidth = 14.0;

  for (let i = 0; i <= n; i++) {
    const s = samples[i % n];
    const halfW = s.width * 0.5;
    const bankY = Math.sin(s.bankingRad) * halfW * 0.35;
    const vCoord = (i / n) * 130;

    // 3-point Crowned Road Cross-Section (Left Edge -> Cambered Center Crown -> Right Edge)
    const lx = s.x - s.rx * halfW;
    const ly = s.y - bankY;
    const lz = s.z - s.rz * halfW;

    const cx = s.x;
    const cy = s.y + 0.024; // Subtle realistic 2.4cm asphalt drainage crown
    const cz = s.z;

    const rx = s.x + s.rx * halfW;
    const ry = s.y + bankY;
    const rz = s.z + s.rz * halfW;

    roadPositions.push(lx, ly, lz, cx, cy, cz, rx, ry, rz);
    roadUvs.push(0, vCoord, 0.5, vCoord, 1, vCoord);

    const klOuterX = s.x - s.rx * (halfW + kerbWidth);
    const klOuterZ = s.z - s.rz * (halfW + kerbWidth);
    const krOuterX = s.x + s.rx * (halfW + kerbWidth);
    const krOuterZ = s.z + s.rz * (halfW + kerbWidth);

    const kerbV = (i / n) * 190;
    kerbPositions.push(
      klOuterX, ly + 0.048, klOuterZ,
      lx, ly + 0.012, lz,
      rx, ry + 0.012, rz,
      krOuterX, ry + 0.048, krOuterZ
    );
    kerbUvs.push(0, kerbV, 1, kerbV, 0, kerbV, 1, kerbV);

    // Non-overlapping Grass Verges: Left Verge + Left Outer Skirt, Right Verge + Right Outer Skirt
    // Every outer point checks track proximity so it NEVER pokes into an adjacent corner or chicane!
    const vlOuterX = s.x - s.rx * (halfW + vergeWidth);
    const vlOuterZ = s.z - s.rz * (halfW + vergeWidth);
    const vrOuterX = s.x + s.rx * (halfW + vergeWidth);
    const vrOuterZ = s.z + s.rz * (halfW + vergeWidth);

    const slOuterX = s.x - s.rx * (halfW + skirtWidth);
    const slOuterZ = s.z - s.rz * (halfW + skirtWidth);
    const srOuterX = s.x + s.rx * (halfW + skirtWidth);
    const srOuterZ = s.z + s.rz * (halfW + skirtWidth);

    const checkVL = findClosestTrackSample(track, vlOuterX, vlOuterZ, i % n);
    const vlY =
      checkVL.distSq < (checkVL.sample.width * 0.5 + kerbWidth + 0.6) ** 2
        ? Math.min(ly - 0.65, checkVL.surfaceY - 0.85)
        : ly - 0.18;

    const checkVR = findClosestTrackSample(track, vrOuterX, vrOuterZ, i % n);
    const vrY =
      checkVR.distSq < (checkVR.sample.width * 0.5 + kerbWidth + 0.6) ** 2
        ? Math.min(ry - 0.65, checkVR.surfaceY - 0.85)
        : ry - 0.18;

    const checkSL = findClosestTrackSample(track, slOuterX, slOuterZ, i % n);
    const slY = Math.min(ly - 3.6, checkSL.surfaceY - 3.6);

    const checkSR = findClosestTrackSample(track, srOuterX, srOuterZ, i % n);
    const srY = Math.min(ry - 3.6, checkSR.surfaceY - 3.6);

    // 6 shoulder vertices per station (3 left, 3 right — NO quad running under the road at -0.02m!)
    shoulderPositions.push(
      slOuterX, slY, slOuterZ,
      vlOuterX, vlY, vlOuterZ,
      klOuterX, ly - 0.04, klOuterZ,
      krOuterX, ry - 0.04, krOuterZ,
      vrOuterX, vrY, vrOuterZ,
      srOuterX, srY, srOuterZ
    );

    const rlX = s.x - s.rx * (halfW + guardrailOffset);
    const rlZ = s.z - s.rz * (halfW + guardrailOffset);
    const rrX = s.x + s.rx * (halfW + guardrailOffset);
    const rrZ = s.z + s.rz * (halfW + guardrailOffset);
    const railV = (i / n) * 150;

    railPositions.push(
      rlX, ly + 0.02, rlZ,
      rlX, ly + 0.78, rlZ,
      rrX, ry + 0.02, rrZ,
      rrX, ry + 0.78, rrZ
    );
    railUvs.push(railV, 0, railV, 1, railV, 0, railV, 1);

    if (i < n) {
      // 3-vertex road cross section (2 quads per station)
      const rBase = i * 3;
      roadIndices.push(
        rBase, rBase + 1, rBase + 3,
        rBase + 1, rBase + 4, rBase + 3,
        rBase + 1, rBase + 2, rBase + 4,
        rBase + 2, rBase + 5, rBase + 4
      );

      const kBase = i * 4;
      kerbIndices.push(kBase, kBase + 1, kBase + 4, kBase + 1, kBase + 5, kBase + 4);
      kerbIndices.push(kBase + 2, kBase + 3, kBase + 6, kBase + 3, kBase + 7, kBase + 6);

      // 6-vertex shoulder cross section (Left skirt + Left verge, Right verge + Right skirt — zero middle road overlap!)
      const sBase = i * 6;
      // Left outer skirt (0..1) & Left trackside verge (1..2)
      shoulderIndices.push(sBase + 0, sBase + 1, sBase + 6, sBase + 1, sBase + 7, sBase + 6);
      shoulderIndices.push(sBase + 1, sBase + 2, sBase + 7, sBase + 2, sBase + 8, sBase + 7);
      // Right trackside verge (3..4) & Right outer skirt (4..5)
      shoulderIndices.push(sBase + 3, sBase + 4, sBase + 9, sBase + 4, sBase + 10, sBase + 9);
      shoulderIndices.push(sBase + 4, sBase + 5, sBase + 10, sBase + 5, sBase + 11, sBase + 10);

      railIndices.push(kBase, kBase + 1, kBase + 4, kBase + 1, kBase + 5, kBase + 4);
      railIndices.push(kBase + 2, kBase + 3, kBase + 6, kBase + 3, kBase + 7, kBase + 6);
    }
  }

  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
  roadGeo.setIndex(roadIndices);
  roadGeo.computeVertexNormals();

  const { colorMap: asphaltTex, bumpMap: asphaltBump } = createAsphaltTextures(
    track.theme.asphaltColor,
    maxAnisotropy
  );
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: asphaltTex,
    bumpMap: asphaltBump,
    bumpScale: 0.018,
    roughness: 0.68,
    metalness: 0.09,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = !isSoftwareGl;
  envGroup.add(roadMesh);

  // 2B. Dynamic 3D Racing Line Rubbering Overlay Ribbon (follows s.racingLineOffset & crown/banking)
  const rlPositions: number[] = [];
  const rlUvs: number[] = [];
  const rlColors: number[] = [];
  const rlIndices: number[] = [];
  const rlHalfWidth = 2.45; // 4.9m wide racing groove ribbon

  const evalRoadSurfaceYAtOffset = (s: typeof samples[0], latOffset: number): number => {
    const halfW = Math.max(1, s.width * 0.5);
    const normLat = Math.max(-1, Math.min(1, latOffset / halfW));
    const bankY = Math.sin(s.bankingRad) * halfW * 0.35 * normLat;
    const crownY = 0.024 * (1 - Math.abs(normLat));
    return s.y + crownY + bankY;
  };

  for (let i = 0; i <= n; i++) {
    const s = samples[i % n];
    const halfW = s.width * 0.5;
    const centerOff = s.racingLineOffset;
    const vCoord = (i / n) * 145;
    const subOffsets = [-rlHalfWidth, -rlHalfWidth * 0.45, 0, rlHalfWidth * 0.45, rlHalfWidth];
    const subU = [0, 0.275, 0.5, 0.725, 1];

    // Heavy braking/cornering zones naturally accumulate deeper rubber sheen
    const cornerDarken = 1 - s.cornerLoadIntensity * 0.25;

    for (let k = 0; k < 5; k++) {
      const lat = Math.max(-(halfW - 0.35), Math.min(halfW - 0.35, centerOff + subOffsets[k]));
      const px = s.x + s.rx * lat;
      const pz = s.z + s.rz * lat;
      const py = evalRoadSurfaceYAtOffset(s, lat) + 0.005;
      rlPositions.push(px, py, pz);
      rlUvs.push(subU[k], vCoord);
      rlColors.push(cornerDarken, cornerDarken, cornerDarken);
    }

    if (i < n) {
      const base = i * 5;
      for (let k = 0; k < 4; k++) {
        rlIndices.push(
          base + k,
          base + k + 1,
          base + 5 + k,
          base + k + 1,
          base + 6 + k,
          base + 5 + k
        );
      }
    }
  }

  const rlGeo = new THREE.BufferGeometry();
  rlGeo.setAttribute('position', new THREE.Float32BufferAttribute(rlPositions, 3));
  rlGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rlUvs, 2));
  rlGeo.setAttribute('color', new THREE.Float32BufferAttribute(rlColors, 3));
  rlGeo.setIndex(rlIndices);
  rlGeo.computeVertexNormals();

  const { colorMap: rlColorMap, bumpMap: rlBumpMap } = createRacingLineRubberTextures(maxAnisotropy);
  const racingLineMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: rlColorMap,
    bumpMap: rlBumpMap,
    bumpScale: 0.024,
    vertexColors: true,
    transparent: true,
    opacity: 0.28,
    roughness: 0.52,
    metalness: 0.16,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  const racingLineMesh = new THREE.Mesh(rlGeo, racingLineMat);
  racingLineMesh.receiveShadow = !isSoftwareGl;
  envGroup.add(racingLineMesh);

  const kerbGeo = new THREE.BufferGeometry();
  kerbGeo.setAttribute('position', new THREE.Float32BufferAttribute(kerbPositions, 3));
  kerbGeo.setAttribute('uv', new THREE.Float32BufferAttribute(kerbUvs, 2));
  kerbGeo.setIndex(kerbIndices);
  kerbGeo.computeVertexNormals();

  const kerbTex = createKerbTexture(track.theme.kerbPrimary, track.theme.kerbSecondary, maxAnisotropy);
  const kerbMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: kerbTex,
    roughness: 0.58,
    metalness: 0.06,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const kerbMesh = new THREE.Mesh(kerbGeo, kerbMat);
  kerbMesh.receiveShadow = !isSoftwareGl;
  envGroup.add(kerbMesh);

  const shoulderGeo = new THREE.BufferGeometry();
  shoulderGeo.setAttribute('position', new THREE.Float32BufferAttribute(shoulderPositions, 3));
  shoulderGeo.setIndex(shoulderIndices);
  shoulderGeo.computeVertexNormals();
  const shoulderMesh = new THREE.Mesh(shoulderGeo, groundMat);
  shoulderMesh.receiveShadow = !isSoftwareGl;
  envGroup.add(shoulderMesh);

  const railGeo = new THREE.BufferGeometry();
  railGeo.setAttribute('position', new THREE.Float32BufferAttribute(railPositions, 3));
  railGeo.setAttribute('uv', new THREE.Float32BufferAttribute(railUvs, 2));
  railGeo.setIndex(railIndices);
  railGeo.computeVertexNormals();

  const railTex = createArmcoRailTexture(maxAnisotropy);
  const railMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: railTex,
    roughness: 0.36,
    metalness: 0.72,
    side: THREE.DoubleSide,
  });
  const railMesh = new THREE.Mesh(railGeo, railMat);
  envGroup.add(railMesh);

  // 2C. Off-Line Corner Tire Debris "Marbles" (Instanced vulcanized rubber chunks outside the racing groove)
  const marbleCapacity = 120;
  const marbleGeo = new THREE.DodecahedronGeometry(0.055, 0);
  marbleGeo.scale(1.3, 0.45, 0.95);
  const marbleMat = new THREE.MeshStandardMaterial({
    color: 0x0b0e13,
    roughness: 0.92,
    metalness: 0.05,
  });
  const marblesInst = new THREE.InstancedMesh(marbleGeo, marbleMat, marbleCapacity);
  const marbleBasePositions: Array<{
    x: number;
    y: number;
    z: number;
    rotY: number;
    stationIdx: number;
    scale: number;
  }> = [];

  for (let i = 0; i < n && marbleBasePositions.length < marbleCapacity; i += 2) {
    const s = samples[i];
    if (s.cornerLoadIntensity < 0.22) continue;
    const outsideSign = s.racingLineOffset <= 0 ? 1 : -1;
    const halfW = s.width * 0.5;
    for (let m = 0; m < 2 && marbleBasePositions.length < marbleCapacity; m++) {
      const pseudo = ((i * 73 + m * 31) % 100) / 100;
      const lat = outsideSign * (halfW * (0.48 + pseudo * 0.38));
      const mx = s.x + s.rx * lat + s.tx * ((pseudo - 0.5) * 1.4);
      const mz = s.z + s.rz * lat + s.tz * ((pseudo - 0.5) * 1.4);
      const my = evalRoadSurfaceYAtOffset(s, lat) + 0.012;
      marbleBasePositions.push({
        x: mx,
        y: my,
        z: mz,
        rotY: pseudo * Math.PI * 2,
        stationIdx: i,
        scale: 0.65 + pseudo * 0.75,
      });
    }
  }
  marblesInst.count = marbleBasePositions.length;
  envGroup.add(marblesInst);

  // 3. Clean Checkered Start/Finish Road Strip & Pit Service Stall Box (Zero Overhead or Trackside Ad Signs)
  const startLookup = findClosestTrackSample(track, 0, 0);
  const startS = startLookup.sample;
  const gantryGroup = new THREE.Group();
  gantryGroup.position.set(startS.x, startLookup.surfaceY, startS.z);
  gantryGroup.rotation.y = Math.atan2(startS.tx, startS.tz);

  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45, metalness: 0.6 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.35, metalness: 0.3 });

  // Checkered start/finish road line
  const checkCanvas = document.createElement('canvas');
  checkCanvas.width = 256;
  checkCanvas.height = 64;
  const cctx = checkCanvas.getContext('2d')!;
  for (let y = 0; y < 64; y += 16) {
    for (let x = 0; x < 256; x += 16) {
      cctx.fillStyle = (x / 16 + y / 16) % 2 === 0 ? '#f8fafc' : '#09090b';
      cctx.fillRect(x, y, 16, 16);
    }
  }
  const checkTex = new THREE.CanvasTexture(checkCanvas);
  checkTex.colorSpace = THREE.SRGBColorSpace;
  checkTex.anisotropy = maxAnisotropy;

  const startStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(startS.width - 0.8, 2.2),
    new THREE.MeshBasicMaterial({
      map: checkTex,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    })
  );
  startStrip.rotation.x = -Math.PI / 2;
  startStrip.position.set(0, 0.014, 0);

  // Painted Pit Service Stall Box markings on the right side of the main straight
  const pitStallCanvas = document.createElement('canvas');
  pitStallCanvas.width = 256;
  pitStallCanvas.height = 512;
  const pctx = pitStallCanvas.getContext('2d')!;
  pctx.clearRect(0, 0, 256, 512);
  pctx.strokeStyle = '#f59e0b';
  pctx.lineWidth = 14;
  pctx.setLineDash([28, 18]);
  pctx.strokeRect(12, 12, 232, 488);
  pctx.setLineDash([]);
  pctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
  pctx.fillRect(18, 18, 220, 476);

  const pitStallTex = new THREE.CanvasTexture(pitStallCanvas);
  pitStallTex.colorSpace = THREE.SRGBColorSpace;
  pitStallTex.anisotropy = maxAnisotropy;

  const pitStallApron = new THREE.Mesh(
    new THREE.PlaneGeometry(3.8, 28),
    new THREE.MeshBasicMaterial({
      map: pitStallTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    })
  );
  pitStallApron.rotation.x = -Math.PI / 2;
  pitStallApron.position.set(-startS.width * 0.34, 0.016, 14);

  gantryGroup.add(startStrip, pitStallApron);
  envGroup.add(gantryGroup);

  // 4. Detailed 3D Pit Lane Complex + 3-Story Autodromo Timing & Press Pagoda Tower
  const pitGroup = new THREE.Group();
  const pitStartDist = 18;
  pitGroup.position.set(
    startS.x + startS.rx * (startS.width * 0.5 + 4.2),
    startLookup.surfaceY,
    startS.z + pitStartDist
  );
  pitGroup.rotation.y = Math.atan2(startS.tx, startS.tz);

  // Concrete Pit Wall
  const pitWallGeo = new THREE.BoxGeometry(0.8, 1.15, 62);
  const pitWallMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.75 });
  const pitWallMesh = new THREE.Mesh(pitWallGeo, pitWallMat);
  pitWallMesh.position.set(0, 0.58, 0);
  pitGroup.add(pitWallMesh);

  // Metal Safety Fence atop Pit Wall
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.8 });
  for (let fz = -28; fz <= 28; fz += 7) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8), fenceMat);
    post.position.set(0, 1.85, fz);
    pitGroup.add(post);
  }
  const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 58), fenceMat);
  railTop.position.set(0, 2.55, 0);
  pitGroup.add(railTop);

  // 3-Story Autodromo Press & Race Control Pagoda Tower
  const pagodaGroup = new THREE.Group();
  pagodaGroup.position.set(5.8, 0, -24);
  const pagodaGlassMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.15,
    metalness: 0.85,
  });
  for (let fl = 0; fl < 3; fl++) {
    const w = 4.6 - fl * 0.35;
    const floorSlab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.35, w + 0.6), pillarMat);
    floorSlab.position.y = fl * 3.1 + 0.18;
    const glassRoom = new THREE.Mesh(new THREE.BoxGeometry(w, 2.75, w), pagodaGlassMat);
    glassRoom.position.y = fl * 3.1 + 1.65;
    const balconyBand = new THREE.Mesh(new THREE.BoxGeometry(w + 0.75, 0.55, w + 0.75), accentMat);
    balconyBand.position.y = (fl + 1) * 3.1 - 0.15;
    pagodaGroup.add(floorSlab, glassRoom, balconyBand);
  }
  const antennaMast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 4.2, 8), fenceMat);
  antennaMast.position.y = 11.4;
  pagodaGroup.add(antennaMast);
  pitGroup.add(pagodaGroup);

  // Pit Crew Mechanics with Lollipop Pit Boards & Spare Compound Tires (shared geometries & materials)
  const mechanicMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.65 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.8 });
  const pitBoardMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 });
  const toolboxMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45, metalness: 0.3 });
  const spareTireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
  const drumMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.45, metalness: 0.6 });
  const mechBodyGeo = new THREE.BoxGeometry(0.5, 0.9, 0.3);
  const mechHeadGeo = new THREE.SphereGeometry(0.16, 10, 10);
  const mechCapGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 10);
  const mechPoleGeo = new THREE.CylinderGeometry(0.025, 0.025, 2.6, 8);
  const mechBoardGeo = new THREE.CircleGeometry(0.28, 14);
  const toolboxGeo = new THREE.BoxGeometry(0.65, 0.85, 1.1);
  const spareTireGeo = new THREE.TorusGeometry(0.34, 0.16, 8, 16);
  const drumGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.95, 12);

  for (let m = 0; m < 4; m++) {
    const mz = -18 + m * 13;
    const mech = new THREE.Group();
    mech.position.set(1.4, 0, mz);

    const body = new THREE.Mesh(mechBodyGeo, mechanicMat);
    body.position.y = 0.9;
    const head = new THREE.Mesh(mechHeadGeo, skinMat);
    head.position.y = 1.5;
    const cap = new THREE.Mesh(mechCapGeo, accentMat);
    cap.position.y = 1.62;

    const pole = new THREE.Mesh(mechPoleGeo, fenceMat);
    pole.position.set(-0.8, 1.4, 0.2);
    pole.rotation.z = 0.35;
    const board = new THREE.Mesh(mechBoardGeo, pitBoardMat);
    board.position.set(-1.3, 2.4, 0.2);
    board.rotation.y = Math.PI / 2;

    mech.add(body, head, cap, pole, board);
    pitGroup.add(mech);

    const toolbox = new THREE.Mesh(toolboxGeo, toolboxMat);
    toolbox.position.set(3.2, 0.42, mz - 2.5);
    pitGroup.add(toolbox);

    for (let th = 0; th < 3; th++) {
      const tire = new THREE.Mesh(spareTireGeo, spareTireMat);
      tire.rotation.x = Math.PI / 2;
      tire.position.set(3.1, 0.16 + th * 0.32, mz + 2.8);
      pitGroup.add(tire);
    }

    const drum = new THREE.Mesh(drumGeo, drumMat);
    drum.position.set(4.2, 0.48, mz);
    pitGroup.add(drum);
  }
  envGroup.add(pitGroup);

  // 5. Outer Corner Hay Bales / Safety Cushions (Zero Road Ads or Commercial Signs)
  const postMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.8 });
  const hayBaleMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.92 });
  const hayBaleGeo = new THREE.BoxGeometry(1.35, 0.72, 0.78);

  for (let i = 0; i < n; i += 18) {
    const s = samples[i];
    if (Math.abs(s.curvature) > 0.017) {
      const outsideSign = s.curvature > 0 ? -1 : 1;
      const hx = s.x + s.rx * outsideSign * (s.width * 0.5 + 1.48);
      const hz = s.z + s.rz * outsideSign * (s.width * 0.5 + 1.48);
      const hLookup = findClosestTrackSample(track, hx, hz, i);
      const bale = new THREE.Mesh(hayBaleGeo, hayBaleMat);
      bale.position.set(hx, hLookup.surfaceY + 0.36, hz);
      bale.rotation.y = Math.atan2(s.tx, s.tz);
      envGroup.add(bale);
    }
  }

  // 7. Trackside Marshal Observation Posts with Flags
  const hutGeo = new THREE.BoxGeometry(2.4, 2.2, 2.4);
  const hutMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9 });
  const hutRoofGeo = new THREE.ConeGeometry(2.1, 1.2, 4);
  const flagPoleGeo = new THREE.CylinderGeometry(0.03, 0.03, 3.2, 8);
  const flagGeo = new THREE.PlaneGeometry(0.9, 0.55);
  const flagMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide });

  for (const mIdx of [Math.floor(n * 0.28), Math.floor(n * 0.65)]) {
    const ms = samples[mIdx];
    const mStand = new THREE.Group();
    const mx = ms.x - ms.rx * (ms.width * 0.5 + 5.5);
    const mz = ms.z - ms.rz * (ms.width * 0.5 + 5.5);
    const mLookup = findClosestTrackSample(track, mx, mz);

    mStand.position.set(mx, mLookup.surfaceY, mz);
    mStand.rotation.y = Math.atan2(ms.tx, ms.tz);

    const hut = new THREE.Mesh(hutGeo, hutMat);
    hut.position.y = 1.1;

    const roof = new THREE.Mesh(hutRoofGeo, accentMat);
    roof.position.y = 2.8;
    roof.rotation.y = Math.PI / 4;

    const flagPole = new THREE.Mesh(flagPoleGeo, postMat);
    flagPole.position.set(1.4, 1.6, 0.8);
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(1.85, 2.8, 0.8);

    mStand.add(hut, roof, flagPole, flag);
    envGroup.add(mStand);
  }

  // 8. Pit-Straight Grandstand with Tiered Spectator Seating, Instanced 3D Crowd & Cantilevered Canopy
  const standGroup = new THREE.Group();
  standGroup.position.set(
    startS.x - startS.rx * (startS.width * 0.5 + 9.5),
    startLookup.surfaceY,
    startS.z + 18
  );
  standGroup.rotation.y = Math.atan2(startS.tx, startS.tz);

  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.5, metalness: 0.25 });
  const crowdColors = [0xdc2626, 0x2563eb, 0xfacc15, 0xf8fafc, 0x16a34a];
  const spectatorCapacity = 4 * 13;
  const specTorsoGeo = new THREE.BoxGeometry(0.45, 0.58, 0.55);
  const specTorsoMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  const specTorsoInst = new THREE.InstancedMesh(specTorsoGeo, specTorsoMat, spectatorCapacity);
  const specHeadGeo = new THREE.SphereGeometry(0.16, 8, 8);
  const specHeadInst = new THREE.InstancedMesh(specHeadGeo, skinMat, spectatorCapacity);
  const specDummy = new THREE.Object3D();
  const specColor = new THREE.Color();
  let specIdx = 0;

  for (let tier = 0; tier < 4; tier++) {
    const tierH = 1.1 + tier * 1.1;
    const tierMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, tierH, 48), concreteMat);
    tierMesh.position.set(-tier * 2.1, tierH * 0.5, 0);
    standGroup.add(tierMesh);

    for (let sz = -21; sz <= 21; sz += 3.5) {
      specDummy.position.set(-tier * 2.1 + 0.3, tierH + 0.29, sz);
      specDummy.updateMatrix();
      specTorsoInst.setMatrixAt(specIdx, specDummy.matrix);
      specColor.setHex(crowdColors[(tier + Math.abs(Math.round(sz))) % crowdColors.length]);
      specTorsoInst.setColorAt(specIdx, specColor);

      specDummy.position.set(-tier * 2.1 + 0.3, tierH + 0.72, sz);
      specDummy.updateMatrix();
      specHeadInst.setMatrixAt(specIdx, specDummy.matrix);
      specIdx++;
    }
  }
  specTorsoInst.count = specIdx;
  specHeadInst.count = specIdx;
  specTorsoInst.instanceMatrix.needsUpdate = true;
  if (specTorsoInst.instanceColor) specTorsoInst.instanceColor.needsUpdate = true;
  specHeadInst.instanceMatrix.needsUpdate = true;
  standGroup.add(specTorsoInst, specHeadInst);

  const standRoof = new THREE.Mesh(new THREE.BoxGeometry(11, 0.4, 50), roofMat);
  standRoof.position.set(-3.2, 7.6, 0);
  standRoof.rotation.z = -0.15;
  standGroup.add(standRoof);
  envGroup.add(standGroup);

  // 9. Tall Silhouette Landmark
  const vistaSample = samples[(startLookup.sample.index + 52) % n];
  const landmarkGroup = new THREE.Group();
  landmarkGroup.position.set(
    vistaSample.x + vistaSample.rx * (vistaSample.width + 24),
    vistaSample.y,
    vistaSample.z
  );

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 });
  const spireMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.55 });

  const towerBase = new THREE.Mesh(new THREE.BoxGeometry(10, 16, 10), stoneMat);
  towerBase.position.y = 8;
  const towerUpper = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 14, 12), stoneMat);
  towerUpper.position.y = 22;
  const towerSpire = new THREE.Mesh(new THREE.ConeGeometry(5.2, 9, 12), spireMat);
  towerSpire.position.y = 33.5;

  landmarkGroup.add(towerBase, towerUpper, towerSpire);
  envGroup.add(landmarkGroup);

  // 10. InstancedMesh Two-Tiered Pine/Cypress Trees & Rock Formations
  const treeCount = 140;
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.46, 2.8, 8);
  trunkGeo.translate(0, 1.4, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });

  const foliageLowerGeo = new THREE.ConeGeometry(2.7, 4.8, 9);
  foliageLowerGeo.translate(0, 4.4, 0);
  const foliageUpperGeo = new THREE.ConeGeometry(2.0, 4.6, 9);
  foliageUpperGeo.translate(0, 7.2, 0);
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 });

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const foliageInst = new THREE.InstancedMesh(foliageLowerGeo, foliageMat, treeCount);
  const foliageUpperInst = new THREE.InstancedMesh(foliageUpperGeo, foliageMat, treeCount);

  const rockCount = 65;
  const rockGeo = new THREE.DodecahedronGeometry(2.4, 0);
  rockGeo.translate(0, 1.2, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 });
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);

  const dummy = new THREE.Object3D();
  const colorHelper = new THREE.Color();

  let seed = track.id === 'monza_storico' ? 101 : track.id === 'cote_dazur' ? 202 : 303;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  let placedTrees = 0;
  let attempts = 0;
  while (placedTrees < treeCount && attempts < 900) {
    attempts++;
    const sIdx = Math.floor(rand() * n);
    const s = samples[sIdx];
    const side = rand() > 0.5 ? 1 : -1;
    const distFromCenter = s.width * 0.5 + 10 + rand() * 55;
    const tx = s.x + s.rx * side * distFromCenter + (rand() - 0.5) * 8;
    const tz = s.z + s.rz * side * distFromCenter + (rand() - 0.5) * 8;

    const check = findClosestTrackSample(track, tx, tz, sIdx);
    if (check.distSq < (check.sample.width * 0.5 + 8.5) ** 2) continue;

    const scale = 0.85 + rand() * 0.35;
    dummy.position.set(tx, check.surfaceY - 0.35, tz);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.set(scale, scale * (0.9 + rand() * 0.25), scale);
    dummy.updateMatrix();

    trunkInst.setMatrixAt(placedTrees, dummy.matrix);
    foliageInst.setMatrixAt(placedTrees, dummy.matrix);
    foliageUpperInst.setMatrixAt(placedTrees, dummy.matrix);

    const hue = 0.27 + (rand() - 0.5) * 0.05;
    const sat = 0.42 + (rand() - 0.5) * 0.12;
    const light = 0.22 + (rand() - 0.5) * 0.08;
    colorHelper.setHSL(hue, sat, light);
    foliageInst.setColorAt(placedTrees, colorHelper);
    colorHelper.setHSL(hue, sat, light * 1.12);
    foliageUpperInst.setColorAt(placedTrees, colorHelper);

    placedTrees++;
  }

  trunkInst.count = placedTrees;
  foliageInst.count = placedTrees;
  foliageUpperInst.count = placedTrees;
  trunkInst.instanceMatrix.needsUpdate = true;
  foliageInst.instanceMatrix.needsUpdate = true;
  foliageUpperInst.instanceMatrix.needsUpdate = true;
  if (foliageInst.instanceColor) foliageInst.instanceColor.needsUpdate = true;
  if (foliageUpperInst.instanceColor) foliageUpperInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  foliageInst.computeBoundingSphere();
  foliageUpperInst.computeBoundingSphere();
  envGroup.add(trunkInst, foliageInst, foliageUpperInst);

  let placedRocks = 0;
  attempts = 0;
  while (placedRocks < rockCount && attempts < 400) {
    attempts++;
    const sIdx = Math.floor(rand() * n);
    const s = samples[sIdx];
    const side = rand() > 0.5 ? 1 : -1;
    const distFromCenter = s.width * 0.5 + 8 + rand() * 42;
    const rx = s.x + s.rx * side * distFromCenter;
    const rz = s.z + s.rz * side * distFromCenter;

    const check = findClosestTrackSample(track, rx, rz, sIdx);
    if (check.distSq < (check.sample.width * 0.5 + 7.5) ** 2) continue;

    const scaleX = 0.85 + rand() * 0.9;
    const scaleY = 0.65 + rand() * 0.7;
    const scaleZ = 0.85 + rand() * 0.9;
    dummy.position.set(rx, check.surfaceY - 0.45, rz);
    dummy.rotation.set(rand() * 0.3, rand() * Math.PI * 2, rand() * 0.3);
    dummy.scale.set(scaleX, scaleY, scaleZ);
    dummy.updateMatrix();

    rockInst.setMatrixAt(placedRocks, dummy.matrix);
    const gray = 0.38 + (rand() - 0.5) * 0.14;
    colorHelper.setRGB(gray, gray * 0.98, gray * 0.95);
    rockInst.setColorAt(placedRocks, colorHelper);
    placedRocks++;
  }
  rockInst.count = placedRocks;
  rockInst.instanceMatrix.needsUpdate = true;
  if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
  rockInst.computeBoundingSphere();
  envGroup.add(rockInst);

  // 2D. Dynamic 3D Standing Water Puddles on Low-Drainage Asphalt Margins & Braking Zones
  const puddleCapacity = 64;
  const puddleCanvas = document.createElement('canvas');
  puddleCanvas.width = 256;
  puddleCanvas.height = 256;
  const pudCtx = puddleCanvas.getContext('2d')!;
  const pudGrad = pudCtx.createRadialGradient(128, 128, 18, 128, 128, 122);
  pudGrad.addColorStop(0.0, 'rgba(14, 26, 42, 0.92)');
  pudGrad.addColorStop(0.55, 'rgba(30, 58, 95, 0.75)');
  pudGrad.addColorStop(0.82, 'rgba(56, 189, 248, 0.28)');
  pudGrad.addColorStop(1.0, 'rgba(15, 23, 42, 0.0)');
  pudCtx.fillStyle = pudGrad;
  pudCtx.fillRect(0, 0, 256, 256);
  const puddleTex = new THREE.CanvasTexture(puddleCanvas);
  puddleTex.colorSpace = THREE.SRGBColorSpace;

  const puddleGeo = new THREE.PlaneGeometry(2.8, 4.6);
  puddleGeo.rotateX(-Math.PI / 2);
  const puddleMat = new THREE.MeshStandardMaterial({
    color: 0x93c5fd,
    map: puddleTex,
    transparent: true,
    opacity: 0.0,
    roughness: 0.03,
    metalness: 0.92,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const puddlesInst = new THREE.InstancedMesh(puddleGeo, puddleMat, puddleCapacity);
  const puddleAnchors: Array<{
    x: number;
    y: number;
    z: number;
    rotY: number;
    stationIdx: number;
    scaleX: number;
    scaleZ: number;
  }> = [];

  for (let i = 0; i < n && puddleAnchors.length < puddleCapacity; i += 3) {
    const s = samples[i];
    const bankMag = Math.abs(s.bankingRad);
    const lowSideSign = s.bankingRad >= 0 ? -1 : 1;
    const halfW = s.width * 0.5;
    const pseudo = ((i * 53 + 19) % 100) / 100;
    const lat = lowSideSign * (halfW * (0.36 + pseudo * 0.36));
    const px = s.x + s.rx * lat;
    const pz = s.z + s.rz * lat;
    const py = evalRoadSurfaceYAtOffset(s, lat) + 0.008;
    puddleAnchors.push({
      x: px,
      y: py,
      z: pz,
      rotY: Math.atan2(s.tx, s.tz) + (pseudo - 0.5) * 0.25,
      stationIdx: i,
      scaleX: (0.75 + pseudo * 0.65) * (1 - bankMag * 0.6),
      scaleZ: 0.85 + pseudo * 0.95,
    });
  }
  puddlesInst.count = puddleAnchors.length;
  puddlesInst.visible = false;
  envGroup.add(puddlesInst);

  // Dynamic Weather, Puddle Formation & Track Drying Visual Updater
  let lastPuddleBucket = -1;
  const updateWeatherVisuals = (weather: WeatherState) => {
    const puddleLvl = weather.puddleLevel ?? 0;
    const dryingLine = weather.dryingLineIntensity ?? Math.max(0, 1 - weather.wetness);

    // Off-line road surface becomes mirror-slick with wetness & standing puddles
    const wetRoughness = Math.max(0.08, 0.68 - weather.wetness * 0.46 - puddleLvl * 0.14);
    roadMat.roughness = wetRoughness;
    roadMat.metalness = Math.min(0.78, 0.09 + weather.wetness * 0.34 + puddleLvl * 0.22);

    const darkShade = 1.0 - weather.wetness * 0.26 - puddleLvl * 0.10;
    roadMat.color.setRGB(darkShade, darkShade, darkShade * 1.05);

    kerbMat.roughness = 0.58 - weather.wetness * 0.38;
    kerbMat.metalness = 0.06 + weather.wetness * 0.22;

    // Update 3D Standing Water Puddles scaling & specular opacity
    if (puddleLvl <= 0.015) {
      puddlesInst.visible = false;
    } else {
      puddlesInst.visible = true;
      puddleMat.opacity = Math.min(0.86, 0.18 + puddleLvl * 0.68);
      const pBucket = Math.round(puddleLvl * 35) * 100 + Math.round(dryingLine * 25);
      if (pBucket !== lastPuddleBucket) {
        lastPuddleBucket = pBucket;
        for (let p = 0; p < puddleAnchors.length; p++) {
          const pa = puddleAnchors[p];
          const localPud =
            weather.sectorPuddles && weather.sectorPuddles.length > pa.stationIdx
              ? weather.sectorPuddles[pa.stationIdx]
              : puddleLvl;
          const sFactor = Math.max(0.01, Math.min(1.35, localPud * 1.25));
          dummy.position.set(pa.x, pa.y, pa.z);
          dummy.rotation.set(0, pa.rotY, 0);
          dummy.scale.set(pa.scaleX * sFactor, 1, pa.scaleZ * sFactor);
          dummy.updateMatrix();
          puddlesInst.setMatrixAt(p, dummy.matrix);
        }
        puddlesInst.instanceMatrix.needsUpdate = true;
      }
    }
  };

  // Dynamic Track Rubbering, Drying Line & Off-Line Corner Marbles Visual Updater
  let lastMarbleUpdateBucket = -1;
  const updateTrackRubberVisuals = (rubberState: TrackRubberState, weather: WeatherState) => {
    const g = Math.max(0, Math.min(1, rubberState.globalRubberLevel));
    const dryingLine = weather.dryingLineIntensity ?? Math.max(0, 1 - weather.wetness);
    // Racing line becomes progressively darker, more opaque, and more deeply textured as laps & passes build up
    racingLineMat.opacity = 0.16 + g * 0.76;
    racingLineMat.bumpScale = 0.014 + g * 0.056;
    // Dried racing groove has noticeably higher matte roughness than the wet off-line track
    const effectiveLineWetness = weather.wetness * (1 - dryingLine * 0.68);
    racingLineMat.roughness = Math.max(0.14, 0.56 - g * 0.16 - effectiveLineWetness * 0.32);
    racingLineMat.metalness = 0.14 + g * 0.16 + effectiveLineWetness * 0.25;

    const bucket = Math.round(g * 40);
    if (bucket !== lastMarbleUpdateBucket) {
      lastMarbleUpdateBucket = bucket;
      // Update per-station vertex darkness along the racing line ribbon
      const colorAttr = rlGeo.getAttribute('color') as THREE.BufferAttribute;
      for (let i = 0; i <= n; i++) {
        const idx = i % n;
        const localR = rubberState.sectorRubber ? (rubberState.sectorRubber[idx] ?? g) : g;
        const cornerBoost = samples[idx].cornerLoadIntensity * 0.25;
        const shade = Math.max(0.18, 1.0 - localR * 0.68 - cornerBoost);
        for (let k = 0; k < 5; k++) {
          colorAttr.setXYZ(i * 5 + k, shade, shade, shade);
        }
      }
      colorAttr.needsUpdate = true;

      // Scale off-line corner rubber "marbles" as tire debris builds up
      const marbleGrowth = Math.max(0, (g - 0.12) / 0.88);
      for (let m = 0; m < marbleBasePositions.length; m++) {
        const mp = marbleBasePositions[m];
        const localR = rubberState.sectorRubber ? (rubberState.sectorRubber[mp.stationIdx] ?? g) : g;
        const sFactor = mp.scale * Math.max(0.01, marbleGrowth * (0.6 + localR * 0.7));
        dummy.position.set(mp.x, mp.y, mp.z);
        dummy.rotation.set(0, mp.rotY, 0);
        dummy.scale.set(sFactor * 1.3, sFactor * 0.55, sFactor);
        dummy.updateMatrix();
        marblesInst.setMatrixAt(m, dummy.matrix);
      }
      marblesInst.instanceMatrix.needsUpdate = true;
    }
  };

  return {
    group: envGroup,
    roadMat,
    racingLineMat,
    kerbMat,
    skyMat,
    updateWeatherVisuals,
    updateTrackRubberVisuals,
  };
}

/**
 * Zero-GC Pooled Particle Ring Buffer (`THREE.InstancedMesh`)
 * for tire smoke, exhaust shift flames, collision sparks, water spray roostertails, and radiator steam.
 */
export function createParticlePool(capacity = 160): ParticlePool {
  const geo = new THREE.SphereGeometry(0.2, 10, 10);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, capacity);
  mesh.frustumCulled = false;

  const px = new Float32Array(capacity);
  const py = new Float32Array(capacity);
  const pz = new Float32Array(capacity);
  const vx = new Float32Array(capacity);
  const vy = new Float32Array(capacity);
  const vz = new Float32Array(capacity);
  const life = new Float32Array(capacity);
  const maxLife = new Float32Array(capacity);
  const baseSize = new Float32Array(capacity);

  let cursor = 0;
  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();

  dummy.scale.setScalar(0);
  dummy.updateMatrix();
  for (let i = 0; i < capacity; i++) {
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, tmpColor.setHex(0xffffff));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  const spawn = (
    x: number,
    y: number,
    z: number,
    velX: number,
    velY: number,
    velZ: number,
    colorHex: number,
    size: number,
    duration: number
  ) => {
    const idx = cursor;
    cursor = (cursor + 1) % capacity;
    px[idx] = x;
    py[idx] = y;
    pz[idx] = z;
    vx[idx] = velX;
    vy[idx] = velY;
    vz[idx] = velZ;
    life[idx] = duration;
    maxLife[idx] = duration;
    baseSize[idx] = size;

    tmpColor.setHex(colorHex);
    mesh.setColorAt(idx, tmpColor);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  const update = (dt: number) => {
    let anyActive = false;
    for (let i = 0; i < capacity; i++) {
      if (life[i] <= 0) continue;
      anyActive = true;
      life[i] -= dt;
      if (life[i] <= 0) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }
      px[i] += vx[i] * dt;
      py[i] += vy[i] * dt;
      pz[i] += vz[i] * dt;
      vy[i] += 1.2 * dt;

      const progress = 1 - life[i] / maxLife[i];
      const scale = baseSize[i] * (0.6 + progress * 1.4) * (1 - progress * 0.7);
      dummy.position.set(px[i], py[i], pz[i]);
      dummy.scale.setScalar(Math.max(0.01, scale));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    if (anyActive) {
      mesh.instanceMatrix.needsUpdate = true;
    }
  };

  return { mesh, spawn, update };
}
