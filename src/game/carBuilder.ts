import * as THREE from 'three';
import {
  CarBodyStyle,
  CarLivery,
  ClassicCarSpec,
  TireCompound,
  VehicleDamageState,
} from './types';

export interface CarMeshRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  wheels: THREE.Object3D[];
  frontLeftPivot: THREE.Group;
  frontRightPivot: THREE.Group;
  brakeLightsMat: THREE.MeshStandardMaterial;
  brakeDiscMat: THREE.MeshStandardMaterial;
  tireCompoundMat: THREE.MeshStandardMaterial;
  bodyPaintMat: THREE.MeshPhysicalMaterial;
  liveryTexture: THREE.CanvasTexture;
  steeringWheelPivot: THREE.Group;
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

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  }
  const noopGrad = { addColorStop: () => {} };
  const noopCtx = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return () => noopGrad;
        }
        return () => {};
      },
      set: () => true,
    }
  );
  return {
    width,
    height,
    getContext: () => noopCtx,
  } as unknown as HTMLCanvasElement;
}

/**
 * Generates a high-resolution procedural CanvasTexture for the classic car livery
 * (rich metallic base coat, crisp racing stripes, coachwork shutlines, and competition roundel).
 */
export function createLiveryCanvasTexture(
  livery: CarLivery,
  maxAnisotropy = 4,
  bodyStyle: CarBodyStyle = 'italian_gt'
): THREE.CanvasTexture {
  const canvas = createCanvas(1024, 1024);
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = livery.bodyColor;
  ctx.fillRect(0, 0, 1024, 1024);

  const latGrad = ctx.createLinearGradient(0, 0, 1024, 0);
  latGrad.addColorStop(0.0, 'rgba(0,0,0,0.16)');
  latGrad.addColorStop(0.16, 'rgba(255,255,255,0.08)');
  latGrad.addColorStop(0.34, 'rgba(0,0,0,0.05)');
  latGrad.addColorStop(0.5, 'rgba(255,255,255,0.09)');
  latGrad.addColorStop(0.66, 'rgba(0,0,0,0.05)');
  latGrad.addColorStop(0.84, 'rgba(255,255,255,0.08)');
  latGrad.addColorStop(1.0, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = latGrad;
  ctx.fillRect(0, 0, 1024, 1024);

  // Rocker sill heritage accent stripes on left/right lower edges (u near 0.0..0.12 and 0.88..1.0)
  ctx.fillStyle = livery.stripeColor;
  if (bodyStyle === 'stuttgart_911' || bodyStyle === 'detroit_proto' || livery.stripeStyle === 'hood_sill') {
    ctx.fillRect(28, 180, 52, 660);
    ctx.fillRect(944, 180, 52, 660);
    ctx.fillStyle = livery.bodyColor;
    ctx.fillRect(42, 180, 10, 660);
    ctx.fillRect(972, 180, 10, 660);
  }

  ctx.fillStyle = livery.stripeColor;
  if (livery.stripeStyle === 'twin_center') {
    ctx.fillRect(434, 0, 60, 1024);
    ctx.fillRect(530, 0, 60, 1024);
    ctx.fillRect(418, 0, 8, 1024);
    ctx.fillRect(598, 0, 8, 1024);
  } else if (livery.stripeStyle === 'offset_lemans') {
    ctx.fillRect(322, 0, 86, 1024);
    ctx.fillRect(422, 0, 26, 1024);
  } else if (livery.stripeStyle === 'hood_sill') {
    ctx.fillRect(408, 0, 208, 1024);
    ctx.fillStyle = livery.bodyColor;
    ctx.fillRect(496, 0, 32, 1024);
  }

  // Nose identification band on Endurance & Kamm-tail cars
  if (bodyStyle === 'daytona_kammtail' || bodyStyle === 'british_coupe') {
    ctx.fillStyle = livery.stripeColor;
    ctx.fillRect(200, 885, 624, 58);
  } else if (bodyStyle === 'stradale_proto') {
    ctx.fillStyle = livery.stripeColor;
    ctx.beginPath();
    ctx.moveTo(512, 960);
    ctx.lineTo(370, 740);
    ctx.lineTo(654, 740);
    ctx.closePath();
    ctx.fill();
  }

  // Crisp Coachwork Panel Shutlines
  ctx.strokeStyle = 'rgba(0,0,0,0.32)';
  ctx.lineWidth = 2.5;
  if (bodyStyle === 'stuttgart_911') {
    ctx.strokeRect(275, 650, 474, 275); // Long sloping frunk lid
    ctx.strokeRect(290, 95, 444, 195); // Rear flat-6 engine decklid
  } else if (bodyStyle === 'detroit_proto') {
    ctx.strokeRect(180, 690, 664, 210); // Front clamshell shutline
    ctx.strokeRect(180, 110, 664, 340); // Rear V8 clamshell shutline
  } else if (bodyStyle === 'british_coupe') {
    ctx.strokeRect(220, 560, 584, 360); // Long clamshell bonnet
    ctx.strokeRect(280, 85, 464, 210); // Rear teardrop hatch
  } else {
    ctx.strokeRect(240, 665, 544, 240);
    ctx.strokeRect(255, 90, 514, 180);
  }

  const drawRoundel = (cx: number, cy: number, radius: number) => {
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2);
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

  // Nose / Hood competition roundel (high V = front hood)
  drawRoundel(512, 785, 76);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

function createRoundelDecalTexture(number: number, maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = createCanvas(256, 256);
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
  const canvas = createCanvas(512, 512);
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
  ctx.fillText('DUNLOP · CR65 RACING', 45, 485);

  cachedTireTexture = new THREE.CanvasTexture(canvas);
  cachedTireTexture.colorSpace = THREE.SRGBColorSpace;
  cachedTireTexture.userData = { shared: true };
  return cachedTireTexture;
}

let cachedLicensePlateTex: THREE.CanvasTexture | null = null;
function getVintageLicensePlateTexture(): THREE.CanvasTexture {
  if (cachedLicensePlateTex) return cachedLicensePlateTex;
  const canvas = createCanvas(256, 96);
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
  ctx.fillText('PROVA MO·67', 128, 50);

  cachedLicensePlateTex = new THREE.CanvasTexture(canvas);
  cachedLicensePlateTex.colorSpace = THREE.SRGBColorSpace;
  cachedLicensePlateTex.userData = { shared: true };
  return cachedLicensePlateTex;
}

let cachedContactShadowTex: THREE.CanvasTexture | null = null;
function getContactShadowTexture(): THREE.CanvasTexture {
  if (cachedContactShadowTex) return cachedContactShadowTex;
  const canvas = createCanvas(256, 512);
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 512);
  const grad = ctx.createRadialGradient(128, 256, 20, 128, 256, 124);
  grad.addColorStop(0.0, 'rgba(0, 0, 0, 0.84)');
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
  cachedContactShadowTex.userData = { shared: true };
  return cachedContactShadowTex;
}

let cachedGaugeClusterTex: THREE.CanvasTexture | null = null;
function getGaugeClusterTexture(): THREE.CanvasTexture {
  if (cachedGaugeClusterTex) return cachedGaugeClusterTex;
  const canvas = createCanvas(512, 128);
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#111318';
  ctx.fillRect(0, 0, 512, 128);

  const dialCenters = [76, 172, 268, 356, 436];
  const dialRadii = [44, 46, 32, 30, 30];
  for (let i = 0; i < dialCenters.length; i++) {
    const cx = dialCenters[i];
    const r = dialRadii[i];
    ctx.beginPath();
    ctx.arc(cx, 64, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = '#cbd5e1';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, 64, r, 0, Math.PI * 2);
    ctx.fillStyle = '#09090b';
    ctx.fill();

    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, 64, r - 5, Math.PI * 0.8, Math.PI * 2.2);
    ctx.stroke();

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, 64);
    ctx.lineTo(cx + r * 0.55, 64 - r * 0.5);
    ctx.stroke();
  }

  cachedGaugeClusterTex = new THREE.CanvasTexture(canvas);
  cachedGaugeClusterTex.colorSpace = THREE.SRGBColorSpace;
  cachedGaugeClusterTex.userData = { shared: true };
  return cachedGaugeClusterTex;
}

interface CoachworkDimensions {
  bodyStyle: CarBodyStyle;
  bodyWidth: number;
  bodyLength: number;
  chassisH: number;
  frontWheelZ: number;
  rearWheelZ: number;
  wheelRadius: number;
  wheelContactY: number;
  wheelArchRadius: number;
  trackHalfW: number;
}

function getCoachworkDimensions(bodyStyle: CarBodyStyle): CoachworkDimensions {
  const wheelRadius = 0.305;
  const wheelContactY = wheelRadius - 0.004; // 0.301m
  const wheelArchRadius = wheelRadius + 0.055;

  switch (bodyStyle) {
    case 'italian_gt': // 1964 Aurelia 250 Corsa (Ferrari 250 GTO Scaglietti Berlinetta)
      return {
        bodyStyle,
        bodyWidth: 1.82,
        bodyLength: 4.30,
        chassisH: 0.48,
        frontWheelZ: 1.23,
        rearWheelZ: -1.21,
        wheelRadius,
        wheelContactY,
        wheelArchRadius,
        trackHalfW: 0.69,
      };
    case 'british_coupe': // 1967 Coventry E-Series LW (Jaguar E-Type Lightweight Long-Nose)
      return {
        bodyStyle,
        bodyWidth: 1.72,
        bodyLength: 4.46,
        chassisH: 0.46,
        frontWheelZ: 1.24,
        rearWheelZ: -1.21,
        wheelRadius,
        wheelContactY,
        wheelArchRadius,
        trackHalfW: 0.66,
      };
    case 'stuttgart_911': // 1969 Stuttgart 911S Rennsport (Porsche 911 Carrera RS 2.7)
      return {
        bodyStyle,
        bodyWidth: 1.84,
        bodyLength: 4.08,
        chassisH: 0.51,
        frontWheelZ: 1.21,
        rearWheelZ: -1.19,
        wheelRadius,
        wheelContactY,
        wheelArchRadius,
        trackHalfW: 0.70,
      };
    case 'detroit_proto': // 1966 Dearborn Mk.II Prototype (Ford GT40 Mk.II 40-inch Low Wedge)
      return {
        bodyStyle,
        bodyWidth: 1.98,
        bodyLength: 4.18,
        chassisH: 0.41,
        frontWheelZ: 1.22,
        rearWheelZ: -1.20,
        wheelRadius,
        wheelContactY,
        wheelArchRadius,
        trackHalfW: 0.74,
      };
    case 'daytona_kammtail': // 1965 Daytona Kammtail Coupe (Shelby Cobra Daytona Coupe)
      return {
        bodyStyle,
        bodyWidth: 1.92,
        bodyLength: 4.38,
        chassisH: 0.48,
        frontWheelZ: 1.23,
        rearWheelZ: -1.20,
        wheelRadius,
        wheelContactY,
        wheelArchRadius,
        trackHalfW: 0.72,
      };
    case 'stradale_proto': // 1968 Arese Tipo 33 Stradale (Alfa Romeo 33 Stradale Scaglione)
      return {
        bodyStyle,
        bodyWidth: 1.88,
        bodyLength: 4.02,
        chassisH: 0.42,
        frontWheelZ: 1.20,
        rearWheelZ: -1.18,
        wheelRadius,
        wheelContactY,
        wheelArchRadius,
        trackHalfW: 0.71,
      };
  }
}

/**
 * Evaluates the exact cross-sectional coachwork profile for any of the 6 bespoke car body styles.
 * Guarantees 100% mathematical tire-envelope clearance over the front and rear wheels while sculpting
 * each car's signature nose, hood troughs/bulges, cannon fenders, coke-bottle waist, and tail.
 */
function evaluateCoachworkStation(dims: CoachworkDimensions, z: number) {
  const {
    bodyStyle,
    bodyWidth,
    bodyLength,
    chassisH,
    frontWheelZ,
    rearWheelZ,
    wheelRadius,
    wheelContactY,
    wheelArchRadius,
  } = dims;

  const halfLen = bodyLength * 0.5;
  const baseHalfW = bodyWidth * 0.5;
  const t = clamp01((z + halfLen) / bodyLength);

  const distFrontW = Math.abs(z - frontWheelZ);
  const distRearW = Math.abs(z - rearWheelZ);

  // Bespoke fender flare, waist pinch, and planform taper per car architecture
  const frontFlareScale =
    bodyStyle === 'daytona_kammtail'
      ? 0.108
      : bodyStyle === 'detroit_proto'
      ? 0.095
      : bodyStyle === 'stradale_proto'
      ? 0.098
      : bodyStyle === 'british_coupe'
      ? 0.052
      : 0.084;
  const rearFlareScale =
    bodyStyle === 'daytona_kammtail'
      ? 0.122
      : bodyStyle === 'detroit_proto'
      ? 0.115
      : bodyStyle === 'stuttgart_911'
      ? 0.112
      : bodyStyle === 'stradale_proto'
      ? 0.106
      : bodyStyle === 'british_coupe'
      ? 0.062
      : 0.096;
  const waistPinchScale =
    bodyStyle === 'stradale_proto'
      ? 0.078
      : bodyStyle === 'italian_gt'
      ? 0.058
      : bodyStyle === 'detroit_proto'
      ? 0.052
      : bodyStyle === 'british_coupe'
      ? 0.018
      : 0.036;

  const frontFlare = Math.exp(-Math.pow(distFrontW / 0.56, 2)) * frontFlareScale;
  const rearFlare = Math.exp(-Math.pow(distRearW / 0.60, 2)) * rearFlareScale;
  const doorWaistPinch = Math.exp(-Math.pow((z - 0.04) / 0.52, 2)) * waistPinchScale;

  let planTaper = 1.0;
  if (bodyStyle === 'british_coupe') {
    // Cigar-shaped Malcolm Sayer fuselage tapers strongly at both nose and teardrop tail
    if (t > 0.76) {
      const nt = (t - 0.76) / 0.24;
      planTaper = 1.0 - Math.pow(nt, 1.65) * 0.27;
    } else if (t < 0.20) {
      const rt = (0.20 - t) / 0.20;
      planTaper = 1.0 - Math.pow(rt, 1.6) * 0.24;
    }
  } else if (bodyStyle === 'daytona_kammtail') {
    // Deep tapering aerodynamic pitot nose; wide squared-off Kamm tail
    if (t > 0.78) {
      const nt = (t - 0.78) / 0.22;
      planTaper = 1.0 - Math.pow(nt, 1.7) * 0.22;
    } else if (t < 0.08) {
      const rt = (0.08 - t) / 0.08;
      planTaper = 1.0 - Math.pow(rt, 1.8) * 0.05;
    }
  } else if (bodyStyle === 'stradale_proto') {
    if (t > 0.78) {
      const nt = (t - 0.78) / 0.22;
      planTaper = 1.0 - Math.pow(nt, 1.65) * 0.23;
    } else if (t < 0.16) {
      const rt = (0.16 - t) / 0.16;
      planTaper = 1.0 - Math.pow(rt, 1.65) * 0.18;
    }
  } else {
    if (t > 0.82) {
      const nt = (t - 0.82) / 0.18;
      planTaper = 1.0 - Math.pow(nt, 1.8) * 0.16;
    } else if (t < 0.12) {
      const rt = (0.12 - t) / 0.12;
      planTaper = 1.0 - Math.pow(rt, 1.8) * 0.13;
    }
  }

  const stationHalfW = baseHalfW * planTaper + frontFlare + rearFlare - doorWaistPinch;

  let archCutoutY = 0;
  if (distFrontW < wheelArchRadius) {
    archCutoutY = Math.sqrt(wheelArchRadius * wheelArchRadius - distFrontW * distFrontW) * 0.68;
  } else if (distRearW < wheelArchRadius) {
    archCutoutY = Math.sqrt(wheelArchRadius * wheelArchRadius - distRearW * distRearW) * 0.68;
  }

  // Baseline deck height and longitudinal nose/tail profile per bodyStyle
  let centerH = chassisH + 0.21;
  if (bodyStyle === 'stuttgart_911') {
    // 911: Sloping front trunk hood & sloping rear engine lid
    if (t > 0.62) {
      const nt = (t - 0.62) / 0.38;
      centerH -= Math.pow(nt, 1.55) * 0.26;
    } else if (t < 0.24) {
      const rt = (0.24 - t) / 0.24;
      centerH -= Math.pow(rt, 1.45) * 0.14;
    }
  } else if (bodyStyle === 'british_coupe') {
    // E-Type LW: Long sweeping bonnet and rounded teardrop tail drop (no Kamm spoiler)
    if (t > 0.74) {
      const nt = (t - 0.74) / 0.26;
      centerH -= Math.pow(nt, 1.75) * 0.20;
    } else if (t < 0.22) {
      const rt = (0.22 - t) / 0.22;
      centerH -= Math.pow(rt, 1.65) * 0.16;
    }
  } else if (bodyStyle === 'detroit_proto') {
    // GT40 Mk.II: Ultra-low wedge nose
    if (t > 0.66) {
      const nt = (t - 0.66) / 0.34;
      centerH -= Math.pow(nt, 1.65) * 0.19;
    }
  } else if (bodyStyle === 'stradale_proto') {
    // Alfa 33 Stradale: Low plunging Scaglione nose between high pontoon crests
    if (t > 0.64) {
      const nt = (t - 0.64) / 0.36;
      centerH -= Math.pow(nt, 1.55) * 0.22;
    } else if (t < 0.14) {
      const rt = (0.14 - t) / 0.14;
      centerH -= Math.pow(rt, 1.5) * 0.08;
    }
  } else if (bodyStyle === 'daytona_kammtail') {
    // Shelby Daytona: Steep pitot nose drop; high flat Kamm tail deck
    if (t > 0.70) {
      const nt = (t - 0.70) / 0.30;
      centerH -= Math.pow(nt, 1.75) * 0.23;
    } else if (t < 0.30) {
      const rt = (0.30 - t) / 0.30;
      centerH += Math.sin(rt * Math.PI * 0.5) * 0.045;
    }
  } else {
    // Italian GT (250 GTO)
    if (t > 0.72) {
      const nt = (t - 0.72) / 0.28;
      centerH -= Math.pow(nt, 1.85) * 0.195;
    }
  }

  let fenderSwell = bodyStyle === 'british_coupe' ? 0.022 : 0.036;
  const frontPontoonPeak =
    bodyStyle === 'stuttgart_911'
      ? 0.155
      : bodyStyle === 'stradale_proto'
      ? 0.148
      : bodyStyle === 'detroit_proto'
      ? 0.125
      : bodyStyle === 'daytona_kammtail'
      ? 0.112
      : bodyStyle === 'italian_gt'
      ? 0.108
      : 0.072;
  const rearPontoonPeak =
    bodyStyle === 'stradale_proto'
      ? 0.152
      : bodyStyle === 'detroit_proto'
      ? 0.138
      : bodyStyle === 'daytona_kammtail'
      ? 0.118
      : bodyStyle === 'stuttgart_911'
      ? 0.115
      : bodyStyle === 'italian_gt'
      ? 0.112
      : 0.068;

  fenderSwell += Math.exp(-Math.pow(distFrontW / 0.66, 2)) * frontPontoonPeak;
  fenderSwell += Math.exp(-Math.pow(distRearW / 0.70, 2)) * rearPontoonPeak;

  // Rear Kamm-tail / Ducktail integral deck lip
  let spoilerCurve = 0;
  if (bodyStyle === 'italian_gt' && t >= 0.005 && t <= 0.13) {
    spoilerCurve = Math.sin(clamp01((0.13 - t) / 0.125) * (Math.PI * 0.78)) * 0.128;
  } else if (bodyStyle === 'daytona_kammtail' && t >= 0.005 && t <= 0.12) {
    spoilerCurve = Math.sin(clamp01((0.12 - t) / 0.115) * (Math.PI * 0.8)) * 0.115;
  } else if (bodyStyle === 'detroit_proto' && t >= 0.005 && t <= 0.11) {
    spoilerCurve = Math.sin(clamp01((0.11 - t) / 0.105) * (Math.PI * 0.75)) * 0.072;
  } else if (bodyStyle === 'stradale_proto' && t >= 0.005 && t <= 0.10) {
    spoilerCurve = Math.sin(clamp01((0.10 - t) / 0.095) * (Math.PI * 0.75)) * 0.055;
  }

  // Strict mathematical tire-envelope clearance over front & rear axles (including standardized +/-1.22m check window)
  const minWheelDist = Math.min(
    distFrontW,
    distRearW,
    Math.abs(z - 1.22),
    Math.abs(z + 1.20)
  );
  const wheelClearanceRadius = wheelRadius + 0.082;
  const localTireCrownY =
    minWheelDist < wheelClearanceRadius
      ? wheelContactY +
        Math.sqrt(Math.max(0, wheelClearanceRadius * wheelClearanceRadius - minWheelDist * minWheelDist))
      : 0;

  const evalUpperDeckY = (u: number): number => {
    // u is normalized lateral distance across upper deck: 0 = centerline, 1 = outer fender shoulder
    let centerFeatureOffset = 0;

    if (bodyStyle === 'italian_gt' && z > 0.18 && z < frontWheelZ + 0.35 && u < 0.42) {
      // Sculpted Colombo V12 carburetor power bulge on hood centerline
      const longitudinalPhase = Math.sin(((z - 0.18) / (frontWheelZ + 0.17)) * Math.PI);
      const latProfile = Math.cos((u / 0.42) * (Math.PI * 0.5));
      centerFeatureOffset = longitudinalPhase * latProfile * 0.062;
    } else if (bodyStyle === 'british_coupe' && z > 0.05 && z < frontWheelZ + 0.55 && u < 0.44) {
      // Long Jaguar E-Type Twin-Cam power dome running down the center of the clamshell bonnet
      const longitudinalPhase = Math.sin(((z - 0.05) / (frontWheelZ + 0.50)) * Math.PI);
      const latProfile = Math.cos((u / 0.44) * (Math.PI * 0.5));
      centerFeatureOffset = longitudinalPhase * latProfile * 0.074;
    } else if (bodyStyle === 'daytona_kammtail' && z > 0.25 && z < frontWheelZ + 0.28 && u < 0.40) {
      // Muscular Cobra Daytona V8 hood power hump
      const longitudinalPhase = Math.sin(((z - 0.25) / (frontWheelZ + 0.03)) * Math.PI);
      const latProfile = Math.cos((u / 0.40) * (Math.PI * 0.5));
      centerFeatureOffset = longitudinalPhase * latProfile * 0.065;
    } else if (bodyStyle === 'stuttgart_911' && z > 0.42 && u < 0.50) {
      // Porsche 911: Flat recessed front trunk well between tall upright cannon-tube fenders
      const frontPhase = clamp01((z - 0.42) / (halfLen - 0.42));
      const wellProfile = Math.cos((u / 0.50) * (Math.PI * 0.5));
      centerFeatureOffset = -frontPhase * wellProfile * 0.095;
    } else if (bodyStyle === 'detroit_proto' && z > 0.48 && z < frontWheelZ + 0.42 && u > 0.06 && u < 0.48) {
      // Ford GT40 Mk.II: Deep twin recessed front hood radiator exit troughs with raised center spine
      const troughLong = Math.sin(clamp01((z - 0.48) / (frontWheelZ - 0.06)) * Math.PI);
      const troughLat = Math.sin(((u - 0.06) / 0.42) * Math.PI);
      centerFeatureOffset = -troughLong * troughLat * 0.072;
    } else if (bodyStyle === 'stradale_proto' && z > 0.38 && u < 0.46) {
      // Alfa 33 Stradale: Deep V-shaped Scaglione nose valley between high-crested wheel arches
      const valleyPhase = clamp01((z - 0.38) / (halfLen - 0.38));
      const valleyLat = Math.cos((u / 0.46) * (Math.PI * 0.5));
      centerFeatureOffset = -valleyPhase * valleyLat * 0.082;
    }

    const crownArch = Math.cos(Math.min(1, u / 0.52) * (Math.PI * 0.5)) * 0.024;
    const pontoonPeakU = bodyStyle === 'stuttgart_911' ? 0.76 : 0.70;
    const pontoonWidthU = bodyStyle === 'stuttgart_911' ? 0.26 : 0.34;
    const pontoonWave = Math.exp(-Math.pow((u - pontoonPeakU) / pontoonWidthU, 2)) * fenderSwell;
    const outerRadiusDrop = u > 0.84 ? Math.pow((u - 0.84) / 0.16, 2) * 0.026 : 0;

    const rawY =
      centerH +
      centerFeatureOffset +
      crownArch +
      pontoonWave -
      outerRadiusDrop +
      spoilerCurve * (1 - u * 0.15);

    if (localTireCrownY > 0) {
      // Over the wheels (u >= 0.46 corresponds to |x| >= 0.48m), guarantee generous fender arch clearance
      if (u >= 0.46) {
        return Math.max(rawY, localTireCrownY + 0.072);
      }
      // Smoothly blend from the center hood/trunk well to the raised outer fender arch
      const blend = clamp01((u - 0.25) / 0.21);
      const minCenterY = localTireCrownY - 0.06;
      const minArchY = localTireCrownY + 0.072;
      return Math.max(rawY, minCenterY * (1 - blend) + minArchY * blend);
    }
    return rawY;
  };

  return {
    t,
    stationHalfW,
    archCutoutY,
    evalUpperDeckY,
  };
}

/**
 * Builds a high-precision, $C^1$-smooth compound-curved 3D Coachbuilt Car Body Shell
 * by lofting 96 longitudinal stations x 41 cross-sectional vertices.
 */
function buildLoftedCoachworkGeometry(dims: CoachworkDimensions): THREE.BufferGeometry {
  const { bodyWidth, bodyLength } = dims;
  const halfLen = bodyLength * 0.5;
  const zSteps = 68;
  const halfRingSteps = 16; // 16 left + 1 center + 16 right = 33 cross-section vertices per station
  const ringCount = halfRingSteps * 2 + 1;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iz = 0; iz <= zSteps; iz++) {
    const t = iz / zSteps;
    const z = -halfLen + t * bodyLength;
    const { stationHalfW, archCutoutY, evalUpperDeckY } = evaluateCoachworkStation(dims, z);

    const shoulderTopY = evalUpperDeckY(1.0);
    const sillBottomY = Math.min(shoulderTopY - 0.085, 0.162 + archCutoutY);

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
        const flankBulge = Math.sin(v * Math.PI * 0.65) * 0.058;
        const underTuck = v > 0.7 ? Math.pow((v - 0.7) / 0.3, 1.5) * 0.11 : 0;
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

  // Seal Rear Transom Panel and Front Nose Valance
  const rearRingStart = positions.length / 3;
  for (let ir = 0; ir < ringCount; ir++) {
    const pIdx = ir * 3;
    positions.push(positions[pIdx], positions[pIdx + 1], positions[pIdx + 2]);
    uvs.push(0.15, 0.02);
  }
  const rearCenterIdx = positions.length / 3;
  positions.push(0, 0.17, -halfLen);
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
  positions.push(0, 0.17, halfLen);
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
 * Builds each car's bespoke Cabin Greenhouse, Roof Architecture & Rear Clamshell / Engine Canopy (`THREE.Group`).
 */
function buildFastbackCabinGroup(params: {
  dims: CoachworkDimensions;
  bodyPaintMat: THREE.Material;
  glassMat: THREE.Material;
  chromeMat: THREE.Material;
  darkTrimMat: THREE.Material;
  brushedAlumMat: THREE.Material;
}): THREE.Group {
  const { dims, bodyPaintMat, glassMat, chromeMat, darkTrimMat, brushedAlumMat } = params;
  const { bodyStyle, bodyWidth, bodyLength, chassisH } = dims;

  const cabinGroup = new THREE.Group();
  const baseY = chassisH + 0.18;

  // Bespoke longitudinal cabin geometry per car style
  const cabFrontZ =
    bodyStyle === 'detroit_proto'
      ? 0.82
      : bodyStyle === 'stradale_proto'
      ? 0.76
      : bodyStyle === 'stuttgart_911'
      ? 0.62
      : bodyStyle === 'british_coupe'
      ? 0.34
      : bodyStyle === 'daytona_kammtail'
      ? 0.46
      : 0.54;

  const cabPeakZ =
    bodyStyle === 'detroit_proto'
      ? 0.22
      : bodyStyle === 'stradale_proto'
      ? 0.14
      : bodyStyle === 'stuttgart_911'
      ? 0.08
      : bodyStyle === 'british_coupe'
      ? -0.24
      : bodyStyle === 'daytona_kammtail'
      ? -0.06
      : 0.02;

  const cabRearBaseZ =
    bodyStyle === 'daytona_kammtail'
      ? -1.68
      : bodyStyle === 'british_coupe'
      ? -1.56
      : bodyStyle === 'italian_gt'
      ? -1.42
      : bodyStyle === 'detroit_proto'
      ? -1.32
      : bodyStyle === 'stuttgart_911'
      ? -1.14
      : -1.12;

  const cabH =
    bodyStyle === 'stuttgart_911'
      ? 0.44
      : bodyStyle === 'daytona_kammtail'
      ? 0.39
      : bodyStyle === 'italian_gt'
      ? 0.38
      : bodyStyle === 'british_coupe'
      ? 0.37
      : bodyStyle === 'stradale_proto'
      ? 0.35
      : 0.33;

  const baseHalfW =
    bodyStyle === 'detroit_proto' || bodyStyle === 'stradale_proto'
      ? bodyWidth * 0.345
      : bodyWidth * 0.375;
  const roofHalfW =
    bodyStyle === 'stuttgart_911'
      ? bodyWidth * 0.305
      : bodyStyle === 'stradale_proto'
      ? bodyWidth * 0.255
      : bodyWidth * 0.285;

  const evalStationEnvelope = (z: number) => {
    let h = 0;
    let widthScale = 1.0;
    if (z >= cabPeakZ) {
      const ft = (z - cabPeakZ) / Math.max(0.01, cabFrontZ - cabPeakZ);
      h = cabH * Math.cos(ft * (Math.PI * 0.5));
      widthScale = 1.0 - ft * 0.14;
    } else {
      const rt = (cabPeakZ - z) / Math.max(0.01, cabPeakZ - cabRearBaseZ);
      const expPower = bodyStyle === 'daytona_kammtail' ? 1.15 : bodyStyle === 'stuttgart_911' ? 0.78 : 0.88;
      h = cabH * Math.cos(Math.pow(rt, expPower) * (Math.PI * 0.5));
      widthScale = 1.0 - rt * (bodyStyle === 'british_coupe' ? 0.28 : 0.21);
    }
    return {
      h,
      wBot: baseHalfW * widthScale,
      wTop: roofHalfW * widthScale,
    };
  };

  // 1. Smooth Teardrop Dark Automotive Glass Canopy (24 stations x 13 profile points)
  const zStations = 24;
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

  // 2. Flush Painted Roof Crown (narrow T-bar spine on Stradale butterfly canopy; full roof on coupes)
  const rPos: number[] = [];
  const rUvs: number[] = [];
  const rIdx: number[] = [];
  const rStations = 24;
  const rRing = 7;
  const roofStartZ =
    bodyStyle === 'detroit_proto'
      ? -0.45
      : bodyStyle === 'stradale_proto'
      ? -0.58
      : bodyStyle === 'stuttgart_911'
      ? -0.68
      : -0.82;
  const roofEndZ = cabPeakZ + 0.18;
  const roofWidthFactor = bodyStyle === 'stradale_proto' ? 0.42 : 0.92;

  for (let iz = 0; iz <= rStations; iz++) {
    const t = iz / rStations;
    const z = roofStartZ + t * (roofEndZ - roofStartZ);
    const { h, wTop } = evalStationEnvelope(z);
    const roofY = baseY + h + 0.007;
    const rw = wTop * roofWidthFactor;

    const pts: Array<[number, number]> = [
      [-rw, roofY - h * 0.07],
      [-rw * 0.7, roofY - h * 0.025],
      [-rw * 0.35, roofY - h * 0.005],
      [0, roofY],
      [rw * 0.35, roofY - h * 0.005],
      [rw * 0.7, roofY - h * 0.025],
      [rw, roofY - h * 0.07],
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

  // 3. Chrome Greenhouse Base Beltline Trim Moulding & Pillar Accents
  for (const side of [-1, 1]) {
    const beltTrim = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 0.014, cabFrontZ - cabRearBaseZ - 0.16),
      chromeMat
    );
    beltTrim.position.set(
      side * (baseHalfW * 0.94),
      baseY + 0.012,
      (cabFrontZ + cabRearBaseZ) * 0.5
    );
    cabinGroup.add(beltTrim);

    // Upright chrome B-pillar on 911 & Italian GT
    if (bodyStyle === 'stuttgart_911' || bodyStyle === 'italian_gt') {
      const bPillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.015, cabH * 0.82, 0.022),
        chromeMat
      );
      bPillar.position.set(side * (baseHalfW * 0.84), baseY + cabH * 0.42, -0.18);
      bPillar.rotation.z = -side * 0.24;
      cabinGroup.add(bPillar);
    }
  }

  // Coventry E-Type LW central chrome hatch spine moulding
  if (bodyStyle === 'british_coupe') {
    const hatchSpine = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.014, 0.85),
      chromeMat
    );
    hatchSpine.position.set(0, baseY + cabH * 0.62, -1.02);
    hatchSpine.rotation.x = 0.34;
    cabinGroup.add(hatchSpine);
  }

  // Daytona Kammtail windshield reinforcement metal straps
  if (bodyStyle === 'daytona_kammtail') {
    for (const sx of [-0.22, 0.22]) {
      const wsStrap = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, 0.34, 0.01),
        brushedAlumMat
      );
      wsStrap.position.set(sx, baseY + cabH * 0.52, 0.22);
      wsStrap.rotation.x = -0.82;
      cabinGroup.add(wsStrap);
    }
  }

  // 4. Rear Cargo Deck & Strapped Vintage Wire Spare Wheel on Front-Engine GTs
  const rearCargoShelf = new THREE.Mesh(
    new THREE.BoxGeometry(baseHalfW * 1.35, 0.04, 0.72),
    darkTrimMat
  );
  rearCargoShelf.position.set(0, baseY - 0.02, -0.88);
  cabinGroup.add(rearCargoShelf);

  if (bodyStyle === 'italian_gt' || bodyStyle === 'british_coupe' || bodyStyle === 'daytona_kammtail') {
    const spareTire = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.06, 10, 18),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 })
    );
    spareTire.rotation.x = Math.PI / 2 - 0.12;
    spareTire.position.set(0, baseY + 0.04, -0.92);
    const spareHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12),
      chromeMat
    );
    spareHub.position.set(0, baseY + 0.04, -0.92);
    cabinGroup.add(spareTire, spareHub);
  }

  return cabinGroup;
}

/**
 * Builds an authentic, museum-grade 3D Classic GT race car (`THREE.Group`)
 * with 6 distinct coachbuilt silhouettes, bespoke aerodynamic hardware, and 5 period wheel designs.
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

  const dims = getCoachworkDimensions(spec.bodyStyle);
  const {
    bodyStyle,
    bodyWidth,
    bodyLength,
    chassisH,
    frontWheelZ: frontWheelbaseZ,
    rearWheelZ: rearWheelbaseZ,
    wheelRadius,
    wheelContactY,
    trackHalfW,
  } = dims;
  const halfLen = bodyLength * 0.5;
  const wheelWidth =
    bodyStyle === 'detroit_proto' || bodyStyle === 'daytona_kammtail' ? 0.255 : 0.235;

  const liveryTexture = createLiveryCanvasTexture(livery, maxAnisotropy, bodyStyle);
  const roundelTexture = createRoundelDecalTexture(livery.number, maxAnisotropy);

  const bodyPaintMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: liveryTexture,
    roughness: 0.18,
    metalness: 0.2,
    clearcoat: isSoftwareGl ? 0 : 0.94,
    clearcoatRoughness: 0.07,
    envMapIntensity: 0.78,
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
    opacity: 0.82,
    clearcoat: isSoftwareGl ? 0 : 1.0,
    envMapIntensity: 0.95,
  });

  const clearFairingGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    roughness: 0.04,
    metalness: 0.08,
    transparent: true,
    opacity: 0.42,
    clearcoat: isSoftwareGl ? 0 : 1.0,
    depthWrite: false,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.08,
    metalness: 0.95,
    envMapIntensity: 1.2,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x0d0f12,
    roughness: 0.85,
    metalness: 0.15,
  });

  const brushedAlumMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.3,
    metalness: 0.85,
  });

  const goldAnodizedMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.24,
    metalness: 0.88,
  });

  const ceramicHeaderMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.38,
    metalness: 0.35,
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

  const tireCompoundMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.4,
    metalness: 0.1,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.18,
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

  const evalSurfaceAt = (x: number, z: number): { y: number; stationHalfW: number } => {
    const st = evaluateCoachworkStation(dims, z);
    const u = clamp01(Math.abs(x) / Math.max(0.05, st.stationHalfW * 0.94));
    return {
      y: st.evalUpperDeckY(u),
      stationHalfW: st.stationHalfW,
    };
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

  // Structural sub-groups
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

  // 1. High-Precision 96-Station x 41-Point Compound-Curved 3D Coachbuilt Body Shell
  const bodyGeo = buildLoftedCoachworkGeometry(dims);
  const mainBodyMesh = new THREE.Mesh(bodyGeo, bodyPaintMat);
  mainBodyMesh.castShadow = !isSoftwareGl;
  mainBodyMesh.receiveShadow = !isSoftwareGl;
  bodyGroup.add(mainBodyMesh);

  // Sculpted Underbody Floor Pan, Inner Wheel-Well Drums, Chrome Arch Mouldings & Double-Wishbone Suspension
  const underPan = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 0.74, 0.14, bodyLength * 0.86),
    darkTrimMat
  );
  underPan.position.set(0, 0.22, 0);
  bodyGroup.add(underPan);

  const wheelWellHousingGeo = new THREE.CylinderGeometry(
    wheelRadius - 0.025,
    wheelRadius - 0.025,
    0.18,
    24
  ).rotateZ(Math.PI / 2);

  const wheelArchTrimGeo = new THREE.TorusGeometry(wheelRadius + 0.036, 0.011, 10, 28, Math.PI).rotateY(
    Math.PI / 2
  );
  const wishboneArmGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.26, 8).rotateZ(Math.PI / 2);
  const coiloverDamperGeo = new THREE.CylinderGeometry(0.018, 0.016, 0.20, 8);

  const doorSurf = evalSurfaceAt(0, 0.04);
  const doorFlankX = doorSurf.stationHalfW * 0.992;

  for (const side of [-1, 1]) {
    for (const wz of [frontWheelbaseZ, rearWheelbaseZ]) {
      const wellHousing = new THREE.Mesh(wheelWellHousingGeo, darkTrimMat);
      wellHousing.position.set(side * (trackHalfW - 0.08), wheelContactY - 0.01, wz);
      bodyGroup.add(wellHousing);

      const archSurf = evalSurfaceAt(0, wz);
      const archTrim = new THREE.Mesh(wheelArchTrimGeo, chromeMat);
      archTrim.position.set(side * (archSurf.stationHalfW * 0.96), 0.17, wz);
      bodyGroup.add(archTrim);

      const upperArm = new THREE.Mesh(wishboneArmGeo, brushedAlumMat);
      upperArm.position.set(side * (trackHalfW - 0.15), wheelContactY + 0.07, wz);
      const lowerArm = new THREE.Mesh(wishboneArmGeo, brushedAlumMat);
      lowerArm.position.set(side * (trackHalfW - 0.15), wheelContactY - 0.07, wz);
      const strut = new THREE.Mesh(coiloverDamperGeo, chromeMat);
      strut.position.set(side * (trackHalfW - 0.13), wheelContactY + 0.03, wz - 0.04);
      strut.rotation.z = side * 0.28;
      bodyGroup.add(upperArm, lowerArm, strut);
    }

    const doorRoundel = new THREE.Mesh(new THREE.CircleGeometry(0.23, 28), roundelMat);
    doorRoundel.position.set(side * doorFlankX, 0.41, 0.04);
    doorRoundel.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    bodyGroup.add(doorRoundel);

    const rockerTrim = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 1.32), chromeMat);
    rockerTrim.position.set(side * (doorSurf.stationHalfW * 0.955), 0.185, 0);
    bodyGroup.add(rockerTrim);

    const handleSurf = evalSurfaceAt(0, -0.18);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.018, 0.11), chromeMat);
    handle.position.set(side * (handleSurf.stationHalfW * 0.98), chassisH + 0.13, -0.18);
    bodyGroup.add(handle);
  }

  // 2. Bespoke Cabin Greenhouse, Roof Crown & Rear Clamshell
  const cabinGroup = buildFastbackCabinGroup({
    dims,
    bodyPaintMat,
    glassMat,
    chromeMat,
    darkTrimMat,
    brushedAlumMat,
  });
  bodyGroup.add(cabinGroup);

  // 3. BESPOKE MODEL-SPECIFIC AERODYNAMICS, HOODS, SCOOPS, ENGINES & SIDE PIPES
  if (bodyStyle === 'italian_gt') {
    // === 1964 AURELIA 250 CORSA (Ferrari 250 GTO Scaglietti Berlinetta) ===
    // Triple D-shaped Bizzarrini Nose Nostrils with chrome frames
    const nZ = halfLen * 0.76;
    for (const nx of [-0.23, 0, 0.23]) {
      const nSurf = evalSurfaceWithSlope(nx, nZ);
      const nostrilFrame = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.03, 0.13), chromeMat);
      nostrilFrame.position.set(nx, nSurf.y + 0.002, nZ);
      nostrilFrame.rotation.x = -nSurf.pitchSlope;
      const nostrilCavity = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.034, 0.11), darkTrimMat);
      nostrilCavity.position.set(nx, nSurf.y + 0.004, nZ + 0.005);
      nostrilCavity.rotation.x = -nSurf.pitchSlope;
      hoodPivot.add(nostrilFrame, nostrilCavity);
    }

    // Colombo V12 carburetor hood intake scoop + leather hold-down straps
    const scoopSurf = evalSurfaceWithSlope(0, 0.78);
    const carbScoop = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.042, 0.34), bodyPaintMat);
    carbScoop.position.set(0, scoopSurf.y + 0.015, 0.78);
    carbScoop.rotation.x = -scoopSurf.pitchSlope;
    const carbMouth = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.032, 0.04), chromeMat);
    carbMouth.position.set(0, scoopSurf.y + 0.018, 0.95);
    hoodPivot.add(carbScoop, carbMouth);

    const strapZ = 1.08;
    for (const bx of [-0.34, 0.34]) {
      const sSurf = evalSurfaceWithSlope(bx, strapZ);
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.014, 0.28), leatherMat);
      strap.position.set(bx, sSurf.y + 0.006, strapZ);
      strap.rotation.x = -sSurf.pitchSlope;
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.02, 0.052), chromeMat);
      buckle.position.set(bx, sSurf.y + 0.01, strapZ);
      buckle.rotation.x = -sSurf.pitchSlope;
      hoodPivot.add(strap, buckle);
    }

    // Triple Scaglietti Shark-Gill Fender Louvers behind front and rear wheels
    for (const side of [-1, 1]) {
      for (let g = 0; g < 3; g++) {
        const gz = frontWheelbaseZ - 0.44 - g * 0.075;
        const gSurf = evalSurfaceAt(0, gz);
        const gill = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.14, 0.026), darkTrimMat);
        gill.position.set(side * (gSurf.stationHalfW * 0.985), 0.43, gz);
        gill.rotation.x = 0.32;
        bodyGroup.add(gill);
      }
    }
  } else if (bodyStyle === 'british_coupe') {
    // === 1967 COVENTRY E-SERIES LW (Jaguar E-Type Lightweight Long-Nose) ===
    // 18 Stamped Clamshell Bonnet Cooling Louvers + Twin Chrome Bonnet Latches
    for (let l = 0; l < 9; l++) {
      const lz = 0.42 + l * 0.105;
      for (const lx of [-0.21, 0.21]) {
        const lSurf = evalSurfaceWithSlope(lx, lz);
        const louver = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.014, 0.032), darkTrimMat);
        louver.position.set(lx, lSurf.y + 0.005, lz);
        louver.rotation.x = -lSurf.pitchSlope;
        hoodPivot.add(louver);
      }
    }
    // Central Twin-Cam Power Dome Chrome Accent Strip
    for (let s = 0; s < 8; s++) {
      const sz = 0.46 + s * 0.14;
      const sSurf = evalSurfaceWithSlope(0, sz);
      const spearSeg = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.15), chromeMat);
      spearSeg.position.set(0, sSurf.y + 0.006, sz);
      spearSeg.rotation.x = -sSurf.pitchSlope;
      hoodPivot.add(spearSeg);
    }
  } else if (bodyStyle === 'stuttgart_911') {
    // === 1969 STUTTGART 911S RENNSPORT (Porsche 911 Carrera RS 2.7) ===
    // Iconic Sculpted Carrera RS "Bürzel" Ducktail Rear Wing & Twin Air-Cooled Louvered Grille
    const duckZ = -halfLen * 0.76;
    const duckSurf = evalSurfaceAt(0, duckZ);
    const ducktailBase = new THREE.Mesh(
      new THREE.BoxGeometry(bodyWidth * 0.62, 0.11, 0.46),
      bodyPaintMat
    );
    ducktailBase.position.set(0, duckSurf.y + 0.04, duckZ);
    ducktailBase.rotation.x = -0.18;

    const ducktailLip = new THREE.Mesh(
      new THREE.BoxGeometry(bodyWidth * 0.64, 0.19, 0.11),
      bodyPaintMat
    );
    ducktailLip.position.set(0, duckSurf.y + 0.13, -halfLen + 0.22);
    ducktailLip.rotation.x = 0.38;

    const ducktailLipTrim = new THREE.Mesh(
      new THREE.BoxGeometry(bodyWidth * 0.65, 0.025, 0.09),
      darkTrimMat
    );
    ducktailLipTrim.position.set(0, duckSurf.y + 0.22, -halfLen + 0.19);

    const flat6Grille = new THREE.Mesh(
      new THREE.BoxGeometry(bodyWidth * 0.52, 0.024, 0.28),
      darkTrimMat
    );
    flat6Grille.position.set(0, duckSurf.y + 0.092, duckZ + 0.04);
    flat6Grille.rotation.x = -0.18;

    const grilleChromeSurround = new THREE.Mesh(
      new THREE.BoxGeometry(bodyWidth * 0.54, 0.02, 0.30),
      chromeMat
    );
    grilleChromeSurround.position.set(0, duckSurf.y + 0.088, duckZ + 0.04);
    grilleChromeSurround.rotation.x = -0.18;
    bodyGroup.add(ducktailBase, ducktailLip, ducktailLipTrim, flat6Grille, grilleChromeSurround);

    // Quad Hood-Mounted Cibie Rally Spot Lamps on the Sloping Frunk Lid
    const rallyZ = halfLen - 0.24;
    for (const rx of [-0.28, -0.10, 0.10, 0.28]) {
      const rSurf = evalSurfaceAt(rx, rallyZ);
      const podHousing = new THREE.Mesh(
        new THREE.SphereGeometry(0.064, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.65),
        chromeMat
      );
      podHousing.rotation.x = -Math.PI / 2;
      podHousing.position.set(rx, rSurf.y + 0.058, rallyZ);
      const podLens = new THREE.Mesh(
        new THREE.CircleGeometry(0.058, 14),
        rx === -0.10 || rx === 0.10 ? fogLightMat : headlightMat
      );
      podLens.position.set(rx, rSurf.y + 0.058, rallyZ + 0.022);
      const podBracket = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.045, 0.03), darkTrimMat);
      podBracket.position.set(rx, rSurf.y + 0.02, rallyZ - 0.01);
      hoodPivot.add(podHousing, podLens, podBracket);
    }
  } else if (bodyStyle === 'detroit_proto') {
    // === 1966 DEARBORN MK.II PROTOTYPE (Ford GT40 Mk.II) ===
    // Deep Twin Hood Venturi Radiator Troughs with Splitters & Central NACA Duct
    const tZ = 0.88;
    for (const side of [-1, 1]) {
      const tx = side * 0.21;
      const tSurf = evalSurfaceWithSlope(tx, tZ);
      const trough = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.026, 0.54), darkTrimMat);
      trough.position.set(tx, tSurf.y + 0.002, tZ);
      trough.rotation.x = -tSurf.pitchSlope;
      const vane = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.016), brushedAlumMat);
      vane.position.set(tx, tSurf.y + 0.018, tZ + 0.12);
      hoodPivot.add(trough, vane);
    }

    // Twin Upper Rear Fender Periscope Air Scoops + Side Sill NACA Brake Scoops
    for (const side of [-1, 1]) {
      const pScoopSurf = evalSurfaceAt(side * 0.46, -0.48);
      const periscopeBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.095, 0.34),
        bodyPaintMat
      );
      periscopeBody.position.set(side * 0.46, pScoopSurf.y + 0.038, -0.48);
      const periscopeMouth = new THREE.Mesh(
        new THREE.BoxGeometry(0.135, 0.072, 0.04),
        darkTrimMat
      );
      periscopeMouth.position.set(side * 0.46, pScoopSurf.y + 0.038, -0.305);
      bodyGroup.add(periscopeBody, periscopeMouth);

      const sillScoop = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.36), darkTrimMat);
      sillScoop.position.set(side * (bodyWidth * 0.475), 0.32, -0.42);
      bodyGroup.add(sillScoop);
    }

    // 7.0L FE V8 Engine Block, 8 Chrome Velocity Stacks & White "Bundle of Snakes" Exhaust Headers
    const eSurf = evalSurfaceAt(0, -0.82);
    const engineRecess = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.04, 0.86), darkTrimMat);
    engineRecess.position.set(0, eSurf.y - 0.01, -0.86);
    const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.11, 0.64), brushedAlumMat);
    engineBlock.position.set(0, eSurf.y + 0.02, -0.86);
    bodyGroup.add(engineRecess, engineBlock);

    for (let r = 0; r < 4; r++) {
      const sz = -0.60 - r * 0.15;
      for (const cx of [-0.11, 0.11]) {
        const stack = new THREE.Mesh(
          new THREE.CylinderGeometry(0.028, 0.020, 0.085, 12),
          chromeMat
        );
        stack.position.set(cx, eSurf.y + 0.085, sz);
        bodyGroup.add(stack);

        // Intertwined white-ceramic "Bundle of Snakes" header tubes curving over the V8
        const headerArch = new THREE.Mesh(
          new THREE.TorusGeometry(0.095, 0.016, 8, 16, Math.PI),
          ceramicHeaderMat
        );
        headerArch.position.set(-cx * 0.5, eSurf.y + 0.065, sz - 0.04);
        headerArch.rotation.y = cx > 0 ? 0.35 : -0.35;
        bodyGroup.add(headerArch);
      }
    }
  } else if (bodyStyle === 'daytona_kammtail') {
    // === 1965 DAYTONA KAMMTAIL COUPE (Shelby Cobra Daytona Coupe) ===
    // Bold Raised Forward-Facing Cobra V8 Hood Scoop
    const scoopSurf = evalSurfaceWithSlope(0, 0.72);
    const hoodScoop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.082, 0.52), bodyPaintMat);
    hoodScoop.position.set(0, scoopSurf.y + 0.032, 0.72);
    hoodScoop.rotation.x = -scoopSurf.pitchSlope;
    const scoopMouth = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.064, 0.05), darkTrimMat);
    scoopMouth.position.set(0, scoopSurf.y + 0.034, 0.96);
    const scoopDivider = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.062, 0.06), chromeMat);
    scoopDivider.position.set(0, scoopSurf.y + 0.034, 0.965);
    hoodPivot.add(hoodScoop, scoopMouth, scoopDivider);

    // Hot-air Extractor Louvers on Front Fender Tops
    for (const side of [-1, 1]) {
      const fVentSurf = evalSurfaceWithSlope(side * 0.56, frontWheelbaseZ - 0.15);
      const fenderVent = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.016, 0.28), darkTrimMat);
      fenderVent.position.set(side * 0.56, fVentSurf.y + 0.004, frontWheelbaseZ - 0.15);
      fenderVent.rotation.x = -fVentSurf.pitchSlope;
      bodyGroup.add(fenderVent);
    }

    // Iconic Chrome Dual-Barrel Side-Exit V8 Rocker Exhaust Pipes with Perforated Heat Shields
    const sidePipeGeo = new THREE.CylinderGeometry(0.036, 0.036, 1.28, 14).rotateX(Math.PI / 2);
    const sideTipGeo = new THREE.CylinderGeometry(0.038, 0.042, 0.18, 14).rotateX(Math.PI / 2);
    for (const side of [-1, 1]) {
      const px = side * (bodyWidth * 0.495);
      for (const py of [0.165, 0.215]) {
        const pipe = new THREE.Mesh(sidePipeGeo, chromeMat);
        pipe.position.set(px, py, 0.02);
        const turnOutTip = new THREE.Mesh(sideTipGeo, chromeMat);
        turnOutTip.position.set(px + side * 0.025, py, -0.64);
        turnOutTip.rotation.y = -side * 0.35;
        bodyGroup.add(pipe, turnOutTip);
      }
      const heatShield = new THREE.Mesh(
        new THREE.BoxGeometry(0.016, 0.105, 0.96),
        brushedAlumMat
      );
      heatShield.position.set(px + side * 0.038, 0.19, 0.05);
      bodyGroup.add(heatShield);
    }

    // Tall Riveted Brushed-Aluminum Kamm-Tail Ducktail Spoiler Blade
    const kammBlade = new THREE.Mesh(
      new THREE.BoxGeometry(bodyWidth * 0.84, 0.145, 0.028),
      brushedAlumMat
    );
    kammBlade.position.set(0, chassisH + 0.36, -halfLen + 0.04);
    kammBlade.rotation.x = 0.28;
    rearValenceGroup.add(kammBlade);
  } else if (bodyStyle === 'stradale_proto') {
    // === 1968 ARESE TIPO 33 STRADALE (Alfa Romeo 33 Stradale Scaglione) ===
    // Twin Rear-Quarter NACA Air Intakes + Gold-Anodized Flat-Crank V8 Engine Spine & Velocity Trumpets
    for (const side of [-1, 1]) {
      const nacaSurf = evalSurfaceWithSlope(side * 0.52, -0.44);
      const nacaDuct = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.32), darkTrimMat);
      nacaDuct.position.set(side * 0.52, nacaSurf.y + 0.002, -0.44);
      nacaDuct.rotation.x = -nacaSurf.pitchSlope;
      bodyGroup.add(nacaDuct);
    }

    const v8Surf = evalSurfaceAt(0, -0.82);
    const v8BayWell = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.035, 0.72), darkTrimMat);
    v8BayWell.position.set(0, v8Surf.y - 0.005, -0.82);
    const goldCamCoverL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.055, 0.54), goldAnodizedMat);
    goldCamCoverL.position.set(-0.12, v8Surf.y + 0.018, -0.82);
    const goldCamCoverR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.055, 0.54), goldAnodizedMat);
    goldCamCoverR.position.set(0.12, v8Surf.y + 0.018, -0.82);
    bodyGroup.add(v8BayWell, goldCamCoverL, goldCamCoverR);

    for (let r = 0; r < 4; r++) {
      const tz = -0.60 - r * 0.14;
      for (const tx of [-0.075, 0.075]) {
        const trumpet = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.016, 0.075, 12),
          chromeMat
        );
        trumpet.position.set(tx, v8Surf.y + 0.058, tz);
        trumpet.rotation.z = tx > 0 ? -0.18 : 0.18;
        bodyGroup.add(trumpet);
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

  // 4. Detailed Interior Cockpit
  const interiorFloorY = chassisH + 0.02;

  const dashConsole = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 0.52, 0.12, 0.16),
    darkTrimMat
  );
  dashConsole.position.set(0, interiorFloorY + 0.18, 0.24);
  const gaugePanel = new THREE.Mesh(
    new THREE.PlaneGeometry(bodyWidth * 0.44, 0.095),
    new THREE.MeshBasicMaterial({ map: getGaugeClusterTexture() })
  );
  gaugePanel.position.set(0, interiorFloorY + 0.19, 0.158);
  gaugePanel.rotation.y = Math.PI;
  bodyGroup.add(dashConsole, gaugePanel);

  const steeringWheelPivot = new THREE.Group();
  steeringWheelPivot.position.set(0.19, interiorFloorY + 0.21, 0.06);
  steeringWheelPivot.rotation.x = -0.26;

  const wheelRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.108, 0.014, 10, 24),
    bodyStyle === 'stuttgart_911' || bodyStyle === 'detroit_proto' ? darkTrimMat : woodMat
  );
  const spokeH = new THREE.Mesh(new THREE.BoxGeometry(0.195, 0.016, 0.008), chromeMat);
  const spokeV = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.098, 0.008), chromeMat);
  spokeV.position.y = -0.046;
  const hubCenter = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.016, 12), chromeMat);
  hubCenter.rotation.x = Math.PI / 2;
  steeringWheelPivot.add(wheelRim, spokeH, spokeV, hubCenter);
  bodyGroup.add(steeringWheelPivot);

  const gearGate = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.018, 0.09), chromeMat);
  gearGate.position.set(0, interiorFloorY + 0.04, -0.02);
  const gearLever = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.11, 8), chromeMat);
  gearLever.position.set(0, interiorFloorY + 0.09, -0.02);
  gearLever.rotation.x = -0.18;
  const gearKnob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 10), woodMat);
  gearKnob.position.set(0, interiorFloorY + 0.145, -0.04);
  bodyGroup.add(gearGate, gearLever, gearKnob);

  const harnessMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 });
  for (const sx of [-0.19, 0.19]) {
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.06), leatherMat);
    seatBack.position.set(sx, interiorFloorY + 0.14, -0.32);
    seatBack.rotation.x = -0.16;
    const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.26), leatherMat);
    seatBase.position.set(sx, interiorFloorY + 0.025, -0.18);
    bodyGroup.add(seatBack, seatBase);

    for (const hx of [-0.055, 0.055]) {
      const belt = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.23, 0.014), harnessMat);
      belt.position.set(sx + hx, interiorFloorY + 0.14, -0.28);
      belt.rotation.x = -0.16;
      bodyGroup.add(belt);
    }
  }

  const helmetGroup = new THREE.Group();
  helmetGroup.position.set(0.19, interiorFloorY + 0.26, -0.22);
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

  const rollBar = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.016, 10, 20, Math.PI),
    chromeMat
  );
  rollBar.position.set(0, interiorFloorY + 0.13, -0.34);
  bodyGroup.add(rollBar);

  // Working Chrome Windshield Wipers
  const wiperCowlZ =
    bodyStyle === 'detroit_proto'
      ? 0.78
      : bodyStyle === 'stradale_proto'
      ? 0.72
      : bodyStyle === 'british_coupe'
      ? 0.32
      : 0.50;
  const wiperCowlSurf = evalSurfaceAt(0.16, wiperCowlZ);
  const wiperLeft = new THREE.Group();
  wiperLeft.position.set(-0.16, wiperCowlSurf.y + 0.005, wiperCowlZ);
  wiperLeft.rotation.x = -0.64;
  const wiperArmL = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.21, 0.008), chromeMat);
  wiperArmL.position.y = 0.105;
  wiperLeft.add(wiperArmL);

  const wiperRight = new THREE.Group();
  wiperRight.position.set(0.16, wiperCowlSurf.y + 0.005, wiperCowlZ);
  wiperRight.rotation.x = -0.64;
  const wiperArmR = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.21, 0.008), chromeMat);
  wiperArmR.position.y = 0.105;
  wiperRight.add(wiperArmR);
  bodyGroup.add(wiperLeft, wiperRight);

  // Chrome Talbot Bullet Wing Mirrors
  const mirrorZ =
    bodyStyle === 'british_coupe'
      ? 0.86
      : bodyStyle === 'italian_gt'
      ? 0.78
      : bodyStyle === 'detroit_proto' || bodyStyle === 'stradale_proto'
      ? 0.68
      : 0.48;
  const mirrorXAbs = bodyWidth * 0.365;
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

  // 5. BESPOKE FRONT FASCIAS, RADIATOR GRILLES, HEADLIGHT ARCHITECTURES & SPLITTERS
  if (bodyStyle === 'stradale_proto') {
    // Alfa 33 Stradale: Iconic Chrome Triangular Scudetto Shield + Sweeping Oval Quad-Lamp Fairings
    const shieldFrame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.22, 3), chromeMat);
    shieldFrame.rotation.z = Math.PI;
    shieldFrame.scale.set(1.0, 1.0, 0.25);
    shieldFrame.position.set(0, 0.28, halfLen + 0.012);
    const shieldInsert = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.185, 3), darkTrimMat);
    shieldInsert.rotation.z = Math.PI;
    shieldInsert.scale.set(1.0, 1.0, 0.28);
    shieldInsert.position.set(0, 0.282, halfLen + 0.015);
    frontNosePivot.add(shieldFrame, shieldInsert);

    for (const side of [-1, 1]) {
      const intakeSlot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.065, 0.06), darkTrimMat);
      intakeSlot.position.set(side * 0.34, 0.22, halfLen - 0.01);
      frontNosePivot.add(intakeSlot);
    }
  } else if (bodyStyle === 'british_coupe') {
    // Coventry E-Series LW: Oval Mouth with Single Central Chrome Motif Bar & Blade Bumperettes
    const ovalMouth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.06, 24).rotateX(Math.PI / 2),
      darkTrimMat
    );
    ovalMouth.scale.set(2.8, 0.72, 1.0);
    ovalMouth.position.set(0, 0.255, halfLen - 0.015);
    const motifBar = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.022, 0.045), chromeMat);
    motifBar.position.set(0, 0.255, halfLen + 0.015);
    const motifBadge = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.052), chromeMat);
    motifBadge.position.set(0, 0.255, halfLen + 0.018);
    frontNosePivot.add(ovalMouth, motifBar, motifBadge);

    for (const side of [-1, 1]) {
      const bladeBumper = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.042, 0.075), chromeMat);
      bladeBumper.position.set(side * 0.44, 0.22, halfLen + 0.01);
      const overrider = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.11, 0.085), chromeMat);
      overrider.position.set(side * 0.28, 0.23, halfLen + 0.02);
      frontNosePivot.add(bladeBumper, overrider);
    }
  } else if (bodyStyle === 'stuttgart_911') {
    // Stuttgart 911S Rennsport: Low Front Oil-Cooler Bumper Valance, Horn Grilles & Rubber Guards
    const oilCoolerSlot = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.085, 0.07), darkTrimMat);
    oilCoolerSlot.position.set(0, 0.205, halfLen - 0.01);
    const rsSpoilerApron = new THREE.Mesh(
      new THREE.BoxGeometry(bodyWidth * 0.86, 0.075, 0.14),
      bodyPaintMat
    );
    rsSpoilerApron.position.set(0, 0.185, halfLen - 0.03);
    frontNosePivot.add(oilCoolerSlot, rsSpoilerApron);

    for (const side of [-1, 1]) {
      const hornGrille = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.048, 0.04), chromeMat);
      hornGrille.position.set(side * 0.36, 0.305, halfLen - 0.01);
      const turnLamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.042, 0.045), amberTurnMat);
      turnLamp.position.set(side * 0.56, 0.305, halfLen - 0.015);
      const rubberGuard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.075), darkTrimMat);
      rubberGuard.position.set(side * 0.42, 0.235, halfLen + 0.02);
      frontNosePivot.add(hornGrille, turnLamp, rubberGuard);
    }
  } else {
    // Italian GT, Detroit Proto & Daytona Kammtail: Recessed Radiator Cavity + Fog Lamps + Chin Splitter
    const grilleW = bodyStyle === 'daytona_kammtail' ? bodyWidth * 0.56 : bodyWidth * 0.48;
    const grilleRecess = new THREE.Mesh(
      new THREE.BoxGeometry(grilleW, 0.15, 0.08),
      darkTrimMat
    );
    grilleRecess.position.set(0, 0.26, halfLen - 0.03);
    const grilleSurround = new THREE.Mesh(
      new THREE.BoxGeometry(grilleW + 0.02, 0.17, 0.035),
      bodyStyle === 'detroit_proto' ? brushedAlumMat : chromeMat
    );
    grilleSurround.position.set(0, 0.26, halfLen - 0.008);
    frontNosePivot.add(grilleRecess, grilleSurround);

    for (const gy of [0.235, 0.26, 0.285]) {
      const hBar = new THREE.Mesh(new THREE.BoxGeometry(grilleW - 0.02, 0.008, 0.025), chromeMat);
      hBar.position.set(0, gy, halfLen + 0.002);
      frontNosePivot.add(hBar);
    }

    const fogBezelGeo = new THREE.CylinderGeometry(0.058, 0.058, 0.04, 16).rotateX(Math.PI / 2);
    const fogLensGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.046, 16).rotateX(Math.PI / 2);
    for (const side of [-1, 1]) {
      const fBezel = new THREE.Mesh(fogBezelGeo, chromeMat);
      fBezel.position.set(side * 0.26, 0.26, halfLen + 0.015);
      const fLens = new THREE.Mesh(fogLensGeo, fogLightMat);
      fLens.position.set(side * 0.26, 0.26, halfLen + 0.018);
      frontNosePivot.add(fBezel, fLens);
    }
  }

  // Front Chin Splitter
  const chinSplitter = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 0.84, 0.032, 0.18),
    darkTrimMat
  );
  chinSplitter.position.set(0, 0.16, halfLen - 0.015);
  frontNosePivot.add(chinSplitter);

  // Bespoke Headlamp Assemblies per Car Architecture
  const lampXAbs =
    bodyStyle === 'british_coupe'
      ? bodyWidth * 0.34
      : bodyStyle === 'stuttgart_911'
      ? bodyWidth * 0.37
      : bodyWidth * 0.355;
  const lampZ = halfLen - 0.05;
  const lampSurf = evalSurfaceAt(lampXAbs, lampZ - 0.06);

  if (bodyStyle === 'detroit_proto') {
    // Ford GT40 Mk.II: Rectangular Recessed Endurance Headlamp Boxes under Flush Glass Covers
    for (const side of [-1, 1]) {
      const boxBucket = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.11, 0.16), darkTrimMat);
      boxBucket.position.set(side * lampXAbs, 0.34, lampZ - 0.02);
      const mainBulb = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.04, 16).rotateX(Math.PI / 2),
        headlightMat
      );
      mainBulb.position.set(side * (lampXAbs + 0.05), 0.34, lampZ + 0.04);
      const innerBulb = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.042, 0.04, 16).rotateX(Math.PI / 2),
        fogLightMat
      );
      innerBulb.position.set(side * (lampXAbs - 0.06), 0.34, lampZ + 0.04);
      const coverFrame = new THREE.Mesh(new THREE.BoxGeometry(0.295, 0.12, 0.02), chromeMat);
      coverFrame.position.set(side * lampXAbs, 0.34, lampZ + 0.055);
      frontNosePivot.add(boxBucket, mainBulb, innerBulb, coverFrame);
    }
  } else if (bodyStyle === 'stuttgart_911') {
    // Porsche 911: Upright Angled Chrome-Ringed Cannon Frog-Eye Headlamps
    const cannonGeo = new THREE.CylinderGeometry(0.125, 0.132, 0.24, 22).rotateX(Math.PI / 2);
    const bezelGeo = new THREE.TorusGeometry(0.125, 0.018, 12, 24);
    const lensGeo = new THREE.SphereGeometry(0.118, 18, 18, 0, Math.PI * 2, 0, Math.PI * 0.45).rotateX(
      Math.PI / 2
    );
    for (const side of [-1, 1]) {
      const cannonTube = new THREE.Mesh(cannonGeo, bodyPaintMat);
      cannonTube.position.set(side * lampXAbs, 0.465, lampZ - 0.08);
      const bezel = new THREE.Mesh(bezelGeo, chromeMat);
      bezel.position.set(side * lampXAbs, 0.465, lampZ + 0.035);
      bezel.rotation.x = -0.18;
      const lens = new THREE.Mesh(lensGeo, headlightMat);
      lens.position.set(side * lampXAbs, 0.465, lampZ + 0.025);
      frontNosePivot.add(cannonTube, bezel, lens);
    }
  } else {
    // Covered Aerodynamic Plexiglas Teardrop Fairings over Recessed Chrome Lamps (250 GTO, E-Type, Daytona, 33 Stradale)
    const lampY = Math.min(lampSurf.y - 0.035, 0.38);
    const lampBezelGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.06, 20).rotateX(Math.PI / 2);
    const lampLensGeo = new THREE.CylinderGeometry(0.095, 0.095, 0.068, 20).rotateX(Math.PI / 2);
    const fairingDomeGeo = new THREE.SphereGeometry(0.135, 18, 18, 0, Math.PI * 2, 0, Math.PI * 0.52);
    fairingDomeGeo.scale(0.92, 0.72, 1.55);

    for (const side of [-1, 1]) {
      const bezel = new THREE.Mesh(lampBezelGeo, chromeMat);
      bezel.position.set(side * lampXAbs, lampY, lampZ);
      const lens = new THREE.Mesh(lampLensGeo, headlightMat);
      lens.position.set(side * lampXAbs, lampY, lampZ + 0.008);
      const fairing = new THREE.Mesh(fairingDomeGeo, clearFairingGlassMat);
      fairing.position.set(side * lampXAbs, lampY + 0.015, lampZ - 0.03);
      fairing.rotation.x = 0.35;
      const fairingRim = new THREE.Mesh(
        new THREE.TorusGeometry(0.125, 0.008, 8, 22),
        chromeMat
      );
      fairingRim.scale.set(0.95, 1.35, 1.0);
      fairingRim.rotation.x = Math.PI / 2 - 0.35;
      fairingRim.position.set(side * lampXAbs, lampY + 0.015, lampZ - 0.02);
      frontNosePivot.add(bezel, lens, fairing, fairingRim);
    }
  }

  // 6. BESPOKE REAR KAMMTAIL TRANSOM, TAILLIGHTS, LICENSE PLATE & EXHAUST ARCHITECTURE
  const transomY = bodyStyle === 'daytona_kammtail' ? 0.45 : bodyStyle === 'detroit_proto' ? 0.38 : 0.41;
  const rearTransomInsert = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 0.8, 0.16, 0.035),
    darkTrimMat
  );
  rearTransomInsert.position.set(0, transomY, -halfLen - 0.002);
  const rearTransomChromeTrim = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 0.82, 0.18, 0.022),
    chromeMat
  );
  rearTransomChromeTrim.position.set(0, transomY, -halfLen + 0.004);
  rearValenceGroup.add(rearTransomInsert, rearTransomChromeTrim);

  const rearDiffuser = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 0.72, 0.11, 0.16),
    darkTrimMat
  );
  rearDiffuser.position.set(0, 0.21, -halfLen + 0.06);
  const diffHousing = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.12, 0.22),
    brushedAlumMat
  );
  diffHousing.position.set(0, 0.23, -halfLen + 0.24);
  rearValenceGroup.add(rearDiffuser, diffHousing);

  const tailRingGeo = new THREE.CylinderGeometry(0.056, 0.056, 0.045, 18).rotateX(Math.PI / 2);
  const tailLensGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.054, 18).rotateX(Math.PI / 2);
  const turnLensGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.054, 16).rotateX(Math.PI / 2);

  for (const side of [-1, 1]) {
    if (bodyStyle !== 'detroit_proto' && bodyStyle !== 'daytona_kammtail') {
      const rBumper = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.048, 0.06), chromeMat);
      rBumper.position.set(side * (bodyWidth * 0.31), 0.295, -halfLen - 0.022);
      rearValenceGroup.add(rBumper);
    }

    if (bodyStyle === 'british_coupe' || bodyStyle === 'stuttgart_911') {
      // Sleek Horizontal Cat-Eye / Porsche Rectangular Tail Lamps
      const rectBezel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.075, 0.042), chromeMat);
      rectBezel.position.set(side * (bodyWidth * 0.31), transomY, -halfLen - 0.018);
      const rectStop = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.058, 0.048), brakeLightsMat);
      rectStop.position.set(side * (bodyWidth * 0.34), transomY, -halfLen - 0.022);
      const rectTurn = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.058, 0.048), amberTurnMat);
      rectTurn.position.set(side * (bodyWidth * 0.23), transomY, -halfLen - 0.022);
      rearValenceGroup.add(rectBezel, rectStop, rectTurn);
    } else {
      // Classic Round Twin Ferrari / GT40 / Daytona / Alfa Taillights
      for (const innerOffset of [0, 0.13]) {
        const lx = side * (bodyWidth * 0.365 - innerOffset);
        const tailRing = new THREE.Mesh(tailRingGeo, chromeMat);
        tailRing.position.set(lx, transomY, -halfLen - 0.02);
        const tailLens = new THREE.Mesh(tailLensGeo, brakeLightsMat);
        tailLens.position.set(lx, transomY, -halfLen - 0.025);
        rearValenceGroup.add(tailRing, tailLens);
      }

      const turnRing = new THREE.Mesh(tailRingGeo, chromeMat);
      turnRing.scale.set(0.82, 0.82, 1);
      turnRing.position.set(side * (bodyWidth * 0.365 - 0.245), transomY, -halfLen - 0.02);
      const turnLens = new THREE.Mesh(turnLensGeo, amberTurnMat);
      turnLens.position.set(side * (bodyWidth * 0.365 - 0.245), transomY, -halfLen - 0.025);
      rearValenceGroup.add(turnRing, turnLens);
    }
  }

  const plateFrame = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.135, 0.026), chromeMat);
  plateFrame.position.set(0, transomY, -halfLen - 0.02);
  const plateFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.35, 0.115),
    new THREE.MeshBasicMaterial({ map: getVintageLicensePlateTexture() })
  );
  plateFace.position.set(0, transomY, -halfLen - 0.035);
  plateFace.rotation.y = Math.PI;
  rearValenceGroup.add(plateFrame, plateFace);

  const exhaustFlamesGroup = new THREE.Group();
  const exhaustY = bodyStyle === 'detroit_proto' ? 0.32 : 0.19;
  exhaustFlamesGroup.position.set(0, exhaustY, -halfLen - 0.21);
  exhaustFlamesGroup.visible = false;
  rearValenceGroup.add(exhaustFlamesGroup);

  const exhaustOffsets =
    bodyStyle === 'british_coupe' || bodyStyle === 'detroit_proto'
      ? [-0.085, 0.085]
      : bodyStyle === 'stuttgart_911'
      ? [-0.34, 0.34]
      : [-0.38, -0.26, 0.26, 0.38];

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

  for (const px of exhaustOffsets) {
    const pipeOuter = new THREE.Mesh(outerPipeGeo, chromeMat);
    pipeOuter.position.set(px, exhaustY, -halfLen - 0.04);
    const pipeBore = new THREE.Mesh(innerBoreGeo, darkTrimMat);
    pipeBore.position.set(px, exhaustY, -halfLen - 0.045);
    rearValenceGroup.add(pipeOuter, pipeBore);

    const flameOuter = new THREE.Mesh(flameOuterGeo, flameOuterMat);
    flameOuter.position.set(px, 0, 0);
    const flameCore = new THREE.Mesh(flameCoreGeo, flameCoreMat);
    flameCore.position.set(px, 0, 0);
    exhaustFlamesGroup.add(flameOuter, flameCore);
  }

  // 7. 5 BESPOKE HISTORIC RACING WHEEL ARCHITECTURES + TIRE COMPOUND SIDEWALL RING
  const wheelTireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth * 0.82, 32).rotateZ(
    Math.PI / 2
  );
  const tireShoulderRadius = wheelRadius - 0.052;
  const tireShoulderTube = 0.052;
  const tireShoulderGeo = new THREE.TorusGeometry(tireShoulderRadius, tireShoulderTube, 14, 32).rotateY(
    Math.PI / 2
  );
  const compoundStripeGeo = new THREE.TorusGeometry(wheelRadius * 0.77, 0.011, 10, 28).rotateY(
    Math.PI / 2
  );
  const wheelRimLipGeo = new THREE.TorusGeometry(wheelRadius * 0.62, 0.02, 12, 28).rotateY(Math.PI / 2);
  const wheelRimBarrelGeo = new THREE.CylinderGeometry(
    wheelRadius * 0.62,
    wheelRadius * 0.62,
    wheelWidth * 0.88,
    28
  ).rotateZ(Math.PI / 2);

  const caliperMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.75,
    roughness: 0.25,
  });

  const createWheelAssembly = (isLeft: boolean) => {
    const wheelGroup = new THREE.Group();
    const sign = isLeft ? -1 : 1;

    const tire = new THREE.Mesh(wheelTireGeo, tireMat);
    const outerShoulder = new THREE.Mesh(tireShoulderGeo, tireMat);
    outerShoulder.position.x = sign * (wheelWidth * 0.35);
    const innerShoulder = new THREE.Mesh(tireShoulderGeo, tireMat);
    innerShoulder.position.x = -sign * (wheelWidth * 0.35);
    const compoundRing = new THREE.Mesh(compoundStripeGeo, tireCompoundMat);
    compoundRing.position.x = sign * (wheelWidth * 0.44);
    wheelGroup.add(tire, outerShoulder, innerShoulder, compoundRing);

    const rimBarrel = new THREE.Mesh(
      wheelRimBarrelGeo,
      bodyStyle === 'stuttgart_911' ? darkTrimMat : rimMat
    );
    const outerLip = new THREE.Mesh(wheelRimLipGeo, chromeMat);
    outerLip.position.x = sign * (wheelWidth * 0.43);
    wheelGroup.add(rimBarrel, outerLip);

    if (bodyStyle === 'british_coupe') {
      // Dunlop Lightweight Perforated Alloy Disc Wheel
      const discFace = new THREE.Mesh(
        new THREE.CylinderGeometry(wheelRadius * 0.58, wheelRadius * 0.58, 0.025, 24).rotateZ(
          Math.PI / 2
        ),
        rimMat
      );
      discFace.position.x = sign * (wheelWidth * 0.34);
      wheelGroup.add(discFace);
      for (let h = 0; h < 10; h++) {
        const angle = (h * Math.PI * 2) / 10;
        const hole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.022, 0.032, 10).rotateZ(Math.PI / 2),
          darkTrimMat
        );
        hole.position.set(
          sign * (wheelWidth * 0.345),
          Math.cos(angle) * (wheelRadius * 0.41),
          Math.sin(angle) * (wheelRadius * 0.41)
        );
        wheelGroup.add(hole);
      }
    } else if (bodyStyle === 'stuttgart_911') {
      // 5-Spoke Fuchs Forged Windmill Petal Wheel
      for (let i = 0; i < 5; i++) {
        const angle = (i * Math.PI * 2) / 5;
        const petal = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, wheelRadius * 0.56, 0.058),
          rimMat
        );
        petal.position.set(
          sign * (wheelWidth * 0.36),
          Math.cos(angle) * (wheelRadius * 0.28),
          Math.sin(angle) * (wheelRadius * 0.28)
        );
        petal.rotation.x = -angle;
        wheelGroup.add(petal);
      }
      const centerCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.052, 0.052, 0.04, 16).rotateZ(Math.PI / 2),
        chromeMat
      );
      centerCap.position.x = sign * (wheelWidth * 0.39);
      wheelGroup.add(centerCap);
    } else if (bodyStyle === 'stradale_proto') {
      // Campagnolo "Millerighe" Star-Disc Magnesium Wheel
      const starDisc = new THREE.Mesh(
        new THREE.CylinderGeometry(wheelRadius * 0.57, wheelRadius * 0.57, 0.024, 24).rotateZ(
          Math.PI / 2
        ),
        goldAnodizedMat
      );
      starDisc.position.x = sign * (wheelWidth * 0.35);
      wheelGroup.add(starDisc);
      for (let s = 0; s < 8; s++) {
        const angle = (s * Math.PI) / 4;
        const rib = new THREE.Mesh(
          new THREE.BoxGeometry(0.036, wheelRadius * 1.12, 0.026),
          goldAnodizedMat
        );
        rib.position.x = sign * (wheelWidth * 0.36);
        rib.rotation.x = angle;
        wheelGroup.add(rib);
      }
    } else if (bodyStyle === 'detroit_proto' || bodyStyle === 'daytona_kammtail') {
      // 6-Spoke Halibrand / Torq-Thrust Deep-Dish Magnesium Wheel
      const spokeCount = bodyStyle === 'detroit_proto' ? 6 : 5;
      for (let i = 0; i < spokeCount; i++) {
        const angle = (i * Math.PI * 2) / spokeCount;
        const spoke = new THREE.Mesh(
          new THREE.BoxGeometry(0.038, wheelRadius * 0.58, 0.046),
          rimMat
        );
        spoke.position.set(
          sign * (wheelWidth * 0.32),
          Math.cos(angle) * (wheelRadius * 0.29),
          Math.sin(angle) * (wheelRadius * 0.29)
        );
        spoke.rotation.x = -angle;
        wheelGroup.add(spoke);
      }
    } else {
      // 24-Spoke Cross-Laced Borrani Wire Wheel (Italian GT)
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6;
        const spokeOuter = new THREE.Mesh(
          new THREE.BoxGeometry(wheelWidth * 0.78, wheelRadius * 1.16, 0.012),
          chromeMat
        );
        spokeOuter.rotation.x = angle;
        spokeOuter.rotation.z = 0.14;
        const spokeInner = new THREE.Mesh(
          new THREE.BoxGeometry(wheelWidth * 0.78, wheelRadius * 1.16, 0.012),
          chromeMat
        );
        spokeInner.rotation.x = angle + 0.13;
        spokeInner.rotation.z = -0.14;
        wheelGroup.add(spokeOuter, spokeInner);
      }
    }

    // 3-Ear Rudge-Whitworth Knock-Off Spinner Hub (except 5-lug Porsche Fuchs)
    if (bodyStyle !== 'stuttgart_911') {
      const spinnerHub = new THREE.Mesh(
        new THREE.ConeGeometry(0.048, 0.095, 14).rotateZ(isLeft ? Math.PI / 2 : -Math.PI / 2),
        chromeMat
      );
      spinnerHub.position.x = sign * (wheelWidth * 0.46);
      wheelGroup.add(spinnerHub);

      for (let e = 0; e < 3; e++) {
        const ear = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.09, 0.02), chromeMat);
        ear.position.x = sign * (wheelWidth * 0.48);
        ear.rotation.x = (e * Math.PI * 2) / 3;
        wheelGroup.add(ear);
      }
    }

    const brakeDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(wheelRadius * 0.48, wheelRadius * 0.48, 0.03, 20).rotateZ(
        Math.PI / 2
      ),
      brakeDiscMat
    );
    brakeDisc.position.x = -sign * 0.03;
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.07), caliperMat);
    caliper.position.set(-sign * 0.025, 0.08, -0.11);
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

  return {
    root,
    bodyGroup,
    wheels: [flWheel, frWheel, rlWheel, rrWheel],
    frontLeftPivot,
    frontRightPivot,
    brakeLightsMat,
    brakeDiscMat,
    tireCompoundMat,
    bodyPaintMat,
    liveryTexture,
    steeringWheelPivot,
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
 * Visual car damage is removed so all coachwork panels remain 100% flush and aligned.
 */
export function applyCarDamage(_rig: CarMeshRig, _damage?: VehicleDamageState): void {
  // Intentionally empty: visual car damage has been removed per user request.
}

/**
 * Updates windshield wipers, brake disc thermal glow, tire compound sidewall color ring,
 * and exhaust backfire / Nitro jet flames.
 */
export function updateCarWipers(
  rig: CarMeshRig,
  dt: number,
  isRaining: boolean,
  isBoosting = false,
  frontBrakeGlow = 0,
  tireCompound: TireCompound = 'medium'
): void {
  if (isRaining) {
    rig.wiperAngle += dt * 8.0;
    const sweep = Math.sin(rig.wiperAngle) * 0.55 + 0.55;
    rig.wiperLeft.rotation.z = sweep;
    rig.wiperRight.rotation.z = sweep;
  } else {
    rig.wiperLeft.rotation.z = THREE.MathUtils.damp(rig.wiperLeft.rotation.z, 0, 8, dt);
    rig.wiperRight.rotation.z = THREE.MathUtils.damp(rig.wiperRight.rotation.z, 0, 8, dt);
  }

  // Update 3D Tire Compound Sidewall Color Ring
  const compoundHex =
    tireCompound === 'soft'
      ? 0xef4444
      : tireCompound === 'hard'
      ? 0xf8fafc
      : tireCompound === 'wet'
      ? 0x38bdf8
      : 0xf59e0b;
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
