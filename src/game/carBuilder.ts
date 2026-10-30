import * as THREE from 'three';
import { CarLivery, ClassicCarSpec, TireCompound, VehicleDamageState } from './types';

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

let cachedGaugeClusterTex: THREE.CanvasTexture | null = null;
function getGaugeClusterTexture(): THREE.CanvasTexture {
  if (cachedGaugeClusterTex) return cachedGaugeClusterTex;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
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
  return cachedGaugeClusterTex;
}

/**
 * Builds a high-precision, $C^1$-smooth compound-curved 3D Coachbuilt Car Body Shell
 * by lofting 96 longitudinal stations x 41 cross-sectional vertices.
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
  const zSteps = 96;
  const halfRingSteps = 20; // 20 left + 1 center + 20 right = 41 ultra-smooth cross-section vertices per station
  const ringCount = halfRingSteps * 2 + 1;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iz = 0; iz <= zSteps; iz++) {
    const t = iz / zSteps;
    const z = -halfLen + t * bodyLength;

    const distFrontW = Math.abs(z - frontWheelZ);
    const distRearW = Math.abs(z - rearWheelZ);
    const frontFlare = Math.exp(-Math.pow(distFrontW / 0.54, 2)) * 0.068;
    const rearFlare = Math.exp(-Math.pow(distRearW / 0.58, 2)) * 0.088;
    const doorWaistPinch = Math.exp(-Math.pow((z - 0.05) / 0.56, 2)) * 0.038;

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
      archCutoutY = Math.sqrt(wheelArchRadius * wheelArchRadius - distFrontW * distFrontW) * 0.74;
    } else if (distRearW < wheelArchRadius) {
      archCutoutY = Math.sqrt(wheelArchRadius * wheelArchRadius - distRearW * distRearW) * 0.74;
    }

    let centerH = chassisH + 0.21;
    let fenderSwell = 0.02;

    if (t > 0.66) {
      const nt = (t - 0.66) / 0.34;
      centerH -= Math.pow(nt, 1.85) * (is911 ? 0.27 : 0.24);
    }

    fenderSwell += Math.exp(-Math.pow(distFrontW / 0.62, 2)) * (is911 ? 0.085 : 0.068);
    fenderSwell += Math.exp(-Math.pow(distRearW / 0.68, 2)) * (isProto ? 0.082 : 0.072);

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

    const evalUpperDeckY = (u: number): number => {
      const crownArch = Math.cos(Math.min(1, u / 0.5) * (Math.PI * 0.5)) * 0.026;
      const pontoonWave = Math.exp(-Math.pow((u - 0.74) / 0.32, 2)) * fenderSwell;
      const outerRadiusDrop = u > 0.78 ? Math.pow((u - 0.78) / 0.22, 2) * 0.048 : 0;
      return centerH + crownArch + pontoonWave - outerRadiusDrop + spoilerCurve * (1 - u * 0.15);
    };

    const shoulderTopY = evalUpperDeckY(1.0);
    const sillBottomY = 0.17 + archCutoutY;

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
        const underTuck = v > 0.7 ? Math.pow((v - 0.7) / 0.3, 1.5) * 0.12 : 0;
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
 * Builds a sleek, tapered 3D Fastback Cabin Greenhouse & Flush Painted Roof Shell (`THREE.Group`)
 * with high-precision 32-station curvature and chrome window-frame surround trim.
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
  const baseY = chassisH + 0.19;
  const cabFrontZ = isProto ? 0.68 : 0.56;
  const cabPeakZ = isBritish ? -0.08 : 0.04;
  const cabRearBaseZ = -1.42;
  const cabH = isProto ? 0.34 : is911 ? 0.41 : 0.38;

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
    const roofY = baseY + h + 0.007;

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

  // 3. Crisp Chrome Greenhouse Base Beltline Trim Moulding
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
  }

  // 4. Rear Cargo Deck & Strapped Vintage Wire Spare Wheel visible inside Rear Fastback Glass
  const rearCargoShelf = new THREE.Mesh(
    new THREE.BoxGeometry(baseHalfW * 1.35, 0.04, 0.72),
    darkTrimMat
  );
  rearCargoShelf.position.set(0, baseY - 0.02, -0.88);
  cabinGroup.add(rearCargoShelf);

  if (!isProto) {
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
 * with 96-station x 41-point compound-curved coachwork, chrome wheel-arch lip mouldings,
 * live compound-coded racing tires, 12-spoke Borrani wire / Campagnolo rims, and full cockpit.
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
    opacity: 0.82,
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
    const frontFlare = Math.exp(-Math.pow(distFrontW / 0.54, 2)) * 0.068;
    const rearFlare = Math.exp(-Math.pow(distRearW / 0.58, 2)) * 0.088;
    const doorWaistPinch = Math.exp(-Math.pow((z - 0.05) / 0.56, 2)) * 0.038;

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
    let fenderSwell = 0.02;
    if (t > 0.66) {
      const nt = (t - 0.66) / 0.34;
      centerH -= Math.pow(nt, 1.85) * (is911 ? 0.27 : 0.24);
    }
    fenderSwell += Math.exp(-Math.pow(distFrontW / 0.62, 2)) * (is911 ? 0.085 : 0.068);
    fenderSwell += Math.exp(-Math.pow(distRearW / 0.68, 2)) * (isProto ? 0.082 : 0.072);

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

  // 1. High-Precision 96-Station x 41-Point Compound-Curved 3D Coachbuilt Body Shell
  const bodyGeo = buildLoftedCoachworkGeometry({
    bodyWidth,
    bodyLength,
    chassisH,
    frontWheelZ: frontWheelbaseZ,
    rearWheelZ: rearWheelbaseZ,
    wheelArchRadius: wheelRadius + 0.06,
    is911,
    isProto,
    isBritish,
  });
  const mainBodyMesh = new THREE.Mesh(bodyGeo, bodyPaintMat);
  mainBodyMesh.castShadow = !isSoftwareGl;
  mainBodyMesh.receiveShadow = !isSoftwareGl;
  bodyGroup.add(mainBodyMesh);

  // Sculpted Underbody Floor Pan, Inner Wheel-Well Drums, Chrome Arch Mouldings & Double-Wishbone Suspension
  const underPan = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 0.76, 0.14, bodyLength * 0.86),
    darkTrimMat
  );
  underPan.position.set(0, 0.22, 0);
  bodyGroup.add(underPan);

  const wheelWellHousingGeo = new THREE.CylinderGeometry(
    wheelRadius - 0.02,
    wheelRadius - 0.02,
    0.22,
    24
  );
  wheelWellHousingGeo.rotateZ(Math.PI / 2);

  // Crisp Chrome Wheel-Arch Lip Moulding framing each wheel opening
  const wheelArchTrimGeo = new THREE.TorusGeometry(wheelRadius + 0.036, 0.012, 10, 28, Math.PI);
  wheelArchTrimGeo.rotateY(Math.PI / 2);

  const wishboneArmGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8).rotateZ(Math.PI / 2);
  const coiloverDamperGeo = new THREE.CylinderGeometry(0.018, 0.016, 0.22, 8);

  const doorSurf = evalSurfaceAt(0, 0.04);
  const doorFlankX = doorSurf.stationHalfW * 0.992;

  for (const side of [-1, 1]) {
    for (const wz of [frontWheelbaseZ, rearWheelbaseZ]) {
      const wellHousing = new THREE.Mesh(wheelWellHousingGeo, darkTrimMat);
      wellHousing.position.set(side * (trackHalfW - 0.06), wheelContactY, wz);
      bodyGroup.add(wellHousing);

      const archSurf = evalSurfaceAt(0, wz);
      const archTrim = new THREE.Mesh(wheelArchTrimGeo, chromeMat);
      archTrim.position.set(side * (archSurf.stationHalfW * 0.965), 0.19, wz);
      bodyGroup.add(archTrim);

      const upperArm = new THREE.Mesh(wishboneArmGeo, brushedAlumMat);
      upperArm.position.set(side * (trackHalfW - 0.16), wheelContactY + 0.08, wz);
      const lowerArm = new THREE.Mesh(wishboneArmGeo, brushedAlumMat);
      lowerArm.position.set(side * (trackHalfW - 0.16), wheelContactY - 0.08, wz);
      const strut = new THREE.Mesh(coiloverDamperGeo, chromeMat);
      strut.position.set(side * (trackHalfW - 0.14), wheelContactY + 0.04, wz - 0.04);
      strut.rotation.z = side * 0.28;
      bodyGroup.add(upperArm, lowerArm, strut);
    }

    const doorRoundel = new THREE.Mesh(new THREE.CircleGeometry(0.23, 28), roundelMat);
    doorRoundel.position.set(side * doorFlankX, 0.425, 0.04);
    doorRoundel.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    bodyGroup.add(doorRoundel);

    const rockerTrim = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 1.32), chromeMat);
    rockerTrim.position.set(side * (doorSurf.stationHalfW * 0.955), 0.185, 0);
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

  // 4. Detailed Interior Cockpit
  const interiorFloorY = chassisH + 0.03;

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

  const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.014, 10, 24), woodMat);
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
  const wiperCowlZ = isProto ? 0.64 : 0.53;
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

  // 5. Front Radiator Egg-Crate Grille, Carello Fog Lamps, Aero Splitter & Headlamps
  const grilleRecess = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 0.48, 0.15, 0.08),
    darkTrimMat
  );
  grilleRecess.position.set(0, 0.265, halfLen - 0.03);
  const grilleSurround = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 0.5, 0.17, 0.035),
    chromeMat
  );
  grilleSurround.position.set(0, 0.265, halfLen - 0.008);
  frontNosePivot.add(grilleRecess, grilleSurround);

  for (const gy of [0.24, 0.265, 0.29]) {
    const hBar = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth * 0.46, 0.008, 0.025), chromeMat);
    hBar.position.set(0, gy, halfLen + 0.002);
    frontNosePivot.add(hBar);
  }

  const fogBezelGeo = new THREE.CylinderGeometry(0.062, 0.062, 0.04, 16).rotateX(Math.PI / 2);
  const fogLensGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.046, 16).rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    const fBezel = new THREE.Mesh(fogBezelGeo, chromeMat);
    fBezel.position.set(side * 0.26, 0.265, halfLen + 0.015);
    const fLens = new THREE.Mesh(fogLensGeo, fogLightMat);
    fLens.position.set(side * 0.26, 0.265, halfLen + 0.018);
    frontNosePivot.add(fBezel, fLens);
  }

  const chinSplitter = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 0.82, 0.032, 0.16),
    darkTrimMat
  );
  chinSplitter.position.set(0, 0.165, halfLen - 0.02);
  frontNosePivot.add(chinSplitter);

  for (const side of [-1, 1]) {
    const bumperette = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.048, 0.055), chromeMat);
    bumperette.position.set(side * (bodyWidth * 0.34), 0.215, halfLen + 0.02);
    frontNosePivot.add(bumperette);
  }

  const lampXAbs = bodyWidth * 0.35;
  const lampZ = halfLen - 0.045;
  const lampSurf = evalSurfaceAt(lampXAbs, lampZ - 0.06);
  const lampY = Math.min(lampSurf.y - 0.045, is911 ? 0.43 : 0.385);
  const lampBezelGeo = new THREE.CylinderGeometry(0.115, 0.115, 0.06, 20).rotateX(Math.PI / 2);
  const lampLensGeo = new THREE.CylinderGeometry(0.098, 0.098, 0.068, 20).rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    const bezel = new THREE.Mesh(lampBezelGeo, chromeMat);
    bezel.position.set(side * lampXAbs, lampY, lampZ);
    const lens = new THREE.Mesh(lampLensGeo, headlightMat);
    lens.position.set(side * lampXAbs, lampY, lampZ + 0.008);
    frontNosePivot.add(bezel, lens);
  }

  // 6. Clean Rear Kammtail Transom, Taillights, License Plate & Hollow Quad Exhausts
  const rearTransomInsert = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 0.8, 0.16, 0.035),
    darkTrimMat
  );
  rearTransomInsert.position.set(0, 0.42, -halfLen - 0.002);
  const rearTransomChromeTrim = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 0.82, 0.18, 0.022),
    chromeMat
  );
  rearTransomChromeTrim.position.set(0, 0.42, -halfLen + 0.004);
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
    const rBumper = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.048, 0.06), chromeMat);
    rBumper.position.set(side * (bodyWidth * 0.31), 0.305, -halfLen - 0.022);
    rearValenceGroup.add(rBumper);

    for (const innerOffset of [0, 0.13]) {
      const lx = side * (bodyWidth * 0.365 - innerOffset);
      const tailRing = new THREE.Mesh(tailRingGeo, chromeMat);
      tailRing.position.set(lx, 0.42, -halfLen - 0.02);
      const tailLens = new THREE.Mesh(tailLensGeo, brakeLightsMat);
      tailLens.position.set(lx, 0.42, -halfLen - 0.025);
      rearValenceGroup.add(tailRing, tailLens);
    }

    const turnRing = new THREE.Mesh(tailRingGeo, chromeMat);
    turnRing.scale.set(0.82, 0.82, 1);
    turnRing.position.set(side * (bodyWidth * 0.365 - 0.245), 0.42, -halfLen - 0.02);
    const turnLens = new THREE.Mesh(turnLensGeo, amberTurnMat);
    turnLens.position.set(side * (bodyWidth * 0.365 - 0.245), 0.42, -halfLen - 0.025);
    rearValenceGroup.add(turnRing, turnLens);
  }

  const plateFrame = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.135, 0.026), chromeMat);
  plateFrame.position.set(0, 0.42, -halfLen - 0.02);
  const plateFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.35, 0.115),
    new THREE.MeshBasicMaterial({ map: getVintageLicensePlateTexture() })
  );
  plateFace.position.set(0, 0.42, -halfLen - 0.035);
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

  // 7. Precision Classic Racing Wheels with Tire Compound Sidewall Color Ring
  const wheelTireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth * 0.82, 32);
  wheelTireGeo.rotateZ(Math.PI / 2);

  const tireShoulderRadius = wheelRadius - 0.052;
  const tireShoulderTube = 0.052;
  const tireShoulderGeo = new THREE.TorusGeometry(tireShoulderRadius, tireShoulderTube, 14, 32);
  tireShoulderGeo.rotateY(Math.PI / 2);

  const compoundStripeGeo = new THREE.TorusGeometry(wheelRadius * 0.77, 0.011, 10, 28);
  compoundStripeGeo.rotateY(Math.PI / 2);

  const wheelRimLipGeo = new THREE.TorusGeometry(wheelRadius * 0.62, 0.02, 12, 28);
  wheelRimLipGeo.rotateY(Math.PI / 2);

  const wheelRimBarrelGeo = new THREE.CylinderGeometry(
    wheelRadius * 0.62,
    wheelRadius * 0.62,
    wheelWidth * 0.88,
    28
  );
  wheelRimBarrelGeo.rotateZ(Math.PI / 2);

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
    // Color-coded Tire Compound Sidewall Ring on outer face
    const compoundRing = new THREE.Mesh(compoundStripeGeo, tireCompoundMat);
    compoundRing.position.x = sign * (wheelWidth * 0.44);
    wheelGroup.add(tire, outerShoulder, innerShoulder, compoundRing);

    const rimBarrel = new THREE.Mesh(wheelRimBarrelGeo, rimMat);
    const outerLip = new THREE.Mesh(wheelRimLipGeo, chromeMat);
    outerLip.position.x = sign * (wheelWidth * 0.43);
    wheelGroup.add(rimBarrel, outerLip);

    const spokeCount = is911 ? 5 : 12;
    for (let i = 0; i < spokeCount; i++) {
      const angle = (i * Math.PI) / (spokeCount * 0.5);
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(
          wheelWidth * 0.84,
          wheelRadius * 1.14,
          is911 ? 0.048 : 0.015
        ),
        rimMat
      );
      spoke.rotation.x = angle;
      wheelGroup.add(spoke);
    }

    const spinnerHub = new THREE.Mesh(
      new THREE.ConeGeometry(0.048, 0.095, 14).rotateZ(isLeft ? Math.PI / 2 : -Math.PI / 2),
      chromeMat
    );
    spinnerHub.position.x = sign * (wheelWidth * 0.48);
    wheelGroup.add(spinnerHub);

    for (let e = 0; e < 3; e++) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.09, 0.02), chromeMat);
      ear.position.x = sign * (wheelWidth * 0.5);
      ear.rotation.x = (e * Math.PI * 2) / 3;
      wheelGroup.add(ear);
    }

    const brakeDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(wheelRadius * 0.48, wheelRadius * 0.48, 0.03, 20).rotateZ(Math.PI / 2),
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
