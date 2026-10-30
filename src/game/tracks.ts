import { ChampionshipLevelSpec, TrackId, TrackPointSample, TrackSpec } from './types';

interface Waypoint {
  x: number;
  y: number;
  z: number;
  width?: number;
  bankingDeg?: number;
}

// Pure Catmull-Rom closed spline evaluator
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function buildTrackSamples(
  waypoints: Waypoint[],
  sampleCount = 600
): { samples: TrackPointSample[]; totalLengthM: number; elevationGainM: number } {
  const n = waypoints.length;
  const rawPoints: Array<{ x: number; y: number; z: number; width: number; bankingRad: number }> = [];

  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < sampleCount; i++) {
    const u = (i / sampleCount) * n;
    const seg = Math.floor(u) % n;
    const localT = u - Math.floor(u);

    const w0 = waypoints[(seg - 1 + n) % n];
    const w1 = waypoints[seg];
    const w2 = waypoints[(seg + 1) % n];
    const w3 = waypoints[(seg + 2) % n];

    const x = catmullRom(w0.x, w1.x, w2.x, w3.x, localT);
    const y = catmullRom(w0.y, w1.y, w2.y, w3.y, localT);
    const z = catmullRom(w0.z, w1.z, w2.z, w3.z, localT);
    const width = catmullRom(
      w0.width ?? 15,
      w1.width ?? 15,
      w2.width ?? 15,
      w3.width ?? 15,
      localT
    );
    const bankDeg = catmullRom(
      w0.bankingDeg ?? 0,
      w1.bankingDeg ?? 0,
      w2.bankingDeg ?? 0,
      w3.bankingDeg ?? 0,
      localT
    );

    if (y < minY) minY = y;
    if (y > maxY) maxY = y;

    rawPoints.push({
      x,
      y,
      z,
      width,
      bankingRad: (bankDeg * Math.PI) / 180,
    });
  }

  // Compute cumulative distance, tangents, right vectors, and curvature
  const distances: number[] = [0];
  let totalLengthM = 0;
  for (let i = 1; i < sampleCount; i++) {
    const dx = rawPoints[i].x - rawPoints[i - 1].x;
    const dy = rawPoints[i].y - rawPoints[i - 1].y;
    const dz = rawPoints[i].z - rawPoints[i - 1].z;
    const segLen = Math.hypot(dx, dy, dz);
    totalLengthM += segLen;
    distances.push(totalLengthM);
  }
  const closeDx = rawPoints[0].x - rawPoints[sampleCount - 1].x;
  const closeDy = rawPoints[0].y - rawPoints[sampleCount - 1].y;
  const closeDz = rawPoints[0].z - rawPoints[sampleCount - 1].z;
  totalLengthM += Math.hypot(closeDx, closeDy, closeDz);

  const samples: TrackPointSample[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const prev = rawPoints[(i - 1 + sampleCount) % sampleCount];
    const curr = rawPoints[i];
    const next = rawPoints[(i + 1) % sampleCount];
    const next2 = rawPoints[(i + 4) % sampleCount];
    const prev2 = rawPoints[(i - 4 + sampleCount) % sampleCount];

    let tx = next.x - prev.x;
    let ty = next.y - prev.y;
    let tz = next.z - prev.z;
    const len = Math.hypot(tx, ty, tz) || 1;
    tx /= len;
    ty /= len;
    tz /= len;

    // Horizontal right vector (cross of tangent and up (0, 1, 0): (-tz, 0, tx))
    const horizLen = Math.hypot(tx, tz) || 1;
    const rx = -tz / horizLen;
    const rz = tx / horizLen;

    // Signed 2D curvature estimate for AI braking and apex targeting
    const v1x = curr.x - prev2.x;
    const v1z = curr.z - prev2.z;
    const v2x = next2.x - curr.x;
    const v2z = next2.z - curr.z;
    const cross = v1x * v2z - v1z * v2x;
    const denom =
      Math.hypot(v1x, v1z) *
        Math.hypot(v2x, v2z) *
        Math.hypot(next2.x - prev2.x, next2.z - prev2.z) || 1;
    const curvature = (2 * cross) / denom;

    samples.push({
      index: i,
      s: distances[i] / totalLengthM,
      distanceM: distances[i],
      x: curr.x,
      y: curr.y,
      z: curr.z,
      tx,
      ty,
      tz,
      rx,
      rz,
      width: curr.width,
      bankingRad: curr.bankingRad,
      curvature,
      racingLineOffset: 0,
      cornerLoadIntensity: 0,
    });
  }

  // Compute curvature-optimized Racing Line (outside entry -> inside apex -> outside exit)
  const rawOffsets = new Float32Array(sampleCount);
  const rawLoad = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const curr = samples[i];
    const maxSafe = curr.width * 0.34;
    const aheadApex = samples[(i + 16) % sampleCount];
    const behindApex = samples[(i - 16 + sampleCount) % sampleCount];

    const currAbsK = Math.abs(curr.curvature);
    const aheadAbsK = Math.abs(aheadApex.curvature);
    const behindAbsK = Math.abs(behindApex.curvature);

    if (currAbsK > 0.005) {
      const sign = Math.sign(curr.curvature);
      rawOffsets[i] = Math.max(-maxSafe, Math.min(maxSafe, -sign * Math.min(maxSafe, currAbsK * 235)));
    } else if (aheadAbsK > 0.009) {
      const sign = Math.sign(aheadApex.curvature);
      rawOffsets[i] = sign * Math.min(maxSafe * 0.72, aheadAbsK * 145);
    } else if (behindAbsK > 0.009) {
      const sign = Math.sign(behindApex.curvature);
      rawOffsets[i] = sign * Math.min(maxSafe * 0.68, behindAbsK * 135);
    } else {
      rawOffsets[i] = 0;
    }

    const brakingZoneK = Math.max(currAbsK, aheadAbsK * 1.15, behindAbsK * 0.75);
    rawLoad[i] = Math.min(1.0, 0.28 + Math.min(0.72, brakingZoneK * 34));
  }

  let smoothed = rawOffsets;
  let smoothedLoad = rawLoad;
  for (let pass = 0; pass < 8; pass++) {
    const next = new Float32Array(sampleCount);
    const nextLoad = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      let sum = 0;
      let loadSum = 0;
      let wSum = 0;
      for (let k = -6; k <= 6; k++) {
        const w = Math.exp(-(k * k) / 10);
        const idx = (i + k + sampleCount) % sampleCount;
        sum += smoothed[idx] * w;
        loadSum += smoothedLoad[idx] * w;
        wSum += w;
      }
      next[i] = sum / wSum;
      nextLoad[i] = loadSum / wSum;
    }
    smoothed = next;
    smoothedLoad = nextLoad;
  }

  for (let i = 0; i < sampleCount; i++) {
    const maxSafe = samples[i].width * 0.35;
    samples[i].racingLineOffset = Math.max(-maxSafe, Math.min(maxSafe, smoothed[i]));
    samples[i].cornerLoadIntensity = Math.max(0.25, Math.min(1.0, smoothedLoad[i]));
  }

  return {
    samples,
    totalLengthM,
    elevationGainM: Math.round(maxY - minY),
  };
}

// 1. Autodromo di Monza Storico (Fast Park Circuit with Elevated Lesmo Ridge & Curva Parabolica)
const MONZA_WAYPOINTS: Waypoint[] = [
  { x: 0, y: 0, z: -120, width: 16, bankingDeg: 0 },
  { x: 0, y: 0, z: 0, width: 16, bankingDeg: 0 },
  { x: 0, y: 0.5, z: 130, width: 16, bankingDeg: 0 },
  { x: 45, y: 4.2, z: 220, width: 15, bankingDeg: 5 },
  { x: 150, y: 8.8, z: 245, width: 14.5, bankingDeg: 6 },
  { x: 225, y: 10.5, z: 195, width: 14.5, bankingDeg: 8 },
  { x: 245, y: 6.2, z: 110, width: 14.5, bankingDeg: 6 },
  { x: 190, y: 1.5, z: 20, width: 15, bankingDeg: -3 },
  { x: 220, y: 5.0, z: -75, width: 14.5, bankingDeg: 5 },
  { x: 175, y: 3.2, z: -165, width: 15, bankingDeg: -4 },
  { x: 95, y: 1.2, z: -235, width: 16, bankingDeg: 10 },
  { x: 20, y: 0.2, z: -215, width: 16, bankingDeg: 8 },
];

// 2. Côte d'Azur Monte Carlo (Steep Beau Rivage Hill Climb to Casino Crest & Harbor Descent)
const COTE_DAZUR_WAYPOINTS: Waypoint[] = [
  { x: 0, y: 0, z: -90, width: 14.5, bankingDeg: 0 },
  { x: 0, y: 0, z: 0, width: 14.5, bankingDeg: 0 },
  { x: 0, y: 3.5, z: 95, width: 14, bankingDeg: 3 },
  { x: 55, y: 11.5, z: 145, width: 13.5, bankingDeg: 4 },
  { x: 135, y: 18.0, z: 165, width: 13.5, bankingDeg: 5 },
  { x: 195, y: 14.5, z: 105, width: 13, bankingDeg: -4 },
  { x: 130, y: 8.5, z: 50, width: 13, bankingDeg: 7 },
  { x: 205, y: 4.2, z: -10, width: 14, bankingDeg: 4 },
  { x: 190, y: 1.5, z: -115, width: 14.5, bankingDeg: 5 },
  { x: 115, y: 0, z: -175, width: 13.5, bankingDeg: -3 },
  { x: 55, y: 0, z: -135, width: 14, bankingDeg: 3 },
  { x: 15, y: 0, z: -165, width: 14.5, bankingDeg: 5 },
];

// 3. Nürburgring Eifel Sprint (Flugplatz Blind Crest, Foxhole Compression & 14° Banked Karussell)
const EIFEL_WAYPOINTS: Waypoint[] = [
  { x: 0, y: 0, z: -110, width: 15, bankingDeg: 0 },
  { x: 0, y: 0, z: 0, width: 15, bankingDeg: 0 },
  { x: 0, y: 4.5, z: 115, width: 14.5, bankingDeg: 4 },
  { x: 75, y: 14.0, z: 190, width: 14, bankingDeg: 6 },
  { x: 45, y: 21.5, z: 265, width: 14, bankingDeg: -5 },
  { x: 140, y: 26.0, z: 310, width: 14.5, bankingDeg: 7 },
  { x: 235, y: 16.5, z: 245, width: 14.5, bankingDeg: 5 },
  { x: 265, y: 7.5, z: 120, width: 14, bankingDeg: 14 },
  { x: 185, y: 12.0, z: 30, width: 14, bankingDeg: -6 },
  { x: 230, y: 5.5, z: -85, width: 14.5, bankingDeg: 6 },
  { x: 145, y: 1.5, z: -195, width: 15, bankingDeg: 4 },
  { x: 45, y: 0.3, z: -190, width: 15, bankingDeg: 3 },
];

// 4. Passo dello Stelvio Alpine Climb (Dramatic +38m Alpine Mountain Ascent & Valley Descent)
const STELVIO_WAYPOINTS: Waypoint[] = [
  { x: 0, y: 0, z: -115, width: 15, bankingDeg: 0 },
  { x: 0, y: 0, z: 0, width: 15, bankingDeg: 0 },
  { x: 0, y: 6.5, z: 125, width: 14.5, bankingDeg: 5 },
  { x: 65, y: 16.5, z: 215, width: 14, bankingDeg: 7 },
  { x: 155, y: 27.5, z: 265, width: 14, bankingDeg: 8 },
  { x: 245, y: 37.5, z: 210, width: 14, bankingDeg: 9 },
  { x: 285, y: 32.0, z: 105, width: 14, bankingDeg: -5 },
  { x: 210, y: 22.5, z: 25, width: 14, bankingDeg: 8 },
  { x: 265, y: 13.5, z: -75, width: 14.5, bankingDeg: 6 },
  { x: 195, y: 6.0, z: -185, width: 15, bankingDeg: 5 },
  { x: 105, y: 2.0, z: -225, width: 15, bankingDeg: 4 },
  { x: 25, y: 0.3, z: -195, width: 15, bankingDeg: 3 },
];

// 5. Targa Florio · Collesano Hills (Sicilian Rolling Mountain Hills, Valley Dips & High-Abrasion Sweepers)
const TARGA_WAYPOINTS: Waypoint[] = [
  { x: 0, y: 0, z: -105, width: 15, bankingDeg: 0 },
  { x: 0, y: 0, z: 0, width: 15, bankingDeg: 0 },
  { x: 0, y: 5.5, z: 110, width: 14.5, bankingDeg: 4 },
  { x: 85, y: 15.0, z: 185, width: 14, bankingDeg: 6 },
  { x: 185, y: 24.5, z: 220, width: 14, bankingDeg: 7 },
  { x: 265, y: 30.5, z: 145, width: 14, bankingDeg: 6 },
  { x: 225, y: 19.0, z: 45, width: 14, bankingDeg: -5 },
  { x: 145, y: 9.5, z: -15, width: 14, bankingDeg: 6 },
  { x: 215, y: 14.0, z: -115, width: 14.5, bankingDeg: 7 },
  { x: 150, y: 5.0, z: -210, width: 14.5, bankingDeg: -4 },
  { x: 65, y: 1.2, z: -205, width: 15, bankingDeg: 5 },
  { x: 15, y: 0.2, z: -175, width: 15, bankingDeg: 3 },
];

const monzaData = buildTrackSamples(MONZA_WAYPOINTS, 600);
const coteData = buildTrackSamples(COTE_DAZUR_WAYPOINTS, 600);
const eifelData = buildTrackSamples(EIFEL_WAYPOINTS, 600);
const stelvioData = buildTrackSamples(STELVIO_WAYPOINTS, 600);
const targaData = buildTrackSamples(TARGA_WAYPOINTS, 600);

export const TRACKS: Record<TrackId, TrackSpec> = {
  monza_storico: {
    id: 'monza_storico',
    name: 'Autodromo di Monza Storico',
    location: 'Royal Park of Monza',
    country: 'Italy',
    lengthKm: Number((monzaData.totalLengthM / 1000).toFixed(2)),
    laps: 3,
    elevationGainM: monzaData.elevationGainM,
    difficulty: 'Classic Fast',
    surfaceGrip: 1.04,
    abrasiveness: 0.92,
    description:
      'The Cathedral of Speed. Long slipstream straights linked by the sweeping Curva Grande, elevated Lesmo ridge, and the banked Parabolica.',
    theme: {
      skyTop: '#162c46',
      skyHorizon: '#e8b48a',
      fogColor: '#d9a77d',
      fogDensity: 0.0014,
      groundColor: '#364926',
      asphaltColor: '#252629',
      kerbPrimary: '#dc2626',
      kerbSecondary: '#f8fafc',
      sunColor: '#fff3d6',
      hemiSky: '#93c5fd',
      hemiGround: '#4a5a33',
    },
    samples: monzaData.samples,
    totalLengthM: monzaData.totalLengthM,
  },
  cote_dazur: {
    id: 'cote_dazur',
    name: "Circuit de la Côte d'Azur",
    location: 'Monte Carlo Harbor',
    country: 'Monaco',
    lengthKm: Number((coteData.totalLengthM / 1000).toFixed(2)),
    laps: 3,
    elevationGainM: coteData.elevationGainM,
    difficulty: 'Technical Street',
    surfaceGrip: 1.0,
    abrasiveness: 1.05,
    description:
      'Steep Beau Rivage climb up to Casino Square and technical downhill switchbacks returning to the Mediterranean harbor.',
    theme: {
      skyTop: '#083854',
      skyHorizon: '#bae6fd',
      fogColor: '#93c5fd',
      fogDensity: 0.0014,
      groundColor: '#3f4d5e',
      asphaltColor: '#1e2530',
      kerbPrimary: '#ef4444',
      kerbSecondary: '#f8fafc',
      sunColor: '#fef9c3',
      hemiSky: '#7dd3fc',
      hemiGround: '#334155',
    },
    samples: coteData.samples,
    totalLengthM: coteData.totalLengthM,
  },
  eifel_sprint: {
    id: 'eifel_sprint',
    name: 'Nürburgring Eifel Sprint',
    location: 'Nürburg Castle Forest',
    country: 'Germany',
    lengthKm: Number((eifelData.totalLengthM / 1000).toFixed(2)),
    laps: 3,
    elevationGainM: eifelData.elevationGainM,
    difficulty: 'Master Endurance',
    surfaceGrip: 1.02,
    abrasiveness: 1.15,
    description:
      'Pine-forested mountain climbs, blind Flugplatz crest, downhill Foxhole compression, and the 14-degree banked Karussell.',
    theme: {
      skyTop: '#16202e',
      skyHorizon: '#94a3b8',
      fogColor: '#78879c',
      fogDensity: 0.0015,
      groundColor: '#253822',
      asphaltColor: '#232426',
      kerbPrimary: '#b91c1c',
      kerbSecondary: '#e2e8f0',
      sunColor: '#fde68a',
      hemiSky: '#94a3b8',
      hemiGround: '#1e2f1d',
    },
    samples: eifelData.samples,
    totalLengthM: eifelData.totalLengthM,
  },
  targa_madonie: {
    id: 'targa_madonie',
    name: 'Targa Florio · Collesano Hills',
    location: 'Madonie Mountains, Sicily',
    country: 'Italy',
    lengthKm: Number((targaData.totalLengthM / 1000).toFixed(2)),
    laps: 3,
    elevationGainM: targaData.elevationGainM,
    difficulty: 'Mountain Hills',
    surfaceGrip: 1.01,
    abrasiveness: 1.28,
    description:
      'Sun-baked Sicilian mountain hills with +31m elevation climbs, rolling valley compressions, and rough volcanic tarmac that punishes soft tires.',
    theme: {
      skyTop: '#1e293b',
      skyHorizon: '#fdba74',
      fogColor: '#f59e0b',
      fogDensity: 0.0012,
      groundColor: '#4b5320',
      asphaltColor: '#27272a',
      kerbPrimary: '#eab308',
      kerbSecondary: '#f8fafc',
      sunColor: '#fef08a',
      hemiSky: '#fed7aa',
      hemiGround: '#3f461c',
    },
    samples: targaData.samples,
    totalLengthM: targaData.totalLengthM,
  },
  stelvio_pass: {
    id: 'stelvio_pass',
    name: 'Passo dello Stelvio Alpine',
    location: 'Ortler Alps · Bormio',
    country: 'Italy',
    lengthKm: Number((stelvioData.totalLengthM / 1000).toFixed(2)),
    laps: 3,
    elevationGainM: stelvioData.elevationGainM,
    difficulty: 'Alpine Climb',
    surfaceGrip: 1.03,
    abrasiveness: 1.22,
    description:
      'High-altitude Dolomites pass featuring a relentless +38m alpine climb, sweeping summit ridge, and high-speed downhill braking zones.',
    theme: {
      skyTop: '#0f172a',
      skyHorizon: '#bae6fd',
      fogColor: '#cbd5e1',
      fogDensity: 0.0013,
      groundColor: '#334155',
      asphaltColor: '#1e293b',
      kerbPrimary: '#dc2626',
      kerbSecondary: '#f8fafc',
      sunColor: '#f8fafc',
      hemiSky: '#bae6fd',
      hemiGround: '#334155',
    },
    samples: stelvioData.samples,
    totalLengthM: stelvioData.totalLengthM,
  },
};

export const TRACK_LIST: TrackSpec[] = [
  TRACKS.monza_storico,
  TRACKS.cote_dazur,
  TRACKS.eifel_sprint,
  TRACKS.targa_madonie,
  TRACKS.stelvio_pass,
];

/**
 * 5-Stage FIA 1967 Championship Career Progression Levels
 */
export const CHAMPIONSHIP_LEVELS: ChampionshipLevelSpec[] = [
  {
    level: 1,
    id: 'lvl_1_monza',
    title: 'Level 1 · Coppa di Monza',
    subtitle: 'High-Speed Slipstream Qualification',
    trackId: 'monza_storico',
    laps: 3,
    weather: 'clear',
    recommendedCompound: 'soft',
    tireWearMultiplier: 1.0,
    targetPosition: 3,
    rewardCredits: 3200,
    elevationChangeM: TRACKS.monza_storico.elevationGainM,
    description:
      'Master slipstream drafting and threshold braking on dry Italian tarmac. Low tire abrasion allows aggressive Soft-compound pace.',
  },
  {
    level: 2,
    id: 'lvl_2_monaco',
    title: 'Level 2 · Grand Prix de Monaco',
    subtitle: 'Harbor Climb & Switchback Precision',
    trackId: 'cote_dazur',
    laps: 3,
    weather: 'overcast',
    recommendedCompound: 'medium',
    tireWearMultiplier: 1.2,
    targetPosition: 2,
    rewardCredits: 4500,
    elevationChangeM: TRACKS.cote_dazur.elevationGainM,
    description:
      'Climb +18m up Beau Rivage to Casino Square and thread the downhill hairpins without overheating your rear tires.',
  },
  {
    level: 3,
    id: 'lvl_3_eifel',
    title: 'Level 3 · ADAC Eifel Pokal',
    subtitle: 'Mountain Forest & Changing Skies',
    trackId: 'eifel_sprint',
    laps: 4,
    weather: 'dynamic',
    recommendedCompound: 'medium',
    tireWearMultiplier: 1.35,
    targetPosition: 2,
    rewardCredits: 6200,
    elevationChangeM: TRACKS.eifel_sprint.elevationGainM,
    description:
      '4-lap endurance test over +26m Eifel hills as rain clouds gather. Watch tire temperatures and pit for Wet or fresh rubber when grip drops.',
  },
  {
    level: 4,
    id: 'lvl_4_targa',
    title: 'Level 4 · Targa Florio Sicilia',
    subtitle: 'Abrasive Mountain Hills & Pit Strategy',
    trackId: 'targa_madonie',
    laps: 4,
    weather: 'clear',
    recommendedCompound: 'hard',
    tireWearMultiplier: 1.55,
    targetPosition: 1,
    rewardCredits: 8000,
    elevationChangeM: TRACKS.targa_madonie.elevationGainM,
    description:
      'Hot Sicilian tarmac and +31m mountain hills rapidly degrade tire tread and carcass integrity. A well-timed Pit Stop is essential for victory.',
  },
  {
    level: 5,
    id: 'lvl_5_stelvio',
    title: 'Level 5 · Trofeo Passo dello Stelvio',
    subtitle: 'Championship Finale · +38m Alpine Summit',
    trackId: 'stelvio_pass',
    laps: 4,
    weather: 'dynamic',
    recommendedCompound: 'medium',
    tireWearMultiplier: 1.65,
    targetPosition: 1,
    rewardCredits: 12000,
    elevationChangeM: TRACKS.stelvio_pass.elevationGainM,
    description:
      'The ultimate 1967 GT finale across the +38m Ortler Alps pass. Manage severe downhill braking heat, tire wear, and dynamic alpine weather.',
  },
];

/**
 * Fast closest-point query on the pre-sampled track spline with continuous segment interpolation
 * and exact banked road surface elevation so vehicles never clip or sink underground.
 */
export function findClosestTrackSample(
  track: TrackSpec,
  x: number,
  z: number,
  hintIndex = -1
): {
  sample: TrackPointSample;
  lateralOffset: number;
  distSq: number;
  surfaceY: number;
  slopePitchRad: number;
  bankRollRad: number;
  interpX: number;
  interpZ: number;
  tx: number;
  tz: number;
  rx: number;
  rz: number;
} {
  const samples = track.samples;
  const n = samples.length;
  let bestIdx = 0;
  let bestDistSq = Infinity;

  if (hintIndex >= 0 && hintIndex < n) {
    const windowRadius = 35;
    for (let offset = -windowRadius; offset <= windowRadius; offset++) {
      const idx = (hintIndex + offset + n) % n;
      const s = samples[idx];
      const dx = x - s.x;
      const dz = z - s.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        bestIdx = idx;
      }
    }
  }

  if (bestDistSq > 900) {
    for (let i = 0; i < n; i++) {
      const s = samples[i];
      const dx = x - s.x;
      const dz = z - s.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        bestIdx = i;
      }
    }
  }

  const s0 = samples[bestIdx];
  const sNext = samples[(bestIdx + 1) % n];
  const sPrev = samples[(bestIdx - 1 + n) % n];

  const segDx = sNext.x - s0.x;
  const segDz = sNext.z - s0.z;
  const segLenSq = segDx * segDx + segDz * segDz || 1;
  const projForward = ((x - s0.x) * segDx + (z - s0.z) * segDz) / segLenSq;

  let segA = s0;
  let segB = sNext;
  let tSeg = Math.max(0, Math.min(1, projForward));

  if (projForward < 0) {
    const pDx = s0.x - sPrev.x;
    const pDz = s0.z - sPrev.z;
    const pLenSq = pDx * pDx + pDz * pDz || 1;
    tSeg = Math.max(0, Math.min(1, ((x - sPrev.x) * pDx + (z - sPrev.z) * pDz) / pLenSq));
    segA = sPrev;
    segB = s0;
  }

  const interpX = segA.x + (segB.x - segA.x) * tSeg;
  const interpY = segA.y + (segB.y - segA.y) * tSeg;
  const interpZ = segA.z + (segB.z - segA.z) * tSeg;
  const interpBanking = segA.bankingRad + (segB.bankingRad - segA.bankingRad) * tSeg;
  const interpTx = segA.tx + (segB.tx - segA.tx) * tSeg;
  const interpTy = segA.ty + (segB.ty - segA.ty) * tSeg;
  const interpTz = segA.tz + (segB.tz - segA.tz) * tSeg;
  const tNorm = Math.hypot(interpTx, interpTz) || 1;
  const tx = interpTx / tNorm;
  const tz = interpTz / tNorm;

  const interpRx = segA.rx + (segB.rx - segA.rx) * tSeg;
  const interpRz = segA.rz + (segB.rz - segA.rz) * tSeg;
  const rNorm = Math.hypot(interpRx, interpRz) || 1;
  const rx = interpRx / rNorm;
  const rz = interpRz / rNorm;

  const dx = x - interpX;
  const dz = z - interpZ;
  const lateralOffset = dx * rx + dz * rz;

  const halfW = s0.width * 0.5;
  const uLat = Math.max(0, Math.min(1, Math.abs(lateralOffset) / Math.max(1, halfW)));
  const crownElevation = (1 - uLat) * 0.024;
  const clampedLatForBank = Math.max(-halfW * 1.15, Math.min(halfW * 1.15, lateralOffset));
  const bankElevation = Math.sin(interpBanking) * clampedLatForBank * 0.35;

  const surfaceY = interpY + crownElevation + bankElevation;
  const slopePitchRad = -Math.asin(Math.max(-0.42, Math.min(0.42, interpTy)));
  const bankRollRad = -interpBanking * 0.35;

  return {
    sample: s0,
    lateralOffset,
    distSq: bestDistSq,
    surfaceY,
    slopePitchRad,
    bankRollRad,
    interpX,
    interpZ,
    tx,
    tz,
    rx,
    rz,
  };
}
