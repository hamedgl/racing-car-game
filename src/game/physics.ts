import {
  ClassicCarSpec,
  CarUpgrades,
  HandlingTuning,
  EffectiveCarStats,
  VehiclePhysicsState,
  ControlInput,
  TrackSpec,
  CarLivery,
  AIArchetype,
  WeatherCondition,
  WeatherState,
  DamageMode,
  VehicleDamageState,
  TrackRubberPreset,
  TrackRubberState,
  TireCompound,
  CornerTireState,
  VehicleTireState,
} from './types';
import { findClosestTrackSample } from './tracks';

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export const TIRE_COMPOUND_SPECS: Record<
  TireCompound,
  {
    label: string;
    shortCode: string;
    colorHex: string;
    dryBaseGrip: number;
    wetBaseGrip: number;
    wearMultiplier: number;
    heatRate: number;
    optTempMin: number;
    optTempMax: number;
  }
> = {
  soft: {
    label: 'Soft Corsa',
    shortCode: 'S',
    colorHex: '#ef4444',
    dryBaseGrip: 1.10,
    wetBaseGrip: 0.72,
    wearMultiplier: 1.55,
    heatRate: 1.28,
    optTempMin: 76,
    optTempMax: 104,
  },
  medium: {
    label: 'Medium Gran Turismo',
    shortCode: 'M',
    colorHex: '#f59e0b',
    dryBaseGrip: 1.03,
    wetBaseGrip: 0.80,
    wearMultiplier: 1.0,
    heatRate: 1.0,
    optTempMin: 74,
    optTempMax: 102,
  },
  hard: {
    label: 'Hard Endurance',
    shortCode: 'H',
    colorHex: '#f8fafc',
    dryBaseGrip: 0.97,
    wetBaseGrip: 0.76,
    wearMultiplier: 0.62,
    heatRate: 0.80,
    optTempMin: 72,
    optTempMax: 106,
  },
  wet: {
    label: 'Wet Pioggia Tread',
    shortCode: 'W',
    colorHex: '#38bdf8',
    dryBaseGrip: 0.87,
    wetBaseGrip: 1.16,
    wearMultiplier: 0.95,
    heatRate: 1.15,
    optTempMin: 54,
    optTempMax: 86,
  },
};

export function createCornerTire(initialTemp = 82): CornerTireState {
  return {
    treadLife: 1.0,
    temperature: initialTemp,
    structuralIntegrity: 1.0,
    slipLoad: 0,
  };
}

export function createInitialTireState(
  compound: TireCompound = 'medium',
  wearRateMultiplier = 1.0
): VehicleTireState {
  const startTemp = compound === 'wet' ? 66 : 82;
  const spec = TIRE_COMPOUND_SPECS[compound];
  return {
    compound,
    nextPitCompound: compound,
    fl: createCornerTire(startTemp),
    fr: createCornerTire(startTemp),
    rl: createCornerTire(startTemp),
    rr: createCornerTire(startTemp),
    avgTreadLife: 1.0,
    minTreadLife: 1.0,
    avgTemp: startTemp,
    peakTemp: startTemp,
    minIntegrity: 1.0,
    gripMultiplier: spec.dryBaseGrip,
    wearRateMultiplier,
    inPitZone: false,
    pitRequest: false,
    pitStopActive: false,
    pitStopTimer: 0,
    pitStopsCompleted: 0,
  };
}

/**
 * Refits all 4 corners with fresh tires of the chosen compound during a Pit Stop
 */
export function refitFreshTires(tires: VehicleTireState, newCompound: TireCompound): void {
  const startTemp = newCompound === 'wet' ? 66 : 82;
  tires.compound = newCompound;
  tires.fl = createCornerTire(startTemp);
  tires.fr = createCornerTire(startTemp);
  tires.rl = createCornerTire(startTemp);
  tires.rr = createCornerTire(startTemp);
  tires.avgTreadLife = 1.0;
  tires.minTreadLife = 1.0;
  tires.avgTemp = startTemp;
  tires.peakTemp = startTemp;
  tires.minIntegrity = 1.0;
  tires.gripMultiplier = TIRE_COMPOUND_SPECS[newCompound].dryBaseGrip;
}

/**
 * Evaluates effective grip multiplier from a VehicleTireState and current weather wetness
 */
export function evaluateTireGripMultiplier(
  tires: VehicleTireState,
  wetness = 0
): number {
  const spec = TIRE_COMPOUND_SPECS[tires.compound];

  // 1. Compound dry vs. wet match
  const compoundGrip =
    spec.dryBaseGrip * (1 - wetness) + spec.wetBaseGrip * wetness;

  // 2. Thermal window curve (cold < optTempMin, optimal peak in [optTempMin..optTempMax], blistering > optTempMax)
  let thermalFactor = 1.0;
  const temp = tires.avgTemp;
  if (temp < spec.optTempMin) {
    const coldDiff = spec.optTempMin - temp;
    thermalFactor = Math.max(0.88, 1.0 - coldDiff * 0.0038);
  } else if (temp <= spec.optTempMax) {
    thermalFactor = 1.02; // Peak operating temperature window bonus
  } else {
    const hotDiff = temp - spec.optTempMax;
    thermalFactor = Math.max(0.80, 1.02 - hotDiff * 0.0075);
  }

  // 3. Tread wear curve with realistic <35% "cliff"
  const effTread = tires.avgTreadLife * 0.65 + tires.minTreadLife * 0.35;
  let treadFactor = 1.0;
  if (effTread >= 0.38) {
    treadFactor = 0.92 + ((effTread - 0.38) / 0.62) * 0.08;
  } else {
    // Below 38% tread life, grip drops off the cliff down to 0.56
    const cliffRatio = clamp(effTread / 0.38, 0, 1);
    treadFactor = 0.56 + Math.pow(cliffRatio, 1.45) * 0.36;
  }

  // 4. Structural carcass integrity factor
  const integ = tires.minIntegrity;
  const integrityFactor =
    integ >= 0.82
      ? 1.0
      : Math.max(0.74, 1.0 - (0.82 - integ) * 0.36);

  return Number(
    clamp(compoundGrip * thermalFactor * treadFactor * integrityFactor, 0.52, 1.16).toFixed(4)
  );
}

/**
 * Advances 4-corner dynamic tire wear, thermal heating/cooling, and carcass structural integrity.
 */
export function stepTireSimulation(
  vehicle: VehiclePhysicsState,
  track: TrackSpec,
  dt: number,
  weather?: WeatherState
): void {
  const tires = vehicle.tires;
  if (!tires) return;

  const spec = TIRE_COMPOUND_SPECS[tires.compound];
  const wetness = weather ? weather.wetness : 0;
  const abrasiveness = track.abrasiveness ?? 1.0;
  const wearScale = (tires.wearRateMultiplier ?? 1.0) * abrasiveness * spec.wearMultiplier;

  const speedNorm = clamp(vehicle.speedMs / 68, 0, 1.3);
  const absSlip = Math.abs(vehicle.slipAngleRad);
  const brakeLoad = vehicle.brake * clamp(vehicle.speedMs / 25, 0.2, 1.5);
  const accelLoad =
    vehicle.throttle * (vehicle.gear <= 2 ? 0.85 : 0.45) +
    (vehicle.isBoosting ? 0.55 : 0) +
    (vehicle.handbrake ? 1.15 : 0) +
    (vehicle.isDrifting ? 0.95 : 0);

  // Signed lateral load: turning left (angularVelocity > 0) loads right-side tires (FR, RR);
  // turning right (angularVelocity < 0) loads left-side tires (FL, RL).
  const lateralG = vehicle.angularVelocity * vehicle.speedMs * 0.085;
  const leftSideLoad = clamp(1.0 + Math.max(0, -lateralG) * 0.55, 0.65, 2.1);
  const rightSideLoad = clamp(1.0 + Math.max(0, lateralG) * 0.55, 0.65, 2.1);

  const frontAxleLoad = 1.0 + brakeLoad * 0.95 + Math.abs(vehicle.steerAngle) * 1.1;
  const rearAxleLoad = 1.0 + accelLoad * 0.85 + absSlip * 2.2;

  const cornerLoads = {
    fl: frontAxleLoad * leftSideLoad,
    fr: frontAxleLoad * rightSideLoad,
    rl: rearAxleLoad * leftSideLoad,
    rr: rearAxleLoad * rightSideLoad,
  };

  // Ambient track surface equilibrium temperature
  const ambientTemp = wetness > 0.4 ? 22 : wetness > 0.1 ? 28 : 36;
  // Running wet tires on dry road overheats & shreds tread rapidly
  const dryWetMismatch = tires.compound === 'wet' && wetness < 0.2 ? 1.85 : 1.0;

  const corners: Array<'fl' | 'fr' | 'rl' | 'rr'> = ['fl', 'fr', 'rl', 'rr'];
  for (const key of corners) {
    const c = tires[key];
    const load = cornerLoads[key];
    c.slipLoad = clamp((load - 0.8) / 2.2, 0, 1);

    // 1. Thermal simulation: friction heating vs airflow & rain cooling
    const frictionHeat =
      speedNorm *
      load *
      (1.15 + absSlip * 4.2 + (vehicle.handbrake ? 1.6 : 0)) *
      spec.heatRate *
      dryWetMismatch *
      4.8;
    const targetEquilibrium = ambientTemp + frictionHeat * 14.5;
    const coolingRate = 0.08 + speedNorm * 0.12 + wetness * 0.18;
    c.temperature = clamp(
      c.temperature + (targetEquilibrium - c.temperature) * Math.min(1, dt * coolingRate),
      ambientTemp,
      142
    );

    // 2. Tread wear degradation
    if (vehicle.speedMs > 1.5 && !tires.pitStopActive) {
      const overheatWearMult =
        c.temperature > spec.optTempMax + 4
          ? 1.0 + (c.temperature - spec.optTempMax) * 0.045
          : 1.0;
      const slipWearMult = 1.0 + absSlip * 3.8 + (vehicle.isDrifting ? 1.1 : 0);
      const baseWearPerSec = 0.0019 * speedNorm * load * wearScale * dryWetMismatch * overheatWearMult * slipWearMult;
      c.treadLife = clamp(c.treadLife - baseWearPerSec * dt, 0, 1.0);
    }

    // 3. Structural carcass integrity degradation (overheating blisters, off-track/kerb shocks, low-tread belt fatigue)
    if (vehicle.speedMs > 2.0 && !tires.pitStopActive) {
      let structDecay = 0.00035 * speedNorm * load * (tires.wearRateMultiplier ?? 1.0);
      if (c.temperature > 108) {
        // Thermal blistering damages internal belt structure
        structDecay += (c.temperature - 108) * 0.00045;
      }
      if (vehicle.isOffTrack) {
        // Rough off-track verge & gravel punishes carcass integrity
        structDecay += 0.0085 * speedNorm;
      }
      if (c.treadLife < 0.35) {
        // Thin rubber exposes carcass plies to rapid structural fatigue
        structDecay += (0.35 - c.treadLife) * 0.012 * speedNorm;
      }
      if (vehicle.hitFlashTimer > 0) {
        structDecay += 0.015;
      }
      c.structuralIntegrity = clamp(c.structuralIntegrity - structDecay * dt, 0.1, 1.0);
    }
  }

  tires.avgTreadLife = Number(
    ((tires.fl.treadLife + tires.fr.treadLife + tires.rl.treadLife + tires.rr.treadLife) * 0.25).toFixed(4)
  );
  tires.minTreadLife = Number(
    Math.min(tires.fl.treadLife, tires.fr.treadLife, tires.rl.treadLife, tires.rr.treadLife).toFixed(4)
  );
  tires.avgTemp = Number(
    ((tires.fl.temperature + tires.fr.temperature + tires.rl.temperature + tires.rr.temperature) * 0.25).toFixed(1)
  );
  tires.peakTemp = Number(
    Math.max(tires.fl.temperature, tires.fr.temperature, tires.rl.temperature, tires.rr.temperature).toFixed(1)
  );
  tires.minIntegrity = Number(
    Math.min(
      tires.fl.structuralIntegrity,
      tires.fr.structuralIntegrity,
      tires.rl.structuralIntegrity,
      tires.rr.structuralIntegrity
    ).toFixed(4)
  );

  tires.gripMultiplier = evaluateTireGripMultiplier(tires, wetness);
}

/**
 * Handles Pit Lane Service Box detection and 2.2-second 4-tire swap service on the Start/Finish straight.
 */
export function stepPitStopService(
  vehicle: VehiclePhysicsState,
  track: TrackSpec,
  dt: number,
  inputPitRequest = false
): { pitStopCompleted: boolean } {
  const tires = vehicle.tires;
  if (!tires) return { pitStopCompleted: false };

  if (inputPitRequest) {
    tires.pitRequest = true;
  }

  // Pit Lane Service Zone spans the Start/Finish straight (s <= 0.075 or s >= 0.935)
  const s = vehicle.lapProgress;
  const onMainStraight = s <= 0.075 || s >= 0.935;
  tires.inPitZone = onMainStraight;

  // If currently stopped in the Pit Box being serviced by mechanics:
  if (tires.pitStopActive) {
    tires.pitStopTimer = Math.max(0, tires.pitStopTimer - dt);
    vehicle.vx = 0;
    vehicle.vz = 0;
    vehicle.speedMs = 0;
    vehicle.lateralSpeedMs = 0;
    vehicle.angularVelocity = 0;
    vehicle.throttle = 0;
    vehicle.brake = 1;
    vehicle.rpm = 1800 + Math.sin(tires.pitStopTimer * 18) * 350;

    if (tires.pitStopTimer <= 0) {
      tires.pitStopActive = false;
      tires.pitRequest = false;
      tires.pitStopsCompleted += 1;
      refitFreshTires(tires, tires.nextPitCompound);
      vehicle.nitroCharge = 100;
      // Clean pit-lane release impulse along track tangent
      const sample = track.samples[vehicle.trackSampleIndex];
      vehicle.yaw = Math.atan2(sample.tx, sample.tz);
      vehicle.vx = sample.tx * 16;
      vehicle.vz = sample.tz * 16;
      vehicle.speedMs = 16;
      return { pitStopCompleted: true };
    }
    return { pitStopCompleted: false };
  }

  // Trigger Pit Stop entry when in Pit Zone and either:
  // 1) Driver armed pitRequest [B / Pit Button], OR
  // 2) Driver pulled into the right-side Pit Stall lane (lateralOffset > 1.75m) and slowed below 22 m/s
  const pulledIntoRightPitStall =
    onMainStraight &&
    vehicle.lateralOffset > 1.75 &&
    vehicle.speedMs < 22 &&
    (tires.avgTreadLife < 0.88 || tires.minIntegrity < 0.88 || tires.compound !== tires.nextPitCompound);

  if (onMainStraight && !vehicle.finished && (tires.pitRequest || pulledIntoRightPitStall)) {
    const sample = track.samples[vehicle.trackSampleIndex];
    const pitStallOffset = sample.width * 0.34;
    vehicle.x = sample.x + sample.rx * pitStallOffset;
    vehicle.z = sample.z + sample.rz * pitStallOffset;
    vehicle.yaw = Math.atan2(sample.tx, sample.tz);
    vehicle.vx = 0;
    vehicle.vz = 0;
    vehicle.speedMs = 0;
    tires.pitStopActive = true;
    tires.pitStopTimer = 2.0; // 2.0s rapid classic pit crew service
  }

  return { pitStopCompleted: false };
}

export function createInitialTrackRubberState(
  sampleCount = 600,
  preset: TrackRubberPreset = 'progressive'
): TrackRubberState {
  const sectorRubber = new Float32Array(sampleCount);
  let globalRubberLevel = 0.24;

  if (preset === 'green') {
    globalRubberLevel = 0.05;
  } else if (preset === 'rubbered') {
    globalRubberLevel = 0.68;
  } else if (preset === 'saturated') {
    globalRubberLevel = 1.0;
  }

  for (let i = 0; i < sampleCount; i++) {
    sectorRubber[i] = globalRubberLevel;
  }

  return {
    preset,
    globalRubberLevel,
    sectorRubber,
    lapsCompleted: 0,
    dirtyVisuals: true,
  };
}

export function applyTrackRubberPreset(
  rubberState: TrackRubberState,
  preset: TrackRubberPreset
): void {
  rubberState.preset = preset;
  if (preset === 'green') {
    rubberState.globalRubberLevel = 0.05;
  } else if (preset === 'progressive') {
    rubberState.globalRubberLevel = clamp(0.24 + rubberState.lapsCompleted * 0.26, 0.24, 1.0);
  } else if (preset === 'rubbered') {
    rubberState.globalRubberLevel = 0.68;
  } else if (preset === 'saturated') {
    rubberState.globalRubberLevel = 1.0;
  }
  for (let i = 0; i < rubberState.sectorRubber.length; i++) {
    rubberState.sectorRubber[i] = Math.max(
      rubberState.globalRubberLevel * 0.85,
      Math.min(1.0, rubberState.sectorRubber[i])
    );
  }
  rubberState.dirtyVisuals = true;
}

export function depositVehicleRubber(
  rubberState: TrackRubberState,
  track: TrackSpec,
  vehicle: VehiclePhysicsState,
  dt: number,
  tireSlipping: boolean,
  lapCompleted: boolean
): void {
  const n = rubberState.sectorRubber.length;
  if (n === 0) return;

  if (lapCompleted) {
    rubberState.lapsCompleted += 1;
    if (rubberState.preset === 'progressive') {
      const lapGain = vehicle.isPlayer ? 0.26 : 0.07;
      rubberState.globalRubberLevel = clamp(rubberState.globalRubberLevel + lapGain, 0, 1.0);
    }
    rubberState.dirtyVisuals = true;
  }

  if (rubberState.preset === 'progressive' && vehicle.speedMs > 4 && !vehicle.isOffTrack) {
    const continuousGain = dt * 0.0022 * (vehicle.isPlayer ? 1.5 : 0.65);
    rubberState.globalRubberLevel = clamp(rubberState.globalRubberLevel + continuousGain, 0, 1.0);
  }

  const centerIdx = ((vehicle.trackSampleIndex % n) + n) % n;
  const sample = track.samples[centerIdx];
  const loadFactor =
    (sample ? sample.cornerLoadIntensity : 0.5) *
    (1.0 + vehicle.brake * 0.9 + (tireSlipping ? 1.4 : 0));
  const deposit = dt * 0.065 * loadFactor;

  for (let offset = -3; offset <= 3; offset++) {
    const idx = (centerIdx + offset + n) % n;
    const falloff = 1.0 - Math.abs(offset) * 0.2;
    rubberState.sectorRubber[idx] = clamp(
      rubberState.sectorRubber[idx] + deposit * falloff,
      0,
      1.0
    );
  }
}

export function evaluateTrackRubberEffect(
  track: TrackSpec,
  sampleIndex: number,
  lateralOffset: number,
  rubberState?: TrackRubberState,
  wetness = 0
): {
  onRacingLine: boolean;
  onMarbles: boolean;
  lineGripModifier: number;
  localRubber: number;
} {
  const n = track.samples.length;
  const sample = track.samples[((sampleIndex % n) + n) % n];
  const roadHalfW = sample.width * 0.5;

  if (Math.abs(lateralOffset) > roadHalfW + 1.35) {
    return {
      onRacingLine: false,
      onMarbles: false,
      lineGripModifier: 1.0,
      localRubber: rubberState ? rubberState.globalRubberLevel : 0,
    };
  }

  const globalR = rubberState ? rubberState.globalRubberLevel : 0.25;
  const sectorR =
    rubberState && rubberState.sectorRubber.length > 0
      ? rubberState.sectorRubber[
          ((sampleIndex % rubberState.sectorRubber.length) + rubberState.sectorRubber.length) %
            rubberState.sectorRubber.length
        ]
      : globalR;
  const localRubber = clamp(globalR * 0.65 + sectorR * 0.35, 0, 1);

  const distFromRacingLine = Math.abs(lateralOffset - sample.racingLineOffset);
  const onRacingLine = distFromRacingLine <= 1.85;

  const absCurv = Math.abs(sample.curvature);
  const curveSign = Math.sign(sample.curvature || 1);
  const isOuterSideOfCorner = lateralOffset * curveSign > 0.65;
  const onMarbles =
    !onRacingLine &&
    absCurv > 0.0065 &&
    isOuterSideOfCorner &&
    distFromRacingLine > 2.15 &&
    localRubber > 0.16;

  let lineGripModifier = 1.0;
  if (onRacingLine) {
    const proximity = 1.0 - clamp(distFromRacingLine / 1.85, 0, 1) * 0.45;
    if (wetness < 0.6) {
      const dryEfficiency = 1.0 - wetness * 1.35;
      lineGripModifier = 1.0 + localRubber * 0.11 * proximity * dryEfficiency;
    } else {
      lineGripModifier = 1.0 - localRubber * 0.04 * proximity;
    }
  } else if (onMarbles) {
    lineGripModifier = 1.0 - localRubber * 0.11;
  }

  return {
    onRacingLine,
    onMarbles,
    lineGripModifier: Number(lineGripModifier.toFixed(4)),
    localRubber,
  };
}

export function createInitialDamageState(): VehicleDamageState {
  return {
    totalDamage: 0,
    frontCrumple: 0,
    rearCrumple: 0,
    leftFenderDent: 0,
    rightFenderDent: 0,
    hoodBuckle: 0,
    windshieldCrack: 0,
    radiatorPunctured: false,
    aeroPenalty: 0,
    enginePenalty: 0,
  };
}

export function createInitialWeatherState(condition: WeatherCondition = 'clear'): WeatherState {
  let activeType: 'clear' | 'overcast' | 'rain' | 'storm' = 'clear';
  let wetness = 0;
  let rainIntensity = 0;
  let gripMultiplier = 1.0;

  switch (condition) {
    case 'overcast':
      activeType = 'overcast';
      wetness = 0.08;
      rainIntensity = 0;
      gripMultiplier = 0.96;
      break;
    case 'rain':
      activeType = 'rain';
      wetness = 0.72;
      rainIntensity = 0.75;
      gripMultiplier = 0.74;
      break;
    case 'storm':
      activeType = 'storm';
      wetness = 1.0;
      rainIntensity = 1.0;
      gripMultiplier = 0.62;
      break;
    case 'dynamic':
      activeType = 'overcast';
      wetness = 0.25;
      rainIntensity = 0.2;
      gripMultiplier = 0.90;
      break;
    case 'clear':
    default:
      activeType = 'clear';
      wetness = 0;
      rainIntensity = 0;
      gripMultiplier = 1.0;
      break;
  }

  return {
    condition,
    activeType,
    wetness,
    rainIntensity,
    gripMultiplier,
    windX: -4.5,
    windZ: 2.2,
    lightningTimer: 0,
  };
}

export function updateWeather(weather: WeatherState, dt: number, raceElapsedMs: number): void {
  if (weather.condition === 'dynamic') {
    const raceSec = raceElapsedMs / 1000;
    if (raceSec < 35) {
      weather.activeType = 'overcast';
      weather.wetness = clamp(weather.wetness + dt * 0.015, 0.15, 0.4);
      weather.rainIntensity = clamp(weather.rainIntensity + dt * 0.02, 0.05, 0.35);
      weather.gripMultiplier = 0.92 - weather.wetness * 0.2;
    } else if (raceSec < 95) {
      weather.activeType = 'rain';
      weather.wetness = clamp(weather.wetness + dt * 0.025, 0.4, 0.82);
      weather.rainIntensity = clamp(weather.rainIntensity + dt * 0.03, 0.4, 0.85);
      weather.gripMultiplier = 0.88 - weather.wetness * 0.22;
    } else {
      weather.activeType = 'storm';
      weather.wetness = clamp(weather.wetness + dt * 0.03, 0.82, 1.0);
      weather.rainIntensity = 1.0;
      weather.gripMultiplier = 0.64;
      weather.lightningTimer -= dt;
      if (weather.lightningTimer <= 0) {
        weather.lightningTimer = 8 + Math.random() * 12;
      }
    }
  } else {
    let targetWet = 0;
    let targetRain = 0;
    let targetGrip = 1.0;
    if (weather.condition === 'overcast') {
      targetWet = 0.08;
      targetRain = 0;
      targetGrip = 0.96;
    } else if (weather.condition === 'rain') {
      targetWet = 0.72;
      targetRain = 0.75;
      targetGrip = 0.74;
    } else if (weather.condition === 'storm') {
      targetWet = 1.0;
      targetRain = 1.0;
      targetGrip = 0.62;
      weather.lightningTimer -= dt;
      if (weather.lightningTimer <= 0) {
        weather.lightningTimer = 7 + Math.random() * 10;
      }
    }
    weather.wetness += (targetWet - weather.wetness) * Math.min(1, dt * 1.5);
    weather.rainIntensity += (targetRain - weather.rainIntensity) * Math.min(1, dt * 2.0);
    weather.gripMultiplier += (targetGrip - weather.gripMultiplier) * Math.min(1, dt * 1.5);
  }
}

/**
 * Visual car damage is disabled per user specification so coachbuilt car bodies remain pristine.
 */
export function accumulateVehicleDamage(
  _vehicle: VehiclePhysicsState,
  _impactSpeedMs: number,
  _localAngleRad: number,
  _damageMode: DamageMode = 'off'
): void {
  // Visual car damage intentionally disabled; collisions affect tire temperature & carcass integrity instead.
}

export function computeEffectiveCarStats(
  car: ClassicCarSpec,
  upgrades: CarUpgrades,
  tuning: HandlingTuning
): EffectiveCarStats {
  const engBonus = (upgrades.engineLevel - 1) * 0.065;
  const transBonus = (upgrades.transmissionLevel - 1) * 0.045;
  const tireBonus = (upgrades.tiresLevel - 1) * 0.055;
  const weightBonus = (upgrades.chassisWeightLevel - 1) * 0.035;

  const powerHp = Math.round(car.baseStats.powerHp * (1 + engBonus));
  const weightKg = Math.round(car.baseStats.weightKg * (1 - weightBonus));

  const psiDelta = tuning.tirePressurePsi - 30.0;
  const psiGripFactor = 1 - Math.abs(psiDelta) * 0.008 - (psiDelta > 0 ? psiDelta * 0.004 : 0);
  const psiRollingFactor = 1 - psiDelta * 0.006;

  const aeroNorm = tuning.aeroDownforce / 100;
  const downforceFactor = 0.18 + aeroNorm * 0.58;
  const aeroDragPenalty = aeroNorm * 0.12;

  const ratioNorm = (tuning.finalDriveRatio - 3.55) / 0.95;
  const gearingTopSpeedMod = 1 - ratioNorm * 0.075;
  const gearingAccelMod = 1 + ratioNorm * 0.095;

  const rawTopSpeed =
    car.baseStats.topSpeedKmh *
    (1 + engBonus * 0.42 + transBonus * 0.18 - aeroDragPenalty * 0.55) *
    gearingTopSpeedMod *
    (2 - psiRollingFactor);
  const topSpeedKmh = Math.round(clamp(rawTopSpeed, 210, 365));
  const maxSpeedMs = topSpeedKmh / 3.6;

  const powerToWeight = powerHp / (weightKg / 1000);
  const basePtw = car.baseStats.powerHp / (car.baseStats.weightKg / 1000);
  const ptwRatio = powerToWeight / basePtw;
  const rawAccel =
    (car.baseStats.accel0to100 / (ptwRatio * (1 + transBonus * 0.35) * gearingAccelMod)) *
    (1 - tireBonus * 0.18);
  const accel0to100Sec = Number(clamp(rawAccel, 2.7, 7.5).toFixed(2));

  const stiffNorm = (tuning.suspensionStiffness - 5.5) / 4.5;
  const rawGripG =
    car.baseStats.lateralGripG *
    (1 + tireBonus + weightBonus * 0.35) *
    psiGripFactor *
    (1 + aeroNorm * 0.16 + stiffNorm * 0.04);
  const lateralGripG = Number(clamp(rawGripG, 0.9, 1.85).toFixed(2));

  const biasDelta = Math.abs(tuning.brakeBiasFront - 58);
  const biasEfficiency = 1 - biasDelta * 0.008;
  const rawBrakingG =
    car.baseStats.brakingG *
    (1 + tireBonus * 0.7 + weightBonus * 0.4) *
    biasEfficiency *
    (1 + aeroNorm * 0.1);
  const brakingG = Number(clamp(rawBrakingG, 0.95, 1.95).toFixed(2));

  const engineForceN = powerHp * 38.5 * (1 + transBonus * 0.25) * gearingAccelMod;
  const brakeForceN = weightKg * 9.81 * brakingG * 1.45;
  const dragFactor = car.baseStats.dragCoeff * (1 + aeroDragPenalty) * psiRollingFactor * 0.42;

  const diffNorm = (tuning.diffLockAccel - 45) / 40;
  const brakeRearBias = (58 - tuning.brakeBiasFront) / 12;
  const oversteerBias = clamp(
    1.0 + diffNorm * 0.22 + stiffNorm * 0.1 + brakeRearBias * 0.12 - aeroNorm * 0.08,
    0.65,
    1.45
  );

  let balanceLabel: 'Understeer' | 'Neutral-Balanced' | 'Oversteer-Agile' = 'Neutral-Balanced';
  if (oversteerBias < 0.92) balanceLabel = 'Understeer';
  else if (oversteerBias > 1.08) balanceLabel = 'Oversteer-Agile';

  const cornerStiffness = lateralGripG * 4.4;
  const turnInRate =
    (2.85 / car.baseStats.wheelbaseM) *
    (1 + stiffNorm * 0.14 + (psiDelta > 0 ? psiDelta * 0.015 : 0));
  const bodyRollFactor = clamp(1.35 - (tuning.suspensionStiffness - 1) * 0.11, 0.25, 1.35);

  const performanceIndex = Math.round(
    clamp(
      (powerToWeight / 300) * 250 +
        (lateralGripG / 1.3) * 180 +
        (brakingG / 1.3) * 110 +
        (topSpeedKmh / 280) * 120,
      350,
      999
    )
  );

  return {
    powerHp,
    weightKg,
    topSpeedKmh,
    accel0to100Sec,
    lateralGripG,
    brakingG,
    maxSpeedMs,
    engineForceN,
    brakeForceN,
    dragFactor,
    downforceFactor,
    cornerStiffness,
    turnInRate,
    bodyRollFactor,
    oversteerBias,
    balanceLabel,
    performanceIndex,
  };
}

export function createInitialVehicleState(params: {
  id: string;
  isPlayer: boolean;
  driverName: string;
  carSpecId: string;
  livery: CarLivery;
  track: TrackSpec;
  gridSlot: number;
  archetype?: AIArchetype;
  tireCompound?: TireCompound;
  startingCompound?: TireCompound;
  tireWearMultiplier?: number;
}): VehiclePhysicsState {
  const {
    id,
    isPlayer,
    driverName,
    carSpecId,
    livery,
    track,
    gridSlot,
    archetype,
    tireCompound,
    startingCompound,
    tireWearMultiplier = 1.0,
  } = params;
  const resolvedCompound: TireCompound = startingCompound || tireCompound || 'medium';
  const startLookup = findClosestTrackSample(track, 0, 0);
  const startIdx = startLookup.sample.index;
  const n = track.samples.length;
  const slotSampleIdx = (startIdx - 6 - gridSlot * 4 + n) % n;
  const sample = track.samples[slotSampleIdx];

  const lateralLane = (gridSlot % 2 === 0 ? -1 : 1) * 3.1;
  const x = sample.x + sample.rx * lateralLane;
  const z = sample.z + sample.rz * lateralLane;
  const exactLookup = findClosestTrackSample(track, x, z, slotSampleIdx);
  const y = exactLookup.surfaceY;
  const yaw = Math.atan2(sample.tx, sample.tz);

  return {
    id,
    isPlayer,
    driverName,
    carSpecId,
    archetype,
    livery,
    x,
    y,
    z,
    yaw,
    vx: 0,
    vz: 0,
    speedMs: 0,
    lateralSpeedMs: 0,
    angularVelocity: 0,
    throttle: 0,
    brake: 0,
    steerAngle: 0,
    handbrake: false,
    gear: 1,
    rpm: 1200,
    pitchRad: exactLookup.slopePitchRad,
    rollRad: exactLookup.bankRollRad,
    slipAngleRad: 0,
    isDrifting: false,
    isOffTrack: false,
    isDrafting: false,
    hitFlashTimer: 0,
    brakeTelegraphTimer: 0,
    trackSampleIndex: slotSampleIdx,
    lapProgress: sample.s,
    lateralOffset: lateralLane,
    lap: 1,
    maxSReachedThisLap: sample.s,
    totalRaceDistanceM: -gridSlot * 8,
    currentLapStartTimeMs: 0,
    lastLapTimeMs: 0,
    bestLapTimeMs: 0,
    finished: false,
    finishTimeMs: 0,
    topSpeedAchievedKmh: 0,
    aiTargetOffset: lateralLane,
    aiReactionTimer: 0,
    damage: createInitialDamageState(),
    aquaplaningTimer: 0,
    tires: createInitialTireState(resolvedCompound, tireWearMultiplier),
    nitroCharge: 100,
    isBoosting: false,
    onRacingLine: Math.abs(lateralLane - sample.racingLineOffset) <= 1.85,
    onMarbles: false,
    lineGripModifier: 1.0,
    frontBrakeGlow: 0,
  };
}

/**
 * Advances a single vehicle's physics state by `dt` seconds (clamped <= 0.05s)
 * with dynamic 4-corner tire wear/temperature/integrity simulation, Pit Stop service,
 * weather grip attenuation, track rubbering on-line grip bonus vs. off-line marbles,
 * exact 3D hilly road elevation locking, and smooth tangent-projected Armco guardrail deflection.
 */
export function stepVehiclePhysics(
  vehicle: VehiclePhysicsState,
  input: ControlInput,
  stats: EffectiveCarStats,
  track: TrackSpec,
  rawDt: number,
  raceElapsedMs: number,
  weather?: WeatherState,
  _damageMode: DamageMode = 'off',
  rubberState?: TrackRubberState,
  tireWearMultiplier = 1.0
): {
  gearChanged: boolean;
  lapCompleted: boolean;
  raceFinished: boolean;
  pitStopCompleted: boolean;
  wallImpactSpeedMs: number;
  wallScrapeSpeedMs: number;
  wallContactX: number;
  wallContactY: number;
  wallContactZ: number;
  tireSlipping: boolean;
  slipIntensity: number;
} {
  const dt = Math.min(Math.max(rawDt, 0.0001), 0.05);
  let gearChanged = false;
  let lapCompleted = false;
  let raceFinished = false;
  let wallImpactSpeedMs = 0;
  let wallScrapeSpeedMs = 0;
  let wallContactX = vehicle.x;
  let wallContactY = vehicle.y;
  let wallContactZ = vehicle.z;

  if (!vehicle.tires) {
    vehicle.tires = createInitialTireState('medium', tireWearMultiplier);
  } else {
    vehicle.tires.wearRateMultiplier = tireWearMultiplier;
  }

  if (vehicle.hitFlashTimer > 0) {
    vehicle.hitFlashTimer = Math.max(0, vehicle.hitFlashTimer - dt);
  }
  if (vehicle.brakeTelegraphTimer > 0) {
    vehicle.brakeTelegraphTimer = Math.max(0, vehicle.brakeTelegraphTimer - dt);
  }

  // Step Pit Stop Service Box Check (if currently in Pit Stop, vehicle is serviced by pit crew)
  const pitResult = stepPitStopService(vehicle, track, dt, Boolean(input.pitRequest));
  if (vehicle.tires.pitStopActive) {
    const pitLookup = findClosestTrackSample(track, vehicle.x, vehicle.z, vehicle.trackSampleIndex);
    vehicle.y = pitLookup.surfaceY;
    return {
      gearChanged: false,
      lapCompleted: false,
      raceFinished: false,
      pitStopCompleted: false,
      wallImpactSpeedMs: 0,
      wallScrapeSpeedMs: 0,
      wallContactX: vehicle.x,
      wallContactY: vehicle.y,
      wallContactZ: vehicle.z,
      tireSlipping: false,
      slipIntensity: 0,
    };
  }

  // Nitro Overboost Activation & Automatic Energy Recharge
  const wantsNitro = Boolean(!vehicle.finished && input.nitro && vehicle.nitroCharge > 1.5 && !input.backward);
  if (wantsNitro) {
    vehicle.isBoosting = true;
    vehicle.nitroCharge = Math.max(0, vehicle.nitroCharge - dt * 28);
  } else {
    vehicle.isBoosting = false;
    const rechargeRate =
      8.0 +
      (vehicle.isDrifting ? 16.0 : 0) +
      (vehicle.isDrafting ? 12.0 : 0) +
      (vehicle.brake > 0.3 && vehicle.speedMs > 10 ? 10.0 : 0);
    vehicle.nitroCharge = Math.min(100, (vehicle.nitroCharge ?? 100) + dt * rechargeRate);
  }

  // Smooth throttle & brake inputs
  const targetThrottle = vehicle.finished ? 0.15 : input.forward || vehicle.isBoosting ? 1 : 0;
  const targetBrake = vehicle.finished ? 0.5 : input.backward ? 1 : 0;
  vehicle.throttle += (targetThrottle - vehicle.throttle) * Math.min(1, dt * 16);
  vehicle.brake += (targetBrake - vehicle.brake) * Math.min(1, dt * 18);
  vehicle.handbrake = vehicle.finished ? false : input.handbrake;

  // Thermal Brake Disc Glow
  const brakeHeatInput =
    vehicle.brake > 0.15 && vehicle.speedMs > 8
      ? vehicle.brake * clamp(vehicle.speedMs / 36, 0.2, 1.4) * 2.4
      : 0;
  const brakeCooling = 0.85 + clamp(vehicle.speedMs / 45, 0, 1.2) * 0.9;
  vehicle.frontBrakeGlow = clamp(
    (vehicle.frontBrakeGlow ?? 0) + (brakeHeatInput - brakeCooling) * dt,
    0,
    1.0
  );

  // Steering input with progressive speed-sensitive authority & caster counter-steer assist
  const digitalSteer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const rawSteer =
    input.steerAxis !== undefined && Math.abs(input.steerAxis) > 0.01
      ? clamp(input.steerAxis, -1, 1)
      : digitalSteer;
  const speedRatio = clamp(vehicle.speedMs / stats.maxSpeedMs, 0, 1.1);

  // Aquaplaning check in heavy standing water (Wet Pioggia tires channel water and cut aquaplaning by 75%!)
  const wetness = weather ? weather.wetness : 0;
  const weatherGripMult = weather ? weather.gripMultiplier : 1.0;
  const isWetTire = vehicle.tires.compound === 'wet';
  if (wetness > 0.55 && vehicle.speedMs > 44 && !isWetTire) {
    vehicle.aquaplaningTimer = Math.min(1.0, vehicle.aquaplaningTimer + dt * 0.9);
  } else {
    vehicle.aquaplaningTimer = Math.max(0, vehicle.aquaplaningTimer - dt * 2.2);
  }

  const aquaSteerPenalty = 1.0 - vehicle.aquaplaningTimer * 0.55;
  // Front tire wear / integrity slightly softens turn-in crispness
  const frontTireHealth =
    (vehicle.tires.fl.treadLife + vehicle.tires.fr.treadLife) * 0.25 +
    (vehicle.tires.fl.structuralIntegrity + vehicle.tires.fr.structuralIntegrity) * 0.25;
  const frontTurnInFactor = 0.82 + 0.18 * frontTireHealth;

  const maxSteerRad =
    0.44 *
    (1 - speedRatio * 0.36) *
    (stats.turnInRate / 1.12) *
    aquaSteerPenalty *
    frontTurnInFactor;

  const driftAssistSteer =
    vehicle.isPlayer && Math.abs(vehicle.slipAngleRad) > 0.08
      ? clamp(-vehicle.slipAngleRad * 0.32, -0.16, 0.16)
      : 0;

  const targetSteer = clamp(rawSteer * maxSteerRad + driftAssistSteer, -0.52, 0.52);
  const steerLerpRate = Math.abs(rawSteer) < 0.05 ? 22 : 15;
  vehicle.steerAngle += (targetSteer - vehicle.steerAngle) * Math.min(1, dt * steerLerpRate);

  const fx = Math.sin(vehicle.yaw);
  const fz = Math.cos(vehicle.yaw);
  const rx = fz;
  const rz = -fx;

  let forwardVel = vehicle.vx * fx + vehicle.vz * fz;
  let lateralVel = vehicle.vx * rx + vehicle.vz * rz;

  // Track surface lookup
  const prevLookup = findClosestTrackSample(track, vehicle.x, vehicle.z, vehicle.trackSampleIndex);
  const roadHalfWidth = prevLookup.sample.width * 0.5;
  const absOffset = Math.abs(prevLookup.lateralOffset);
  vehicle.isOffTrack = absOffset > roadHalfWidth + 1.35;

  // Step Dynamic 4-Corner Tire Wear, Heat & Structural Integrity Simulation
  stepTireSimulation(vehicle, track, dt, weather);
  const tireGripMult = vehicle.tires.gripMultiplier;

  // Evaluate Track Rubbering effect
  const rubberEffect = evaluateTrackRubberEffect(
    track,
    prevLookup.sample.index,
    prevLookup.lateralOffset,
    rubberState,
    wetness
  );
  vehicle.onRacingLine = rubberEffect.onRacingLine;
  vehicle.onMarbles = rubberEffect.onMarbles;
  vehicle.lineGripModifier = rubberEffect.lineGripModifier;

  // Effective weather grip: Wet compound tires negate most of the rain grip loss!
  const effectiveWeatherGrip = isWetTire
    ? Math.max(weatherGripMult, 1.0 - wetness * 0.12)
    : weatherGripMult;

  // Combined Surface + Tire Compound/Wear/Temp + Track Rubbering + Aero Downforce Grip
  const surfaceGrip =
    track.surfaceGrip *
    effectiveWeatherGrip *
    tireGripMult *
    rubberEffect.lineGripModifier *
    (vehicle.isOffTrack ? 0.72 : 1.0) *
    (1 + speedRatio * speedRatio * stats.downforceFactor * 0.44);

  // 5-speed classic gearbox
  const gearMaxSpeeds = [
    stats.maxSpeedMs * 0.25,
    stats.maxSpeedMs * 0.43,
    stats.maxSpeedMs * 0.63,
    stats.maxSpeedMs * 0.82,
    stats.maxSpeedMs * 1.02,
  ];
  let newGear = 1;
  const absSpeed = Math.abs(forwardVel);
  for (let g = 0; g < 5; g++) {
    if (absSpeed > gearMaxSpeeds[g] * 0.86 && g < 4) {
      newGear = g + 2;
    }
  }
  if (newGear !== vehicle.gear) {
    gearChanged = true;
    vehicle.gear = newGear;
  }

  const gearFloor = vehicle.gear === 1 ? 0 : gearMaxSpeeds[vehicle.gear - 2] * 0.68;
  const gearCeil = gearMaxSpeeds[vehicle.gear - 1];
  const gearProgress = clamp((absSpeed - gearFloor) / Math.max(1, gearCeil - gearFloor), 0, 1);
  const targetRpm =
    1450 + gearProgress * 6650 + vehicle.throttle * 380 + (vehicle.isBoosting ? 420 : 0);
  vehicle.rpm += (targetRpm - vehicle.rpm) * Math.min(1, dt * 16);

  const rpmNorm = (vehicle.rpm - 1200) / 7000;
  const torqueCurve = 0.82 + Math.sin(clamp(rpmNorm, 0.05, 0.98) * Math.PI) * 0.34;
  const gearMultipliers = [1.62, 1.30, 1.08, 0.94, 0.84];
  const gearMult = gearMultipliers[vehicle.gear - 1] ?? 1.0;

  let driveForce = 0;
  if (forwardVel >= -0.5 && vehicle.throttle > 0.01) {
    const draftBoost = vehicle.isDrafting ? 1.14 : 1.0;
    const nitroBoostMult = vehicle.isBoosting ? 1.44 : 1.0;
    const lineTractionMod = vehicle.onRacingLine
      ? Math.max(1.0, rubberEffect.lineGripModifier)
      : vehicle.onMarbles
      ? 0.93
      : 1.0;
    // Worn rear tires lose longitudinal launch/exit traction
    const rearTireTraction = clamp(0.68 + 0.34 * tireGripMult, 0.62, 1.12);
    driveForce +=
      stats.engineForceN *
      torqueCurve *
      gearMult *
      vehicle.throttle *
      draftBoost *
      nitroBoostMult *
      lineTractionMod *
      rearTireTraction;
  }

  if (vehicle.brake > 0.01) {
    const brakingTireEfficiency =
      (0.75 + 0.25 * effectiveWeatherGrip) *
      rubberEffect.lineGripModifier *
      clamp(0.72 + 0.28 * tireGripMult, 0.65, 1.1);
    if (forwardVel > 1.0) {
      driveForce -= stats.brakeForceN * vehicle.brake * brakingTireEfficiency;
    } else {
      driveForce -= stats.engineForceN * 0.48 * vehicle.brake;
    }
  }

  if (vehicle.handbrake && Math.abs(forwardVel) > 0.5) {
    driveForce -= Math.sign(forwardVel) * stats.brakeForceN * 0.52;
  }

  const aeroDrag =
    stats.dragFactor *
    forwardVel *
    Math.abs(forwardVel) *
    (vehicle.isDrafting ? 0.76 : 1.0) *
    (vehicle.isBoosting ? 0.84 : 1.0);
  // Degraded tire structural integrity increases rolling resistance slightly
  const tireIntegrityDrag = (1.0 - vehicle.tires.minIntegrity) * 280;
  const rollingRes =
    (vehicle.isOffTrack
      ? 1350
      : (vehicle.onMarbles ? 340 : 225) + wetness * 180 + tireIntegrityDrag) * forwardVel;
  // Pronounced 3D hill gravity force: uphill climbs require high torque, downhill descents accelerate faster
  const slopeGravity = -stats.weightKg * 9.81 * prevLookup.sample.ty * 0.42;

  const netLongitudinalForce = driveForce - aeroDrag - rollingRes + slopeGravity;
  const longAccel = netLongitudinalForce / stats.weightKg;

  forwardVel += longAccel * dt;
  const maxAllowedSpeed =
    stats.maxSpeedMs *
    (vehicle.isDrafting ? 1.05 : 1.0) *
    (vehicle.isBoosting ? 1.12 : 1.0);
  forwardVel = clamp(forwardVel, -15, maxAllowedSpeed);

  // Cornering Yaw Rate & Tire Wear Oversteer Balance
  const minSteerSpeed = Math.min(1.0, Math.abs(forwardVel) / 2.6);
  const directionSign = forwardVel >= -0.2 ? 1 : -1;
  const handbrakeOversteer = vehicle.handbrake ? 1.85 : 1.0;
  const trailBrakeRotation =
    vehicle.brake > 0.12 && Math.abs(vehicle.steerAngle) > 0.03
      ? 1.0 + Math.min(0.22, vehicle.brake * 0.24)
      : 1.0;

  // Worn rear tires induce progressive power oversteer
  const rearWearOversteer = Math.max(0, 0.85 - (vehicle.tires.rl.treadLife + vehicle.tires.rr.treadLife) * 0.5) * 0.45;
  const wetOversteerMod =
    1.0 + (1.0 - effectiveWeatherGrip) * 0.5 + (vehicle.onMarbles ? 0.25 : 0) + rearWearOversteer;
  const throttleOversteer =
    1 + vehicle.throttle * (stats.oversteerBias - 1.0) * 0.42 * wetOversteerMod;

  const targetAngularVel =
    vehicle.steerAngle *
    stats.turnInRate *
    minSteerSpeed *
    directionSign *
    handbrakeOversteer *
    trailBrakeRotation *
    throttleOversteer *
    (0.72 + 0.28 * surfaceGrip);

  if (vehicle.handbrake && Math.abs(forwardVel) > 7 && Math.abs(vehicle.steerAngle) > 0.04) {
    vehicle.angularVelocity += Math.sign(vehicle.steerAngle) * 3.6 * dt;
  }

  const isCounterSteering =
    vehicle.slipAngleRad * vehicle.steerAngle < -0.01 && Math.abs(vehicle.slipAngleRad) > 0.09;
  const yawDamping = isCounterSteering ? 25 : Math.abs(rawSteer) < 0.05 ? 19 : 15;
  vehicle.angularVelocity +=
    (targetAngularVel - vehicle.angularVelocity) * Math.min(1, dt * yawDamping);
  vehicle.yaw = normalizeAngle(vehicle.yaw + vehicle.angularVelocity * dt);

  const centrifugalLateral =
    -vehicle.angularVelocity *
    forwardVel *
    0.26 *
    stats.oversteerBias *
    (vehicle.handbrake ? 2.15 : 1.0);
  lateralVel += centrifugalLateral * dt * 3.8;

  const absSlip = Math.abs(vehicle.slipAngleRad);
  const pacejkaGripFactor = absSlip < 0.14 ? 1.06 : Math.max(0.74, 1.06 - (absSlip - 0.14) * 0.65);
  const handbrakeLateralGrip = vehicle.handbrake ? 0.22 : pacejkaGripFactor;
  const lateralGripDamping = stats.cornerStiffness * surfaceGrip * handbrakeLateralGrip;
  lateralVel *= Math.exp(-lateralGripDamping * dt);

  if (Math.abs(prevLookup.sample.bankingRad) > 0.01 && Math.abs(forwardVel) > 6) {
    lateralVel -= Math.sin(prevLookup.sample.bankingRad) * 5.4 * dt;
  }

  const newFx = Math.sin(vehicle.yaw);
  const newFz = Math.cos(vehicle.yaw);
  const newRx = newFz;
  const newRz = -newFx;

  vehicle.vx = newFx * forwardVel + newRx * lateralVel;
  vehicle.vz = newFz * forwardVel + newRz * lateralVel;
  vehicle.speedMs = Math.hypot(vehicle.vx, vehicle.vz);
  vehicle.lateralSpeedMs = lateralVel;

  const kmh = vehicle.speedMs * 3.6;
  if (kmh > vehicle.topSpeedAchievedKmh) {
    vehicle.topSpeedAchievedKmh = kmh;
  }

  vehicle.slipAngleRad = Math.atan2(lateralVel, Math.max(2.5, Math.abs(forwardVel)));
  vehicle.isDrifting =
    vehicle.speedMs > 10 &&
    (Math.abs(vehicle.slipAngleRad) > 0.12 ||
      (vehicle.handbrake && Math.abs(vehicle.steerAngle) > 0.05));

  const hardBraking = vehicle.brake > 0.55 && vehicle.speedMs > 6;
  const launchWheelspin =
    vehicle.gear === 1 && vehicle.throttle > 0.85 && vehicle.speedMs > 2 && vehicle.speedMs < 14;
  const tireSlipping =
    hardBraking ||
    launchWheelspin ||
    (vehicle.handbrake && vehicle.speedMs > 3.5) ||
    (vehicle.isDrifting && Math.abs(vehicle.slipAngleRad) > 0.13);
  const slipIntensity = clamp(
    Math.abs(vehicle.slipAngleRad) * 2.8 +
      (vehicle.handbrake ? 0.65 : 0) +
      (hardBraking ? 0.55 : 0) +
      (launchWheelspin ? 0.45 : 0),
    0,
    1.0
  );

  // Advance horizontal position
  vehicle.x += vehicle.vx * dt;
  vehicle.z += vehicle.vz * dt;

  // Query exact interpolated track surface & Smooth Tangent-Projected Armco Guardrail Collision
  const currLookup = findClosestTrackSample(track, vehicle.x, vehicle.z, prevLookup.sample.index);
  const sample = currLookup.sample;

  const barrierLimit = sample.width * 0.5 + 1.18;
  if (Math.abs(currLookup.lateralOffset) > barrierLimit) {
    const sign = Math.sign(currLookup.lateralOffset);
    // Keep 3cm inward clearance inside barrierLimit so car never re-snags on the next frame
    const clampedOffset = sign * (barrierLimit - 0.03);
    vehicle.x = currLookup.interpX + currLookup.rx * clampedOffset;
    vehicle.z = currLookup.interpZ + currLookup.rz * clampedOffset;

    wallContactX = currLookup.interpX + currLookup.rx * (sign * (barrierLimit + 0.55));
    wallContactZ = currLookup.interpZ + currLookup.rz * (sign * (barrierLimit + 0.55));

    const vTang = vehicle.vx * currLookup.tx + vehicle.vz * currLookup.tz;
    const vNorm = vehicle.vx * currLookup.rx + vehicle.vz * currLookup.rz;

    if (vNorm * sign > -0.1) {
      wallImpactSpeedMs = Math.max(0, vNorm * sign);
      wallScrapeSpeedMs = Math.abs(vTang);

      const impactRatio = clamp(wallImpactSpeedMs / Math.max(1, vehicle.speedMs), 0, 1);
      // Gentle inward push away from barrier + smooth tangential glide
      const bouncedNorm = -sign * Math.max(0.85, wallImpactSpeedMs * 0.16);
      const frictionLoss = clamp(1.0 - (0.02 + impactRatio * 0.09), 0.88, 0.985);
      const retainedTang = vTang * frictionLoss;

      vehicle.vx = currLookup.tx * retainedTang + currLookup.rx * bouncedNorm;
      vehicle.vz = currLookup.tz * retainedTang + currLookup.rz * bouncedNorm;
      vehicle.speedMs = Math.hypot(vehicle.vx, vehicle.vz);
      vehicle.hitFlashTimer = 0.06;

      // Smoothly align vehicle heading parallel to the interpolated guardrail tangent so nose never digs in
      const trackYaw = Math.atan2(currLookup.tx, currLookup.tz);
      const yawDiff = normalizeAngle(trackYaw - vehicle.yaw);
      vehicle.yaw = normalizeAngle(vehicle.yaw + yawDiff * (0.55 + impactRatio * 0.25));
      vehicle.angularVelocity *= 0.2;
    }
  }

  // Exact road surface height locking (zero floating gap)
  const finalLookup = findClosestTrackSample(track, vehicle.x, vehicle.z, sample.index);
  vehicle.y = finalLookup.surfaceY;
  wallContactY = vehicle.y + 0.42;

  const headingDotTangent = newFx * finalLookup.tx + newFz * finalLookup.tz;
  const effectiveSlopePitch = finalLookup.slopePitchRad * headingDotTangent;

  const suspPitch = clamp(-longAccel * 0.0014 * stats.bodyRollFactor, -0.024, 0.024);
  const suspRoll = clamp(
    vehicle.angularVelocity * forwardVel * 0.0015 * stats.bodyRollFactor,
    -0.055,
    0.055
  );
  const targetPitch = effectiveSlopePitch + suspPitch;
  const targetRoll = finalLookup.bankRollRad * headingDotTangent + suspRoll;

  vehicle.pitchRad += (targetPitch - vehicle.pitchRad) * Math.min(1, dt * 16);
  vehicle.rollRad += (targetRoll - vehicle.rollRad) * Math.min(1, dt * 16);

  // Update Lap & Race Progress
  vehicle.trackSampleIndex = finalLookup.sample.index;
  vehicle.lateralOffset = finalLookup.lateralOffset;

  const prevS = vehicle.lapProgress;
  const newS = finalLookup.sample.s;
  vehicle.lapProgress = newS;

  if (newS > vehicle.maxSReachedThisLap) {
    vehicle.maxSReachedThisLap = newS;
  }

  // Cross start/finish line detection
  if (prevS > 0.85 && newS < 0.15 && vehicle.maxSReachedThisLap > 0.75) {
    const lapTime = Math.max(1000, raceElapsedMs - vehicle.currentLapStartTimeMs);
    vehicle.lastLapTimeMs = lapTime;
    if (vehicle.bestLapTimeMs === 0 || lapTime < vehicle.bestLapTimeMs) {
      vehicle.bestLapTimeMs = lapTime;
    }

    vehicle.lap++;
    vehicle.currentLapStartTimeMs = raceElapsedMs;
    vehicle.maxSReachedThisLap = newS;
    lapCompleted = true;

    if (vehicle.lap > track.laps && !vehicle.finished) {
      vehicle.finished = true;
      vehicle.finishTimeMs = raceElapsedMs;
      raceFinished = true;
    }
  }

  vehicle.totalRaceDistanceM =
    (vehicle.lap - 1) * track.totalLengthM + newS * track.totalLengthM;

  if (rubberState) {
    depositVehicleRubber(rubberState, track, vehicle, dt, tireSlipping, lapCompleted);
  }

  return {
    gearChanged,
    lapCompleted,
    raceFinished,
    pitStopCompleted: pitResult.pitStopCompleted,
    wallImpactSpeedMs,
    wallScrapeSpeedMs,
    wallContactX,
    wallContactY,
    wallContactZ,
    tireSlipping,
    slipIntensity,
  };
}

/**
 * Smart Multi-Horizon AI Competitor Decision Policies with Racing Line Tracking,
 * Weather Adaptation, and Automatic Pit Stop Tire Strategy
 */
export function computeAIControls(
  ai: VehiclePhysicsState,
  allVehicles: VehiclePhysicsState[],
  track: TrackSpec,
  dt: number,
  weather?: WeatherState
): ControlInput {
  const samples = track.samples;
  const n = samples.length;
  const currIdx = ai.trackSampleIndex;
  const metersPerSample = track.totalLengthM / n;

  const nearSteps = Math.max(4, Math.round(13 / metersPerSample));
  const midSteps = Math.max(9, Math.round(28 / metersPerSample));
  const farSteps = Math.max(16, Math.round(50 / metersPerSample));

  const nearSample = samples[(currIdx + nearSteps) % n];
  const midSample = samples[(currIdx + midSteps) % n];
  const farSample = samples[(currIdx + farSteps) % n];

  const maxCurvature = Math.max(
    Math.abs(nearSample.curvature),
    Math.abs(midSample.curvature) * 0.95,
    Math.abs(farSample.curvature) * 0.82
  );

  const dominantCurve =
    Math.abs(midSample.curvature) > Math.abs(nearSample.curvature)
      ? midSample.curvature
      : nearSample.curvature || farSample.curvature;
  const curveSign = Math.sign(dominantCurve || 1);
  const maxSafeOffset = nearSample.width * 0.35;

  // AI Pit Stop Strategy: if tires are worn (<35%) or weather turned wet while on slicks, arm Pit Stop before final lap
  let pitRequest = false;
  if (ai.tires && ai.lap < track.laps) {
    const wetness = weather ? weather.wetness : 0;
    const needsWetTires = wetness > 0.48 && ai.tires.compound !== 'wet';
    const needsDryTires = wetness < 0.15 && ai.tires.compound === 'wet';
    const criticallyWorn = ai.tires.minTreadLife < 0.32 || ai.tires.minIntegrity < 0.45;
    if (needsWetTires) {
      ai.tires.nextPitCompound = 'wet';
      pitRequest = true;
    } else if (needsDryTires || criticallyWorn) {
      ai.tires.nextPitCompound = track.laps - ai.lap <= 1 ? 'soft' : 'medium';
      pitRequest = true;
    }
  }

  const weatherGripFactor = weather ? weather.gripMultiplier : 1.0;
  const tireGripFactor = ai.tires ? ai.tires.gripMultiplier : 1.0;
  const effectiveRadius = 1 / Math.max(0.0025, maxCurvature);
  const baseLateralAccel =
    (ai.archetype === 'late_braker' ? 13.8 : ai.archetype === 'apex_precision' ? 13.2 : 12.9) *
    weatherGripFactor *
    tireGripFactor;
  const physicsCornerSpeedMs = clamp(Math.sqrt(baseLateralAccel * effectiveRadius), 18, 86);

  let desiredOffset = clamp(nearSample.racingLineOffset, -maxSafeOffset, maxSafeOffset);
  let targetSpeedMs = physicsCornerSpeedMs;

  if (ai.archetype === 'late_braker') {
    desiredOffset = clamp(
      nearSample.racingLineOffset * 0.85 - curveSign * maxCurvature * 45,
      -maxSafeOffset,
      maxSafeOffset
    );
    targetSpeedMs = physicsCornerSpeedMs * 1.03;
    if (ai.speedMs > targetSpeedMs * 1.05 && maxCurvature > 0.012 && ai.brakeTelegraphTimer <= 0) {
      ai.brakeTelegraphTimer = 0.45;
    }
  } else if (ai.archetype === 'slipstream_defender') {
    for (const other of allVehicles) {
      if (other.id === ai.id) continue;
      const distDiff = other.totalRaceDistanceM - ai.totalRaceDistanceM;
      if (distDiff > 6 && distDiff < 42 && maxCurvature < 0.009) {
        desiredOffset = clamp(other.lateralOffset, -maxSafeOffset, maxSafeOffset);
      } else if (other.isPlayer && distDiff < 0 && distDiff > -20) {
        desiredOffset = clamp(
          (other.lateralOffset - curveSign * 1.6) * 0.75,
          -maxSafeOffset,
          maxSafeOffset
        );
      }
    }
  }

  // Overtaking & traffic avoidance
  for (const other of allVehicles) {
    if (other.id === ai.id) continue;
    const distAhead = other.totalRaceDistanceM - ai.totalRaceDistanceM;
    const latDiff = other.lateralOffset - ai.lateralOffset;

    if (distAhead > -2.5 && distAhead < 26 && Math.abs(latDiff) < 2.5) {
      const roomLeft = other.lateralOffset + maxSafeOffset;
      const roomRight = maxSafeOffset - other.lateralOffset;
      const passOffset =
        roomLeft > roomRight ? other.lateralOffset - 3.4 : other.lateralOffset + 3.4;
      desiredOffset = clamp(passOffset, -maxSafeOffset, maxSafeOffset);

      if (distAhead > 0 && distAhead < 7.5 && Math.abs(latDiff) < 1.7) {
        targetSpeedMs = Math.min(targetSpeedMs, other.speedMs * 0.96);
      }
    }
  }

  ai.aiTargetOffset += (desiredOffset - ai.aiTargetOffset) * Math.min(1, dt * 4.5);

  const aimSample = ai.speedMs > 42 ? midSample : nearSample;
  const aimX = aimSample.x + aimSample.rx * ai.aiTargetOffset;
  const aimZ = aimSample.z + aimSample.rz * ai.aiTargetOffset;

  const dx = aimX - ai.x;
  const dz = aimZ - ai.z;
  const desiredYaw = Math.atan2(dx, dz);
  const angleDiff = normalizeAngle(desiredYaw - ai.yaw);

  const steerThreshold = 0.024;
  const left = angleDiff > steerThreshold;
  const right = angleDiff < -steerThreshold;

  const needBrake = ai.speedMs > targetSpeedMs + 1.8;
  const forward = !needBrake || ai.speedMs < 16;
  const backward = needBrake && ai.speedMs > 18;
  const handbrake =
    ai.archetype === 'late_braker' &&
    maxCurvature > 0.025 &&
    Math.abs(angleDiff) > 0.35 &&
    ai.speedMs > 28;

  return {
    forward,
    backward,
    left,
    right,
    handbrake,
    pitRequest,
  };
}

/**
 * 3-Sphere Longitudinal Capsule (Front + Center + Rear) Car-to-Car Collision Resolution.
 * Matches exact 1.84m car width (`sphereRadius = 0.92m`) with smooth door-to-door rubbing
 * separation and dampened yaw impulse so side-by-side racing never snags or spins out unfairly.
 */
export function resolveMultiVehicleInteractions(
  vehicles: VehiclePhysicsState[],
  _damageMode: DamageMode = 'off'
): {
  playerImpactSpeedMs: number;
  collisionContacts: Array<{ x: number; y: number; z: number; impactSpeedMs: number }>;
} {
  let playerImpactSpeedMs = 0;
  const collisionContacts: Array<{ x: number; y: number; z: number; impactSpeedMs: number }> = [];
  const sphereRadius = 0.92;
  const minDist = sphereRadius * 2; // 1.84m exact car body width
  const sphereOffsets = [-1.18, 0.0, 1.18];

  for (const v of vehicles) {
    v.isDrafting = false;
  }

  for (let i = 0; i < vehicles.length; i++) {
    const a = vehicles[i];
    if (a.tires?.pitStopActive) continue;
    const afx = Math.sin(a.yaw);
    const afz = Math.cos(a.yaw);

    for (let j = 0; j < vehicles.length; j++) {
      if (i === j) continue;
      const b = vehicles[j];
      if (b.tires?.pitStopActive) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const centerDist = Math.hypot(dx, dz);

      if (centerDist > 4.6 && centerDist < 36 && a.speedMs > 24) {
        const forwardProj = (dx * afx + dz * afz) / centerDist;
        if (forwardProj > 0.93) {
          a.isDrafting = true;
        }
      }

      if (j > i && centerDist < 4.5) {
        const bfx = Math.sin(b.yaw);
        const bfz = Math.cos(b.yaw);

        let deepestOverlap = 0;
        let bestNx = 0;
        let bestNz = 0;
        let bestOffsetA = 0;
        let bestOffsetB = 0;
        let contactX = (a.x + b.x) * 0.5;
        let contactZ = (a.z + b.z) * 0.5;

        for (const offA of sphereOffsets) {
          const ax = a.x + afx * offA;
          const az = a.z + afz * offA;
          for (const offB of sphereOffsets) {
            const bx = b.x + bfx * offB;
            const bz = b.z + bfz * offB;
            const sdx = bx - ax;
            const sdz = bz - az;
            const sDist = Math.hypot(sdx, sdz);
            if (sDist < minDist && sDist > 0.0001) {
              const overlap = minDist - sDist;
              if (overlap > deepestOverlap) {
                deepestOverlap = overlap;
                bestNx = sdx / sDist;
                bestNz = sdz / sDist;
                bestOffsetA = offA;
                bestOffsetB = offB;
                contactX = (ax + bx) * 0.5;
                contactZ = (az + bz) * 0.5;
              }
            }
          }
        }

        if (deepestOverlap > 0) {
          // Separate cleanly with a 2cm margin so capsules never stay stuck across frames
          const sepDist = (deepestOverlap + 0.02) * 0.52;
          a.x -= bestNx * sepDist;
          a.z -= bestNz * sepDist;
          b.x += bestNx * sepDist;
          b.z += bestNz * sepDist;

          const rvx = b.vx - a.vx;
          const rvz = b.vz - a.vz;
          const relNormalVel = rvx * bestNx + rvz * bestNz;

          const tangX = -bestNz;
          const tangZ = bestNx;
          const relTangVel = rvx * tangX + rvz * tangZ;

          if (relNormalVel < 0.8) {
            const closingSpeed = Math.max(0, -relNormalVel);
            const restitution = 0.28;
            // Ensure a minimum gentle separation velocity (0.65 m/s) so side-by-side cars unstick cleanly
            const impulse = Math.max(0.65, (1 + restitution) * closingSpeed * 0.5);
            const frictionImpulse = clamp(relTangVel * 0.08, -impulse * 0.22, impulse * 0.22);

            a.vx -= bestNx * impulse - tangX * frictionImpulse;
            a.vz -= bestNz * impulse - tangZ * frictionImpulse;
            b.vx += bestNx * impulse - tangX * frictionImpulse;
            b.vz += bestNz * impulse - tangZ * frictionImpulse;

            a.speedMs = Math.hypot(a.vx, a.vz);
            b.speedMs = Math.hypot(b.vx, b.vz);

            const crossA = afx * bestNz - afz * bestNx;
            const crossB = bfx * bestNz - bfz * bestNx;
            a.angularVelocity = clamp(
              a.angularVelocity - crossA * bestOffsetA * impulse * 0.014,
              -1.4,
              1.4
            );
            b.angularVelocity = clamp(
              b.angularVelocity + crossB * bestOffsetB * impulse * 0.014,
              -1.4,
              1.4
            );

            const impactMag = closingSpeed + Math.abs(relTangVel) * 0.15;
            if (impactMag > 1.2) {
              a.hitFlashTimer = 0.06;
              b.hitFlashTimer = 0.06;
              collisionContacts.push({
                x: contactX,
                y: Math.max(a.y, b.y) + 0.42,
                z: contactZ,
                impactSpeedMs: impactMag,
              });
              if (a.isPlayer || b.isPlayer) {
                playerImpactSpeedMs = Math.max(playerImpactSpeedMs, impactMag);
              }
            }
          }
        }
      }
    }
  }

  return { playerImpactSpeedMs, collisionContacts };
}

export function getSortedStandings(vehicles: VehiclePhysicsState[]): VehiclePhysicsState[] {
  return [...vehicles].sort((a, b) => {
    if (a.finished && b.finished) {
      return a.finishTimeMs - b.finishTimeMs;
    }
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.totalRaceDistanceM - a.totalRaceDistanceM;
  });
}

export function calculateRaceRewardCredits(position: number, cleanLapBonus: boolean): number {
  const basePayouts = [2800, 1900, 1350, 900];
  const base = basePayouts[clamp(position - 1, 0, 3)] ?? 900;
  return base + (cleanLapBonus ? 400 : 0);
}
