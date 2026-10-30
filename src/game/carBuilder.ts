import * as THREE from 'three';
import {
  CarLivery,
  ClassicCarSpec,
  CockpitLightingState,
  PitStopAnimationState,
  TireCompound,
  VehicleDamageState,
} from './types';

export interface CarMeshRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  cabinGroup: THREE.Group;
  wheels: THREE.Object3D[];
  frontLeftPivot: THREE.Group;
  frontRightPivot: THREE.Group;
  trackHalfW: number;
  wheelContactY: number;
  frontWheelbaseZ: number;
  rearWheelbaseZ: number;
  brakeLightsMat: THREE.MeshStandardMaterial;
  brakeDiscMat: THREE.MeshStandardMaterial;
  tireCompoundMat: THREE.MeshStandardMaterial;
  bodyPaintMat: THREE.MeshPhysicalMaterial;
  liveryTexture: THREE.CanvasTexture;
  steeringWheelPivot: THREE.Group;
  speedoNeedlePivot: THREE.Group;
  tachNeedlePivot: THREE.Group;
  oilNeedlePivot: THREE.Group;
  waterNeedlePivot: THREE.Group;
  fuelNeedlePivot: THREE.Group;
  shiftGreenMat: THREE.MeshStandardMaterial;
  shiftAmberMat: THREE.MeshStandardMaterial;
  shiftLightMat: THREE.MeshStandardMaterial;
  cockpitDynamicLight: THREE.PointLight;
  dappledLightSweepMesh: THREE.Mesh;
  dappledLightSweepMat: THREE.MeshBasicMaterial;
  binnacleLeatherMat: THREE.MeshStandardMaterial;
  binnacleBaseHex: number;
  engineTurnedMat: THREE.MeshStandardMaterial;
  crackleDashMat: THREE.MeshStandardMaterial;
  mahoganyWheelMat: THREE.MeshPhysicalMaterial;
  gloveLeatherMat: THREE.MeshStandardMaterial;
  nomexSleeveMat: THREE.MeshStandardMaterial;
  gaugeDialMaterials: THREE.MeshBasicMaterial[];
  haldaFaceMat: THREE.MeshBasicMaterial;
  gearShifterPivot: THREE.Group;
  throttlePedalPivot: THREE.Group;
  brakePedalPivot: THREE.Group;
  driverArmsGroup: THREE.Group;
  helmetMesh: THREE.Object3D;
  wiperLeft: THREE.Group;
  wiperRight: THREE.Group;
  wiperAngle: number;
  exhaustFlamesGroup: THREE.Group;
  exhaustFlameTimer: number;
  flameOuterMat: THREE.MeshBasicMaterial;
  flameCoreMat: THREE.MeshBasicMaterial;
  frontNosePivot: THREE.Group;
  hoodPivot: THREE.Group;
  leftFenderGroup: THREE.Group;
  rightFenderGroup: THREE.Group;
  rearValenceGroup: THREE.Group;
}

export interface CornerPitCrewRig {
  side: number;
  baseX: number;
  baseZ: number;
  crewGroup: THREE.Group;
  torsoPivot: THREE.Group;
  armsPivot: THREE.Group;
  wrenchGroup: THREE.Group;
  sparkBurstGroup: THREE.Group;
  oldWheelProp: THREE.Group;
  freshWheelProp: THREE.Group;
}

export interface PitJackRig {
  group: THREE.Group;
  liftSaddle: THREE.Object3D;
  handlePivot: THREE.Group;
  mechanicTorso: THREE.Group;
}

export interface PitCrewServiceRig {
  root: THREE.Group;
  cornerCrews: CornerPitCrewRig[];
  frontJack: PitJackRig;
  rearJack: PitJackRig;
  lollipopChiefGroup: THREE.Group;
  lollipopPolePivot: THREE.Group;
  lollipopBoardMat: THREE.MeshStandardMaterial;
  freshTireCompoundMat: THREE.MeshStandardMaterial;
  oldTireCompoundMat: THREE.MeshStandardMaterial;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Generates a high-resolution procedural CanvasTexture for the classic car livery
 * (rich metallic base coat, crisp racing stripes, panel shutlines, and competition roundel).
 */
export function createLiveryCanvasTexture(
  livery: CarLivery,
  maxAnisotropy = 4
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = livery.bodyColor;
  ctx.fillRect(0, 0, 1024, 1024);

  const latGrad = ctx.createLinearGradient(0, 0, 1024, 0);
  latGrad.addColorStop(0.0, 'rgba(0,0,0,0.12)');
  latGrad.addColorStop(0.18, 'rgba(255,255,255,0.06)');
  latGrad.addColorStop(0.34, 'rgba(0,0,0,0.05)');
  latGrad.addColorStop(0.5, 'rgba(255,255,255,0.07)');
  latGrad.addColorStop(0.66, 'rgba(0,0,0,0.05)');
  latGrad.addColorStop(0.82, 'rgba(255,255,255,0.06)');
  latGrad.addColorStop(1.0, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = latGrad;
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.fillStyle = livery.stripeColor;
  if (livery.stripeStyle === 'twin_center') {
    ctx.fillRect(438, 0, 56, 1024);
    ctx.fillRect(530, 0, 56, 1024);
    ctx.fillRect(422, 0, 7, 1024);
    ctx.fillRect(595, 0, 7, 1024);
  } else if (livery.stripeStyle === 'offset_lemans') {
    ctx.fillRect(326, 0, 82, 1024);
    ctx.fillRect(422, 0, 24, 1024);
  } else if (livery.stripeStyle === 'hood_sill') {
    ctx.fillRect(416, 0, 192, 1024);
    ctx.fillStyle = livery.bodyColor;
    ctx.fillRect(498, 0, 28, 1024);
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.26)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(240, 665, 544, 240);
  ctx.strokeRect(255, 90, 514, 180);

  const drawRoundel = (cx: number, cy: number, radius: number) => {
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();

    ctx.fillStyle = '#09090b';
    ctx.font = `900 ${Math.round(radius * 1.15)}px "Chakra Petch", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(livery.number), cx, cy + 3);
  };

  drawRoundel(512, 225, 76);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

function createRoundelDecalTexture(number: number, maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 256);
  ctx.beginPath();
  ctx.arc(128, 128, 118, 0, Math.PI * 2);
  ctx.fillStyle = '#0f172a';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(128, 128, 110, 0, Math.PI * 2);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();

  ctx.fillStyle = '#09090b';
  ctx.font = '900 124px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), 128, 134);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

let cachedTireTexture: THREE.CanvasTexture | null = null;
function getTireSidewallTexture(): THREE.CanvasTexture {
  if (cachedTireTexture) return cachedTireTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#141417';
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = '#070709';
  for (const x of [110, 200, 300, 390]) {
    ctx.fillRect(x, 0, 10, 512);
  }
  for (let y = 0; y < 512; y += 24) {
    ctx.fillRect(36, y, 70, 11);
    ctx.fillRect(124, y + 6, 72, 11);
    ctx.fillRect(214, y, 82, 11);
    ctx.fillRect(314, y + 6, 72, 11);
    ctx.fillRect(404, y, 70, 11);
  }

  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 20px "Chakra Petch", sans-serif';
  ctx.fillText('CORSA · GT67', 45, 485);

  cachedTireTexture = new THREE.CanvasTexture(canvas);
  cachedTireTexture.colorSpace = THREE.SRGBColorSpace;
  return cachedTireTexture;
}

let cachedLicensePlateTex: THREE.CanvasTexture | null = null;
function getVintageLicensePlateTexture(): THREE.CanvasTexture {
  if (cachedLicensePlateTex) return cachedLicensePlateTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 248, 88);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 34px "Chakra Petch", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PROVA MO·64', 128, 50);

  cachedLicensePlateTex = new THREE.CanvasTexture(canvas);
  cachedLicensePlateTex.colorSpace = THREE.SRGBColorSpace;
  return cachedLicensePlateTex;
}

let cachedContactShadowTex: THREE.CanvasTexture | null = null;
function getContactShadowTexture(): THREE.CanvasTexture {
  if (cachedContactShadowTex) return cachedContactShadowTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 512);
  const grad = ctx.createRadialGradient(128, 256, 20, 128, 256, 124);
  grad.addColorStop(0.0, 'rgba(0, 0, 0, 0.82)');
  grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.58)');
  grad.addColorStop(0.88, 'rgba(0, 0, 0, 0.22)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

  ctx.save();
  ctx.translate(128, 256);
  ctx.scale(1.0, 1.95);
  ctx.translate(-128, -256);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 512);
  ctx.restore();

  cachedContactShadowTex = new THREE.CanvasTexture(canvas);
  return cachedContactShadowTex;
}

const cachedSpeedoTextures = new Map<string, THREE.CanvasTexture>();
function getSpeedometerDialFaceTexture(
  bodyStyle: ClassicCarSpec['bodyStyle'] = 'italian_gt',
  maxAnisotropy = 4
): THREE.CanvasTexture {
  if (cachedSpeedoTextures.has(bodyStyle)) return cachedSpeedoTextures.get(bodyStyle)!;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const is911 = bodyStyle === 'stuttgart_911';
  const isBritish = bodyStyle === 'british_coupe';
  const isProto = bodyStyle === 'detroit_proto';

  ctx.clearRect(0, 0, 512, 512);
  ctx.beginPath();
  ctx.arc(256, 256, 248, 0, Math.PI * 2);
  ctx.fillStyle = isBritish ? '#0c0f14' : '#080a0f';
  ctx.fill();

  // Outer metallic/ivory chapter ring
  ctx.beginPath();
  ctx.arc(256, 256, 236, 0, Math.PI * 2);
  ctx.strokeStyle = isBritish
    ? 'rgba(254, 243, 199, 0.38)'
    : is911
    ? 'rgba(74, 222, 128, 0.25)'
    : 'rgba(226, 232, 240, 0.22)';
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(256, 256, 200, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.14)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const startDeg = -215;
  const endDeg = 35;
  const maxKmh = 320;

  for (let kmh = 0; kmh <= maxKmh; kmh += 10) {
    const frac = kmh / maxKmh;
    const deg = startDeg + frac * (endDeg - startDeg);
    const rad = (deg * Math.PI) / 180;
    const isMajor = kmh % 40 === 0;
    const rOuter = 232;
    const rInner = isMajor ? 196 : 212;

    ctx.beginPath();
    ctx.moveTo(256 + Math.cos(rad) * rInner, 256 + Math.sin(rad) * rInner);
    ctx.lineTo(256 + Math.cos(rad) * rOuter, 256 + Math.sin(rad) * rOuter);
    ctx.strokeStyle =
      kmh >= 280
        ? '#f59e0b'
        : is911
        ? '#4ade80'
        : isBritish
        ? '#fef3c7'
        : '#f8fafc';
    ctx.lineWidth = isMajor ? 6 : 3;
    ctx.stroke();

    if (isMajor) {
      const rText = 158;
      const tx = 256 + Math.cos(rad) * rText;
      const ty = 256 + Math.sin(rad) * rText;
      ctx.fillStyle =
        kmh >= 280
          ? '#fcd34d'
          : is911
          ? '#86efac'
          : isBritish
          ? '#fef3c7'
          : '#f8fafc';
      ctx.font = 'bold 30px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(kmh), tx, ty);
    }
  }

  ctx.fillStyle = is911 ? '#86efac' : '#cbd5e1';
  ctx.font = 'bold 21px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  const brandLabel = isBritish
    ? 'SMITHS MOTOR ACCESS.'
    : is911
    ? 'VDO · STUTTGART'
    : isProto
    ? 'STEWART-WARNER'
    : 'VEGLIA BORLETTI';
  ctx.fillText(brandLabel, 256, 174);

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 26px "JetBrains Mono", monospace';
  ctx.fillText('KM/H', 256, 334);

  // Mechanical Trip & Total Odometer Drum Windows
  ctx.fillStyle = '#040507';
  ctx.fillRect(178, 360, 156, 40);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.strokeRect(178, 360, 156, 40);
  for (let d = 1; d < 5; d++) {
    ctx.beginPath();
    ctx.moveTo(178 + d * 31.2, 360);
    ctx.lineTo(178 + d * 31.2, 400);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 25px "JetBrains Mono", monospace';
  ctx.fillText('04819', 256, 381);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  cachedSpeedoTextures.set(bodyStyle, tex);
  return tex;
}

const cachedTachTextures = new Map<string, THREE.CanvasTexture>();
function getTachometerDialFaceTexture(
  bodyStyle: ClassicCarSpec['bodyStyle'] = 'italian_gt',
  maxAnisotropy = 4
): THREE.CanvasTexture {
  if (cachedTachTextures.has(bodyStyle)) return cachedTachTextures.get(bodyStyle)!;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const is911 = bodyStyle === 'stuttgart_911';
  const isBritish = bodyStyle === 'british_coupe';
  const isProto = bodyStyle === 'detroit_proto';

  ctx.clearRect(0, 0, 512, 512);
  ctx.beginPath();
  ctx.arc(256, 256, 248, 0, Math.PI * 2);
  ctx.fillStyle = isBritish ? '#0c0f14' : '#080a0f';
  ctx.fill();

  const startDeg = -215;
  const endDeg = 35;
  const maxRpm = 90; // x100 = 9000 RPM

  // Yellow caution sector (6,400–7,200 RPM) & Redline sector (7,200–9,000 RPM)
  const warnStartRad = ((startDeg + (64 / maxRpm) * (endDeg - startDeg)) * Math.PI) / 180;
  const redStartRad = ((startDeg + (72 / maxRpm) * (endDeg - startDeg)) * Math.PI) / 180;
  const redEndRad = (endDeg * Math.PI) / 180;

  ctx.beginPath();
  ctx.arc(256, 256, 215, warnStartRad, redStartRad);
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
  ctx.lineWidth = 20;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(256, 256, 215, redStartRad, redEndRad);
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
  ctx.lineWidth = 24;
  ctx.stroke();

  for (let r = 0; r <= maxRpm; r += 5) {
    const frac = r / maxRpm;
    const deg = startDeg + frac * (endDeg - startDeg);
    const rad = (deg * Math.PI) / 180;
    const isMajor = r % 10 === 0;
    const rOuter = 232;
    const rInner = isMajor ? 194 : 211;

    ctx.beginPath();
    ctx.moveTo(256 + Math.cos(rad) * rInner, 256 + Math.sin(rad) * rInner);
    ctx.lineTo(256 + Math.cos(rad) * rOuter, 256 + Math.sin(rad) * rOuter);
    ctx.strokeStyle =
      r >= 72
        ? '#ef4444'
        : is911
        ? '#4ade80'
        : isBritish
        ? '#fef3c7'
        : '#f8fafc';
    ctx.lineWidth = isMajor ? 7 : 3;
    ctx.stroke();

    if (isMajor) {
      const rText = 156;
      const tx = 256 + Math.cos(rad) * rText;
      const ty = 256 + Math.sin(rad) * rText;
      ctx.fillStyle =
        r >= 72
          ? '#f87171'
          : is911
          ? '#86efac'
          : isBritish
          ? '#fef3c7'
          : '#f8fafc';
      ctx.font = 'bold 34px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(r), tx, ty);
    }
  }

  ctx.fillStyle = is911 ? '#86efac' : '#cbd5e1';
  ctx.font = 'bold 21px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  const brandLabel = isBritish
    ? 'SMITHS CHRONOMETRIC'
    : is911
    ? 'VDO · RENNSPORT'
    : isProto
    ? 'STEWART-WARNER'
    : 'VEGLIA BORLETTI';
  ctx.fillText(brandLabel, 256, 174);

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 24px "JetBrains Mono", monospace';
  ctx.fillText(isBritish || isProto ? 'RPM × 100' : 'GIRI × 100', 256, 342);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 18px "Chakra Petch", sans-serif';
  ctx.fillText(isBritish ? 'LONDON · ENGLAND' : isProto ? 'DEARBORN · USA' : 'ACQUA · OLIO', 256, 380);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  cachedTachTextures.set(bodyStyle, tex);
  return tex;
}

const cachedAuxDialTextures = new Map<string, THREE.CanvasTexture>();
function getAuxDialFaceTexture(
  label: string,
  unit: string,
  bodyStyle: ClassicCarSpec['bodyStyle'] = 'italian_gt',
  maxAnisotropy = 4
): THREE.CanvasTexture {
  const key = `${label}_${unit}_${bodyStyle}`;
  if (cachedAuxDialTextures.has(key)) return cachedAuxDialTextures.get(key)!;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const is911 = bodyStyle === 'stuttgart_911';

  ctx.clearRect(0, 0, 256, 256);
  ctx.beginPath();
  ctx.arc(128, 128, 122, 0, Math.PI * 2);
  ctx.fillStyle = '#080a0f';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(128, 128, 114, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.25)';
  ctx.lineWidth = 3;
  ctx.stroke();

  const startDeg = -205;
  const endDeg = 25;
  for (let i = 0; i <= 8; i++) {
    const frac = i / 8;
    const rad = ((startDeg + frac * (endDeg - startDeg)) * Math.PI) / 180;
    const isMaj = i % 2 === 0;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(rad) * (isMaj ? 88 : 100), 128 + Math.sin(rad) * (isMaj ? 88 : 100));
    ctx.lineTo(128 + Math.cos(rad) * 114, 128 + Math.sin(rad) * 114);
    ctx.strokeStyle = i >= 7 ? '#ef4444' : is911 ? '#4ade80' : '#f8fafc';
    ctx.lineWidth = isMaj ? 5 : 3;
    ctx.stroke();
  }

  ctx.fillStyle = is911 ? '#86efac' : '#f8fafc';
  ctx.font = 'bold 26px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, 128, 92);

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 22px "JetBrains Mono", monospace';
  ctx.fillText(unit, 128, 184);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  cachedAuxDialTextures.set(key, tex);
  return tex;
}

let cachedCrackleDashTex: THREE.CanvasTexture | null = null;
function getCrackleDashTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  if (cachedCrackleDashTex) return cachedCrackleDashTex;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#111318';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle 1960s wrinkle-finish / pebble leather micro-grain
  for (let y = 0; y < 512; y += 4) {
    for (let x = 0; x < 512; x += 4) {
      const n = ((x * 73 + y * 139) % 29) / 29;
      ctx.fillStyle = n > 0.5 ? 'rgba(255,255,255,0.038)' : 'rgba(0,0,0,0.22)';
      ctx.fillRect(x, y, 3, 3);
    }
  }

  // Double French contrast stitching along top & bottom seam borders
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 6]);
  ctx.beginPath();
  ctx.moveTo(0, 18);
  ctx.lineTo(512, 18);
  ctx.moveTo(0, 494);
  ctx.lineTo(512, 494);
  ctx.stroke();

  cachedCrackleDashTex = new THREE.CanvasTexture(canvas);
  cachedCrackleDashTex.colorSpace = THREE.SRGBColorSpace;
  cachedCrackleDashTex.wrapS = THREE.RepeatWrapping;
  cachedCrackleDashTex.wrapT = THREE.RepeatWrapping;
  cachedCrackleDashTex.anisotropy = maxAnisotropy;
  return cachedCrackleDashTex;
}

let cachedEngineTurnedTex: THREE.CanvasTexture | null = null;
function getEngineTurnedAlumTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  if (cachedEngineTurnedTex) return cachedEngineTurnedTex;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(0, 0, 512, 256);

  // Classic engine-turned perlage (overlapping swirled circular metallic discs)
  const step = 28;
  for (let y = 0; y <= 256 + step; y += step * 0.75) {
    const offset = (Math.round(y / (step * 0.75)) % 2) * (step * 0.5);
    for (let x = -step; x <= 512 + step; x += step) {
      const cx = x + offset;
      const grad = ctx.createRadialGradient(cx - 4, y - 4, 2, cx, y, step * 0.62);
      grad.addColorStop(0.0, '#f8fafc');
      grad.addColorStop(0.45, '#cbd5e1');
      grad.addColorStop(0.85, '#64748b');
      grad.addColorStop(1.0, '#475569');
      ctx.beginPath();
      ctx.arc(cx, y, step * 0.58, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  cachedEngineTurnedTex = new THREE.CanvasTexture(canvas);
  cachedEngineTurnedTex.colorSpace = THREE.SRGBColorSpace;
  cachedEngineTurnedTex.wrapS = THREE.RepeatWrapping;
  cachedEngineTurnedTex.wrapT = THREE.RepeatWrapping;
  cachedEngineTurnedTex.anisotropy = maxAnisotropy;
  return cachedEngineTurnedTex;
}

const cachedUpholsteryTextures = new Map<string, THREE.CanvasTexture>();
function getUpholsteryTexture(
  bodyStyle: ClassicCarSpec['bodyStyle'],
  maxAnisotropy = 4
): THREE.CanvasTexture {
  if (cachedUpholsteryTextures.has(bodyStyle)) return cachedUpholsteryTextures.get(bodyStyle)!;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  if (bodyStyle === 'stuttgart_911') {
    // Iconic 1960s Porsche Pepita Houndstooth Center Weave + Black Leather Bolsters
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, 512, 512);
    const cell = 16;
    for (let y = 64; y < 448; y += cell) {
      for (let x = 64; x < 448; x += cell) {
        const ix = Math.floor(x / cell);
        const iy = Math.floor(y / cell);
        if ((ix + iy) % 2 === 0) {
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(x, y, cell * 0.78, cell * 0.78);
        }
      }
    }
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 4;
    ctx.strokeRect(60, 60, 392, 392);
  } else if (bodyStyle === 'detroit_proto') {
    // Famous Ford GT40 Mk.II Black Vinyl Cushion with Period Brass Ventilation Grommets
    ctx.fillStyle = '#14161c';
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 48; y <= 464; y += 52) {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(32, y - 18, 448, 36);
      for (const gx of [120, 210, 302, 392]) {
        ctx.beginPath();
        ctx.arc(gx, y, 13, 0, Math.PI * 2);
        ctx.fillStyle = '#d4af37';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(gx, y, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#050608';
        ctx.fill();
      }
    }
  } else {
    // Classic Italian Cognac Saddle or British Biscuit Diamond-Quilted Connolly Leather
    const baseHex = bodyStyle === 'british_coupe' ? '#925422' : '#7c2d12';
    const stitchHex = bodyStyle === 'british_coupe' ? '#fde68a' : '#fdba74';
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.36)';
    ctx.lineWidth = 5;
    const step = 64;
    for (let i = -512; i <= 1024; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 512, 512);
      ctx.moveTo(i + 512, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
    }

    ctx.strokeStyle = stitchHex;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    for (let i = -512; i <= 1024; i += step) {
      ctx.beginPath();
      ctx.moveTo(i + 3, 0);
      ctx.lineTo(i + 515, 512);
      ctx.moveTo(i + 509, 0);
      ctx.lineTo(i - 3, 512);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  cachedUpholsteryTextures.set(bodyStyle, tex);
  return tex;
}

let cachedMahoganyTex: THREE.CanvasTexture | null = null;
function getMahoganyRimTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  if (cachedMahoganyTex) return cachedMahoganyTex;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0.0, '#451a03');
  grad.addColorStop(0.28, '#9a3412');
  grad.addColorStop(0.5, '#b45309');
  grad.addColorStop(0.72, '#9a3412');
  grad.addColorStop(1.0, '#451a03');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 128);

  // Dark ebony inlay stripe & brass rivet dots along the Nardi wood rim
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 59, 512, 10);
  for (let x = 16; x < 512; x += 32) {
    ctx.beginPath();
    ctx.arc(x, 64, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fde68a';
    ctx.fill();
  }

  cachedMahoganyTex = new THREE.CanvasTexture(canvas);
  cachedMahoganyTex.colorSpace = THREE.SRGBColorSpace;
  cachedMahoganyTex.anisotropy = maxAnisotropy;
  return cachedMahoganyTex;
}

let cachedHaldaTex: THREE.CanvasTexture | null = null;
function getHaldaTwinmasterTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  if (cachedHaldaTex) return cachedHaldaTex;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Crackle dark aluminum instrument housing background
  ctx.fillStyle = '#0f1319';
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 504, 248);

  // Left half: HALDA TWINMASTER mechanical rally odometer drums
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(16, 16, 260, 224);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, 260, 224);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 20px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HALDA TWINMASTER', 146, 44);

  for (const [ry, numStr, tag] of [
    [64, '1 4 8 . 6 2', 'INTER'],
    [144, '0 3 4 . 1 8', 'TOTAL'],
  ] as const) {
    ctx.fillStyle = '#050608';
    ctx.fillRect(32, ry, 184, 52);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(32, ry, 184, 52);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 28px "JetBrains Mono", monospace';
    ctx.fillText(numStr, 124, ry + 35);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 14px "Chakra Petch", sans-serif';
    ctx.fillText(tag, 244, ry + 32);
  }

  // Right half: Dual HEUER MONTE-CARLO Rally Stopwatches
  for (const [cx, title] of [
    [340, 'HEUER'],
    [442, 'MONTE-CARLO'],
  ] as const) {
    const cy = 132;
    const r = 46;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#07090d';
    ctx.fill();

    for (let m = 0; m < 12; m++) {
      const a = (m * Math.PI) / 6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10));
      ctx.lineTo(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3));
      ctx.strokeStyle = m % 3 === 0 ? '#f59e0b' : '#f8fafc';
      ctx.lineWidth = m % 3 === 0 ? 3 : 1.5;
      ctx.stroke();
    }

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 10px "Chakra Petch", sans-serif';
    ctx.fillText(title, cx, cy - 14);

    // Luminous stopwatch hands
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 18, cy - 24);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  cachedHaldaTex = new THREE.CanvasTexture(canvas);
  cachedHaldaTex.colorSpace = THREE.SRGBColorSpace;
  cachedHaldaTex.anisotropy = maxAnisotropy;
  return cachedHaldaTex;
}

let cachedDappledSweepTex: THREE.CanvasTexture | null = null;
function getDappledCockpitLightTexture(): THREE.CanvasTexture {
  if (cachedDappledSweepTex) return cachedDappledSweepTex;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 512, 256);

  // Diagonal dappled sunbeams & overhead sodium luminaire bands
  for (const bandX of [96, 256, 416]) {
    const grad = ctx.createRadialGradient(bandX, 128, 8, bandX, 128, 118);
    grad.addColorStop(0.0, 'rgba(255, 248, 220, 0.92)');
    grad.addColorStop(0.45, 'rgba(253, 224, 71, 0.38)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);
  }

  cachedDappledSweepTex = new THREE.CanvasTexture(canvas);
  cachedDappledSweepTex.colorSpace = THREE.SRGBColorSpace;
  cachedDappledSweepTex.wrapS = THREE.RepeatWrapping;
  cachedDappledSweepTex.wrapT = THREE.ClampToEdgeWrapping;
  return cachedDappledSweepTex;
}

/**
 * Builds a smooth, compound-curved 3D Arched Instrument Binnacle Cowling (`BufferGeometry`)
 * that wraps cleanly over the Speedometer, Shift Jewel, and Tachometer with zero boxy edges.
 */
function buildArchedBinnacleGeometry(
  width: number,
  archHeight: number,
  depth: number,
  thickness = 0.014
): THREE.BufferGeometry {
  const halfW = width * 0.5;
  const shape = new THREE.Shape();
  const segs = 56;

  // Outer arch curve from right base (-halfW, 0) over top crown (0, archHeight) to left base (+halfW, 0)
  shape.moveTo(-halfW - thickness, 0);
  for (let i = 0; i <= segs; i++) {
    const theta = Math.PI * (1 - i / segs);
    const x = Math.cos(theta) * (halfW + thickness);
    const y = Math.sin(theta) * (archHeight + thickness);
    shape.lineTo(x, y);
  }
  // Inner arch curve back from (+halfW, 0) to (-halfW, 0)
  for (let i = segs; i >= 0; i--) {
    const theta = Math.PI * (1 - i / segs);
    const x = Math.cos(theta) * halfW;
    const y = Math.sin(theta) * archHeight;
    shape.lineTo(x, y);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 2,
    depth,
    bevelEnabled: true,
    bevelThickness: 0.0045,
    bevelSize: 0.0045,
    bevelSegments: 5,
  });
  geo.translate(0, 0, -depth * 0.5);
  geo.computeVertexNormals();
  return geo;
}

function buildUnifiedTireGeometry(wheelRadius: number, wheelWidth: number): THREE.BufferGeometry {
  const halfW = wheelWidth * 0.48;
  const rimR = wheelRadius * 0.60;
  const shoulderR = wheelRadius * 0.945;
  // LatheGeometry revolves around Y axis in XY plane (x = radial distance >= 0, y = axial offset along wheel width)
  const profilePoints: THREE.Vector2[] = [
    new THREE.Vector2(rimR, -halfW * 0.88),
    new THREE.Vector2(rimR + 0.035, -halfW * 0.96),
    new THREE.Vector2(wheelRadius * 0.78, -halfW),
    new THREE.Vector2(shoulderR, -halfW * 0.92),
    new THREE.Vector2(wheelRadius * 0.988, -halfW * 0.76),
    new THREE.Vector2(wheelRadius, -halfW * 0.52),
    new THREE.Vector2(wheelRadius, 0),
    new THREE.Vector2(wheelRadius, halfW * 0.52),
    new THREE.Vector2(wheelRadius * 0.988, halfW * 0.76),
    new THREE.Vector2(shoulderR, halfW * 0.92),
    new THREE.Vector2(wheelRadius * 0.78, halfW),
    new THREE.Vector2(rimR + 0.035, halfW * 0.96),
    new THREE.Vector2(rimR, halfW * 0.88),
  ];
  const geo = new THREE.LatheGeometry(profilePoints, 32);
  // Rotate so wheel spin axis is along X
  geo.rotateZ(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

let cachedUnifiedTireGeo: THREE.BufferGeometry | null = null;
function getUnifiedTireGeometry(wheelRadius: number, wheelWidth: number): THREE.BufferGeometry {
  if (!cachedUnifiedTireGeo) {
    cachedUnifiedTireGeo = buildUnifiedTireGeometry(wheelRadius, wheelWidth);
  }
  return cachedUnifiedTireGeo;
}

/**
 * Builds a high-precision, $C^1$-smooth compound-curved 3D Coachbuilt Car Body Shell
 * by lofting 68 longitudinal stations x 33 cross-sectional vertices with sculpted fender arches.
 */
function buildLoftedCoachworkGeometry(params: {
  bodyWidth: number;
  bodyLength: number;
  chassisH: number;
  frontWheelZ: number;
  rearWheelZ: number;
  wheelArchRadius: number;
  is911: boolean;
  isProto: boolean;
  isBritish: boolean;
}): THREE.BufferGeometry {
  const {
    bodyWidth,
    bodyLength,
    chassisH,
    frontWheelZ,
    rearWheelZ,
    wheelArchRadius,
    is911,
    isProto,
    isBritish,
  } = params;

  const halfLen = bodyLength * 0.5;
  const baseHalfW = bodyWidth * 0.5;
  const zSteps = 68;
  const halfRingSteps = 16; // 16 left + 1 center + 16 right = 33 ultra-smooth cross-section vertices per station
  const ringCount = halfRingSteps * 2 + 1;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iz = 0; iz <= zSteps; iz++) {
    const t = iz / zSteps;
    const z = -halfLen + t * bodyLength;

    const distFrontW = Math.abs(z - frontWheelZ);
    const distRearW = Math.abs(z - rearWheelZ);
    const frontFlare = Math.exp(-Math.pow(distFrontW / 0.52, 2)) * 0.072;
    const rearFlare = Math.exp(-Math.pow(distRearW / 0.56, 2)) * 0.092;
    const doorWaistPinch = Math.exp(-Math.pow((z - 0.05) / 0.56, 2)) * 0.04;

    let planTaper = 1.0;
    if (t > 0.8) {
      const nt = (t - 0.8) / 0.2;
      planTaper = 1.0 - Math.pow(nt, 1.85) * (isBritish ? 0.22 : 0.18);
    } else if (t < 0.12) {
      const rt = (0.12 - t) / 0.12;
      planTaper = 1.0 - Math.pow(rt, 1.8) * 0.12;
    }

    const stationHalfW = baseHalfW * planTaper + frontFlare + rearFlare - doorWaistPinch;

    let archCutoutY = 0;
    if (distFrontW < wheelArchRadius) {
      archCutoutY = Math.sqrt(wheelArchRadius * wheelArchRadius - distFrontW * distFrontW) * 0.78;
    } else if (distRearW < wheelArchRadius) {
      archCutoutY = Math.sqrt(wheelArchRadius * wheelArchRadius - distRearW * distRearW) * 0.78;
    }

    let centerH = chassisH + 0.21;
    let fenderSwell = 0.024;

    if (t > 0.66) {
      const nt = (t - 0.66) / 0.34;
      centerH -= Math.pow(nt, 1.85) * (is911 ? 0.27 : 0.24);
    }

    fenderSwell += Math.exp(-Math.pow(distFrontW / 0.62, 2)) * (is911 ? 0.088 : 0.072);
    fenderSwell += Math.exp(-Math.pow(distRearW / 0.68, 2)) * (isProto ? 0.086 : 0.076);

    if (z > 0.15 && z < frontWheelZ + 0.42) {
      const hoodPhase = Math.sin(((z - 0.15) / (frontWheelZ + 0.27)) * Math.PI);
      if (isProto) {
        centerH -= hoodPhase * 0.032;
      } else if (!is911) {
        centerH += hoodPhase * 0.042;
      }
    }

    const spoilerCurve =
      t >= 0.005 && t <= 0.12
        ? Math.sin(clamp01((0.12 - t) / 0.115) * (Math.PI * 0.75)) *
          (is911 ? 0.11 : isProto ? 0.055 : 0.075)
        : 0;

    // Smooth C1-continuous 3D cockpit tub recess inside the cabin opening (z in [-0.48, +0.38], u < 0.68)
    // so the exterior coachwork shell drops cleanly below cabinCarpetDeck everywhere inside the cabin
    // while keeping the outer door sills, front cowl/hood, and rear deck 100% untouched.
    let cabinZFactor = 0;
    if (z > -0.48 && z < 0.38) {
      const rRamp = clamp01((z + 0.48) / 0.08);
      const fRamp = clamp01((0.38 - z) / 0.09);
      const sRear = rRamp * rRamp * (3 - 2 * rRamp);
      const sFront = fRamp * fRamp * (3 - 2 * fRamp);
      cabinZFactor = sRear * sFront;
    }

    const evalUpperDeckY = (u: number): number => {
      const crownArch = Math.cos(Math.min(1, u / 0.5) * (Math.PI * 0.5)) * 0.026;
      const pontoonWave = Math.exp(-Math.pow((u - 0.74) / 0.32, 2)) * fenderSwell;
      const outerRadiusDrop = u > 0.78 ? Math.pow((u - 0.78) / 0.22, 2) * 0.048 : 0;
      const uRamp = clamp01((0.68 - u) / 0.10);
      const sTransverse = uRamp * uRamp * (3 - 2 * uRamp);
      const cabinWellDrop = cabinZFactor * sTransverse * 0.22;
      return (
        centerH +
        crownArch +
        pontoonWave -
        outerRadiusDrop +
        spoilerCurve * (1 - u * 0.15) -
        cabinWellDrop
      );
    };

    const shoulderTopY = evalUpperDeckY(1.0);
    const sillBottomY = 0.175 + archCutoutY;

    for (let ir = -halfRingSteps; ir <= halfRingSteps; ir++) {
      const q = ir / halfRingSteps;
      const absQ = Math.abs(q);
      const signQ = Math.sign(q);

      let xNorm = 0;
      let y = 0;

      if (absQ <= 0.75) {
        const u = absQ / 0.75;
        xNorm = signQ * u * 0.94;
        y = evalUpperDeckY(u);
      } else {
        const v = (absQ - 0.75) / 0.25;
        const flankBulge = Math.sin(v * Math.PI * 0.65) * 0.06;
        const underTuck = v > 0.7 ? Math.pow((v - 0.7) / 0.3, 1.5) * (archCutoutY > 0.02 ? 0.04 : 0.12) : 0;
        xNorm = signQ * (0.94 + flankBulge - underTuck);

        const dropFactor = 0.5 - 0.5 * Math.cos(v * Math.PI);
        y = shoulderTopY * (1 - dropFactor) + sillBottomY * dropFactor;
      }

      const x = xNorm * stationHalfW;
      positions.push(x, y, z);

      const uvU = clamp01(x / bodyWidth + 0.5);
      const uvV = clamp01(z / bodyLength + 0.5);
      uvs.push(uvU, uvV);
    }
  }

  for (let iz = 0; iz < zSteps; iz++) {
    const rowA = iz * ringCount;
    const rowB = (iz + 1) * ringCount;
    for (let ir = 0; ir < ringCount - 1; ir++) {
      const a = rowA + ir;
      const b = rowA + ir + 1;
      const c = rowB + ir;
      const d = rowB + ir + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  // Seal Rear Kamm Transom Panel and Front Nose Valance
  const rearRingStart = positions.length / 3;
  for (let ir = 0; ir < ringCount; ir++) {
    const pIdx = ir * 3;
    positions.push(positions[pIdx], positions[pIdx + 1], positions[pIdx + 2]);
    uvs.push(0.15, 0.02);
  }
  const rearCenterIdx = positions.length / 3;
  positions.push(0, 0.175, -halfLen);
  uvs.push(0.15, 0.02);
  for (let ir = 0; ir < ringCount - 1; ir++) {
    indices.push(rearRingStart + ir, rearRingStart + ir + 1, rearCenterIdx);
  }

  const lastRowOffset = zSteps * ringCount;
  const frontRingStart = positions.length / 3;
  for (let ir = 0; ir < ringCount; ir++) {
    const pIdx = (lastRowOffset + ir) * 3;
    positions.push(positions[pIdx], positions[pIdx + 1], positions[pIdx + 2]);
    uvs.push(0.15, 0.98);
  }
  const frontCenterIdx = positions.length / 3;
  positions.push(0, 0.175, halfLen);
  uvs.push(0.15, 0.98);
  for (let ir = 0; ir < ringCount - 1; ir++) {
    indices.push(frontRingStart + ir + 1, frontRingStart + ir, frontCenterIdx);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a sleek, tapered 3D Fastback Cabin Greenhouse & Flush Painted Roof Shell (`THREE.Group`)
 * that blends seamlessly into the coachwork deck without any mismatched box frames or protruding bars.
 */
function buildFastbackCabinGroup(params: {
  bodyWidth: number;
  bodyLength: number;
  chassisH: number;
  is911: boolean;
  isProto: boolean;
  isBritish: boolean;
  bodyPaintMat: THREE.Material;
  glassMat: THREE.Material;
  chromeMat: THREE.Material;
  darkTrimMat: THREE.Material;
}): THREE.Group {
  const {
    bodyWidth,
    bodyLength,
    chassisH,
    is911,
    isProto,
    isBritish,
    bodyPaintMat,
    glassMat,
    chromeMat,
    darkTrimMat,
  } = params;

  const cabinGroup = new THREE.Group();
  const baseY = chassisH + 0.178;
  const cabFrontZ = isProto ? 0.68 : 0.56;
  const cabPeakZ = isBritish ? -0.08 : 0.04;
  const cabRearBaseZ = -1.42;
  const cabH = isProto ? 0.35 : is911 ? 0.42 : 0.39;

  const baseHalfW = bodyWidth * 0.375;
  const roofHalfW = bodyWidth * 0.285;

  const evalStationEnvelope = (z: number) => {
    let h = 0;
    let widthScale = 1.0;
    if (z >= cabPeakZ) {
      const ft = (z - cabPeakZ) / Math.max(0.01, cabFrontZ - cabPeakZ);
      h = cabH * Math.cos(ft * (Math.PI * 0.5));
      widthScale = 1.0 - ft * 0.12;
    } else {
      const rt = (cabPeakZ - z) / Math.max(0.01, cabPeakZ - cabRearBaseZ);
      h = cabH * Math.cos(Math.pow(rt, 0.88) * (Math.PI * 0.5));
      widthScale = 1.0 - rt * 0.22;
    }
    return {
      h,
      wBot: baseHalfW * widthScale,
      wTop: roofHalfW * widthScale,
    };
  };

  // 1. Smooth Teardrop Dark Automotive Glass Canopy (32 stations x 13 profile points)
  const zStations = 32;
  const ringPts = 13;
  const gPos: number[] = [];
  const gIdx: number[] = [];

  for (let iz = 0; iz <= zStations; iz++) {
    const t = iz / zStations;
    const z = cabRearBaseZ + t * (cabFrontZ - cabRearBaseZ);
    const { h, wBot, wTop } = evalStationEnvelope(z);

    const ringCoords: Array<[number, number]> = [
      [-wBot, baseY],
      [-wBot * 0.98, baseY + h * 0.26],
      [-wBot * 0.94, baseY + h * 0.52],
      [-wTop * 1.05, baseY + h * 0.74],
      [-wTop * 0.9, baseY + h * 0.91],
      [-wTop * 0.5, baseY + h * 0.98],
      [0, baseY + h],
      [wTop * 0.5, baseY + h * 0.98],
      [wTop * 0.9, baseY + h * 0.91],
      [wTop * 1.05, baseY + h * 0.74],
      [wBot * 0.94, baseY + h * 0.52],
      [wBot * 0.98, baseY + h * 0.26],
      [wBot, baseY],
    ];

    for (const [rx, ry] of ringCoords) {
      gPos.push(rx, ry, z);
    }
  }

  for (let iz = 0; iz < zStations; iz++) {
    const rA = iz * ringPts;
    const rB = (iz + 1) * ringPts;
    for (let ir = 0; ir < ringPts - 1; ir++) {
      gIdx.push(rA + ir, rB + ir, rA + ir + 1, rA + ir + 1, rB + ir, rB + ir + 1);
    }
  }

  const glassGeo = new THREE.BufferGeometry();
  glassGeo.setAttribute('position', new THREE.Float32BufferAttribute(gPos, 3));
  glassGeo.setIndex(gIdx);
  glassGeo.computeVertexNormals();
  const glassMesh = new THREE.Mesh(glassGeo, glassMat);
  cabinGroup.add(glassMesh);

  // 2. Flush Painted Roof Crown & Rear Fastback Sail Panels
  const rPos: number[] = [];
  const rUvs: number[] = [];
  const rIdx: number[] = [];
  const rStations = 24;
  const rRing = 7;
  const roofStartZ = -0.82;
  const roofEndZ = cabPeakZ + 0.18;

  for (let iz = 0; iz <= rStations; iz++) {
    const t = iz / rStations;
    const z = roofStartZ + t * (roofEndZ - roofStartZ);
    const { h, wTop } = evalStationEnvelope(z);
    const roofY = baseY + h + 0.005;

    const pts: Array<[number, number]> = [
      [-wTop * 0.92, roofY - h * 0.08],
      [-wTop * 0.65, roofY - h * 0.025],
      [-wTop * 0.32, roofY - h * 0.005],
      [0, roofY],
      [wTop * 0.32, roofY - h * 0.005],
      [wTop * 0.65, roofY - h * 0.025],
      [wTop * 0.92, roofY - h * 0.08],
    ];

    for (const [px, py] of pts) {
      rPos.push(px, py, z);
      rUvs.push(clamp01(px / bodyWidth + 0.5), clamp01(z / bodyLength + 0.5));
    }
  }

  for (let iz = 0; iz < rStations; iz++) {
    const rA = iz * rRing;
    const rB = (iz + 1) * rRing;
    for (let ir = 0; ir < rRing - 1; ir++) {
      rIdx.push(rA + ir, rB + ir, rA + ir + 1, rA + ir + 1, rB + ir, rB + ir + 1);
    }
  }

  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3));
  roofGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rUvs, 2));
  roofGeo.setIndex(rIdx);
  roofGeo.computeVertexNormals();
  const roofMesh = new THREE.Mesh(roofGeo, bodyPaintMat);
  cabinGroup.add(roofMesh);

  // 3. Rear Cargo Deck & Strapped Spare Wheel visible inside Rear Fastback Glass
  const rearCargoShelf = new THREE.Mesh(
    new THREE.BoxGeometry(baseHalfW * 1.25, 0.036, 0.68),
    darkTrimMat
  );
  rearCargoShelf.position.set(0, baseY - 0.01, -0.88);
  cabinGroup.add(rearCargoShelf);

  if (!isProto) {
    const spareWheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.19, 0.09, 20),
      darkTrimMat
    );
    spareWheel.rotation.x = -0.12;
    spareWheel.position.set(0, baseY + 0.04, -0.92);
    const spareHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.095, 16),
      chromeMat
    );
    spareHub.rotation.x = -0.12;
    spareHub.position.set(0, baseY + 0.04, -0.92);
    cabinGroup.add(spareWheel, spareHub);
  }

  return cabinGroup;
}

/**
 * Builds an authentic, museum-grade 3D Classic GT race car (`THREE.Group`)
 * with compound-curved coachwork, unified LatheGeometry racing tires,
 * deep-dish Borrani wire / Campagnolo magnesium rims, and full 1967 GT cockpit.
 */
export function buildClassicCarMesh(
  spec: ClassicCarSpec,
  livery: CarLivery,
  isSoftwareGl: boolean,
  maxAnisotropy: number
): CarMeshRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const liveryTexture = createLiveryCanvasTexture(livery, maxAnisotropy);
  const roundelTexture = createRoundelDecalTexture(livery.number, maxAnisotropy);

  const bodyPaintMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: liveryTexture,
    roughness: 0.2,
    metalness: 0.18,
    clearcoat: isSoftwareGl ? 0 : 0.92,
    clearcoatRoughness: 0.08,
    envMapIntensity: 0.7,
  });

  const roundelMat = new THREE.MeshBasicMaterial({
    map: roundelTexture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    roughness: 0.05,
    metalness: 0.12,
    transparent: true,
    opacity: 0.64,
    clearcoat: isSoftwareGl ? 0 : 1.0,
    envMapIntensity: 0.95,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.1,
    metalness: 0.94,
    envMapIntensity: 1.15,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x0d0f12,
    roughness: 0.85,
    metalness: 0.15,
  });

  const brushedAlumMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.35,
    metalness: 0.8,
  });

  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x7c2d12,
    roughness: 0.62,
    metalness: 0.05,
  });

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.32,
    metalness: 0.06,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: getTireSidewallTexture(),
    roughness: 0.82,
    metalness: 0.06,
  });

  // Tire Compound Sidewall Color Ring Material (Red=Soft, Amber=Medium, White=Hard, Blue=Wet)
  const tireCompoundMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.4,
    metalness: 0.1,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.22,
    side: THREE.DoubleSide,
  });

  const rimColor =
    livery.wheelFinish === 'gold_magnesium'
      ? 0xd4af37
      : livery.wheelFinish === 'gunmetal_alloy'
      ? 0x475569
      : 0xe2e8f0;
  const rimMat = new THREE.MeshStandardMaterial({
    color: rimColor,
    roughness: 0.16,
    metalness: 0.9,
    side: THREE.DoubleSide,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfef08a,
    emissiveIntensity: 1.9,
    roughness: 0.06,
  });

  const fogLightMat = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    emissive: 0xfacc15,
    emissiveIntensity: 1.5,
    roughness: 0.1,
  });

  const brakeLightsMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0xef4444,
    emissiveIntensity: 0.55,
    roughness: 0.16,
  });

  const amberTurnMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.5,
    roughness: 0.2,
  });

  const brakeDiscMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.9,
    roughness: 0.25,
    emissive: 0xff3b00,
    emissiveIntensity: 0,
  });

  const isProto = spec.bodyStyle === 'detroit_proto';
  const is911 = spec.bodyStyle === 'stuttgart_911';
  const isBritish = spec.bodyStyle === 'british_coupe';
  const isItalian = spec.bodyStyle === 'italian_gt';

  const bodyWidth = isProto ? 1.92 : 1.84;
  const bodyLength = isBritish ? 4.34 : isProto ? 4.18 : 4.22;
  const halfLen = bodyLength * 0.5;
  const chassisH = isProto ? 0.42 : 0.48;

  const wheelRadius = 0.35;
  const wheelContactY = wheelRadius - 0.005;
  const wheelWidth = 0.28;
  const frontWheelbaseZ = halfLen * 0.58;
  const rearWheelbaseZ = -halfLen * 0.57;
  const trackHalfW = bodyWidth * 0.405;

  const evalSurfaceAt = (x: number, z: number): { y: number; stationHalfW: number } => {
    const baseHalfW = bodyWidth * 0.5;
    const t = clamp01((z + halfLen) / bodyLength);
    const distFrontW = Math.abs(z - frontWheelbaseZ);
    const distRearW = Math.abs(z - rearWheelbaseZ);
    const frontFlare = Math.exp(-Math.pow(distFrontW / 0.52, 2)) * 0.072;
    const rearFlare = Math.exp(-Math.pow(distRearW / 0.56, 2)) * 0.092;
    const doorWaistPinch = Math.exp(-Math.pow((z - 0.05) / 0.56, 2)) * 0.04;

    let planTaper = 1.0;
    if (t > 0.8) {
      const nt = (t - 0.8) / 0.2;
      planTaper = 1.0 - Math.pow(nt, 1.85) * (isBritish ? 0.22 : 0.18);
    } else if (t < 0.12) {
      const rt = (0.12 - t) / 0.12;
      planTaper = 1.0 - Math.pow(rt, 1.8) * 0.12;
    }
    const stationHalfW = baseHalfW * planTaper + frontFlare + rearFlare - doorWaistPinch;

    let centerH = chassisH + 0.21;
    let fenderSwell = 0.024;
    if (t > 0.66) {
      const nt = (t - 0.66) / 0.34;
      centerH -= Math.pow(nt, 1.85) * (is911 ? 0.27 : 0.24);
    }
    fenderSwell += Math.exp(-Math.pow(distFrontW / 0.62, 2)) * (is911 ? 0.088 : 0.072);
    fenderSwell += Math.exp(-Math.pow(distRearW / 0.68, 2)) * (isProto ? 0.086 : 0.076);

    if (z > 0.15 && z < frontWheelbaseZ + 0.42) {
      const hoodPhase = Math.sin(((z - 0.15) / (frontWheelbaseZ + 0.27)) * Math.PI);
      if (isProto) {
        centerH -= hoodPhase * 0.032;
      } else if (!is911) {
        centerH += hoodPhase * 0.042;
      }
    }

    const spoilerCurve =
      t >= 0.005 && t <= 0.12
        ? Math.sin(clamp01((0.12 - t) / 0.115) * (Math.PI * 0.75)) *
          (is911 ? 0.11 : isProto ? 0.055 : 0.075)
        : 0;

    const u = clamp01(Math.abs(x) / Math.max(0.05, stationHalfW * 0.94));
    const crownArch = Math.cos(Math.min(1, u / 0.5) * (Math.PI * 0.5)) * 0.026;
    const pontoonWave = Math.exp(-Math.pow((u - 0.74) / 0.32, 2)) * fenderSwell;
    const outerRadiusDrop = u > 0.78 ? Math.pow((u - 0.78) / 0.22, 2) * 0.048 : 0;
    const y = centerH + crownArch + pontoonWave - outerRadiusDrop + spoilerCurve * (1 - u * 0.15);

    return { y, stationHalfW };
  };

  const evalSurfaceWithSlope = (x: number, z: number) => {
    const s0 = evalSurfaceAt(x, z);
    const sF = evalSurfaceAt(x, z + 0.04);
    const sB = evalSurfaceAt(x, z - 0.04);
    const pitchSlope = Math.atan2(sF.y - sB.y, 0.08);
    return { y: s0.y, stationHalfW: s0.stationHalfW, pitchSlope };
  };

  // 0. Soft Under-Chassis Contact Shadow / Ambient Occlusion Decal
  const contactShadowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(bodyWidth * 1.22, bodyLength * 1.14),
    new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    })
  );
  contactShadowMesh.rotation.x = -Math.PI / 2;
  contactShadowMesh.position.set(0, 0.006, 0);
  root.add(contactShadowMesh);

  // Structural sub-groups (all strictly locked at 0,0,0)
  const frontNosePivot = new THREE.Group();
  bodyGroup.add(frontNosePivot);

  const hoodPivot = new THREE.Group();
  bodyGroup.add(hoodPivot);

  const leftFenderGroup = new THREE.Group();
  bodyGroup.add(leftFenderGroup);

  const rightFenderGroup = new THREE.Group();
  bodyGroup.add(rightFenderGroup);

  const rearValenceGroup = new THREE.Group();
  bodyGroup.add(rearValenceGroup);

  // 1. High-Precision Compound-Curved 3D Coachbuilt Body Shell
  const bodyGeo = buildLoftedCoachworkGeometry({
    bodyWidth,
    bodyLength,
    chassisH,
    frontWheelZ: frontWheelbaseZ,
    rearWheelZ: rearWheelbaseZ,
    wheelArchRadius: wheelRadius + 0.055,
    is911,
    isProto,
    isBritish,
  });
  const mainBodyMesh = new THREE.Mesh(bodyGeo, bodyPaintMat);
  mainBodyMesh.castShadow = !isSoftwareGl;
  mainBodyMesh.receiveShadow = !isSoftwareGl;
  bodyGroup.add(mainBodyMesh);

  // Sculpted Underbody Floor Pan & Recessed Inboard Wheel-Well Backing Plates (strictly inboard of tires!)
  const underPan = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 0.62, 0.14, bodyLength * 0.84),
    darkTrimMat
  );
  underPan.position.set(0, 0.22, 0);
  bodyGroup.add(underPan);

  const wheelWellBackingGeo = new THREE.CylinderGeometry(
    wheelRadius - 0.04,
    wheelRadius - 0.04,
    0.05,
    20
  );
  wheelWellBackingGeo.rotateZ(Math.PI / 2);

  const wishboneArmGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.18, 8).rotateZ(Math.PI / 2);
  const coiloverDamperGeo = new THREE.CylinderGeometry(0.016, 0.014, 0.18, 8);

  const doorSurf = evalSurfaceAt(0, 0.04);
  const doorFlankX = doorSurf.stationHalfW * 0.992;

  for (const side of [-1, 1]) {
    for (const wz of [frontWheelbaseZ, rearWheelbaseZ]) {
      // Recessed well inboard of the tire inner sidewall (trackHalfW - 0.14) so it never touches or clips the tire
      const wellBacking = new THREE.Mesh(wheelWellBackingGeo, darkTrimMat);
      wellBacking.position.set(side * (trackHalfW - 0.185), wheelContactY, wz);
      bodyGroup.add(wellBacking);

      const upperArm = new THREE.Mesh(wishboneArmGeo, brushedAlumMat);
      upperArm.position.set(side * (trackHalfW - 0.22), wheelContactY + 0.075, wz);
      const lowerArm = new THREE.Mesh(wishboneArmGeo, brushedAlumMat);
      lowerArm.position.set(side * (trackHalfW - 0.22), wheelContactY - 0.075, wz);
      const strut = new THREE.Mesh(coiloverDamperGeo, chromeMat);
      strut.position.set(side * (trackHalfW - 0.20), wheelContactY + 0.03, wz - 0.03);
      strut.rotation.z = side * 0.24;
      bodyGroup.add(upperArm, lowerArm, strut);
    }

    const doorRoundel = new THREE.Mesh(new THREE.CircleGeometry(0.23, 28), roundelMat);
    doorRoundel.position.set(side * doorFlankX, 0.425, 0.04);
    doorRoundel.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    bodyGroup.add(doorRoundel);

    const rockerTrim = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1.24), chromeMat);
    rockerTrim.position.set(side * (doorSurf.stationHalfW * 0.945), 0.185, 0);
    bodyGroup.add(rockerTrim);

    for (let g = 0; g < 3; g++) {
      const gz = frontWheelbaseZ - 0.46 - g * 0.072;
      const gSurf = evalSurfaceAt(0, gz);
      const gill = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.12, 0.024), darkTrimMat);
      gill.position.set(side * (gSurf.stationHalfW * 0.985), 0.43, gz);
      gill.rotation.x = 0.28;
      bodyGroup.add(gill);
    }

    const handleSurf = evalSurfaceAt(0, -0.18);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.018, 0.11), chromeMat);
    handle.position.set(side * (handleSurf.stationHalfW * 0.98), chassisH + 0.14, -0.18);
    bodyGroup.add(handle);

    // Cloisonné Scuderia Fender Shield Emblem behind front wheel arch
    const shieldZ = frontWheelbaseZ - 0.33;
    const shieldSurf = evalSurfaceAt(0, shieldZ);
    const shieldBezel = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.068, 0.054),
      chromeMat
    );
    shieldBezel.position.set(side * (shieldSurf.stationHalfW * 0.985), 0.475, shieldZ);
    const shieldEnamel = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 0.056, 0.044),
      new THREE.MeshStandardMaterial({
        color: isBritish ? 0x065f46 : isProto ? 0x1d4ed8 : 0xfacc15,
        roughness: 0.25,
        metalness: 0.4,
      })
    );
    shieldEnamel.position.set(side * (shieldSurf.stationHalfW * 0.987), 0.475, shieldZ);
    bodyGroup.add(shieldBezel, shieldEnamel);
  }

  // 2. Sleek Tapered Fastback Cabin Greenhouse & Flush Painted Roof
  const cabinGroup = buildFastbackCabinGroup({
    bodyWidth,
    bodyLength,
    chassisH,
    is911,
    isProto,
    isBritish,
    bodyPaintMat,
    glassMat,
    chromeMat,
    darkTrimMat,
  });
  bodyGroup.add(cabinGroup);

  // 3. Chassis-Specific Authentic Hood, Engine Bay & Aero Hardware
  if (isItalian) {
    const nZ = halfLen * 0.72;
    for (const nx of [-0.21, 0, 0.21]) {
      const nSurf = evalSurfaceWithSlope(nx, nZ);
      const nostril = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.026, 0.11), darkTrimMat);
      nostril.position.set(nx, nSurf.y + 0.002, nZ);
      nostril.rotation.x = -nSurf.pitchSlope;
      hoodPivot.add(nostril);
    }
    const strapZ = 1.12;
    for (const bx of [-0.32, 0.32]) {
      const sSurf = evalSurfaceWithSlope(bx, strapZ);
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.26), leatherMat);
      strap.position.set(bx, sSurf.y + 0.005, strapZ);
      strap.rotation.x = -sSurf.pitchSlope;
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.018, 0.048), chromeMat);
      buckle.position.set(bx, sSurf.y + 0.009, strapZ);
      buckle.rotation.x = -sSurf.pitchSlope;
      hoodPivot.add(strap, buckle);
    }
  } else if (isBritish) {
    for (let l = 0; l < 7; l++) {
      const lz = 0.58 + l * 0.11;
      for (const lx of [-0.18, 0.18]) {
        const lSurf = evalSurfaceWithSlope(lx, lz);
        const louver = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.012, 0.03), darkTrimMat);
        louver.position.set(lx, lSurf.y + 0.004, lz);
        louver.rotation.x = -lSurf.pitchSlope;
        hoodPivot.add(louver);
      }
    }
  } else if (is911) {
    const gZ = -halfLen * 0.72;
    const gSurf = evalSurfaceWithSlope(0, gZ);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.018, 0.38), darkTrimMat);
    grille.position.set(0, gSurf.y + 0.005, gZ);
    grille.rotation.x = -gSurf.pitchSlope;
    bodyGroup.add(grille);
  } else if (isProto) {
    const tZ = 0.82;
    for (const side of [-1, 1]) {
      const tx = side * 0.19;
      const tSurf = evalSurfaceWithSlope(tx, tZ);
      const trough = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.022, 0.44), darkTrimMat);
      trough.position.set(tx, tSurf.y + 0.003, tZ);
      trough.rotation.x = -tSurf.pitchSlope;
      hoodPivot.add(trough);
    }
    const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.56), brushedAlumMat);
    const eSurf = evalSurfaceAt(0, -0.72);
    engineBlock.position.set(0, eSurf.y - 0.02, -0.72);
    bodyGroup.add(engineBlock);
    for (let r = 0; r < 4; r++) {
      const sz = -0.52 - r * 0.13;
      const sSurf = evalSurfaceAt(0.1, sz);
      for (const cx of [-0.1, 0.1]) {
        const stack = new THREE.Mesh(
          new THREE.CylinderGeometry(0.024, 0.018, 0.065, 12),
          chromeMat
        );
        stack.position.set(cx, sSurf.y + 0.02, sz);
        bodyGroup.add(stack);
      }
    }
  }

  // Flip-Top Chrome Monza Quick-Release Fuel Filler Cap on Rear Left Haunch
  const fuelX = -bodyWidth * 0.28;
  const fuelZ = -halfLen * 0.72;
  const fuelSurf = evalSurfaceWithSlope(fuelX, fuelZ);
  const fuelBase = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.054, 0.02, 16), chromeMat);
  fuelBase.position.set(fuelX, fuelSurf.y + 0.008, fuelZ);
  fuelBase.rotation.x = -fuelSurf.pitchSlope;
  const fuelLatch = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.012, 0.068), chromeMat);
  fuelLatch.position.set(fuelX, fuelSurf.y + 0.018, fuelZ - 0.01);
  fuelLatch.rotation.x = -fuelSurf.pitchSlope;
  bodyGroup.add(fuelBase, fuelLatch);

  // Chrome Dzus Quarter-Turn Bonnet Fastener Plates & Hood Pins on Front Deck
  const dzusZ = halfLen - 0.22;
  for (const dx of [-0.30, 0.30]) {
    const dSurf = evalSurfaceWithSlope(dx, dzusZ);
    const dzusPlate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, 0.006, 14),
      chromeMat
    );
    dzusPlate.position.set(dx, dSurf.y + 0.004, dzusZ);
    dzusPlate.rotation.x = -dSurf.pitchSlope;
    const dzusRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.014, 0.003, 8, 14).rotateX(Math.PI / 2),
      chromeMat
    );
    dzusRing.position.set(dx, dSurf.y + 0.008, dzusZ);
    dzusRing.rotation.x = Math.PI / 2 - dSurf.pitchSlope;
    hoodPivot.add(dzusPlate, dzusRing);
  }

  // 4. Museum-Grade 1967 GT Interior Cockpit:
  // Sculpted Curved Arched Leather Binnacle, Engine-Turned Perlage Fascia, Marque-Specific Veglia/Smiths/VDO/Stewart-Warner Dials,
  // Halda Twinmaster & Dual Heuer Monte-Carlo Chronometers, Aircraft Toggle Switch Bank, Slotted 3-Spoke Nardi Wheel with Heuer Wristwatch & Nomex Sleeves,
  // Quilted Interior Door Cards, Drilled Footwell Pedal Box, Chrome Open-Gate Shift Tower, Fly-Off Handbrake, Halon Extinguisher & Deep-Bolstered Seats
  const interiorFloorY = chassisH + 0.105;

  const crackleDashMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: getCrackleDashTexture(maxAnisotropy),
    roughness: 0.78,
    metalness: 0.12,
  });

  const engineTurnedTex = getEngineTurnedAlumTexture(maxAnisotropy);
  const engineTurnedMat = new THREE.MeshStandardMaterial({
    color: isProto ? 0x64748b : 0xffffff,
    map: engineTurnedTex,
    emissive: isProto ? 0x334155 : 0xffffff,
    emissiveMap: engineTurnedTex,
    emissiveIntensity: isProto ? 0.15 : 0.28,
    roughness: isProto ? 0.45 : 0.32,
    metalness: isProto ? 0.35 : 0.28,
  });

  const upholsteryMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: getUpholsteryTexture(spec.bodyStyle, maxAnisotropy),
    roughness: 0.58,
    metalness: 0.06,
  });

  const binnacleLeatherColor = isBritish
    ? 0x7c3f16
    : is911 || isProto
    ? 0x181b22
    : 0x6b2710;
  const binnacleLeatherMat = new THREE.MeshStandardMaterial({
    color: binnacleLeatherColor,
    roughness: 0.46,
    metalness: 0.08,
  });

  const mahoganyWheelMat = new THREE.MeshPhysicalMaterial({
    color: is911 || isProto ? 0x18181b : 0xffffff,
    map: is911 || isProto ? getCrackleDashTexture(maxAnisotropy) : getMahoganyRimTexture(maxAnisotropy),
    roughness: is911 || isProto ? 0.55 : 0.22,
    metalness: 0.05,
    clearcoat: isSoftwareGl || is911 || isProto ? 0 : 0.85,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.24,
    metalness: 0.88,
  });

  // 4A. Recessed Quilted Cabin Floor Pan, Ribbed Aluminum Driver Heel Plate, Footwell Firewall & Contoured Transmission Tunnel Saddle
  const cabinCarpetDeck = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 0.68, 0.024, 0.74),
    crackleDashMat
  );
  cabinCarpetDeck.position.set(0, interiorFloorY + 0.032, -0.02);

  const footwellBulkhead = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 0.66, 0.11, 0.03),
    crackleDashMat
  );
  footwellBulkhead.position.set(0, interiorFloorY + 0.075, 0.235);

  const driverHeelPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.006, 0.22),
    engineTurnedMat
  );
  driverHeelPlate.position.set(0.19, interiorFloorY + 0.046, 0.11);

  // Contoured diamond-quilted transmission tunnel with rounded top ridge
  const centerTunnelConsole = new THREE.Mesh(
    new THREE.BoxGeometry(0.165, 0.085, 0.68),
    upholsteryMat
  );
  centerTunnelConsole.position.set(0, interiorFloorY + 0.078, -0.04);

  const tunnelTopPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.125, 0.008, 0.48),
    engineTurnedMat
  );
  tunnelTopPlate.position.set(0, interiorFloorY + 0.122, -0.02);
  bodyGroup.add(
    cabinCarpetDeck,
    footwellBulkhead,
    driverHeelPlate,
    centerTunnelConsole,
    tunnelTopPlate
  );

  // 4B. Sculpted Interior Door Cards, Chrome Spear Mouldings, Rotary Window Cranks & Leather Pull Straps
  for (const side of [-1, 1]) {
    const doorCardX = side * (bodyWidth * 0.335);
    const doorCardPanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.175, 0.64),
      upholsteryMat
    );
    doorCardPanel.position.set(doorCardX, interiorFloorY + 0.125, -0.04);

    const doorUpperCapping = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.013, 0.56, 12).rotateX(Math.PI / 2),
      binnacleLeatherMat
    );
    doorUpperCapping.position.set(doorCardX - side * 0.006, interiorFloorY + 0.168, -0.10);

    const doorChromeSpear = new THREE.Mesh(
      new THREE.BoxGeometry(0.008, 0.009, 0.56),
      chromeMat
    );
    doorChromeSpear.position.set(doorCardX - side * 0.011, interiorFloorY + 0.145, -0.06);

    // Rotary window winder crank & leather door pull loop
    const winderRosette = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.01, 12).rotateZ(Math.PI / 2),
      chromeMat
    );
    winderRosette.position.set(doorCardX - side * 0.012, interiorFloorY + 0.130, 0.09);
    const winderArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.008, 0.036, 0.009),
      chromeMat
    );
    winderArm.position.set(doorCardX - side * 0.016, interiorFloorY + 0.118, 0.10);
    winderArm.rotation.x = 0.55;

    const pullStrapLoop = new THREE.Mesh(
      new THREE.TorusGeometry(0.022, 0.0055, 8, 16, Math.PI * 1.25).rotateY(Math.PI / 2),
      binnacleLeatherMat
    );
    pullStrapLoop.position.set(doorCardX - side * 0.014, interiorFloorY + 0.122, -0.02);

    bodyGroup.add(
      doorCardPanel,
      doorUpperCapping,
      doorChromeSpear,
      winderRosette,
      winderArm,
      pullStrapLoop
    );
  }

  // 4C. Driver Footwell Drilled Aluminum Pedal Box (Clutch, Brake, Throttle with Animated Pivots)
  const createPedalAssembly = (px: number, padW: number, padH: number): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(px, interiorFloorY + 0.052, 0.205);
    pivot.rotation.x = -0.32;

    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.007, 0.055, 0.008),
      darkTrimMat
    );
    arm.position.set(0, 0.024, 0);

    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(padW, padH, 0.006),
      chromeMat
    );
    pad.position.set(0, 0.048, -0.004);
    pad.rotation.x = 0.22;

    for (const dy of [-0.009, 0.009]) {
      const hole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0038, 0.0038, 0.008, 8).rotateX(Math.PI / 2),
        darkTrimMat
      );
      hole.position.set(0, 0.048 + dy, -0.004);
      pivot.add(hole);
    }

    pivot.add(arm, pad);
    bodyGroup.add(pivot);
    return pivot;
  };

  createPedalAssembly(0.245, 0.026, 0.042); // Clutch pedal (symmetric +0.055 from 0.190 centerline)
  const brakePedalPivot = createPedalAssembly(0.190, 0.030, 0.044); // Brake pedal strictly on 0.190 driver centerline
  const throttlePedalPivot = createPedalAssembly(0.135, 0.024, 0.058); // Organ-style throttle pedal (symmetric -0.055 from 0.190 centerline)

  // 4D. Multi-Layered Sculpted 1967 GT Dashboard Cowl, Split Bullnose Roll & Engine-Turned Fascia
  // IMPORTANT: The arched driver binnacle spans x = [0.034 .. 0.346], centered on x = 0.190.
  // All horizontal dashboard bullnose rolls, chrome top beads, and cowl slabs are strictly split
  // outside [0.034 .. 0.346] or positioned forward of z = 0.185 so NO horizontal line EVER cuts across the Speedometer or Tachometer!
  const dashWidth = bodyWidth * 0.64;
  const dashHalfW = dashWidth * 0.5;
  const binnacleCenterX = 0.190;
  const binnacleBaseY = interiorFloorY + 0.112;
  const binnacleSpanW = 0.312; // spans x = 0.034 .. 0.346
  const binnacleArchH = 0.140; // peaks at y = interiorFloorY + 0.252 while legs reach down to knee-roll at +0.112
  const binnacleDepth = 0.092;
  const binnacleRightEdgeX = binnacleCenterX - binnacleSpanW * 0.5; // 0.034
  const binnacleLeftEdgeX = binnacleCenterX + binnacleSpanW * 0.5;  // 0.346

  // Forward anti-glare cowl deck (sits at z = 0.305, rear edge at z = 0.190 — completely forward of the binnacle gauges at z = 0.126!)
  const dashCowlTop = new THREE.Mesh(
    new THREE.BoxGeometry(dashWidth, 0.020, 0.23),
    crackleDashMat
  );
  dashCowlTop.position.set(0, interiorFloorY + 0.190, 0.305);
  dashCowlTop.rotation.x = 0.03;
  bodyGroup.add(dashCowlTop);

  // Dynamic Dappled Sunlight & Tunnel Sodium Caustic Sweep Overlay across the dashboard cowl top
  const dappledLightSweepMat = new THREE.MeshBasicMaterial({
    color: 0xffe89e,
    map: getDappledCockpitLightTexture(),
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const dappledLightSweepMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(dashWidth * 0.96, 0.21),
    dappledLightSweepMat
  );
  dappledLightSweepMesh.rotation.x = -Math.PI / 2 + 0.03;
  dappledLightSweepMesh.position.set(0, interiorFloorY + 0.201, 0.295);
  bodyGroup.add(dappledLightSweepMesh);

  // Rolled stitched leather bullnose edge along the passenger/center dashboard (strictly from -dashHalfW to binnacleRightEdgeX = 0.034!)
  const passBullnoseLen = Math.max(0.05, binnacleRightEdgeX - -dashHalfW);
  const passBullnoseCenterX = (-dashHalfW + binnacleRightEdgeX) * 0.5;
  const dashUpperBullnosePass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, passBullnoseLen, 16).rotateZ(Math.PI / 2),
    binnacleLeatherMat
  );
  dashUpperBullnosePass.position.set(passBullnoseCenterX, interiorFloorY + 0.202, 0.138);
  bodyGroup.add(dashUpperBullnosePass);

  // Short outer left bullnose wing outside the binnacle (from binnacleLeftEdgeX = 0.346 to +dashHalfW)
  const outerLeftWingLen = Math.max(0.02, dashHalfW - binnacleLeftEdgeX);
  if (outerLeftWingLen > 0.02) {
    const dashUpperBullnoseLeft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, outerLeftWingLen, 14).rotateZ(Math.PI / 2),
      binnacleLeatherMat
    );
    dashUpperBullnoseLeft.position.set(
      (binnacleLeftEdgeX + dashHalfW) * 0.5,
      interiorFloorY + 0.202,
      0.138
    );
    bodyGroup.add(dashUpperBullnoseLeft);
  }

  // Twin recessed defroster louver grilles + brass scrutineering chassis plate on cowl top
  for (const ventX of [-0.24, 0.24]) {
    const defrosterFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.145, 0.006, 0.042),
      chromeMat
    );
    defrosterFrame.position.set(ventX, interiorFloorY + 0.201, 0.35);
    const defrosterGrid = new THREE.Mesh(
      new THREE.BoxGeometry(0.135, 0.007, 0.032),
      darkTrimMat
    );
    defrosterGrid.position.set(ventX, interiorFloorY + 0.202, 0.35);
    bodyGroup.add(defrosterFrame, defrosterGrid);
  }

  const chassisPlaque = new THREE.Mesh(
    new THREE.BoxGeometry(0.068, 0.005, 0.024),
    brassMat
  );
  chassisPlaque.position.set(0, interiorFloorY + 0.201, 0.33);
  bodyGroup.add(chassisPlaque);

  // Main contoured dashboard body (recessed forward at z = 0.222 so it never intersects the binnacle backing plate)
  const dashConsole = new THREE.Mesh(
    new THREE.BoxGeometry(dashWidth, 0.102, 0.148),
    crackleDashMat
  );
  dashConsole.position.set(0, interiorFloorY + 0.144, 0.222);

  // Engine-turned aluminum instrument fascia positioned at z = 0.140 (front face at z = 0.134, strictly behind
  // binnacleBackMesh at z = 0.131) and split outside the upper binnacle so there is zero gap and zero seam!
  const dashAlumFasciaPass = new THREE.Mesh(
    new THREE.BoxGeometry(passBullnoseLen + 0.024, 0.096, 0.010),
    engineTurnedMat
  );
  dashAlumFasciaPass.position.set(passBullnoseCenterX + 0.012, interiorFloorY + 0.148, 0.140);
  bodyGroup.add(dashConsole, dashAlumFasciaPass);

  if (outerLeftWingLen > 0.02) {
    const dashAlumFasciaLeft = new THREE.Mesh(
      new THREE.BoxGeometry(outerLeftWingLen + 0.024, 0.096, 0.010),
      engineTurnedMat
    );
    dashAlumFasciaLeft.position.set(
      (binnacleLeftEdgeX + dashHalfW) * 0.5 - 0.012,
      interiorFloorY + 0.148,
      0.140
    );
    bodyGroup.add(dashAlumFasciaLeft);
  }

  // Chrome beading frame along the passenger/center fascia top (strictly stopping at binnacleRightEdgeX = 0.034!)
  const dashFasciaTopBead = new THREE.Mesh(
    new THREE.BoxGeometry(passBullnoseLen, 0.004, 0.015),
    chromeMat
  );
  dashFasciaTopBead.position.set(passBullnoseCenterX, interiorFloorY + 0.197, 0.137);

  // Lower padded leather knee-roll bolster along bottom of dashboard
  const dashKneeRoll = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.013, bodyWidth * 0.62, 14).rotateZ(Math.PI / 2),
    binnacleLeatherMat
  );
  dashKneeRoll.position.set(0, interiorFloorY + 0.098, 0.135);

  bodyGroup.add(dashFasciaTopBead, dashKneeRoll);

  // 4E. Smooth Compound-Curved Arched Leather Instrument Binnacle Cowling
  // Curves smoothly from x = 0.034 to x = 0.346, peaking at y = interiorFloorY + 0.252
  const archedBinnacleGeo = buildArchedBinnacleGeometry(
    binnacleSpanW,
    binnacleArchH,
    binnacleDepth,
    0.014
  );
  const archedBinnacleHood = new THREE.Mesh(archedBinnacleGeo, binnacleLeatherMat);
  archedBinnacleHood.position.set(binnacleCenterX, binnacleBaseY, 0.168);
  bodyGroup.add(archedBinnacleHood);

  // Rolled stitched front lip piping around the mouth of the arched binnacle (56 smooth segments)
  const binnacleLipCurvePts: THREE.Vector3[] = [];
  for (let i = 0; i <= 56; i++) {
    const theta = Math.PI * (1 - i / 56);
    binnacleLipCurvePts.push(
      new THREE.Vector3(
        binnacleCenterX + Math.cos(theta) * (binnacleSpanW * 0.5 + 0.007),
        binnacleBaseY + Math.sin(theta) * (binnacleArchH + 0.007),
        0.121
      )
    );
  }
  const binnacleLipGeo = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(binnacleLipCurvePts),
    56,
    0.0068,
    16,
    false
  );
  const binnacleLipMesh = new THREE.Mesh(binnacleLipGeo, binnacleLeatherMat);
  bodyGroup.add(binnacleLipMesh);

  // Seamless engine-turned aluminum & anti-glare gauge well backing plate sealing the entire arched binnacle opening
  const binnacleBackShape = new THREE.Shape();
  binnacleBackShape.moveTo(-binnacleSpanW * 0.5, -0.014);
  for (let i = 0; i <= 56; i++) {
    const theta = Math.PI * (1 - i / 56);
    binnacleBackShape.lineTo(
      Math.cos(theta) * (binnacleSpanW * 0.5),
      Math.sin(theta) * binnacleArchH
    );
  }
  binnacleBackShape.lineTo(binnacleSpanW * 0.5, -0.014);
  binnacleBackShape.closePath();
  const binnacleBackMesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(binnacleBackShape, { depth: 0.008, bevelEnabled: false }),
    engineTurnedMat
  );
  binnacleBackMesh.position.set(binnacleCenterX, binnacleBaseY, 0.131);
  bodyGroup.add(binnacleBackMesh);

  // Dynamic Cockpit PointLight (active on all devices; responds to tree canopy flicker & tunnel sodium lamps!)
  const cockpitDynamicLight = new THREE.PointLight(0xfff4d6, 0.95, 1.45, 1.35);
  cockpitDynamicLight.position.set(0.12, interiorFloorY + 0.228, 0.04);
  bodyGroup.add(cockpitDynamicLight);

  // 4F. Deep-Dish 3D Chrome-Bezel Instrument Pods with Crisp High-Contrast Dial Faces & Precision Needles
  const needleColor = is911 ? 0xef4444 : isBritish || isProto ? 0xf8fafc : 0xf97316;
  const needleBladeMat = new THREE.MeshBasicMaterial({ color: needleColor });
  const needleTipMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const needleCapMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.92,
    roughness: 0.14,
  });
  const gaugeDialMaterials: THREE.MeshBasicMaterial[] = [];

  const createGaugePod = (
    x: number,
    y: number,
    z: number,
    radius: number,
    faceTexture: THREE.CanvasTexture
  ): THREE.Group => {
    const podGroup = new THREE.Group();
    podGroup.position.set(x, y, z);

    // Stepped double-ring chrome Smiths/Veglia bezel
    const outerBezel = new THREE.Mesh(
      new THREE.TorusGeometry(radius, radius * 0.105, 14, 32),
      chromeMat
    );
    const innerBezelLip = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.91, radius * 0.045, 10, 28),
      brushedAlumMat
    );
    innerBezelLip.position.z = -0.002;
    podGroup.add(outerBezel, innerBezelLip);

    // Deep housing barrel positioned strictly forward (+Z) so its back cap never covers the dial face!
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.99, radius * 0.99, 0.018, 28).rotateX(Math.PI / 2),
      darkTrimMat
    );
    barrel.position.z = 0.011;
    podGroup.add(barrel);

    // High-contrast dial face clearly visible in front of the barrel (-Z faces driver)
    const dialMat = new THREE.MeshBasicMaterial({ map: faceTexture, color: 0xffffff });
    gaugeDialMaterials.push(dialMat);
    const dialFace = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.92, 32), dialMat);
    dialFace.rotation.y = Math.PI;
    dialFace.position.z = -0.0015;
    podGroup.add(dialFace);

    const needlePivot = new THREE.Group();
    needlePivot.position.z = -0.0045;

    const needleLen = radius * 0.78;
    const CounterweightTail = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.08, needleLen * 0.24, 0.002),
      needleBladeMat
    );
    CounterweightTail.position.y = -needleLen * 0.10;

    const needleBlade = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.062, needleLen, 0.002),
      needleBladeMat
    );
    needleBlade.position.y = needleLen * 0.36;

    const needleTip = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.048, needleLen * 0.34, 0.0025),
      needleTipMat
    );
    needleTip.position.y = needleLen * 0.58;

    const centerBoss = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.15, radius * 0.15, 0.006, 16).rotateX(Math.PI / 2),
      needleCapMat
    );
    needlePivot.add(CounterweightTail, needleBlade, needleTip, centerBoss);
    podGroup.add(needlePivot);

    bodyGroup.add(podGroup);
    return needlePivot;
  };

  // Symmetrical Primary Gauges centered on x = 0.190 inside the arched binnacle above the steering wheel crown:
  // Left Primary Gauge: Speedometer (0–320 KM/H) at x = 0.236 (0.190 + 0.046), y = interiorFloorY + 0.178
  const speedoNeedlePivot = createGaugePod(
    0.236,
    interiorFloorY + 0.178,
    0.126,
    0.040,
    getSpeedometerDialFaceTexture(spec.bodyStyle, maxAnisotropy)
  );

  // Right Primary Gauge: Tachometer (0–9000 RPM) at x = 0.144 (0.190 - 0.046), y = interiorFloorY + 0.178
  const tachNeedlePivot = createGaugePod(
    0.144,
    interiorFloorY + 0.178,
    0.126,
    0.040,
    getTachometerDialFaceTexture(spec.bodyStyle, maxAnisotropy)
  );

  // 3-Stage Sequential RPM Shift-Light Array (Green 6350 -> Amber 6800 -> Red 7050 RPM) centered at x = 0.190
  const shiftGreenMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: new THREE.Color(0x22c55e),
    emissiveIntensity: 0.15,
    roughness: 0.18,
  });
  const shiftAmberMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: new THREE.Color(0xf59e0b),
    emissiveIntensity: 0.15,
    roughness: 0.18,
  });
  const shiftLightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: new THREE.Color(0xef4444),
    emissiveIntensity: 0.25,
    roughness: 0.16,
  });

  const shiftLampSpecs: Array<{ x: number; y: number; r: number; mat: THREE.MeshStandardMaterial }> = [
    { x: 0.205, y: interiorFloorY + 0.210, r: 0.0054, mat: shiftGreenMat },
    { x: 0.190, y: interiorFloorY + 0.214, r: 0.0064, mat: shiftAmberMat },
    { x: 0.175, y: interiorFloorY + 0.210, r: 0.0070, mat: shiftLightMat },
  ];
  for (const lamp of shiftLampSpecs) {
    const bezel = new THREE.Mesh(
      new THREE.CylinderGeometry(lamp.r * 1.15, lamp.r * 1.32, 0.016, 16).rotateX(Math.PI / 2),
      chromeMat
    );
    bezel.position.set(lamp.x, lamp.y, 0.128);
    const jewel = new THREE.Mesh(new THREE.SphereGeometry(lamp.r, 14, 14), lamp.mat);
    jewel.position.set(lamp.x, lamp.y, 0.121);
    bodyGroup.add(bezel, jewel);
  }

  // Four Center Console Auxiliary Gauges: Oil Pressure, Water Temp, Fuel Level, and Ammeter
  // Evenly spaced at x = 0.004, -0.042, -0.088, -0.134 with radius = 0.0205 so they never collide with the Halda Twinmaster!
  const oilNeedlePivot = createGaugePod(
    0.004,
    interiorFloorY + 0.172,
    0.129,
    0.0205,
    getAuxDialFaceTexture(isBritish || isProto ? 'OIL' : 'OLIO', 'BAR', spec.bodyStyle, maxAnisotropy)
  );
  const waterNeedlePivot = createGaugePod(
    -0.042,
    interiorFloorY + 0.172,
    0.129,
    0.0205,
    getAuxDialFaceTexture(isBritish || isProto ? 'WATER' : 'ACQUA', '°C', spec.bodyStyle, maxAnisotropy)
  );
  const fuelNeedlePivot = createGaugePod(
    -0.088,
    interiorFloorY + 0.172,
    0.129,
    0.0205,
    getAuxDialFaceTexture(isBritish || isProto ? 'FUEL' : 'BENZINA', 'LITRI', spec.bodyStyle, maxAnisotropy)
  );
  const ampNeedlePivot = createGaugePod(
    -0.134,
    interiorFloorY + 0.172,
    0.129,
    0.0205,
    getAuxDialFaceTexture('AMP', '+/- 30A', spec.bodyStyle, maxAnisotropy)
  );
  ampNeedlePivot.rotation.z = 0.22;

  // Sculpted 1960s Chrome Heater & Defroster Slide Quadrant below Auxiliary Gauges
  const heaterPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.088, 0.018, 0.006),
    chromeMat
  );
  heaterPlate.position.set(-0.088, interiorFloorY + 0.124, 0.132);
  bodyGroup.add(heaterPlate);
  for (let hs = 0; hs < 2; hs++) {
    const slotY = interiorFloorY + 0.127 - hs * 0.006;
    const slotGroove = new THREE.Mesh(
      new THREE.BoxGeometry(0.068, 0.0025, 0.007),
      darkTrimMat
    );
    slotGroove.position.set(-0.088, slotY, 0.131);
    const sliderArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.005, 0.005, 0.016),
      chromeMat
    );
    sliderArm.position.set(-0.096 + hs * 0.024, slotY, 0.124);
    const sliderTip = new THREE.Mesh(
      new THREE.BoxGeometry(0.010, 0.008, 0.006),
      hs === 0 ? new THREE.MeshBasicMaterial({ color: 0xef4444 }) : new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    sliderTip.position.set(-0.096 + hs * 0.024, slotY, 0.116);
    bodyGroup.add(slotGroove, sliderArm, sliderTip);
  }

  // 4G. Passenger Rally Instrument Cluster: Halda Twinmaster Mechanical Computer & Dual Heuer Monte-Carlo Stopwatches
  const haldaGroup = new THREE.Group();
  haldaGroup.position.set(-0.226, interiorFloorY + 0.166, 0.132);
  const haldaHousing = new THREE.Mesh(
    new THREE.BoxGeometry(0.118, 0.058, 0.018),
    darkTrimMat
  );
  haldaHousing.position.z = 0.006;
  const haldaChromeFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.122, 0.062, 0.014),
    chromeMat
  );
  haldaChromeFrame.position.z = 0.004;
  const haldaFaceMat = new THREE.MeshBasicMaterial({
    map: getHaldaTwinmasterTexture(maxAnisotropy),
    color: 0xffffff,
  });
  const haldaFace = new THREE.Mesh(new THREE.PlaneGeometry(0.114, 0.054), haldaFaceMat);
  haldaFace.rotation.y = Math.PI;
  haldaFace.position.z = -0.004;

  // 3D Knurled Reset T-Knobs & Stopwatch Crown Pushers on the Halda/Heuer Cluster
  for (const kx of [-0.042, -0.014]) {
    const resetStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0025, 0.0025, 0.014, 8).rotateX(Math.PI / 2),
      chromeMat
    );
    resetStem.position.set(kx, -0.021, -0.010);
    const resetKnob = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0055, 0.0055, 0.005, 10).rotateX(Math.PI / 2),
      chromeMat
    );
    resetKnob.position.set(kx, -0.021, -0.016);
    haldaGroup.add(resetStem, resetKnob);
  }
  for (const cx of [0.020, 0.044]) {
    const crownPusher = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0035, 0.003, 0.01, 8),
      chromeMat
    );
    crownPusher.position.set(cx, 0.034, 0.001);
    haldaGroup.add(crownPusher);
  }
  haldaGroup.add(haldaHousing, haldaChromeFrame, haldaFace);
  bodyGroup.add(haldaGroup);

  // 4H. Aircraft Toggle Switch Bank, Red Safety Flip-Guard, Starter Push-Button & Jewel Warning Lamps
  const redSafetyMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.3,
    metalness: 0.25,
  });
  const jewelColors = [0x22c55e, 0xf59e0b, 0x38bdf8, 0x22c55e, 0xef4444];

  for (let i = 0; i < 5; i++) {
    const tx = 0.016 - i * 0.028;
    const toggleNut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0055, 0.0065, 0.01, 8).rotateX(Math.PI / 2),
      chromeMat
    );
    toggleNut.position.set(tx, interiorFloorY + 0.124, 0.132);

    const toggleBat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0018, 0.0036, 0.019, 8),
      chromeMat
    );
    toggleBat.position.set(tx, interiorFloorY + 0.122, 0.123);
    toggleBat.rotation.x = i % 2 === 0 ? 0.58 : -0.45;

    // Miniature jewel indicator lamp above each toggle switch
    const jewelColor = jewelColors[i];
    const jewelLamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.0032, 8, 8),
      new THREE.MeshBasicMaterial({ color: jewelColor })
    );
    jewelLamp.position.set(tx, interiorFloorY + 0.134, 0.131);

    bodyGroup.add(toggleNut, toggleBat, jewelLamp);

    // Iconic red anodized flip-up aircraft guard on the first switch (Master Ignition / Fuel Pump)
    if (i === 0) {
      const safetyGuard = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.022, 0.014),
        redSafetyMat
      );
      safetyGuard.position.set(tx, interiorFloorY + 0.133, 0.127);
      safetyGuard.rotation.x = -0.45;
      bodyGroup.add(safetyGuard);
    }
  }

  // Red Engine Starter Push-Button & Knurled Choke/Heater Pull Knobs
  const starterBezel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0085, 0.0095, 0.01, 14).rotateX(Math.PI / 2),
    chromeMat
  );
  starterBezel.position.set(0.048, interiorFloorY + 0.126, 0.132);
  const starterButton = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0065, 0.0065, 0.012, 14).rotateX(Math.PI / 2),
    redSafetyMat
  );
  starterButton.position.set(0.048, interiorFloorY + 0.126, 0.129);
  bodyGroup.add(starterBezel, starterButton);

  // Passenger Chrome Rally Grab Handle with twin standoffs
  const passengerGrabBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0055, 0.0055, 0.14, 12).rotateZ(Math.PI / 2),
    chromeMat
  );
  passengerGrabBar.position.set(-0.226, interiorFloorY + 0.120, 0.120);
  for (const gx of [-0.285, -0.165]) {
    const standoff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.007, 0.02, 10).rotateX(Math.PI / 2),
      chromeMat
    );
    standoff.position.set(gx, interiorFloorY + 0.120, 0.129);
    bodyGroup.add(standoff);
  }
  bodyGroup.add(passengerGrabBar);

  // 4I. Classic 1960s Dash-Cowl Chrome Stalk Rearview Mirror with Beveled Frame & Anti-Dazzle Flip Tab
  const intMirrorGroup = new THREE.Group();
  intMirrorGroup.position.set(0.0, interiorFloorY + 0.196, 0.24);
  const intMirrorBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.012, 0.008, 12),
    chromeMat
  );
  intMirrorBase.position.y = -0.032;
  const intMirrorStalk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0032, 0.0048, 0.038, 10),
    chromeMat
  );
  intMirrorStalk.position.y = -0.015;
  intMirrorStalk.rotation.x = -0.15;
  const intMirrorFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.122, 0.032, 0.010),
    chromeMat
  );
  const intMirrorGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.115, 0.026),
    new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.96,
      roughness: 0.05,
    })
  );
  intMirrorGlass.rotation.y = Math.PI;
  intMirrorGlass.position.z = -0.0055;
  const antiDazzleTab = new THREE.Mesh(
    new THREE.BoxGeometry(0.014, 0.007, 0.008),
    darkTrimMat
  );
  antiDazzleTab.position.set(0, -0.018, -0.003);
  intMirrorGroup.add(intMirrorBase, intMirrorStalk, intMirrorFrame, intMirrorGlass, antiDazzleTab);
  bodyGroup.add(intMirrorGroup);

  // 4J. Precision-Scaled Nardi Slotted 3-Spoke Steering Wheel, Centered Column Nacelle, Stalks & Ignition Key
  // Strictly centered on the driver column centerline (x = 0.190) across all 4 classic car models,
  // positioned forward at z = 0.058, y = interiorFloorY + 0.080 with wheelRadiusCockpit = 0.068
  // so the entire wheel rim, hub, and gloved hands sit cleanly below the Speedometer & Tachometer sightline with 0% dial obstruction!
  const steeringColumnCenterX = 0.190;
  const steeringWheelPivot = new THREE.Group();
  steeringWheelPivot.position.set(steeringColumnCenterX, interiorFloorY + 0.080, 0.058);
  steeringWheelPivot.rotation.x = -0.08;

  const steeringColumnNacelle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.022, 0.082, 16).rotateX(Math.PI / 2),
    crackleDashMat
  );
  steeringColumnNacelle.position.set(steeringColumnCenterX, interiorFloorY + 0.083, 0.098);
  steeringColumnNacelle.rotation.x = -0.08;

  // Concentric chrome column collar where the steering shaft enters the nacelle
  const steeringColumnCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.008, 16).rotateX(Math.PI / 2),
    chromeMat
  );
  steeringColumnCollar.position.set(steeringColumnCenterX, interiorFloorY + 0.080, 0.062);
  steeringColumnCollar.rotation.x = -0.08;
  bodyGroup.add(steeringColumnNacelle, steeringColumnCollar);

  // Left & Right Chrome Column Stalks symmetrically aligned on steeringColumnCenterX (x = 0.190)
  for (const stalkSide of [-1, 1]) {
    const stalkRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0020, 0.0026, 0.058, 8).rotateZ(Math.PI / 2),
      chromeMat
    );
    stalkRod.position.set(steeringColumnCenterX + stalkSide * 0.034, interiorFloorY + 0.082, 0.084);
    const stalkTip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0038, 0.0030, 0.013, 10).rotateZ(Math.PI / 2),
      darkTrimMat
    );
    stalkTip.position.set(steeringColumnCenterX + stalkSide * 0.064, interiorFloorY + 0.082, 0.084);
    bodyGroup.add(stalkRod, stalkTip);
  }

  // Ignition Lock Cylinder with Chrome Bezel, Brass Key & Dangling Leather Fob on Right of Column
  const ignitionBezel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0095, 0.011, 0.012, 14).rotateX(Math.PI / 2),
    chromeMat
  );
  ignitionBezel.position.set(0.072, interiorFloorY + 0.118, 0.131);
  const ignitionKeyBlade = new THREE.Mesh(
    new THREE.BoxGeometry(0.008, 0.003, 0.018),
    brassMat
  );
  ignitionKeyBlade.position.set(0.072, interiorFloorY + 0.118, 0.120);
  const ignitionKeyFob = new THREE.Mesh(
    new THREE.BoxGeometry(0.014, 0.026, 0.004),
    binnacleLeatherMat
  );
  ignitionKeyFob.position.set(0.072, interiorFloorY + 0.102, 0.112);
  ignitionKeyFob.rotation.z = 0.22;
  bodyGroup.add(ignitionBezel, ignitionKeyBlade, ignitionKeyFob);

  const wheelRadiusCockpit = 0.068;
  const wheelRim = new THREE.Mesh(
    new THREE.TorusGeometry(wheelRadiusCockpit, 0.0076, 18, 48),
    mahoganyWheelMat
  );
  const wheelRivetRing = new THREE.Mesh(
    new THREE.TorusGeometry(wheelRadiusCockpit, 0.0080, 8, 36),
    chromeMat
  );
  wheelRivetRing.scale.set(1, 1, 0.22);

  // Top-center yellow leather rally centering stripe on steering wheel rim
  const topCenterMarker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0082, 0.0082, 0.013, 12).rotateZ(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xfacc15 })
  );
  topCenterMarker.position.set(0, wheelRadiusCockpit, 0);

  // 3 Slotted Brushed-Alloy Spokes angled at 8-and-4 o'clock (-0.34, Math.PI + 0.34, -Math.PI/2)
  for (const spokeAngle of [-0.34, Math.PI + 0.34, -Math.PI / 2]) {
    const spokeGroup = new THREE.Group();
    spokeGroup.rotation.z = spokeAngle;
    const spokeBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.060, 0.0105, 0.0038),
      brushedAlumMat
    );
    spokeBar.position.x = 0.035;
    spokeGroup.add(spokeBar);

    // Three graduated circular lightening holes along each alloy spoke
    for (const [hx, hr] of [
      [0.022, 0.0032],
      [0.035, 0.0029],
      [0.047, 0.0025],
    ] as const) {
      const holeBezel = new THREE.Mesh(
        new THREE.CylinderGeometry(hr, hr, 0.0046, 12).rotateX(Math.PI / 2),
        darkTrimMat
      );
      holeBezel.position.x = hx;
      spokeGroup.add(holeBezel);
    }
    steeringWheelPivot.add(spokeGroup);
  }

  // Machined 6-Bolt Alloy Hub Boss & Enameled Marque Horn Button
  const hubCenter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0155, 0.017, 0.011, 20).rotateX(Math.PI / 2),
    chromeMat
  );
  for (let b = 0; b < 6; b++) {
    const ba = (b * Math.PI) / 3;
    const hexBolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0014, 0.0014, 0.012, 6).rotateX(Math.PI / 2),
      darkTrimMat
    );
    hexBolt.position.set(Math.cos(ba) * 0.0115, Math.sin(ba) * 0.0115, -0.001);
    steeringWheelPivot.add(hexBolt);
  }

  const hornAccentColor = isBritish
    ? 0x0f4c3a
    : is911
    ? 0xb45309
    : isProto
    ? 0x1e3a8a
    : 0xfacc15;
  const hornButton = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0092, 0.0092, 0.013, 18).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: hornAccentColor, roughness: 0.25, metalness: 0.3 })
  );
  steeringWheelPivot.add(wheelRim, wheelRivetRing, topCenterMarker, hubCenter, hornButton);

  // 4K. Articulated Stringback Driving Gloves, Vintage Heuer Wristwatch & Nomex Racing Forearms
  const driverArmsGroup = new THREE.Group();
  const gloveLeatherMat = new THREE.MeshStandardMaterial({
    color: 0xc26a1b,
    roughness: 0.46,
    metalness: 0.05,
  });
  const gloveCutoutSkinMat = new THREE.MeshStandardMaterial({
    color: 0xeab676,
    roughness: 0.65,
  });
  const nomexSleeveMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.72,
    metalness: 0.04,
  });

  for (const side of [-1, 1]) {
    const handGroup = new THREE.Group();
    const gripX = side * 0.064;
    const gripY = -0.012;
    handGroup.position.set(gripX, gripY, -0.002);
    handGroup.scale.setScalar(0.76);

    const palmMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.038, 0.026),
      gloveLeatherMat
    );
    palmMesh.rotation.z = -side * 0.18;

    // Classic 1960s driving glove dorsal circular cutout with snap button
    const dorsalOpening = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0078, 0.0078, 0.004, 12).rotateX(Math.PI / 2),
      gloveCutoutSkinMat
    );
    dorsalOpening.position.set(0, -0.003, -0.013);

    const knucklesMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0135, 0.0135, 0.036, 12),
      gloveLeatherMat
    );
    knucklesMesh.position.set(0, 0, 0.008);
    knucklesMesh.rotation.z = -side * 0.18;

    const thumbMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0065, 0.0080, 0.029, 10),
      gloveLeatherMat
    );
    thumbMesh.position.set(-side * 0.015, 0.014, -0.003);
    thumbMesh.rotation.z = side * 0.48;

    const wristCuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.0185, 0.026, 12).rotateX(Math.PI / 2),
      binnacleLeatherMat
    );
    wristCuff.position.set(side * 0.004, -0.015, -0.02);
    wristCuff.rotation.x = 0.42;

    // Vintage Heuer Carrera Chronograph wristwatch on the driver's left wrist (side === 1 in car local +X)
    if (side === 1) {
      const watchCase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0088, 0.0088, 0.006, 14),
        chromeMat
      );
      watchCase.position.set(0.004, -0.012, -0.032);
      watchCase.rotation.x = 0.42;
      const watchDial = new THREE.Mesh(
        new THREE.CircleGeometry(0.0072, 14),
        new THREE.MeshBasicMaterial({ color: 0x090b10 })
      );
      watchDial.position.set(0.004, -0.009, -0.033);
      watchDial.rotation.x = -Math.PI / 2 + 0.42;
      handGroup.add(watchCase, watchDial);
    }

    // Sculpted Nomex racing suit forearm extending back toward the driver's seat
    const forearmSleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0185, 0.025, 0.135, 12).rotateX(Math.PI / 2),
      nomexSleeveMat
    );
    forearmSleeve.position.set(side * 0.016, -0.046, -0.082);
    forearmSleeve.rotation.x = 0.46;
    forearmSleeve.rotation.y = -side * 0.14;

    handGroup.add(palmMesh, dorsalOpening, knucklesMesh, thumbMesh, wristCuff, forearmSleeve);
    driverArmsGroup.add(handGroup);
  }

  steeringWheelPivot.add(driverArmsGroup);
  bodyGroup.add(steeringWheelPivot);

  // 4L. Center Tunnel Open-Gate 5-Speed Shift Tower (Positioned at z = -0.048 so the knob never blocks the auxiliary gauges!)
  const gearTowerX = 0.012;
  const gearTowerZ = -0.048;
  const gearGate = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.020, 0.090), chromeMat);
  gearGate.position.set(gearTowerX, interiorFloorY + 0.125, gearTowerZ);
  const gearGateRecess = new THREE.Mesh(
    new THREE.BoxGeometry(0.054, 0.019, 0.074),
    darkTrimMat
  );
  gearGateRecess.position.set(gearTowerX, interiorFloorY + 0.126, gearTowerZ);
  bodyGroup.add(gearGate, gearGateRecess);

  // Individual milled chrome H-pattern gate fingers on Italian & British GTs; ribbed rubber gaiter boot on 911/GT40
  if (is911 || isProto) {
    for (let b = 0; b < 3; b++) {
      const bootRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024 - b * 0.004, 0.028 - b * 0.004, 0.010, 14),
        darkTrimMat
      );
      bootRing.position.set(gearTowerX, interiorFloorY + 0.133 + b * 0.008, gearTowerZ);
      bodyGroup.add(bootRing);
    }
  } else {
    for (const gx of [-0.011, 0.011]) {
      for (const gz of [-0.016, 0.016]) {
        const finger = new THREE.Mesh(
          new THREE.BoxGeometry(0.0045, 0.004, 0.026),
          chromeMat
        );
        finger.position.set(gearTowerX + gx, interiorFloorY + 0.135, gearTowerZ + gz);
        bodyGroup.add(finger);
      }
    }
  }

  const gearShifterPivot = new THREE.Group();
  gearShifterPivot.position.set(gearTowerX, interiorFloorY + 0.112, gearTowerZ);
  const gearLever = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0038, 0.0058, 0.042, 12),
    chromeMat
  );
  gearLever.position.set(0, 0.021, 0);
  const gearLockCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0066, 0.0066, 0.008, 12),
    chromeMat
  );
  gearLockCollar.position.set(0, 0.034, 0);
  const gearKnob = new THREE.Mesh(
    new THREE.SphereGeometry(0.0132, 16, 16),
    is911 || isProto ? darkTrimMat : mahoganyWheelMat
  );
  gearKnob.position.set(0, 0.044, 0);
  const gearPatternCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0076, 0.0076, 0.0035, 14),
    chromeMat
  );
  gearPatternCap.position.set(0, 0.055, 0);
  gearShifterPivot.add(gearLever, gearLockCollar, gearKnob, gearPatternCap);
  gearShifterPivot.rotation.x = -0.10;
  bodyGroup.add(gearShifterPivot);

  // Chrome Fly-Off Mechanical Handbrake Lever alongside Center Tunnel
  const handbrakeGroup = new THREE.Group();
  handbrakeGroup.position.set(-0.068, interiorFloorY + 0.092, -0.06);
  const hbRatchet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 0.008, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2),
    chromeMat
  );
  const hbLever = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0045, 0.006, 0.13, 10).rotateX(Math.PI / 2),
    chromeMat
  );
  hbLever.position.set(0, 0.026, 0.045);
  hbLever.rotation.x = -0.36;
  const hbGrip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0075, 0.0075, 0.048, 10).rotateX(Math.PI / 2),
    binnacleLeatherMat
  );
  hbGrip.position.set(0, 0.042, 0.088);
  hbGrip.rotation.x = -0.36;
  handbrakeGroup.add(hbRatchet, hbLever, hbGrip);
  bodyGroup.add(handbrakeGroup);

  // Red Halon Competition Fire Extinguisher Bottle with Quick-Release Chrome Straps in Passenger Footwell
  const extinguisherGroup = new THREE.Group();
  extinguisherGroup.position.set(-0.105, interiorFloorY + 0.062, 0.06);
  const extBottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 0.16, 14).rotateX(Math.PI / 2),
    redSafetyMat
  );
  const extNozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.012, 0.028, 10).rotateX(Math.PI / 2),
    brassMat
  );
  extNozzle.position.z = 0.09;
  for (const sz of [-0.045, 0.045]) {
    const strap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0255, 0.0255, 0.012, 14).rotateX(Math.PI / 2),
      chromeMat
    );
    strap.position.z = sz;
    extinguisherGroup.add(strap);
  }
  extinguisherGroup.add(extBottle, extNozzle);
  bodyGroup.add(extinguisherGroup);

  // 4M. Deep-Bolstered Historic Bucket Seats, 4-Point Sabelt/Willans Harnesses & Braced Roll Hoop
  const harnessMat = new THREE.MeshStandardMaterial({
    color: isBritish ? 0x1e3a8a : 0xdc2626,
    roughness: 0.52,
  });
  for (const sx of [-0.19, 0.19]) {
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.25, 0.055), upholsteryMat);
    seatBack.position.set(sx, interiorFloorY + 0.125, -0.34);
    seatBack.rotation.x = -0.16;

    const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.26), upholsteryMat);
    seatBase.position.set(sx, interiorFloorY + 0.028, -0.18);

    // Sculpted lateral kidney & thigh side bolsters wrapping each bucket seat
    for (const bSide of [-1, 1]) {
      const sideBolster = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.034, 0.24, 12),
        binnacleLeatherMat
      );
      sideBolster.position.set(sx + bSide * 0.122, interiorFloorY + 0.12, -0.31);
      sideBolster.rotation.x = -0.16;

      const thighBolster = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.028, 0.25, 12).rotateX(Math.PI / 2),
        binnacleLeatherMat
      );
      thighBolster.position.set(sx + bSide * 0.122, interiorFloorY + 0.052, -0.18);
      bodyGroup.add(sideBolster, thighBolster);
    }

    // Period cylindrical leather headrest pad
    const headrest = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, 0.15, 14).rotateZ(Math.PI / 2),
      binnacleLeatherMat
    );
    headrest.position.set(sx, interiorFloorY + 0.265, -0.365);
    bodyGroup.add(seatBack, seatBase, headrest);

    for (const hx of [-0.055, 0.055]) {
      const belt = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.22, 0.014), harnessMat);
      belt.position.set(sx + hx, interiorFloorY + 0.125, -0.30);
      belt.rotation.x = -0.16;
      bodyGroup.add(belt);
    }
    const camLockBuckle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.012, 12).rotateX(Math.PI / 2),
      chromeMat
    );
    camLockBuckle.position.set(sx, interiorFloorY + 0.085, -0.28);
    bodyGroup.add(camLockBuckle);
  }

  const helmetGroup = new THREE.Group();
  helmetGroup.position.set(0.19, interiorFloorY + 0.25, -0.22);
  const helmetShell = new THREE.Mesh(
    new THREE.SphereGeometry(0.102, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.15 })
  );
  const helmetVisor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 0.055, 16, 1, false, -Math.PI * 0.35, Math.PI * 0.7),
    darkTrimMat
  );
  helmetVisor.position.set(0, 0.01, 0.008);
  helmetGroup.add(helmetShell, helmetVisor);
  bodyGroup.add(helmetGroup);

  // Rear Tubular FIA Roll Hoop with Harness Crossbar & Diagonal Rear Stays (strictly behind seats!)
  const rollBar = new THREE.Mesh(
    new THREE.TorusGeometry(0.185, 0.014, 12, 24, Math.PI),
    chromeMat
  );
  rollBar.position.set(0, interiorFloorY + 0.11, -0.39);
  const rollCrossbar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.011, 0.36, 10).rotateZ(Math.PI / 2),
    chromeMat
  );
  rollCrossbar.position.set(0, interiorFloorY + 0.18, -0.39);
  bodyGroup.add(rollBar, rollCrossbar);

  // Working Chrome Windshield Wipers (parked horizontally along base cowl when dry)
  const wiperCowlZ = isProto ? 0.64 : 0.53;
  const wiperCowlSurf = evalSurfaceAt(0.16, wiperCowlZ);
  const wiperLeft = new THREE.Group();
  wiperLeft.position.set(-0.16, wiperCowlSurf.y + 0.005, wiperCowlZ);
  wiperLeft.rotation.x = -0.64;
  wiperLeft.rotation.z = 1.42;
  const wiperArmL = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.21, 0.008), chromeMat);
  wiperArmL.position.y = 0.105;
  wiperLeft.add(wiperArmL);

  const wiperRight = new THREE.Group();
  wiperRight.position.set(0.16, wiperCowlSurf.y + 0.005, wiperCowlZ);
  wiperRight.rotation.x = -0.64;
  wiperRight.rotation.z = 1.42;
  const wiperArmR = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.21, 0.008), chromeMat);
  wiperArmR.position.y = 0.105;
  wiperRight.add(wiperArmR);
  bodyGroup.add(wiperLeft, wiperRight);

  // Chrome Talbot Bullet Wing Mirrors
  const mirrorZ = isBritish ? 0.78 : 0.48;
  const mirrorXAbs = bodyWidth * 0.375;
  const mirrorSurf = evalSurfaceAt(mirrorXAbs, mirrorZ);
  const mirrorConeGeo = new THREE.ConeGeometry(0.038, 0.125, 16).rotateX(-Math.PI / 2);
  const mirrorGlassGeo = new THREE.CircleGeometry(0.034, 16).rotateY(Math.PI);
  const mirrorStalkGeo = new THREE.BoxGeometry(0.012, 0.042, 0.028);

  for (const side of [-1, 1]) {
    const mGroup = new THREE.Group();
    mGroup.position.set(side * mirrorXAbs, mirrorSurf.y + 0.028, mirrorZ);
    const stalk = new THREE.Mesh(mirrorStalkGeo, chromeMat);
    stalk.position.set(0, -0.016, 0);
    stalk.rotation.z = -side * 0.18;
    const bulletHousing = new THREE.Mesh(mirrorConeGeo, chromeMat);
    const mirrorLens = new THREE.Mesh(mirrorGlassGeo, chromeMat);
    mirrorLens.position.z = -0.063;
    mGroup.add(stalk, bulletHousing, mirrorLens);
    bodyGroup.add(mGroup);
  }

  // 5. Sculpted Front Radiator Egg-Crate Grille, Contoured Wrap-Around Chrome Bumpers, Overriders, Aero Chin Spoiler & Recessed Headlamps
  const noseSurf = evalSurfaceAt(0, halfLen - 0.02);
  const noseHalfW = noseSurf.stationHalfW;
  const noseDeckY = noseSurf.y;
  const grilleY = Math.min(0.258, noseDeckY - 0.115);
  const grilleW = noseHalfW * 0.88;
  const grilleH = 0.114;

  const grilleRecess = new THREE.Mesh(
    new THREE.BoxGeometry(grilleW, grilleH, 0.020),
    darkTrimMat
  );
  grilleRecess.position.set(0, grilleY, halfLen + 0.004);

  const grilleSurround = new THREE.Mesh(
    new THREE.BoxGeometry(grilleW + 0.028, grilleH + 0.024, 0.018),
    chromeMat
  );
  grilleSurround.position.set(0, grilleY, halfLen + 0.002);
  frontNosePivot.add(grilleRecess, grilleSurround);

  for (const gy of [grilleY - 0.026, grilleY, grilleY + 0.026]) {
    const hBar = new THREE.Mesh(new THREE.BoxGeometry(grilleW - 0.016, 0.006, 0.014), chromeMat);
    hBar.position.set(0, gy, halfLen + 0.013);
    frontNosePivot.add(hBar);
  }
  for (let vx = -3; vx <= 3; vx++) {
    const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.0045, grilleH - 0.012, 0.012), brushedAlumMat);
    vBar.position.set(vx * (grilleW * 0.125), grilleY, halfLen + 0.012);
    frontNosePivot.add(vBar);
  }

  const fogBezelGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.024, 16).rotateX(Math.PI / 2);
  const fogLensGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.028, 16).rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    const fogX = side * (grilleW * 0.34);
    const fBezel = new THREE.Mesh(fogBezelGeo, chromeMat);
    fBezel.position.set(fogX, grilleY, halfLen + 0.016);
    const fLens = new THREE.Mesh(fogLensGeo, fogLightMat);
    fLens.position.set(fogX, grilleY, halfLen + 0.019);
    frontNosePivot.add(fBezel, fLens);
  }

  // Tapered front chin spoiler / aero splitter strictly within the lower nose sill width
  const chinSplitterW = noseHalfW * 1.66;
  const chinSplitter = new THREE.Mesh(
    new THREE.BoxGeometry(chinSplitterW, 0.028, 0.08),
    darkTrimMat
  );
  chinSplitter.position.set(0, 0.172, halfLen - 0.005);
  const chinLipTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, chinSplitterW, 14).rotateZ(Math.PI / 2),
    darkTrimMat
  );
  chinLipTube.position.set(0, 0.172, halfLen + 0.032);
  frontNosePivot.add(chinSplitter, chinLipTube);

  // Contoured 3D Wrap-Around Chrome Front Bumper Assembly with Chassis Mounting Brackets & Vertical Overriders
  const frontBumperY = 0.214;
  if (isBritish || is911) {
    // Full-width compound-curved wrap-around chrome front bumper blade wrapping outside the nose corners
    const fbPts = [
      new THREE.Vector3(-noseHalfW * 0.98, frontBumperY, halfLen - 0.055),
      new THREE.Vector3(-noseHalfW * 0.92, frontBumperY, halfLen + 0.028),
      new THREE.Vector3(-noseHalfW * 0.50, frontBumperY, halfLen + 0.044),
      new THREE.Vector3(0, frontBumperY, halfLen + 0.050),
      new THREE.Vector3(noseHalfW * 0.50, frontBumperY, halfLen + 0.044),
      new THREE.Vector3(noseHalfW * 0.92, frontBumperY, halfLen + 0.028),
      new THREE.Vector3(noseHalfW * 0.98, frontBumperY, halfLen - 0.055),
    ];
    const fbCurve = new THREE.CatmullRomCurve3(fbPts);
    const fbBladeGeo = new THREE.TubeGeometry(fbCurve, 36, 0.024, 16, false);
    const fbBladeMesh = new THREE.Mesh(fbBladeGeo, chromeMat);
    const fbRubGeo = new THREE.TubeGeometry(fbCurve, 36, 0.011, 12, false);
    const fbRubMesh = new THREE.Mesh(fbRubGeo, darkTrimMat);
    fbRubMesh.position.z = 0.016;
    frontNosePivot.add(fbBladeMesh, fbRubMesh);
  } else {
    // Sculpted split quarter-bumperettes wrapping smoothly around each front nose corner (Italian GT & Proto)
    for (const side of [-1, 1]) {
      const qbPts = [
        new THREE.Vector3(side * (noseHalfW * 0.32), frontBumperY, halfLen + 0.042),
        new THREE.Vector3(side * (noseHalfW * 0.64), frontBumperY, halfLen + 0.038),
        new THREE.Vector3(side * (noseHalfW * 0.92), frontBumperY, halfLen + 0.026),
        new THREE.Vector3(side * (noseHalfW * 0.98), frontBumperY, halfLen - 0.055),
      ];
      const qbCurve = new THREE.CatmullRomCurve3(qbPts);
      const qbGeo = new THREE.TubeGeometry(qbCurve, 24, 0.024, 16, false);
      const qbMesh = new THREE.Mesh(qbGeo, chromeMat);
      const qbRubGeo = new THREE.TubeGeometry(qbCurve, 24, 0.011, 12, false);
      const qbRubMesh = new THREE.Mesh(qbRubGeo, darkTrimMat);
      qbRubMesh.position.z = 0.015;
      frontNosePivot.add(qbMesh, qbRubMesh);
    }
  }

  // Front Bumper Mounting Irons & Classic Chrome Vertical Overriders with Black Rubber Impact Pads
  for (const side of [-1, 1]) {
    const overX = side * (noseHalfW * 0.38);
    const mountIron = new THREE.Mesh(
      new THREE.BoxGeometry(0.026, 0.024, 0.048),
      darkTrimMat
    );
    mountIron.position.set(overX, frontBumperY, halfLen + 0.018);

    const overriderBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.082, 0.036),
      chromeMat
    );
    overriderBody.position.set(overX, frontBumperY + 0.008, halfLen + 0.042);

    const overriderPad = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.068, 0.012),
      darkTrimMat
    );
    overriderPad.position.set(overX, frontBumperY + 0.008, halfLen + 0.058);
    frontNosePivot.add(mountIron, overriderBody, overriderPad);
  }

  // Fender-Integrated Headlamps with Chrome Bezels emerging cleanly from the front pontoon fenders
  const lampXAbs = noseHalfW * 0.68;
  const lampZ = halfLen + 0.004;
  const lampSurf = evalSurfaceAt(lampXAbs, halfLen - 0.04);
  const lampY = Math.min(lampSurf.y - 0.048, is911 ? 0.365 : isProto ? 0.305 : 0.335);
  const lampRadius = isProto ? 0.068 : 0.076;
  const lampBucketGeo = new THREE.CylinderGeometry(lampRadius * 1.04, lampRadius * 1.10, 0.09, 20).rotateX(Math.PI / 2);
  const lampBezelGeo = new THREE.CylinderGeometry(lampRadius, lampRadius * 1.04, 0.032, 20).rotateX(Math.PI / 2);
  const lampLensGeo = new THREE.CylinderGeometry(lampRadius * 0.86, lampRadius * 0.86, 0.038, 20).rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    const bucket = new THREE.Mesh(lampBucketGeo, bodyPaintMat);
    bucket.position.set(side * lampXAbs, lampY, lampZ - 0.028);
    const bezel = new THREE.Mesh(lampBezelGeo, chromeMat);
    bezel.position.set(side * lampXAbs, lampY, lampZ + 0.006);
    const lens = new THREE.Mesh(lampLensGeo, headlightMat);
    lens.position.set(side * lampXAbs, lampY, lampZ + 0.010);
    frontNosePivot.add(bucket, bezel, lens);

    // Front Fender Corner Amber Indicator / Marker Lamp with Chrome Bezel
    const markerX = side * (noseHalfW * 0.83);
    const markerY = frontBumperY + 0.048;
    const markerBezel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.024, 0.020, 14).rotateX(Math.PI / 2),
      chromeMat
    );
    markerBezel.position.set(markerX, markerY, halfLen + 0.006);
    const markerLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.017, 0.017, 0.024, 14).rotateX(Math.PI / 2),
      amberTurnMat
    );
    markerLens.position.set(markerX, markerY, halfLen + 0.009);
    frontNosePivot.add(markerBezel, markerLens);
  }

  // FIA Scrutineering Painted Steel Front Tow Loop
  const towHookMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    roughness: 0.35,
    metalness: 0.45,
  });
  const frontTowEye = new THREE.Mesh(
    new THREE.TorusGeometry(0.024, 0.006, 10, 18).rotateX(Math.PI / 2),
    towHookMat
  );
  frontTowEye.position.set(noseHalfW * 0.28, 0.175, halfLen + 0.048);
  frontNosePivot.add(frontTowEye);

  // 6. Sculpted Rear Kammtail Transom, Contoured Wrap-Around Rear Bumpers with Overriders, Taillights, License Plate & Quad Exhausts
  const tailSurf = evalSurfaceAt(0, -halfLen + 0.02);
  const tailHalfW = tailSurf.stationHalfW;
  const transomW = tailHalfW * 1.54; // Stays strictly inside the rear compound-curved quarter flanks on all 4 models!
  const transomY = isProto ? 0.395 : 0.415;

  const rearTransomChromeTrim = new THREE.Mesh(
    new THREE.BoxGeometry(transomW + 0.024, 0.146, 0.016),
    chromeMat
  );
  rearTransomChromeTrim.position.set(0, transomY, -halfLen - 0.006);

  const rearTransomInsert = new THREE.Mesh(
    new THREE.BoxGeometry(transomW, 0.130, 0.016),
    darkTrimMat
  );
  rearTransomInsert.position.set(0, transomY, -halfLen - 0.009);
  rearValenceGroup.add(rearTransomChromeTrim, rearTransomInsert);

  // Recessed Underbody Rear Diffuser Valance with Vertical Aero Strakes
  const rearDiffuserW = tailHalfW * 1.32;
  const rearDiffuser = new THREE.Mesh(
    new THREE.BoxGeometry(rearDiffuserW, 0.088, 0.09),
    darkTrimMat
  );
  rearDiffuser.position.set(0, 0.205, -halfLen - 0.008);
  const diffHousing = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.11, 0.20),
    brushedAlumMat
  );
  diffHousing.position.set(0, 0.225, -halfLen + 0.12);
  rearValenceGroup.add(rearDiffuser, diffHousing);

  for (const fx of [-0.32, -0.14, 0.14, 0.32]) {
    const diffuserFin = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.075, 0.08),
      darkTrimMat
    );
    diffuserFin.position.set(fx, 0.198, -halfLen - 0.018);
    rearValenceGroup.add(diffuserFin);
  }

  // Contoured 3D Wrap-Around Chrome Rear Bumper Assembly with Corner Returns, Mounting Irons & Vertical Overriders
  const rearBumperY = 0.292;
  if (isBritish || is911) {
    // Full-width contoured chrome rear bumper blade wrapping smoothly outside the rear quarter panels
    const rbPts = [
      new THREE.Vector3(-tailHalfW * 0.98, rearBumperY, -halfLen + 0.055),
      new THREE.Vector3(-tailHalfW * 0.92, rearBumperY, -halfLen - 0.030),
      new THREE.Vector3(-tailHalfW * 0.50, rearBumperY, -halfLen - 0.044),
      new THREE.Vector3(0, rearBumperY, -halfLen - 0.048),
      new THREE.Vector3(tailHalfW * 0.50, rearBumperY, -halfLen - 0.044),
      new THREE.Vector3(tailHalfW * 0.92, rearBumperY, -halfLen - 0.030),
      new THREE.Vector3(tailHalfW * 0.98, rearBumperY, -halfLen + 0.055),
    ];
    const rbCurve = new THREE.CatmullRomCurve3(rbPts);
    const rbBladeGeo = new THREE.TubeGeometry(rbCurve, 36, 0.024, 16, false);
    const rbBladeMesh = new THREE.Mesh(rbBladeGeo, chromeMat);
    const rbRubGeo = new THREE.TubeGeometry(rbCurve, 36, 0.011, 12, false);
    const rbRubMesh = new THREE.Mesh(rbRubGeo, darkTrimMat);
    rbRubMesh.position.z = -0.016;
    rearValenceGroup.add(rbBladeMesh, rbRubMesh);
  } else {
    // Sculpted split wrap-around chrome rear quarter-bumperettes (Italian GT & Proto)
    for (const side of [-1, 1]) {
      const rqbPts = [
        new THREE.Vector3(side * 0.24, rearBumperY, -halfLen - 0.042),
        new THREE.Vector3(side * (tailHalfW * 0.58), rearBumperY, -halfLen - 0.040),
        new THREE.Vector3(side * (tailHalfW * 0.92), rearBumperY, -halfLen - 0.028),
        new THREE.Vector3(side * (tailHalfW * 0.98), rearBumperY, -halfLen + 0.055),
      ];
      const rqbCurve = new THREE.CatmullRomCurve3(rqbPts);
      const rqbGeo = new THREE.TubeGeometry(rqbCurve, 24, 0.024, 16, false);
      const rqbMesh = new THREE.Mesh(rqbGeo, chromeMat);
      const rqbRubGeo = new THREE.TubeGeometry(rqbCurve, 24, 0.011, 12, false);
      const rqbRubMesh = new THREE.Mesh(rqbRubGeo, darkTrimMat);
      rqbRubMesh.position.z = -0.015;
      rearValenceGroup.add(rqbMesh, rqbRubMesh);
    }
  }

  // Rear Bumper Mounting Irons & Vertical Chrome Overriders with Rubber Impact Pads
  for (const side of [-1, 1]) {
    const rOverX = side * 0.28;
    const rMountIron = new THREE.Mesh(
      new THREE.BoxGeometry(0.026, 0.024, 0.048),
      darkTrimMat
    );
    rMountIron.position.set(rOverX, rearBumperY, -halfLen - 0.018);

    const rOverriderBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.082, 0.036),
      chromeMat
    );
    rOverriderBody.position.set(rOverX, rearBumperY + 0.008, -halfLen - 0.042);

    const rOverriderPad = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.068, 0.012),
      darkTrimMat
    );
    rOverriderPad.position.set(rOverX, rearBumperY + 0.008, -halfLen - 0.058);
    rearValenceGroup.add(rMountIron, rOverriderBody, rOverriderPad);
  }

  const tailRingGeo = new THREE.CylinderGeometry(0.046, 0.046, 0.024, 18).rotateX(Math.PI / 2);
  const tailLensGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.030, 18).rotateX(Math.PI / 2);
  const turnLensGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.030, 16).rotateX(Math.PI / 2);

  for (const side of [-1, 1]) {
    const outerLampX = transomW * 0.42;
    for (const innerOffset of [0, 0.112]) {
      const lx = side * (outerLampX - innerOffset);
      const tailRing = new THREE.Mesh(tailRingGeo, chromeMat);
      tailRing.position.set(lx, transomY, -halfLen - 0.016);
      const tailLens = new THREE.Mesh(tailLensGeo, brakeLightsMat);
      tailLens.position.set(lx, transomY, -halfLen - 0.020);
      rearValenceGroup.add(tailRing, tailLens);
    }

    const turnX = side * (outerLampX - 0.210);
    const turnRing = new THREE.Mesh(tailRingGeo, chromeMat);
    turnRing.scale.set(0.84, 0.84, 1);
    turnRing.position.set(turnX, transomY, -halfLen - 0.016);
    const turnLens = new THREE.Mesh(turnLensGeo, amberTurnMat);
    turnLens.position.set(turnX, transomY, -halfLen - 0.020);
    rearValenceGroup.add(turnRing, turnLens);
  }

  const plateFrame = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.112, 0.014), chromeMat);
  plateFrame.position.set(0, transomY, -halfLen - 0.016);
  const plateFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.296, 0.096),
    new THREE.MeshBasicMaterial({ map: getVintageLicensePlateTexture() })
  );
  plateFace.position.set(0, transomY, -halfLen - 0.024);
  plateFace.rotation.y = Math.PI;
  rearValenceGroup.add(plateFrame, plateFace);

  const exhaustFlamesGroup = new THREE.Group();
  exhaustFlamesGroup.position.set(0, 0.19, -halfLen - 0.21);
  exhaustFlamesGroup.visible = false;
  rearValenceGroup.add(exhaustFlamesGroup);

  const exhaustOffsets = isBritish
    ? [-0.09, 0.09]
    : [-0.37, -0.25, 0.25, 0.37];

  const outerPipeGeo = new THREE.CylinderGeometry(0.042, 0.052, 0.34, 16).rotateX(Math.PI / 2);
  const innerBoreGeo = new THREE.CylinderGeometry(0.033, 0.033, 0.35, 14).rotateX(Math.PI / 2);
  const flameOuterGeo = new THREE.ConeGeometry(0.048, 0.42, 12)
    .rotateX(-Math.PI / 2)
    .translate(0, 0, -0.21);
  const flameCoreGeo = new THREE.ConeGeometry(0.026, 0.25, 10)
    .rotateX(-Math.PI / 2)
    .translate(0, 0, -0.125);

  const flameOuterMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.88,
  });
  const flameCoreMat = new THREE.MeshBasicMaterial({
    color: 0x60a5fa,
    transparent: true,
    opacity: 0.95,
  });

  const silencerGeo = new THREE.CylinderGeometry(0.056, 0.056, 0.28, 16).rotateX(Math.PI / 2);
  for (const sx of isBritish ? [0] : [-0.31, 0.31]) {
    const silencer = new THREE.Mesh(silencerGeo, brushedAlumMat);
    silencer.position.set(sx, 0.195, -halfLen + 0.18);
    rearValenceGroup.add(silencer);
  }

  const rearTowEye = new THREE.Mesh(
    new THREE.TorusGeometry(0.024, 0.006, 10, 18).rotateX(Math.PI / 2),
    towHookMat
  );
  rearTowEye.position.set(-0.20, 0.20, -halfLen - 0.042);
  rearValenceGroup.add(rearTowEye);

  for (const px of exhaustOffsets) {
    const pipeOuter = new THREE.Mesh(outerPipeGeo, chromeMat);
    pipeOuter.position.set(px, 0.19, -halfLen - 0.04);
    const pipeBore = new THREE.Mesh(innerBoreGeo, darkTrimMat);
    pipeBore.position.set(px, 0.19, -halfLen - 0.045);
    rearValenceGroup.add(pipeOuter, pipeBore);

    const flameOuter = new THREE.Mesh(flameOuterGeo, flameOuterMat);
    flameOuter.position.set(px, 0, 0);
    const flameCore = new THREE.Mesh(flameCoreGeo, flameCoreMat);
    flameCore.position.set(px, 0, 0);
    exhaustFlamesGroup.add(flameOuter, flameCore);
  }

  // 7. Unified Smooth-Profiled Classic Racing Wheels (Zero Protruding Torus Bars!)
  const unifiedTireGeo = getUnifiedTireGeometry(wheelRadius, wheelWidth);

  // Flush flat sidewall ring for the tire compound indicator
  const compoundStripeGeo = new THREE.RingGeometry(wheelRadius * 0.71, wheelRadius * 0.77, 32);
  compoundStripeGeo.rotateY(Math.PI / 2);

  // Deep-dish open-ended rim barrel & recessed inner hub drum
  const wheelRimBarrelGeo = new THREE.CylinderGeometry(
    wheelRadius * 0.60,
    wheelRadius * 0.60,
    wheelWidth * 0.84,
    28,
    1,
    true
  );
  wheelRimBarrelGeo.rotateZ(Math.PI / 2);

  const wheelInnerHubGeo = new THREE.CylinderGeometry(
    wheelRadius * 0.59,
    wheelRadius * 0.59,
    wheelWidth * 0.18,
    24
  );
  wheelInnerHubGeo.rotateZ(Math.PI / 2);

  const caliperMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.75,
    roughness: 0.25,
  });

  const createWheelAssembly = (isLeft: boolean) => {
    const wheelGroup = new THREE.Group();
    const sign = isLeft ? -1 : 1;

    const tire = new THREE.Mesh(unifiedTireGeo, tireMat);
    // Flush Color-coded Tire Compound Sidewall Band on outer sidewall face
    const compoundRing = new THREE.Mesh(compoundStripeGeo, tireCompoundMat);
    compoundRing.position.x = sign * (wheelWidth * 0.483);
    wheelGroup.add(tire, compoundRing);

    const rimBarrel = new THREE.Mesh(wheelRimBarrelGeo, rimMat);
    const innerHub = new THREE.Mesh(wheelInnerHubGeo, rimMat);
    innerHub.position.x = -sign * (wheelWidth * 0.08);
    wheelGroup.add(rimBarrel, innerHub);

    const spokeCount = is911 ? 5 : 10;
    for (let i = 0; i < spokeCount; i++) {
      const angle = (i * Math.PI) / (spokeCount * 0.5);
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(
          0.028,
          wheelRadius * 1.14,
          is911 ? 0.048 : 0.016
        ),
        rimMat
      );
      spoke.position.x = sign * (wheelWidth * 0.22);
      spoke.rotation.x = angle;
      wheelGroup.add(spoke);
    }

    const spinnerHub = new THREE.Mesh(
      new THREE.ConeGeometry(0.042, 0.075, 14).rotateZ(isLeft ? Math.PI / 2 : -Math.PI / 2),
      chromeMat
    );
    spinnerHub.position.x = sign * (wheelWidth * 0.34);
    wheelGroup.add(spinnerHub);

    for (let e = 0; e < 3; e++) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.078, 0.018), chromeMat);
      ear.position.x = sign * (wheelWidth * 0.36);
      ear.rotation.x = (e * Math.PI * 2) / 3;
      wheelGroup.add(ear);
    }

    const brakeDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(wheelRadius * 0.46, wheelRadius * 0.46, 0.026, 20).rotateZ(Math.PI / 2),
      brakeDiscMat
    );
    brakeDisc.position.x = -sign * 0.04;
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.095, 0.065), caliperMat);
    caliper.position.set(-sign * 0.035, 0.075, -0.105);
    wheelGroup.add(brakeDisc, caliper);

    return wheelGroup;
  };

  const frontLeftPivot = new THREE.Group();
  const frontRightPivot = new THREE.Group();
  const flWheel = createWheelAssembly(true);
  const frWheel = createWheelAssembly(false);
  frontLeftPivot.add(flWheel);
  frontRightPivot.add(frWheel);

  const rlWheel = createWheelAssembly(true);
  const rrWheel = createWheelAssembly(false);

  frontLeftPivot.position.set(-trackHalfW, wheelContactY, frontWheelbaseZ);
  frontRightPivot.position.set(trackHalfW, wheelContactY, frontWheelbaseZ);
  rlWheel.position.set(-trackHalfW, wheelContactY, rearWheelbaseZ);
  rrWheel.position.set(trackHalfW, wheelContactY, rearWheelbaseZ);

  bodyGroup.add(frontLeftPivot, frontRightPivot, rlWheel, rrWheel);

  // Fixed Upright Brake Discs & Calipers on the Suspension Hubs (tucked inboard so they never protrude through mounted wheels!)
  for (const side of [-1, 1]) {
    for (const wz of [frontWheelbaseZ, rearWheelbaseZ]) {
      const fixedDisc = new THREE.Mesh(
        new THREE.CylinderGeometry(wheelRadius * 0.46, wheelRadius * 0.46, 0.028, 20).rotateZ(Math.PI / 2),
        brakeDiscMat
      );
      fixedDisc.position.set(side * (trackHalfW - 0.045), wheelContactY, wz);
      const fixedCaliper = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.098, 0.068), caliperMat);
      fixedCaliper.position.set(side * (trackHalfW - 0.04), wheelContactY + 0.075, wz - 0.105);
      const hubSpindle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.032, 0.08, 12).rotateZ(Math.PI / 2),
        chromeMat
      );
      hubSpindle.position.set(side * (trackHalfW - 0.01), wheelContactY, wz);
      bodyGroup.add(fixedDisc, fixedCaliper, hubSpindle);
    }
  }

  return {
    root,
    bodyGroup,
    cabinGroup,
    wheels: [flWheel, frWheel, rlWheel, rrWheel],
    frontLeftPivot,
    frontRightPivot,
    trackHalfW,
    wheelContactY,
    frontWheelbaseZ,
    rearWheelbaseZ,
    brakeLightsMat,
    brakeDiscMat,
    tireCompoundMat,
    bodyPaintMat,
    liveryTexture,
    steeringWheelPivot,
    speedoNeedlePivot,
    tachNeedlePivot,
    oilNeedlePivot,
    waterNeedlePivot,
    fuelNeedlePivot,
    shiftGreenMat,
    shiftAmberMat,
    shiftLightMat,
    cockpitDynamicLight,
    dappledLightSweepMesh,
    dappledLightSweepMat,
    binnacleLeatherMat,
    binnacleBaseHex: binnacleLeatherColor,
    engineTurnedMat,
    crackleDashMat,
    mahoganyWheelMat,
    gloveLeatherMat,
    nomexSleeveMat,
    gaugeDialMaterials,
    haldaFaceMat,
    gearShifterPivot,
    throttlePedalPivot,
    brakePedalPivot,
    driverArmsGroup,
    helmetMesh: helmetGroup,
    wiperLeft,
    wiperRight,
    wiperAngle: 0,
    exhaustFlamesGroup,
    exhaustFlameTimer: 0,
    flameOuterMat,
    flameCoreMat,
    frontNosePivot,
    hoodPivot,
    leftFenderGroup,
    rightFenderGroup,
    rearValenceGroup,
  };
}

/**
 * Builds the 3D Pit Crew Tire-Change Service Rig (`PitCrewServiceRig`)
 * featuring 4 articulated corner wheel mechanics with pneumatic impact wrenches, hub spark bursts,
 * removed/fresh compound tire assemblies, Front & Rear quick-lift tubular jacks with jack men,
 * and the Lollipop Pit Chief.
 */
export function buildPitCrewServiceRig(): PitCrewServiceRig {
  const root = new THREE.Group();
  root.visible = false;

  const coverallMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.68,
    metalness: 0.05,
  });
  const navyTrimMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a8a,
    roughness: 0.6,
    metalness: 0.1,
  });
  const redAccentMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.42,
    metalness: 0.25,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xfed7aa,
    roughness: 0.75,
  });
  const helmetMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.2,
    metalness: 0.15,
  });
  const goggleMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.15,
    metalness: 0.8,
  });
  const chromeToolMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.18,
    metalness: 0.9,
  });
  const darkRubberMat = new THREE.MeshStandardMaterial({
    color: 0x141418,
    roughness: 0.88,
    metalness: 0.05,
  });
  const sparkMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.95,
  });
  const sparkCyanMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.9,
  });

  const freshTireCompoundMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 0.3,
    roughness: 0.35,
  });
  const oldTireCompoundMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.75,
  });

  // Helper to build a spare wheel & tire prop
  const spareTireGeo = getUnifiedTireGeometry(0.35, 0.28);
  const spareRingGeo = new THREE.RingGeometry(0.248, 0.27, 24).rotateY(Math.PI / 2);
  const buildSpareWheelProp = (compoundMat: THREE.Material): THREE.Group => {
    const wg = new THREE.Group();
    const tireMesh = new THREE.Mesh(spareTireGeo, darkRubberMat);
    const rimCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.205, 0.205, 0.22, 18).rotateZ(Math.PI / 2),
      chromeToolMat
    );
    const compRing = new THREE.Mesh(spareRingGeo, compoundMat);
    compRing.position.x = 0.136;
    const compRingInner = new THREE.Mesh(spareRingGeo, compoundMat);
    compRingInner.position.x = -0.136;
    wg.add(tireMesh, rimCyl, compRing, compRingInner);
    return wg;
  };

  // 1. Pit Box Apron Alignment Strips & Coiled Air Hoses on Ground
  const apronMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    polygonOffset: true,
    polygonOffsetFactor: -3,
  });
  for (const side of [-1, 1]) {
    const sideStrip = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 4.6), apronMat);
    sideStrip.rotation.x = -Math.PI / 2;
    sideStrip.position.set(side * 1.38, 0.015, 0);
    root.add(sideStrip);
  }
  const frontStopBar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 0.12), redAccentMat);
  frontStopBar.position.set(0, 0.02, 2.25);
  root.add(frontStopBar);

  // 2. Four Articulated Corner Wheel Mechanics (FL, FR, RL, RR)
  const cornerCrews: CornerPitCrewRig[] = [];
  const trackHalfW = 0.76;
  const wheelStations: Array<{ side: number; z: number }> = [
    { side: -1, z: 1.22 },
    { side: 1, z: 1.22 },
    { side: -1, z: -1.2 },
    { side: 1, z: -1.2 },
  ];

  for (const st of wheelStations) {
    const crewGroup = new THREE.Group();
    const baseX = st.side * (trackHalfW + 0.68);
    crewGroup.position.set(baseX, 0, st.z);
    // Face inward toward the car's wheel hub
    crewGroup.rotation.y = st.side < 0 ? Math.PI / 2 : -Math.PI / 2;

    // Kneeling lower legs & boots
    for (const legSide of [-1, 1]) {
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.34), navyTrimMat);
      shin.position.set(legSide * 0.11, 0.08, -0.12);
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.15), coverallMat);
      thigh.position.set(legSide * 0.11, 0.26, -0.02);
      thigh.rotation.x = 0.22;
      crewGroup.add(shin, thigh);
    }

    // Articulated Torso + Head + Helmet
    const torsoPivot = new THREE.Group();
    torsoPivot.position.set(0, 0.38, 0);

    const torsoBox = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.22), coverallMat);
    torsoBox.position.y = 0.22;
    const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.08, 0.23), redAccentMat);
    chestStripe.position.y = 0.3;
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.05, 0.23), navyTrimMat);
    belt.position.y = 0.04;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), skinMat);
    head.position.set(0, 0.56, 0.02);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.132, 14, 14), helmetMat);
    helmet.position.set(0, 0.58, 0.01);
    const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.055, 0.08), goggleMat);
    goggles.position.set(0, 0.56, 0.1);

    torsoPivot.add(torsoBox, chestStripe, belt, head, helmet, goggles);

    // Articulated Arms + Pneumatic Impact Wrench + Spark Burst
    const armsPivot = new THREE.Group();
    armsPivot.position.set(0, 0.36, 0.05);

    for (const armSide of [-1, 1]) {
      const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.28, 8), coverallMat);
      upperArm.rotation.x = Math.PI / 2 - 0.25;
      upperArm.rotation.z = -armSide * 0.22;
      upperArm.position.set(armSide * 0.19, -0.04, 0.14);

      const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.26, 8), skinMat);
      forearm.rotation.x = Math.PI / 2;
      forearm.rotation.z = armSide * 0.32;
      forearm.position.set(armSide * 0.11, -0.08, 0.32);
      armsPivot.add(upperArm, forearm);
    }

    const wrenchGroup = new THREE.Group();
    wrenchGroup.position.set(0, -0.08, 0.46);
    const gunBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.048, 0.22, 12).rotateX(Math.PI / 2),
      redAccentMat
    );
    const gunNose = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.03, 0.16, 10).rotateX(Math.PI / 2),
      chromeToolMat
    );
    gunNose.position.z = 0.16;
    const gunGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.14, 8), goggleMat);
    gunGrip.position.set(0, -0.08, -0.02);
    gunGrip.rotation.x = 0.25;
    wrenchGroup.add(gunBody, gunNose, gunGrip);

    // 3D Star Spark Burst at the impact gun socket
    const sparkBurstGroup = new THREE.Group();
    sparkBurstGroup.position.set(0, 0, 0.25);
    sparkBurstGroup.visible = false;
    for (let s = 0; s < 6; s++) {
      const ray = new THREE.Mesh(
        new THREE.ConeGeometry(0.022, 0.24, 6).rotateZ((s * Math.PI) / 3),
        s % 2 === 0 ? sparkMat : sparkCyanMat
      );
      sparkBurstGroup.add(ray);
    }
    wrenchGroup.add(sparkBurstGroup);

    armsPivot.add(wrenchGroup);
    torsoPivot.add(armsPivot);
    crewGroup.add(torsoPivot);

    // Fresh Replacement Wheel Prop & Removed Old Wheel Prop on the Pit Apron beside the mechanic
    const freshWheelProp = buildSpareWheelProp(freshTireCompoundMat);
    freshWheelProp.rotation.z = Math.PI / 2;
    freshWheelProp.position.set(st.side * 0.45, 0.12, st.z + 0.58);
    root.add(freshWheelProp);

    const oldWheelProp = buildSpareWheelProp(oldTireCompoundMat);
    oldWheelProp.rotation.z = Math.PI / 2;
    oldWheelProp.position.set(st.side * 0.45, 0.12, st.z - 0.58);
    oldWheelProp.visible = false;
    root.add(oldWheelProp);

    root.add(crewGroup);
    cornerCrews.push({
      side: st.side,
      baseX,
      baseZ: st.z,
      crewGroup,
      torsoPivot,
      armsPivot,
      wrenchGroup,
      sparkBurstGroup,
      oldWheelProp,
      freshWheelProp,
    });
  }

  // 3. Front & Rear Quick-Lift Hydraulic Tubular Jacks + Jack Mechanics
  const buildJackRig = (isFront: boolean): PitJackRig => {
    const group = new THREE.Group();
    const zSign = isFront ? 1 : -1;
    group.position.set(0, 0, zSign * 2.38);
    if (!isFront) {
      group.rotation.y = Math.PI;
    }

    const baseFrame = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.045, 0.65), redAccentMat);
    baseFrame.position.set(0, 0.04, -0.18);
    const liftSaddle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.06, 14), chromeToolMat);
    liftSaddle.position.set(0, 0.12, -0.36);

    const handlePivot = new THREE.Group();
    handlePivot.position.set(0, 0.08, 0.08);
    const handlePole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 1.35, 10), chromeToolMat);
    handlePole.position.set(0, 0.55, 0.35);
    handlePole.rotation.x = 0.58;
    const handleCrossbar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.38, 8).rotateZ(Math.PI / 2),
      redAccentMat
    );
    handleCrossbar.position.set(0, 1.1, 0.72);
    handlePivot.add(handlePole, handleCrossbar);

    // Standing Jack Mechanic operating the quick-lift lever
    const mechanicTorso = new THREE.Group();
    mechanicTorso.position.set(0, 0, 0.78);
    mechanicTorso.rotation.y = Math.PI;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.68, 0.2), navyTrimMat);
    legs.position.y = 0.34;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.48, 0.22), coverallMat);
    torso.position.y = 0.92;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), skinMat);
    head.position.y = 1.28;
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.132, 12, 12), redAccentMat);
    helmet.position.y = 1.31;
    mechanicTorso.add(legs, torso, head, helmet);

    group.add(baseFrame, liftSaddle, handlePivot, mechanicTorso);
    root.add(group);
    return { group, liftSaddle, handlePivot, mechanicTorso };
  };

  const frontJack = buildJackRig(true);
  const rearJack = buildJackRig(false);

  // 4. Lollipop Pit Chief standing ahead-right of the nose
  const lollipopChiefGroup = new THREE.Group();
  lollipopChiefGroup.position.set(-1.18, 0, 2.45);
  lollipopChiefGroup.rotation.y = Math.PI * 0.78;

  const chiefLegs = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.72, 0.2), navyTrimMat);
  chiefLegs.position.y = 0.36;
  const chiefTorso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.5, 0.22), redAccentMat);
  chiefTorso.position.y = 0.96;
  const chiefHead = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), skinMat);
  chiefHead.position.y = 1.32;
  const chiefHelmet = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 12), helmetMat);
  chiefHelmet.position.y = 1.35;
  lollipopChiefGroup.add(chiefLegs, chiefTorso, chiefHead, chiefHelmet);

  const lollipopPolePivot = new THREE.Group();
  lollipopPolePivot.position.set(-1.18, 1.05, 2.35);

  const lollipopPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.022, 1.55, 8).rotateZ(Math.PI / 2),
    chromeToolMat
  );
  lollipopPole.position.set(0.65, 0, 0);

  const lollipopBoardMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.45,
    roughness: 0.3,
  });
  const lollipopDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 20), lollipopBoardMat);
  lollipopDisc.rotation.x = Math.PI / 2;
  lollipopDisc.position.set(1.22, 0, 0);
  const lollipopRim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 8, 24), chromeToolMat);
  lollipopRim.position.set(1.22, 0, 0);
  lollipopPolePivot.add(lollipopPole, lollipopDisc, lollipopRim);
  root.add(lollipopChiefGroup, lollipopPolePivot);

  return {
    root,
    cornerCrews,
    frontJack,
    rearJack,
    lollipopChiefGroup,
    lollipopPolePivot,
    lollipopBoardMat,
    freshTireCompoundMat,
    oldTireCompoundMat,
  };
}

function getCompoundColorHex(compound: TireCompound): number {
  if (compound === 'soft') return 0xef4444;
  if (compound === 'hard') return 0xf8fafc;
  if (compound === 'wet') return 0x38bdf8;
  return 0xf59e0b;
}

/**
 * Updates both the 3D Pit Crew Service Rig and the Car's 3D Chassis/Wheels
 * during an active pit stop sequence.
 */
export function updatePitCrewServiceRig(
  pitRig: PitCrewServiceRig,
  carRig: CarMeshRig,
  anim: PitStopAnimationState,
  currentCompound: TireCompound,
  nextCompound: TireCompound
): void {
  const flWheel = carRig.wheels[0];
  const frWheel = carRig.wheels[1];
  const rlWheel = carRig.wheels[2];
  const rrWheel = carRig.wheels[3];

  if (!anim.active) {
    if (pitRig.root.visible) {
      pitRig.root.visible = false;
    }
    // Ensure all 4 wheels sit flush on their stock hubs
    flWheel.position.set(0, 0, 0);
    frWheel.position.set(0, 0, 0);
    rlWheel.position.set(-carRig.trackHalfW, carRig.wheelContactY, carRig.rearWheelbaseZ);
    rrWheel.position.set(carRig.trackHalfW, carRig.wheelContactY, carRig.rearWheelbaseZ);
    flWheel.rotation.z = 0;
    frWheel.rotation.z = 0;
    rlWheel.rotation.z = 0;
    rrWheel.rotation.z = 0;
    return;
  }

  pitRig.root.visible = true;
  pitRig.root.position.copy(carRig.root.position);
  pitRig.root.rotation.copy(carRig.root.rotation);

  // 1. Lift Car Chassis on Hydraulic Jacks & Droop Suspension slightly
  carRig.bodyGroup.position.y = anim.chassisLiftY;
  carRig.bodyGroup.rotation.x += anim.chassisPitchOffsetRad;

  const suspDroopY = -anim.chassisLiftY * 0.25;
  const latOff = anim.wheelLateralOffsetM;
  const tilt = anim.wheelTiltRad;

  flWheel.position.set(-latOff, suspDroopY, 0);
  frWheel.position.set(latOff, suspDroopY, 0);
  rlWheel.position.set(-carRig.trackHalfW - latOff, carRig.wheelContactY + suspDroopY, carRig.rearWheelbaseZ);
  rrWheel.position.set(carRig.trackHalfW + latOff, carRig.wheelContactY + suspDroopY, carRig.rearWheelbaseZ);

  flWheel.rotation.z = tilt;
  frWheel.rotation.z = -tilt;
  rlWheel.rotation.z = tilt;
  rrWheel.rotation.z = -tilt;

  // Spin wheels slightly as impact guns torque them
  if (anim.wrenchActive) {
    for (const w of carRig.wheels) {
      w.rotation.x += 0.35;
    }
  }

  // 2. Update Tire Compound Sidewall Colors on Car and Pit Props
  const oldHex = getCompoundColorHex(currentCompound);
  const nextHex = getCompoundColorHex(nextCompound);
  pitRig.oldTireCompoundMat.color.setHex(oldHex);
  pitRig.freshTireCompoundMat.color.setHex(nextHex);
  pitRig.freshTireCompoundMat.emissive.setHex(nextHex);

  const activeCarHex = anim.showFreshCompound ? nextHex : oldHex;
  carRig.tireCompoundMat.color.setHex(activeCarHex);
  carRig.tireCompoundMat.emissive.setHex(activeCarHex);

  // 3. Animate 4 Corner Mechanics, Impact Guns, Spark Bursts & Tire Props
  for (let i = 0; i < pitRig.cornerCrews.length; i++) {
    const crew = pitRig.cornerCrews[i];
    const stepBackDist = (1 - anim.mechanicReachRatio) * 0.62;
    const wheelPushBack = latOff * 0.65;
    crew.crewGroup.position.x = crew.baseX + crew.side * (stepBackDist + wheelPushBack);

    const wrenchJitter = anim.wrenchActive ? Math.sin(anim.wrenchSpinRad * 2.2 + i) * 0.06 : 0;
    crew.torsoPivot.rotation.x = 0.24 * anim.mechanicReachRatio + wrenchJitter;
    crew.armsPivot.rotation.x =
      anim.phase === 'wheels_off' || anim.phase === 'wheels_on'
        ? -0.22 * Math.sin(anim.phaseProgress * Math.PI)
        : wrenchJitter * 1.5;

    crew.wrenchGroup.rotation.z = anim.wrenchSpinRad;
    crew.sparkBurstGroup.visible = anim.wrenchActive;
    if (anim.wrenchActive) {
      const sScale = 0.65 + ((Math.sin(anim.wrenchSpinRad * 3.7 + i * 2) + 1) * 0.5) * 0.85;
      crew.sparkBurstGroup.scale.setScalar(sScale);
      crew.sparkBurstGroup.rotation.z = anim.wrenchSpinRad * 1.5;
    }

    // Show fresh wheel prop on ground until mounted (progress < 0.50); show old wheel prop once removed (progress >= 0.42)
    crew.freshWheelProp.visible = !anim.showFreshCompound;
    crew.oldWheelProp.visible = anim.progress >= 0.42;
  }

  // 4. Animate Front & Rear Hydraulic Quick-Lift Jacks
  pitRig.frontJack.liftSaddle.position.y = 0.1 + anim.chassisLiftY;
  pitRig.rearJack.liftSaddle.position.y = 0.1 + anim.chassisLiftY;
  pitRig.frontJack.handlePivot.rotation.x = anim.jackHandleAngleRad * 0.65;
  pitRig.rearJack.handlePivot.rotation.x = anim.jackHandleAngleRad * 0.65;
  pitRig.frontJack.mechanicTorso.rotation.x = (1 - anim.jackHandleAngleRad) * 0.25;
  pitRig.rearJack.mechanicTorso.rotation.x = (1 - anim.jackHandleAngleRad) * 0.25;

  // 5. Animate Pit Chief Lollipop Sign (Amber HOLD -> Raised Green GO!)
  if (anim.lollipopRaised) {
    pitRig.lollipopPolePivot.position.y = 1.05 + anim.phaseProgress * 0.65;
    pitRig.lollipopPolePivot.rotation.z = anim.phaseProgress * 0.42;
    pitRig.lollipopBoardMat.color.setHex(0x22c55e);
    pitRig.lollipopBoardMat.emissive.setHex(0x22c55e);
  } else {
    pitRig.lollipopPolePivot.position.y = 1.05;
    pitRig.lollipopPolePivot.rotation.z = 0;
    pitRig.lollipopBoardMat.color.setHex(0xfacc15);
    pitRig.lollipopBoardMat.emissive.setHex(0xf59e0b);
  }
}

/**
 * Visual car damage is removed so all coachwork panels remain 100% flush and aligned.
 */
export function applyCarDamage(_rig: CarMeshRig, _damage?: VehicleDamageState): void {
  // Intentionally empty: visual car damage has been removed per user request.
}

/**
 * Updates windshield wipers, 3D Veglia dashboard gauges (speedometer, tachometer, oil, water, fuel),
 * shift light jewel, gated 5-speed shifter lever, brake disc thermal glow, tire compound ring,
 * and exhaust backfire / Nitro jet flames.
 */
export function updateCarWipers(
  rig: CarMeshRig,
  dt: number,
  isRaining: boolean,
  isBoosting = false,
  frontBrakeGlow = 0,
  tireCompound: TireCompound = 'medium',
  speedKmh = 0,
  rpm = 1200,
  gear = 1,
  throttle = 0,
  brake = 0,
  redlineTremor = 0,
  cockpitLighting?: CockpitLightingState
): void {
  if (isRaining) {
    rig.wiperAngle += dt * 8.0;
    const sweep = Math.sin(rig.wiperAngle) * 0.65 + 0.65;
    rig.wiperLeft.rotation.z = sweep;
    rig.wiperRight.rotation.z = sweep;
  } else {
    rig.wiperLeft.rotation.z = THREE.MathUtils.damp(rig.wiperLeft.rotation.z, 1.42, 8, dt);
    rig.wiperRight.rotation.z = THREE.MathUtils.damp(rig.wiperRight.rotation.z, 1.42, 8, dt);
  }

  // High-frequency harmonic phase for redline mechanical cockpit tremor
  const harmonicPhase = performance.now() * 0.085;
  const harmonicSin = Math.sin(harmonicPhase);
  const harmonicCos = Math.cos(harmonicPhase * 1.27);

  // Dynamic Interior Cockpit Lighting Response (Tree Canopy Dappled Sunlight Flicker & Tunnel Sodium Sweeps)
  if (cockpitLighting) {
    const {
      zone,
      ambientFactor,
      dappledFlicker,
      tunnelSodiumPulse,
      instrumentBacklight,
      sweepPhase,
      lightColorHex,
      lightIntensity,
    } = cockpitLighting;

    // 1. Move & modulate the dynamic 3D cockpit point light as overhead sunbeams or tunnel lamps pass
    rig.cockpitDynamicLight.color.setHex(lightColorHex);
    rig.cockpitDynamicLight.intensity = lightIntensity;
    rig.cockpitDynamicLight.position.x = 0.14 + sweepPhase * 0.16;
    rig.cockpitDynamicLight.position.z = 0.05 + sweepPhase * 0.14;

    // 2. Animate Dappled Sunlight / Tunnel Sodium Caustic Sweep across the dashboard cowl top
    const sweepStrength =
      zone === 'tree_canopy'
        ? dappledFlicker * 0.42
        : zone === 'tunnel'
        ? tunnelSodiumPulse * 0.52
        : 0;
    rig.dappledLightSweepMat.opacity = sweepStrength;
    rig.dappledLightSweepMat.color.setHex(zone === 'tunnel' ? 0xff9e2c : 0xffe89e);
    if (rig.dappledLightSweepMat.map) {
      rig.dappledLightSweepMat.map.offset.x = sweepPhase * 0.5;
    }

    // 3. Modulate cockpit leather, engine-turned aluminum, Nardi wood rim & driving gloves
    // so dappled leaf shadows and warm tunnel sodium pulses are unmistakably visible on all GPUs & Software WebGL
    const surfaceBright = Math.max(
      0.38,
      Math.min(1.38, ambientFactor * 0.88 + dappledFlicker * 0.46 + tunnelSodiumPulse * 0.54)
    );
    rig.binnacleLeatherMat.color.setHex(rig.binnacleBaseHex).multiplyScalar(surfaceBright);
    rig.binnacleLeatherMat.emissive.setHex(zone === 'tunnel' ? 0xd97706 : 0xfde68a);
    rig.binnacleLeatherMat.emissiveIntensity =
      zone === 'tunnel' ? tunnelSodiumPulse * 0.28 : dappledFlicker * 0.18;

    rig.engineTurnedMat.emissiveIntensity =
      0.10 + ambientFactor * 0.20 + dappledFlicker * 0.26 + tunnelSodiumPulse * 0.34;
    rig.engineTurnedMat.emissive.setHex(zone === 'tunnel' ? 0xf59e0b : 0xffffff);

    rig.mahoganyWheelMat.emissive.setHex(zone === 'tunnel' ? 0xd97706 : 0xfbbf24);
    rig.mahoganyWheelMat.emissiveIntensity =
      zone === 'tunnel' ? tunnelSodiumPulse * 0.32 : dappledFlicker * 0.22;

    rig.gloveLeatherMat.color.setHex(0xc26a1b).multiplyScalar(surfaceBright);
    rig.nomexSleeveMat.color.setHex(0xe2e8f0).multiplyScalar(Math.max(0.45, surfaceBright * 0.95));

    // 4. Warm vintage instrument dial backlights & Halda Twinmaster illumination in tunnels / shade
    for (let i = 0; i < rig.gaugeDialMaterials.length; i++) {
      const dMat = rig.gaugeDialMaterials[i];
      if (instrumentBacklight > 0.45) {
        // Warm vintage incandescent amber-cream instrument glow in dark tunnels/shade
        dMat.color.setRGB(1.0, 0.96 - (instrumentBacklight - 0.45) * 0.08, 0.84 - (instrumentBacklight - 0.45) * 0.18);
      } else {
        dMat.color.setHex(0xffffff);
      }
    }
    if (instrumentBacklight > 0.45) {
      rig.haldaFaceMat.color.setRGB(1.0, 0.94, 0.82);
    } else {
      rig.haldaFaceMat.color.setHex(0xffffff);
    }
  }

  // Animate 3D Cockpit Instrument Needles (0 = -125 deg = -2.181 rad, Max = +125 deg = +2.181 rad)
  const speedRatio = Math.max(0, Math.min(1, speedKmh / 320));
  const targetSpeedoZ = (-125 + speedRatio * 250) * (Math.PI / 180);
  rig.speedoNeedlePivot.rotation.z = THREE.MathUtils.damp(
    rig.speedoNeedlePivot.rotation.z,
    targetSpeedoZ,
    18,
    dt
  );

  const rpmRatio = Math.max(0, Math.min(1, rpm / 9000));
  const targetTachZ =
    (-125 + rpmRatio * 250) * (Math.PI / 180) + harmonicSin * redlineTremor * 0.048;
  rig.tachNeedlePivot.rotation.z = THREE.MathUtils.damp(
    rig.tachNeedlePivot.rotation.z,
    targetTachZ,
    28,
    dt
  );

  // Auxiliary dials: Oil pressure rises with RPM, Water temp sits around 85C, Fuel sits near 3/4
  const oilRatio = 0.35 + rpmRatio * 0.45;
  rig.oilNeedlePivot.rotation.z = THREE.MathUtils.damp(
    rig.oilNeedlePivot.rotation.z,
    (-110 + oilRatio * 220) * (Math.PI / 180),
    10,
    dt
  );
  rig.waterNeedlePivot.rotation.z = 0.08;
  rig.fuelNeedlePivot.rotation.z = 0.65;

  // 3-Stage Sequential RPM Shift-Light Array (Green 6350 -> Amber 6800 -> Red 7050+ flashing)
  rig.shiftGreenMat.emissiveIntensity = rpm >= 6350 ? 2.6 : 0.12;
  rig.shiftAmberMat.emissiveIntensity = rpm >= 6800 ? 3.2 : 0.12;
  const redlineStrobe = rpm >= 7400 ? (harmonicSin > 0 ? 4.8 : 1.4) : 3.8;
  rig.shiftLightMat.emissiveIntensity = rpm >= 7050 ? redlineStrobe : 0.15;

  // Apply subtle mechanical redline harmonic buzz to the steering wheel rim
  if (redlineTremor > 0.01) {
    rig.steeringWheelPivot.rotation.z += harmonicSin * redlineTremor * 0.016;
  }

  // Animate footwell drilled aluminum throttle & brake pedals
  rig.throttlePedalPivot.rotation.x = THREE.MathUtils.damp(
    rig.throttlePedalPivot.rotation.x,
    -0.32 + throttle * 0.28,
    18,
    dt
  );
  rig.brakePedalPivot.rotation.x = THREE.MathUtils.damp(
    rig.brakePedalPivot.rotation.x,
    -0.32 + brake * 0.25,
    18,
    dt
  );

  // Animate gated 5-speed shifter lever into current gear slot + mechanical redline buzz
  const gearXAngles: Record<number, number> = {
    1: -0.22,
    2: 0.14,
    3: -0.22,
    4: 0.14,
    5: -0.22,
  };
  const gearZAngles: Record<number, number> = {
    1: 0.12,
    2: 0.12,
    3: 0.0,
    4: 0.0,
    5: -0.12,
  };
  const targetGearX = (gearXAngles[gear] ?? -0.14) + harmonicSin * redlineTremor * 0.025;
  const targetGearZ = (gearZAngles[gear] ?? 0) + harmonicCos * redlineTremor * 0.025;
  rig.gearShifterPivot.rotation.x = THREE.MathUtils.damp(
    rig.gearShifterPivot.rotation.x,
    targetGearX,
    18,
    dt
  );
  rig.gearShifterPivot.rotation.z = THREE.MathUtils.damp(
    rig.gearShifterPivot.rotation.z,
    targetGearZ,
    18,
    dt
  );

  // Update 3D Tire Compound Sidewall Color Ring
  const compoundHex = getCompoundColorHex(tireCompound);
  rig.tireCompoundMat.color.setHex(compoundHex);
  rig.tireCompoundMat.emissive.setHex(compoundHex);

  // Cherry-orange cast-iron brake rotor thermal glow under heavy high-speed braking
  rig.brakeDiscMat.emissiveIntensity = frontBrakeGlow * 2.4;

  if (isBoosting) {
    rig.exhaustFlamesGroup.visible = true;
    rig.flameOuterMat.color.setHex(0x38bdf8);
    rig.flameCoreMat.color.setHex(0xe0f2fe);
    const pulse = 1.15 + Math.random() * 0.55;
    rig.exhaustFlamesGroup.scale.set(1.1, 1.1, pulse);
  } else if (rig.exhaustFlameTimer > 0) {
    rig.exhaustFlameTimer = Math.max(0, rig.exhaustFlameTimer - dt);
    rig.exhaustFlamesGroup.visible = true;
    rig.flameOuterMat.color.setHex(0xf97316);
    rig.flameCoreMat.color.setHex(0x60a5fa);
    const pulse = 0.75 + Math.random() * 0.45;
    rig.exhaustFlamesGroup.scale.set(1, 1, pulse);
  } else {
    rig.exhaustFlamesGroup.visible = false;
  }
}
