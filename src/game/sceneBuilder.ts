import * as THREE from 'three';
import {
  BreakablePropState,
  RacingLinePointProfile,
  TrackRubberState,
  TrackSpec,
  WeatherState,
} from './types';
import {
  findClosestTrackSample,
  findNonLocalTrackProximity,
  isWorldPointClearOfTrack,
} from './tracks';
import { createTrackBreakableProps, evaluateRacingLineSegmentVisual } from './physics';
import { TREE_CANOPY_SECTORS, TUNNEL_GALLERY_SECTORS } from './cockpitLighting';

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
  breakableProps: BreakablePropState[];
  syncBreakablePropsVisuals: () => void;
  updateWeatherVisuals: (weather: WeatherState) => void;
  updateTrackRubberVisuals: (rubberState: TrackRubberState, weather: WeatherState) => void;
  updateDynamicRacingLineVisuals: (
    profile: RacingLinePointProfile[],
    playerSampleIndex: number,
    playerSpeedMs: number,
    timeSec: number,
    visible: boolean
  ) => void;
}

function createRacingLineGuideTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 512);

  // Feathered lateral alpha envelope with crisp dual edge rails and glowing center spine
  const latGrad = ctx.createLinearGradient(0, 0, 256, 0);
  latGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
  latGrad.addColorStop(0.10, 'rgba(255, 255, 255, 0.25)');
  latGrad.addColorStop(0.18, 'rgba(255, 255, 255, 0.88)');
  latGrad.addColorStop(0.28, 'rgba(255, 255, 255, 0.52)');
  latGrad.addColorStop(0.50, 'rgba(255, 255, 255, 0.76)');
  latGrad.addColorStop(0.72, 'rgba(255, 255, 255, 0.52)');
  latGrad.addColorStop(0.82, 'rgba(255, 255, 255, 0.88)');
  latGrad.addColorStop(0.90, 'rgba(255, 255, 255, 0.25)');
  latGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = latGrad;
  ctx.fillRect(0, 0, 256, 512);

  // Subtle forward-pointing telemetry chevrons repeated along V
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let y = 40; y < 512; y += 84) {
    ctx.beginPath();
    ctx.moveTo(58, y + 26);
    ctx.lineTo(128, y - 14);
    ctx.lineTo(198, y + 26);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createRacingLineRubberTextures(maxAnisotropy: number): {
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
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
  for (let s = 0; s < 220; s++) {
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
  for (let i = 0; i < 9000; i++) {
    const x = 48 + Math.random() * 416;
    const y = Math.random() * 1024;
    const edgeFade = Math.sin(((x - 48) / 416) * Math.PI);
    ctx.fillStyle =
      i % 2 === 0
        ? `rgba(4, 5, 8, ${(0.35 * edgeFade).toFixed(3)})`
        : `rgba(28, 33, 42, ${(0.22 * edgeFade).toFixed(3)})`;
    ctx.fillRect(x, y, 2 + (i % 2), 3 + (i % 3));
  }

  const colorMap = new THREE.CanvasTexture(canvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = THREE.ClampToEdgeWrapping;
  colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.anisotropy = maxAnisotropy;

  // High-contrast bump map simulating vulcanized rubber buildup & longitudinal tire grooves
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 512;
  const bctx = bumpCanvas.getContext('2d')!;
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 256, 512);

  for (let s = 0; s < 140; s++) {
    const x = 32 + Math.random() * 192;
    const y = Math.random() * 512;
    const h = 30 + Math.random() * 90;
    bctx.fillStyle = s % 2 === 0 ? '#b8b8b8' : '#484848';
    bctx.fillRect(x, y, 2, h);
  }
  for (let i = 0; i < 8000; i++) {
    const x = 24 + Math.random() * 208;
    const y = Math.random() * 512;
    bctx.fillStyle = i % 2 === 0 ? '#d0d0d0' : '#383838';
    bctx.fillRect(x, y, 2, 2);
  }

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.ClampToEdgeWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  return { colorMap, bumpMap };
}

function createAsphaltTextures(
  asphaltHex: string,
  maxAnisotropy: number
): { colorMap: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = asphaltHex;
  ctx.fillRect(0, 0, 1024, 1024);

  // Multi-scale crushed basalt & quartz stone aggregate speckle
  for (let i = 0; i < 24000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const r = Math.random();
    if (r > 0.66) {
      ctx.fillStyle = 'rgba(241, 245, 249, 0.068)';
    } else if (r > 0.3) {
      ctx.fillStyle = 'rgba(2, 6, 23, 0.11)';
    } else {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.055)';
    }
    ctx.fillRect(x, y, 2 + (i % 2), 2 + ((i + 1) % 3));
  }

  // Polished wheel-track bitumen lanes & road-crown tonal gradient
  const rubberGrad = ctx.createLinearGradient(0, 0, 1024, 0);
  rubberGrad.addColorStop(0, 'rgba(0,0,0,0.14)');
  rubberGrad.addColorStop(0.14, 'rgba(255,255,255,0.025)');
  rubberGrad.addColorStop(0.28, 'rgba(0,0,0,0.12)');
  rubberGrad.addColorStop(0.5, 'rgba(255,255,255,0.035)');
  rubberGrad.addColorStop(0.72, 'rgba(0,0,0,0.12)');
  rubberGrad.addColorStop(0.86, 'rgba(255,255,255,0.025)');
  rubberGrad.addColorStop(1, 'rgba(0,0,0,0.14)');
  ctx.fillStyle = rubberGrad;
  ctx.fillRect(0, 0, 1024, 1024);

  // Off-line shredded tire marbles near the outer edges (x: 45..135 and 889..979)
  for (let m = 0; m < 1400; m++) {
    const isLeft = m % 2 === 0;
    const mx = isLeft ? 48 + Math.random() * 88 : 888 + Math.random() * 88;
    const my = Math.random() * 1024;
    ctx.fillStyle = m % 3 === 0 ? 'rgba(6, 8, 12, 0.38)' : 'rgba(15, 20, 28, 0.25)';
    ctx.fillRect(mx, my, 3 + (m % 2), 4 + (m % 3));
  }

  // Longitudinal tarmac paving seams & subtle bitumen tar patches
  ctx.fillStyle = 'rgba(8, 10, 15, 0.22)';
  ctx.fillRect(510, 0, 4, 1024);
  ctx.fillStyle = 'rgba(15, 18, 26, 0.14)';
  ctx.fillRect(254, 0, 3, 1024);
  ctx.fillRect(767, 0, 3, 1024);

  // Transverse hot-poured tar expansion joints
  for (const ty of [180, 520, 860]) {
    ctx.fillStyle = 'rgba(6, 8, 12, 0.24)';
    ctx.fillRect(36, ty, 952, 4);
  }

  for (let s = 0; s < 24; s++) {
    const sx = 200 + Math.random() * 620;
    const sy = Math.random() * 820;
    const len = 90 + Math.random() * 200;
    ctx.fillStyle = 'rgba(8, 10, 14, 0.14)';
    ctx.fillRect(sx, sy, 6, len);
    ctx.fillRect(sx + 92, sy, 6, len);
  }

  // Crisp FIA historic white edge boundary lines with weathered aggregate texture
  ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
  ctx.fillRect(24, 0, 16, 1024);
  ctx.fillRect(984, 0, 16, 1024);

  // Subtle dashed center reference line
  ctx.fillStyle = 'rgba(248, 250, 252, 0.36)';
  ctx.fillRect(507, 60, 10, 340);
  ctx.fillRect(507, 570, 10, 340);

  const colorMap = new THREE.CanvasTexture(canvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.anisotropy = maxAnisotropy;

  // High-frequency bump map for asphalt macro-aggregate & tar joint relief
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bctx = bumpCanvas.getContext('2d')!;
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 18000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    bctx.fillStyle = Math.random() > 0.5 ? '#b4b4b4' : '#4c4c4c';
    bctx.fillRect(x, y, 2, 2);
  }
  bctx.fillStyle = '#383838';
  bctx.fillRect(255, 0, 2, 512);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  return { colorMap, bumpMap };
}

function createKerbTexture(primaryHex: string, secondaryHex: string, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = primaryHex;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = secondaryHex;
  ctx.fillRect(0, 256, 256, 256);

  // 3D serrated sawtooth step bevels & concrete expansion grooves
  for (const blockY of [0, 256]) {
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(0, blockY, 256, 14);
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.fillRect(0, blockY + 238, 256, 18);
    // Serrated rumble ridges inside each kerb block
    ctx.fillStyle = 'rgba(0,0,0,0.11)';
    ctx.fillRect(0, blockY + 82, 256, 8);
    ctx.fillRect(0, blockY + 164, 256, 8);
  }

  // Rubber tire scrub marks along the inner apex bevel
  const scrubGrad = ctx.createLinearGradient(0, 0, 256, 0);
  scrubGrad.addColorStop(0, 'rgba(12,14,18,0.38)');
  scrubGrad.addColorStop(0.38, 'rgba(12,14,18,0.12)');
  scrubGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = scrubGrad;
  ctx.fillRect(0, 0, 256, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createArmcoRailTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Double-wave W-beam hot-dip galvanized steel shading with crisp specular ridges
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#64748b');
  grad.addColorStop(0.12, '#cbd5e1');
  grad.addColorStop(0.24, '#f8fafc');
  grad.addColorStop(0.36, '#94a3b8');
  grad.addColorStop(0.47, '#334155');
  grad.addColorStop(0.53, '#334155');
  grad.addColorStop(0.64, '#94a3b8');
  grad.addColorStop(0.76, '#f8fafc');
  grad.addColorStop(0.88, '#cbd5e1');
  grad.addColorStop(1.0, '#475569');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Subtle zinc spangle grain & horizontal tire-rub marks
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)';
    ctx.fillRect(Math.random() * 512, Math.random() * 256, 6, 2);
  }

  // Vertical overlapping W-beam panel splice seams, hex bolt rows & retro-reflective safety reflectors
  for (let x = 0; x < 512; x += 128) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.fillRect(x, 0, 5, 256);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(x + 5, 0, 2, 256);

    // Splice bolts
    ctx.fillStyle = '#1e293b';
    for (const by of [44, 72, 128, 184, 212]) {
      ctx.beginPath();
      ctx.arc(x + 14, by, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Red/white retro-reflective trapezoid delineator in the central W-beam valley
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(x + 52, 118, 18, 20);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x + 70, 118, 18, 20);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 52, 118, 36, 20);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createChevronBoardTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 256, 128);

  ctx.fillStyle = '#dc2626';
  for (let x = -64; x < 280; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 34, 0);
    ctx.lineTo(x + 64, 64);
    ctx.lineTo(x + 34, 128);
    ctx.lineTo(x, 128);
    ctx.lineTo(x + 30, 64);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 250, 122);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createBrakingMarkerTexture(distanceLabel: string, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(8, 8, 240, 22);
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 5;
  ctx.strokeRect(5, 5, 246, 118);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '900 66px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(distanceLabel, 128, 78);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createHayBaleTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ca8a04';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle =
      i % 3 === 0 ? '#facc15' : i % 2 === 0 ? '#a16207' : '#eab308';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 14, 3);
  }

  // Twin sisal twine binding straps around the bale
  ctx.fillStyle = '#78350f';
  ctx.fillRect(0, 62, 256, 10);
  ctx.fillRect(0, 184, 256, 10);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSkyDomeTexture(topHex: string, horizonHex: string, sunHex: string): THREE.CanvasTexture {
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

  // 1. Extended Outdoor 3D Hills & Mountain Terrain Ground (120x120 high-res grid, deeply recessed within 42m of the track)
  const groundGeo = new THREE.PlaneGeometry(1500, 1500, 120, 120);
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

    const checkVL = findNonLocalTrackProximity(track, vlOuterX, vlOuterZ, i % n, 22);
    const vlY =
      checkVL.minDistM < checkVL.halfWidth + kerbWidth + 2.5
        ? Math.min(ly - 0.85, checkVL.surfaceY - 1.1)
        : ly - 0.18;

    const checkVR = findNonLocalTrackProximity(track, vrOuterX, vrOuterZ, i % n, 22);
    const vrY =
      checkVR.minDistM < checkVR.halfWidth + kerbWidth + 2.5
        ? Math.min(ry - 0.85, checkVR.surfaceY - 1.1)
        : ry - 0.18;

    const checkSL = findNonLocalTrackProximity(track, slOuterX, slOuterZ, i % n, 22);
    const slY = Math.min(ly - 3.6, checkSL.surfaceY - 3.6);

    const checkSR = findNonLocalTrackProximity(track, srOuterX, srOuterZ, i % n, 22);
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
    const railU = (i / n) * 165;

    // 3D W-Beam Corrugated Armco Profile (5 vertices per side = 10 vertices per station):
    // Protrudes 0.095m inward toward the track on the lower (y+0.28m) and upper (y+0.64m) corrugation crests,
    // with a deep recessed central bolt valley at y+0.46m so light catches true 3D metallic ridges!
    const wCrestIn = 0.095;
    const wValleyIn = 0.015;
    railPositions.push(
      // Left guardrail (0..4): inward is +s.rx, +s.rz
      rlX, ly + 0.14, rlZ,
      rlX + s.rx * wCrestIn, ly + 0.28, rlZ + s.rz * wCrestIn,
      rlX + s.rx * wValleyIn, ly + 0.46, rlZ + s.rz * wValleyIn,
      rlX + s.rx * wCrestIn, ly + 0.64, rlZ + s.rz * wCrestIn,
      rlX, ly + 0.79, rlZ,
      // Right guardrail (5..9): inward is -s.rx, -s.rz
      rrX, ry + 0.14, rrZ,
      rrX - s.rx * wCrestIn, ry + 0.28, rrZ - s.rz * wCrestIn,
      rrX - s.rx * wValleyIn, ry + 0.46, rrZ - s.rz * wValleyIn,
      rrX - s.rx * wCrestIn, ry + 0.64, rrZ - s.rz * wCrestIn,
      rrX, ry + 0.79, rrZ
    );
    railUvs.push(
      railU, 0.0, railU, 0.25, railU, 0.5, railU, 0.75, railU, 1.0,
      railU, 0.0, railU, 0.25, railU, 0.5, railU, 0.75, railU, 1.0
    );

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

      // 10-vertex 3D W-Beam Guardrail indices (4 corrugated strips Left + 4 corrugated strips Right)
      const gBase = i * 10;
      const gNext = (i + 1) * 10;
      for (let seg = 0; seg < 4; seg++) {
        // Left W-beam strip
        railIndices.push(
          gBase + seg, gBase + seg + 1, gNext + seg,
          gBase + seg + 1, gNext + seg + 1, gNext + seg
        );
        // Right W-beam strip
        railIndices.push(
          gBase + 5 + seg, gNext + 5 + seg, gBase + 5 + seg + 1,
          gBase + 5 + seg + 1, gNext + 5 + seg, gNext + 5 + seg + 1
        );
      }
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

  // 2B-Guide. Dynamic Alpha-Blended 3D Telemetry Racing Line Path Overlay Ribbon
  // Color-coded segments (Emerald = Accelerate, Amber = Coast/Turn-In, Crimson = Braking Zone)
  const guidePositions: number[] = [];
  const guideUvs: number[] = [];
  const guideColors: number[] = [];
  const guideIndices: number[] = [];
  const guideHalfWidth = 0.72; // 1.44m wide precision ideal line ribbon

  for (let i = 0; i <= n; i++) {
    const s = samples[i % n];
    const halfW = s.width * 0.5;
    const centerOff = s.racingLineOffset;
    const vCoord = (i / n) * 180;
    const subOffsets = [-guideHalfWidth, 0, guideHalfWidth];
    const subU = [0, 0.5, 1];

    for (let k = 0; k < 3; k++) {
      const lat = Math.max(-(halfW - 0.45), Math.min(halfW - 0.45, centerOff + subOffsets[k]));
      const px = s.x + s.rx * lat;
      const pz = s.z + s.rz * lat;
      const py = evalRoadSurfaceYAtOffset(s, lat) + 0.026;
      guidePositions.push(px, py, pz);
      guideUvs.push(subU[k], vCoord);
      guideColors.push(0.06, 0.78, 0.51);
    }

    if (i < n) {
      const base = i * 3;
      guideIndices.push(
        base + 0,
        base + 1,
        base + 3,
        base + 1,
        base + 4,
        base + 3,
        base + 1,
        base + 2,
        base + 4,
        base + 2,
        base + 5,
        base + 4
      );
    }
  }

  const guideGeo = new THREE.BufferGeometry();
  guideGeo.setAttribute('position', new THREE.Float32BufferAttribute(guidePositions, 3));
  guideGeo.setAttribute('uv', new THREE.Float32BufferAttribute(guideUvs, 2));
  guideGeo.setAttribute('color', new THREE.Float32BufferAttribute(guideColors, 3));
  guideGeo.setIndex(guideIndices);
  guideGeo.computeVertexNormals();

  const guideTex = createRacingLineGuideTexture(maxAnisotropy);
  const guideMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: guideTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -5,
    polygonOffsetUnits: -5,
  });
  const guideMesh = new THREE.Mesh(guideGeo, guideMat);
  guideMesh.renderOrder = 2;
  envGroup.add(guideMesh);

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
    roughness: 0.28,
    metalness: 0.78,
    side: THREE.DoubleSide,
  });
  const railMesh = new THREE.Mesh(railGeo, railMat);
  envGroup.add(railMesh);

  // 2B-2. 3D Galvanized Steel I-Beam Guardrail Support Posts & Retro-Reflective Corner Chevron Boards (InstancedMesh)
  const postStep = 2;
  const maxPosts = Math.ceil(n / postStep) * 2;
  const railPostGeo = new THREE.BoxGeometry(0.11, 0.88, 0.14);
  const railPostMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.38,
    metalness: 0.82,
  });
  const railPostsInst = new THREE.InstancedMesh(railPostGeo, railPostMat, maxPosts);
  const postDummy = new THREE.Object3D();
  let postIdx = 0;

  // Count corner chevron boards
  const chevronStations: Array<{ x: number; y: number; z: number; yaw: number }> = [];
  for (let i = 0; i < n; i += postStep) {
    const s = samples[i];
    const halfW = s.width * 0.5;
    const bankLift = Math.sin(s.bankingRad) * halfW;
    const ly = s.y - bankLift;
    const ry = s.y + bankLift;
    const yaw = Math.atan2(s.tx, s.tz);

    // Left support post anchored just behind the left W-beam rail
    const lx = s.x - s.rx * (halfW + guardrailOffset + 0.07);
    const lz = s.z - s.rz * (halfW + guardrailOffset + 0.07);
    postDummy.position.set(lx, ly + 0.39, lz);
    postDummy.rotation.set(0, yaw, 0);
    postDummy.updateMatrix();
    railPostsInst.setMatrixAt(postIdx++, postDummy.matrix);

    // Right support post anchored just behind the right W-beam rail
    const rxPos = s.x + s.rx * (halfW + guardrailOffset + 0.07);
    const rzPos = s.z + s.rz * (halfW + guardrailOffset + 0.07);
    postDummy.position.set(rxPos, ry + 0.39, rzPos);
    postDummy.rotation.set(0, yaw, 0);
    postDummy.updateMatrix();
    railPostsInst.setMatrixAt(postIdx++, postDummy.matrix);

    // Add high-visibility red/white corner chevron boards along the outside of sharp bends
    if (Math.abs(s.curvature) >= 0.0072 && i % 4 === 0) {
      const outsideSign = s.curvature > 0 ? 1 : -1;
      const cx = s.x + s.rx * outsideSign * (halfW + guardrailOffset + 0.12);
      const cz = s.z + s.rz * outsideSign * (halfW + guardrailOffset + 0.12);
      const cy = (outsideSign > 0 ? ry : ly) + 1.08;
      chevronStations.push({
        x: cx,
        y: cy,
        z: cz,
        yaw: yaw + (outsideSign > 0 ? -0.35 : 0.35),
      });
    }
  }
  railPostsInst.count = postIdx;
  railPostsInst.instanceMatrix.needsUpdate = true;
  railPostsInst.computeBoundingSphere();
  envGroup.add(railPostsInst);

  if (chevronStations.length > 0) {
    const chevronGeo = new THREE.BoxGeometry(0.12, 0.56, 1.45);
    const chevronMat = new THREE.MeshStandardMaterial({
      map: createChevronBoardTexture(maxAnisotropy),
      roughness: 0.35,
      metalness: 0.15,
    });
    const chevronInst = new THREE.InstancedMesh(chevronGeo, chevronMat, chevronStations.length);
    for (let c = 0; c < chevronStations.length; c++) {
      const ch = chevronStations[c];
      postDummy.position.set(ch.x, ch.y, ch.z);
      postDummy.rotation.set(0, ch.yaw, 0);
      postDummy.updateMatrix();
      chevronInst.setMatrixAt(c, postDummy.matrix);
    }
    chevronInst.instanceMatrix.needsUpdate = true;
    chevronInst.computeBoundingSphere();
    envGroup.add(chevronInst);
  }

  // 2B-3. 150m / 100m / 50m Corner Braking Distance Marker Boards before major corners
  const brakeLabels = ['150', '100', '50'] as const;
  const brakeMats = brakeLabels.map(
    (lbl) =>
      new THREE.MeshStandardMaterial({
        map: createBrakingMarkerTexture(lbl, maxAnisotropy),
        roughness: 0.35,
      })
  );
  const brakeBoardGeo = new THREE.BoxGeometry(0.92, 0.52, 0.08);
  let lastBrakingZoneIdx = -40;
  for (let i = 24; i < n - 12; i++) {
    const prevCurv = Math.abs(samples[i - 4].curvature);
    const currCurv = Math.abs(samples[i].curvature);
    if (currCurv >= 0.011 && prevCurv < 0.006 && i - lastBrakingZoneIdx > 32) {
      lastBrakingZoneIdx = i;
      const outsideSign = samples[i].curvature > 0 ? 1 : -1;
      const offsets = [12, 8, 4]; // ~150m, 100m, 50m upstream of corner entry
      offsets.forEach((stepBack, bIdx) => {
        const stIdx = (i - stepBack + n) % n;
        const bs = samples[stIdx];
        const bLat = outsideSign * (bs.width * 0.5 + guardrailOffset - 0.18);
        const bx = bs.x + bs.rx * bLat;
        const bz = bs.z + bs.rz * bLat;
        const by = bs.y + 0.96;
        const boardMesh = new THREE.Mesh(brakeBoardGeo, brakeMats[bIdx]);
        boardMesh.position.set(bx, by, bz);
        boardMesh.rotation.y = Math.atan2(bs.tx, bs.tz);
        envGroup.add(boardMesh);
      });
    }
  }

  // 2C. Off-Line Corner Tire Debris "Marbles" (Instanced vulcanized rubber chunks outside the racing groove)
  const marbleCapacity = 240;
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

  // Pit Crew Mechanics with Lollipop Pit Boards & Spare Compound Tires
  const mechanicMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.65 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.8 });
  const pitBoardMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 });

  for (let m = 0; m < 4; m++) {
    const mz = -18 + m * 13;
    const mech = new THREE.Group();
    mech.position.set(1.4, 0, mz);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.3), mechanicMat);
    body.position.y = 0.9;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), skinMat);
    head.position.y = 1.5;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 12), accentMat);
    cap.position.y = 1.62;

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.6, 8), fenceMat);
    pole.position.set(-0.8, 1.4, 0.2);
    pole.rotation.z = 0.35;
    const board = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16), pitBoardMat);
    board.position.set(-1.3, 2.4, 0.2);
    board.rotation.y = Math.PI / 2;

    mech.add(body, head, cap, pole, board);
    pitGroup.add(mech);

    const toolbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.85, 1.1),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45, metalness: 0.3 })
    );
    toolbox.position.set(3.2, 0.42, mz - 2.5);
    pitGroup.add(toolbox);

    for (let th = 0; th < 3; th++) {
      const tire = new THREE.Mesh(
        new THREE.TorusGeometry(0.34, 0.16, 10, 18),
        new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 })
      );
      tire.rotation.x = Math.PI / 2;
      tire.position.set(3.1, 0.16 + th * 0.32, mz + 2.8);
      pitGroup.add(tire);
    }

    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.95, 16),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.45, metalness: 0.6 })
    );
    drum.position.set(4.2, 0.48, mz);
    pitGroup.add(drum);
  }
  envGroup.add(pitGroup);

  // 5. Interactive Breakable Trackside Props (Golden Straw Hay Bales, Striped Apex Cones & Chicane Boards)
  const postMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.8 });
  const breakableProps = createTrackBreakableProps(track);
  const hayProps = breakableProps.filter((p) => p.type === 'hay_bale');
  const coneProps = breakableProps.filter((p) => p.type === 'apex_cone');
  const signProps = breakableProps.filter((p) => p.type === 'chicane_sign');

  const hayBaleGeo = new THREE.BoxGeometry(1.18, 0.62, 0.72);
  const hayBaleMat = new THREE.MeshStandardMaterial({
    map: createHayBaleTexture(maxAnisotropy),
    roughness: 0.88,
  });
  const hayBaleInst = new THREE.InstancedMesh(
    hayBaleGeo,
    hayBaleMat,
    Math.max(1, hayProps.length)
  );
  hayBaleInst.frustumCulled = false;

  const apexConeGeo = new THREE.ConeGeometry(0.24, 0.64, 14);
  const apexConeMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 0.18,
    roughness: 0.45,
  });
  const apexConeInst = new THREE.InstancedMesh(
    apexConeGeo,
    apexConeMat,
    Math.max(1, coneProps.length)
  );
  apexConeInst.frustumCulled = false;

  const chicaneSignGeo = new THREE.BoxGeometry(1.05, 0.54, 0.10);
  const chicaneSignMat = new THREE.MeshStandardMaterial({
    map: createChevronBoardTexture(maxAnisotropy),
    roughness: 0.42,
  });
  const chicaneSignInst = new THREE.InstancedMesh(
    chicaneSignGeo,
    chicaneSignMat,
    Math.max(1, signProps.length)
  );
  chicaneSignInst.frustumCulled = false;

  envGroup.add(hayBaleInst, apexConeInst, chicaneSignInst);

  const propDummy = new THREE.Object3D();
  const syncBreakablePropsVisuals = () => {
    for (let i = 0; i < hayProps.length; i++) {
      const p = hayProps[i];
      propDummy.position.set(p.x, p.y + 0.31, p.z);
      propDummy.rotation.set(p.pitch, p.yaw, p.roll);
      propDummy.scale.setScalar(p.broken && p.respawnTimer < 11.2 ? 0.001 : 1.0);
      propDummy.updateMatrix();
      hayBaleInst.setMatrixAt(i, propDummy.matrix);
    }
    hayBaleInst.count = hayProps.length;
    hayBaleInst.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < coneProps.length; i++) {
      const p = coneProps[i];
      propDummy.position.set(p.x, p.y + 0.32, p.z);
      propDummy.rotation.set(p.pitch, p.yaw, p.roll);
      propDummy.scale.setScalar(p.broken && p.respawnTimer < 11.2 ? 0.001 : 1.0);
      propDummy.updateMatrix();
      apexConeInst.setMatrixAt(i, propDummy.matrix);
    }
    apexConeInst.count = coneProps.length;
    apexConeInst.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < signProps.length; i++) {
      const p = signProps[i];
      propDummy.position.set(p.x, p.y + 0.30, p.z);
      propDummy.rotation.set(p.pitch, p.yaw, p.roll);
      propDummy.scale.setScalar(p.broken && p.respawnTimer < 11.2 ? 0.001 : 1.0);
      propDummy.updateMatrix();
      chicaneSignInst.setMatrixAt(i, propDummy.matrix);
    }
    chicaneSignInst.count = signProps.length;
    chicaneSignInst.instanceMatrix.needsUpdate = true;
  };
  syncBreakablePropsVisuals();

  // 7. Trackside Marshal Observation Posts with Flags (Verified Clear of All Track Segments)
  for (const mIdx of [Math.floor(n * 0.28), Math.floor(n * 0.65)]) {
    const ms = samples[mIdx];
    const mStand = new THREE.Group();
    let mDist = ms.width * 0.5 + 8.5;
    let mx = ms.x - ms.rx * mDist;
    let mz = ms.z - ms.rz * mDist;
    let mClear = isWorldPointClearOfTrack(track, mx, mz, 5.5);
    if (!mClear.clear) {
      mx = ms.x + ms.rx * mDist;
      mz = ms.z + ms.rz * mDist;
      mClear = isWorldPointClearOfTrack(track, mx, mz, 5.5);
    }
    if (!mClear.clear) continue;

    mStand.position.set(mx, mClear.surfaceY, mz);
    mStand.rotation.y = Math.atan2(ms.tx, ms.tz);

    const hutGeo = new THREE.BoxGeometry(2.4, 2.2, 2.4);
    const hutMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9 });
    const hut = new THREE.Mesh(hutGeo, hutMat);
    hut.position.y = 1.1;

    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.2, 4), accentMat);
    roof.position.y = 2.8;
    roof.rotation.y = Math.PI / 4;

    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 8), postMat);
    flagPole.position.set(1.4, 1.6, 0.8);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.55),
      new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide })
    );
    flag.position.set(1.85, 2.8, 0.8);

    mStand.add(hut, roof, flagPole, flag);
    envGroup.add(mStand);
  }

  // 8. Pit-Straight Grandstand with Tiered Spectator Seating, 3D Crowd & Cantilevered Canopy
  const standGroup = new THREE.Group();
  standGroup.position.set(
    startS.x - startS.rx * (startS.width * 0.5 + 12.5),
    startLookup.surfaceY,
    startS.z + 18
  );
  standGroup.rotation.y = Math.atan2(startS.tx, startS.tz);

  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.5, metalness: 0.25 });
  const crowdColors = [0xdc2626, 0x2563eb, 0xfacc15, 0xf8fafc, 0x16a34a];
  const specZCoords: number[] = [];
  for (let sz = -21; sz <= 21; sz += 3.5) {
    specZCoords.push(sz);
  }
  const totalSpectators = 4 * specZCoords.length;
  const specTorsoInst = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.45, 0.58, 0.55),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
    totalSpectators
  );
  const specHeadInst = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.16, 8, 8),
    skinMat,
    totalSpectators
  );
  const specDummy = new THREE.Object3D();
  const specColor = new THREE.Color();
  let specIdx = 0;

  const tierGeo = new THREE.BoxGeometry(2.2, 1, 48);
  for (let tier = 0; tier < 4; tier++) {
    const tierH = 1.1 + tier * 1.1;
    const tierMesh = new THREE.Mesh(tierGeo, concreteMat);
    tierMesh.scale.y = tierH;
    tierMesh.position.set(-tier * 2.1, tierH * 0.5, 0);
    standGroup.add(tierMesh);

    for (const sz of specZCoords) {
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
  specTorsoInst.instanceMatrix.needsUpdate = true;
  if (specTorsoInst.instanceColor) specTorsoInst.instanceColor.needsUpdate = true;
  specHeadInst.instanceMatrix.needsUpdate = true;
  standGroup.add(specTorsoInst, specHeadInst);
  const standRoof = new THREE.Mesh(new THREE.BoxGeometry(11, 0.4, 50), roofMat);
  standRoof.position.set(-3.2, 7.6, 0);
  standRoof.rotation.z = -0.15;
  standGroup.add(standRoof);
  envGroup.add(standGroup);

  // 9. Tall Silhouette Landmark (Verified Clear of All Track Segments)
  const vistaSample = samples[(startLookup.sample.index + 52) % n];
  const landmarkGroup = new THREE.Group();
  let lmDist = vistaSample.width * 0.5 + 34;
  let lmx = vistaSample.x + vistaSample.rx * lmDist;
  let lmz = vistaSample.z + vistaSample.rz * lmDist;
  if (!isWorldPointClearOfTrack(track, lmx, lmz, 14).clear) {
    lmx = vistaSample.x - vistaSample.rx * (lmDist + 18);
    lmz = vistaSample.z - vistaSample.rz * (lmDist + 18);
  }
  landmarkGroup.position.set(lmx, vistaSample.y, lmz);

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

  // 10. InstancedMesh Two-Tiered Pine/Cypress Trees (Roadside Canopy Avenues + Forest Groves) & Rock Formations
  // Strictly validated via global `isWorldPointClearOfTrack` so no trunk or foliage EVER encroaches onto the road!
  const treeCount = 240;
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.44, 3.8, 8);
  trunkGeo.translate(0, 1.9, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });

  const foliageLowerGeo = new THREE.ConeGeometry(2.65, 4.8, 9);
  foliageLowerGeo.translate(0, 5.6, 0);
  const foliageUpperGeo = new THREE.ConeGeometry(1.95, 4.5, 9);
  foliageUpperGeo.translate(0, 8.6, 0);
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 });

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const foliageInst = new THREE.InstancedMesh(foliageLowerGeo, foliageMat, treeCount);
  const foliageUpperInst = new THREE.InstancedMesh(foliageUpperGeo, foliageMat, treeCount);

  const rockCount = 65;
  const rockGeo = new THREE.DodecahedronGeometry(2.2, 0);
  rockGeo.translate(0, 1.1, 0);
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

  // 10A. Roadside Tree Canopy Avenues (placed strictly outside the guardrail + 6.4m buffer & verified globally against all switchbacks)
  const canopyShadowPositions: Array<{ x: number; y: number; z: number; yaw: number; width: number }> = [];
  for (const sector of TREE_CANOPY_SECTORS) {
    const startI = Math.floor((sector.startIdx / 600) * n);
    const endI = Math.floor((sector.endIdx / 600) * n);
    for (let i = startI; i <= endI && placedTrees < treeCount - 2; i += 3) {
      const s = samples[i % n];
      const yaw = Math.atan2(s.tx, s.tz);
      let anyTreeAtStation = false;

      for (const side of [-1, 1]) {
        if (placedTrees >= treeCount) break;
        const vergeDist = s.width * 0.5 + guardrailOffset + 6.4;
        const tx = s.x + s.rx * side * vergeDist;
        const tz = s.z + s.rz * side * vergeDist;

        // Global check against every segment of the circuit so trees never land on hairpins or adjacent legs
        const clearance = isWorldPointClearOfTrack(track, tx, tz, 6.2);
        if (!clearance.clear) continue;

        anyTreeAtStation = true;
        const scale = 0.96 + (i % 3) * 0.08;

        dummy.position.set(tx, s.y - 0.25, tz);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(scale, scale * 1.08, scale);
        dummy.updateMatrix();

        trunkInst.setMatrixAt(placedTrees, dummy.matrix);
        foliageInst.setMatrixAt(placedTrees, dummy.matrix);
        foliageUpperInst.setMatrixAt(placedTrees, dummy.matrix);

        const hue = 0.28 + ((i % 5) - 2) * 0.01;
        const sat = 0.45;
        const light = 0.21 + (i % 2) * 0.03;
        colorHelper.setHSL(hue, sat, light);
        foliageInst.setColorAt(placedTrees, colorHelper);
        colorHelper.setHSL(hue, sat, light * 1.15);
        foliageUpperInst.setColorAt(placedTrees, colorHelper);
        placedTrees++;
      }

      if (anyTreeAtStation) {
        canopyShadowPositions.push({
          x: s.x,
          y: s.y + 0.018,
          z: s.z,
          yaw,
          width: s.width - 0.6,
        });
      }
    }
  }

  // Render Dappled Canopy Shadow Bands across the asphalt in Tree Canopy sectors
  if (canopyShadowPositions.length > 0) {
    const shadowBandGeo = new THREE.PlaneGeometry(1, 3.2);
    shadowBandGeo.rotateX(-Math.PI / 2);
    const shadowBandMat = new THREE.MeshBasicMaterial({
      color: 0x090d16,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const shadowBandInst = new THREE.InstancedMesh(
      shadowBandGeo,
      shadowBandMat,
      canopyShadowPositions.length
    );
    for (let c = 0; c < canopyShadowPositions.length; c++) {
      const sp = canopyShadowPositions[c];
      dummy.position.set(sp.x, sp.y, sp.z);
      dummy.rotation.set(0, sp.yaw, 0);
      dummy.scale.set(sp.width, 1, 1);
      dummy.updateMatrix();
      shadowBandInst.setMatrixAt(c, dummy.matrix);
    }
    shadowBandInst.instanceMatrix.needsUpdate = true;
    shadowBandInst.computeBoundingSphere();
    envGroup.add(shadowBandInst);
  }

  // 10B. Scattered Background Forest Trees (Globally checked against all 600 track samples)
  let attempts = 0;
  while (placedTrees < treeCount && attempts < 1100) {
    attempts++;
    const sIdx = Math.floor(rand() * n);
    const s = samples[sIdx];
    const side = rand() > 0.5 ? 1 : -1;
    const distFromCenter = s.width * 0.5 + 12 + rand() * 58;
    const tx = s.x + s.rx * side * distFromCenter + (rand() - 0.5) * 6;
    const tz = s.z + s.rz * side * distFromCenter + (rand() - 0.5) * 6;

    const check = isWorldPointClearOfTrack(track, tx, tz, 8.5);
    if (!check.clear) continue;

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

  // 10C. 3D Vaulted Stone & Concrete Tunnel Galleries with Warm Sodium Ceiling Luminaires
  const tunnelWallMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.82,
    metalness: 0.12,
  });
  const tunnelRoofMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.78,
    metalness: 0.18,
  });
  const tunnelPortalTrimMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.55,
    metalness: 0.25,
  });
  const sodiumLampMat = new THREE.MeshStandardMaterial({
    color: 0xffb347,
    emissive: new THREE.Color(0xf59e0b),
    emissiveIntensity: 3.4,
    roughness: 0.15,
  });
  const lampHousingMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.4,
    metalness: 0.8,
  });

  const pillarGeo = new THREE.BoxGeometry(0.78, 5.4, 1.35);
  const rightWallSegGeo = new THREE.BoxGeometry(0.85, 5.4, 4.4);
  const roofSegGeo = new THREE.BoxGeometry(1, 0.72, 4.5);
  const lampHousingGeo = new THREE.BoxGeometry(1.85, 0.16, 0.48);
  const lampGlowGeo = new THREE.BoxGeometry(1.65, 0.12, 0.34);

  for (const tSec of TUNNEL_GALLERY_SECTORS) {
    const startI = Math.floor((tSec.startIdx / 600) * n);
    const endI = Math.floor((tSec.endIdx / 600) * n);
    for (let i = startI; i <= endI; i += 2) {
      const s = samples[i % n];
      const yaw = Math.atan2(s.tx, s.tz);
      const halfW = s.width * 0.5;
      const wallOffset = halfW + guardrailOffset + 0.55;
      const spanW = wallOffset * 2 + 0.9;

      // Left colonnade pillar
      const lx = s.x - s.rx * wallOffset;
      const lz = s.z - s.rz * wallOffset;
      const pillar = new THREE.Mesh(pillarGeo, tunnelWallMat);
      pillar.position.set(lx, s.y + 2.6, lz);
      pillar.rotation.y = yaw;
      envGroup.add(pillar);

      // Right solid retaining wall segment
      const rxPos = s.x + s.rx * wallOffset;
      const rzPos = s.z + s.rz * wallOffset;
      const rWall = new THREE.Mesh(rightWallSegGeo, tunnelWallMat);
      rWall.position.set(rxPos, s.y + 2.6, rzPos);
      rWall.rotation.y = yaw;
      envGroup.add(rWall);

      // Vaulted overhead tunnel roof slab
      const roofSlab = new THREE.Mesh(
        roofSegGeo,
        i === startI || i >= endI - 1 ? tunnelPortalTrimMat : tunnelRoofMat
      );
      roofSlab.scale.x = spanW;
      roofSlab.position.set(s.x, s.y + 5.35, s.z);
      roofSlab.rotation.y = yaw;
      envGroup.add(roofSlab);

      // Warm amber sodium-vapor ceiling luminaire every 2 segments
      if ((i - startI) % 2 === 0) {
        const housing = new THREE.Mesh(lampHousingGeo, lampHousingMat);
        housing.position.set(s.x, s.y + 4.92, s.z);
        housing.rotation.y = yaw;
        const lampBar = new THREE.Mesh(lampGlowGeo, sodiumLampMat);
        lampBar.position.set(s.x, s.y + 4.82, s.z);
        lampBar.rotation.y = yaw;
        envGroup.add(housing, lampBar);
      }
    }
  }

  let placedRocks = 0;
  attempts = 0;
  while (placedRocks < rockCount && attempts < 600) {
    attempts++;
    const sIdx = Math.floor(rand() * n);
    const s = samples[sIdx];
    const side = rand() > 0.5 ? 1 : -1;
    const distFromCenter = s.width * 0.5 + 10 + rand() * 44;
    const rx = s.x + s.rx * side * distFromCenter;
    const rz = s.z + s.rz * side * distFromCenter;

    const check = isWorldPointClearOfTrack(track, rx, rz, 7.5);
    if (!check.clear) continue;

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

  // Dynamic Weather Visual Updater
  const updateWeatherVisuals = (weather: WeatherState) => {
    const wetRoughness = 0.68 - weather.wetness * 0.50;
    roadMat.roughness = wetRoughness;
    roadMat.metalness = 0.09 + weather.wetness * 0.32;

    const darkShade = 1.0 - weather.wetness * 0.28;
    roadMat.color.setRGB(darkShade, darkShade, darkShade * 1.04);

    kerbMat.roughness = 0.58 - weather.wetness * 0.38;
    kerbMat.metalness = 0.06 + weather.wetness * 0.22;
  };

  // Dynamic Track Rubbering & Off-Line Corner Marbles Visual Updater
  let lastMarbleUpdateBucket = -1;
  const updateTrackRubberVisuals = (rubberState: TrackRubberState, weather: WeatherState) => {
    const g = Math.max(0, Math.min(1, rubberState.globalRubberLevel));
    // Racing line becomes progressively darker, more opaque, and more deeply textured as laps & passes build up
    racingLineMat.opacity = 0.14 + g * 0.78;
    racingLineMat.bumpScale = 0.014 + g * 0.056;
    // Vulcanized rubber has a low-sheen satin finish when dry, and slick mirror sheen when wet
    racingLineMat.roughness = Math.max(0.14, 0.56 - g * 0.18 - weather.wetness * 0.32);
    racingLineMat.metalness = 0.14 + g * 0.18 + weather.wetness * 0.25;

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

  // Dynamic Alpha-Blended Telemetry Racing Line Updater (Live Braking / Coast / Acceleration Zones)
  const updateDynamicRacingLineVisuals = (
    profile: RacingLinePointProfile[],
    playerSampleIndex: number,
    playerSpeedMs: number,
    timeSec: number,
    visible: boolean
  ) => {
    guideMesh.visible = visible;
    if (!visible || profile.length === 0) return;

    // Animate chevron texture scroll forward along the racing line
    guideTex.offset.y = -(timeSec * 0.65) % 1;

    const colorAttr = guideGeo.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i <= n; i++) {
      const idx = i % n;
      const pt = profile[idx] || profile[0];
      const vis = evaluateRacingLineSegmentVisual(pt, playerSampleIndex, playerSpeedMs, n, timeSec);

      // Modulate vertex brightness by alpha so upcoming 180m corridor glows vividly while distant segments stay subtle
      const intensity = 0.26 + vis.alpha * 0.92;
      const r = Math.min(1, vis.r * intensity);
      const g = Math.min(1, vis.g * intensity);
      const b = Math.min(1, vis.b * intensity);

      colorAttr.setXYZ(i * 3 + 0, r * 0.88, g * 0.88, b * 0.88);
      colorAttr.setXYZ(i * 3 + 1, r, g, b);
      colorAttr.setXYZ(i * 3 + 2, r * 0.88, g * 0.88, b * 0.88);
    }
    colorAttr.needsUpdate = true;
  };

  return {
    group: envGroup,
    roadMat,
    racingLineMat,
    kerbMat,
    skyMat,
    breakableProps,
    syncBreakablePropsVisuals,
    updateWeatherVisuals,
    updateTrackRubberVisuals,
    updateDynamicRacingLineVisuals,
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
