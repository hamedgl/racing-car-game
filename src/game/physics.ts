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
  PitStopPhase,
  PitStopAnimationState,
  HandlingMode,
  BreakablePropState,
  BreakablePropType,
} from './types';
import { findClosestTrackSample } from './tracks';

export const PIT_STOP_DURATION_SEC = 2.4;

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Computes the normalized high-frequency mechanical redline tremor intensity (0..1)
 * when a high-revving historic engine enters the 6950..8500 RPM redline band before an upshift.
 */
export function computeRedlineTremor(rpm: number, gear = 1): number {
  const redlineThreshold = 6950;
  if (rpm <= redlineThreshold || gear < 1) return 0;
  const raw = clamp((rpm - redlineThreshold) / (8350 - redlineThreshold), 0, 1);
  // Nonlinear ramp with extra mechanical intensity in lower/mid gears and near rev-limiter bounce
  const limiterPulse = rpm >= 7750 ? 0.14 * Math.abs(Math.sin(rpm * 0.085)) : 0;
  return Number(clamp(raw * (0.45 + 0.55 * raw) + limiterPulse, 0, 1).toFixed(4));
}

/**
 * Awards gamified Driver Mastery style points, increments the active combo multiplier (up to 5x),
 * and sets the live HUD action callout banner.
 */
export function awardDriverMasteryAction(
  vehicle: VehiclePhysicsState,
  label: string,
  basePoints: number
): number {
  if (!vehicle.isPlayer) return 0;
  const activeCombo = clamp((vehicle.comboTimer > 0 ? vehicle.styleCombo : 0) + 1, 1, 5);
  const totalPts = Math.round(basePoints * (1 + (activeCombo - 1) * 0.25));
  vehicle.styleCombo = activeCombo;
  vehicle.comboTimer = 5.5;
  vehicle.styleScore = (vehicle.styleScore ?? 0) + totalPts;
  vehicle.lastActionBanner = label;
  vehicle.lastActionPoints = totalPts;
  vehicle.lastActionTimer = 2.1;
  return totalPts;
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
    pitCooldownTimer: 0,
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
 * Evaluates the deterministic 5-phase 3D Pit Stop Tire-Change Animation kinematics
 * from the current pitStopActive state and countdown timer.
 */
export function evaluatePitStopAnimation(
  pitStopActive: boolean,
  pitStopTimer: number,
  totalDuration = PIT_STOP_DURATION_SEC
): PitStopAnimationState {
  if (!pitStopActive || totalDuration <= 0) {
    return {
      active: false,
      phase: 'idle',
      phaseLabel: 'STANDBY',
      progress: 0,
      phaseProgress: 0,
      chassisLiftY: 0,
      chassisPitchOffsetRad: 0,
      wheelLateralOffsetM: 0,
      wheelTiltRad: 0,
      wrenchSpinRad: 0,
      wrenchActive: false,
      showFreshCompound: false,
      mechanicReachRatio: 0,
      jackHandleAngleRad: 0.95,
      lollipopRaised: false,
    };
  }

  const elapsed = clamp(totalDuration - pitStopTimer, 0, totalDuration);
  const progress = Number(clamp(elapsed / totalDuration, 0, 1).toFixed(4));
  const smoothstep = (t: number) => {
    const c = clamp(t, 0, 1);
    return c * c * (3 - 2 * c);
  };

  let phase: PitStopPhase = 'jacking_up';
  let phaseLabel = 'CREW DEPLOYING · JACKING CHASSIS';
  let phaseProgress = 0;
  let chassisLiftY = 0;
  let chassisPitchOffsetRad = 0;
  let wheelLateralOffsetM = 0;
  let wheelTiltRad = 0;
  let wrenchActive = false;
  let showFreshCompound = false;
  let mechanicReachRatio = 0;
  let jackHandleAngleRad = 0.95;
  let lollipopRaised = false;

  if (progress < 0.18) {
    // Phase 1: Crew rushes in & quick-lift jacks raise the car chassis
    phase = 'jacking_up';
    phaseLabel = 'PHASE 1/5 · JACKING CHASSIS';
    phaseProgress = clamp(progress / 0.18, 0, 1);
    const s = smoothstep(phaseProgress);
    mechanicReachRatio = s;
    chassisLiftY = Number((s * 0.13).toFixed(4));
    chassisPitchOffsetRad = Number((Math.sin(phaseProgress * Math.PI) * 0.022).toFixed(4));
    jackHandleAngleRad = Number(((1 - s) * 0.95).toFixed(4));
  } else if (progress < 0.46) {
    // Phase 2: Pneumatic guns unfasten Borrani knock-off spinners & mechanics pull old worn tires off hubs
    phase = 'wheels_off';
    phaseLabel = 'PHASE 2/5 · REMOVING WORN TIRES';
    phaseProgress = clamp((progress - 0.18) / 0.28, 0, 1);
    mechanicReachRatio = 1.0;
    chassisLiftY = 0.13;
    jackHandleAngleRad = 0;

    if (phaseProgress < 0.45) {
      const gunU = phaseProgress / 0.45;
      wrenchActive = true;
      wheelLateralOffsetM = Number((gunU * 0.04).toFixed(4));
      chassisLiftY = Number((0.13 + Math.sin(gunU * Math.PI * 6) * 0.003).toFixed(4));
    } else {
      const pullS = smoothstep((phaseProgress - 0.45) / 0.55);
      wrenchActive = false;
      wheelLateralOffsetM = Number((0.04 + pullS * 0.34).toFixed(4));
      wheelTiltRad = Number((pullS * 0.18).toFixed(4));
    }
  } else if (progress < 0.66) {
    // Phase 3: Mechanics lift fresh compound tires and slide them onto the 4 hubs
    phase = 'wheels_on';
    phaseLabel = 'PHASE 3/5 · MOUNTING FRESH TIRES';
    phaseProgress = clamp((progress - 0.46) / 0.20, 0, 1);
    const pushS = smoothstep(phaseProgress);
    mechanicReachRatio = 1.0;
    chassisLiftY = 0.13;
    jackHandleAngleRad = 0;
    showFreshCompound = progress >= 0.50;
    wheelLateralOffsetM = Number((0.38 * (1 - pushS)).toFixed(4));
    wheelTiltRad = Number((0.18 * (1 - pushS)).toFixed(4));
  } else if (progress < 0.85) {
    // Phase 4: Pneumatic impact guns torque-lock the 3-ear knock-off spinners with hub sparks
    phase = 'torque_lock';
    phaseLabel = 'PHASE 4/5 · TORQUING WHEEL HUBS';
    phaseProgress = clamp((progress - 0.66) / 0.19, 0, 1);
    mechanicReachRatio = 1.0;
    chassisLiftY = Number((0.13 + Math.sin(phaseProgress * Math.PI * 6) * 0.003).toFixed(4));
    jackHandleAngleRad = 0;
    wheelLateralOffsetM = 0;
    wheelTiltRad = 0;
    wrenchActive = true;
    showFreshCompound = true;
  } else {
    // Phase 5: Quick-lift jacks drop the car onto its suspension, lollipop raises, engine revs to launch
    phase = 'dropping_go';
    phaseLabel = 'PHASE 5/5 · JACKS DOWN — GO! GO!';
    phaseProgress = clamp((progress - 0.85) / 0.15, 0, 1);
    const dropS = smoothstep(phaseProgress);
    chassisLiftY = Number(Math.max(0, 0.13 * (1 - dropS * 1.15)).toFixed(4));
    chassisPitchOffsetRad = Number((-Math.sin(phaseProgress * Math.PI) * 0.016).toFixed(4));
    mechanicReachRatio = Number((1.0 - dropS * 0.85).toFixed(4));
    jackHandleAngleRad = Number((dropS * 0.95).toFixed(4));
    wheelLateralOffsetM = 0;
    wheelTiltRad = 0;
    wrenchActive = false;
    showFreshCompound = true;
    lollipopRaised = true;
  }

  return {
    active: true,
    phase,
    phaseLabel,
    progress,
    phaseProgress: Number(phaseProgress.toFixed(4)),
    chassisLiftY,
    chassisPitchOffsetRad,
    wheelLateralOffsetM,
    wheelTiltRad,
    wrenchSpinRad: Number((elapsed * 42).toFixed(3)),
    wrenchActive,
    showFreshCompound,
    mechanicReachRatio,
    jackHandleAngleRad,
    lollipopRaised,
  };
}

/**
 * Handles Pit Lane Service Box detection and 2.4-second 3D 4-tire swap service in the Pit Lane.
 */
export function stepPitStopService(
  vehicle: VehiclePhysicsState,
  track: TrackSpec,
  dt: number,
  inputPitRequest = false
): { pitStopCompleted: boolean } {
  const tires = vehicle.tires;
  if (!tires) return { pitStopCompleted: false };

  if (tires.pitCooldownTimer && tires.pitCooldownTimer > 0) {
    tires.pitCooldownTimer = Math.max(0, tires.pitCooldownTimer - dt);
  }

  if (inputPitRequest && (tires.pitCooldownTimer ?? 0) <= 0) {
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
    vehicle.throttle = tires.pitStopTimer < 0.38 ? 0.65 : 0;
    vehicle.brake = tires.pitStopTimer < 0.15 ? 0 : 1;
    // Blip engine revs as jacks drop for pit-lane launch
    vehicle.rpm =
      tires.pitStopTimer < 0.38
        ? 4600 + Math.sin(tires.pitStopTimer * 35) * 650
        : 1850 + Math.sin(tires.pitStopTimer * 18) * 350;

    if (tires.pitStopTimer <= 0) {
      tires.pitStopActive = false;
      tires.pitRequest = false;
      tires.pitCooldownTimer = 4.0;
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

  if ((tires.pitCooldownTimer ?? 0) > 0 || vehicle.finished) {
    return { pitStopCompleted: false };
  }

  // Trigger Pit Stop entry when:
  // 1) Driver explicitly triggered a pit stop (vehicle.isPlayer && tires.pitRequest), OR
  // 2) AI car with armed pitRequest reaches the Start/Finish straight, OR
  // 3) Driver pulled into the right-side Pit Stall lane (lateralOffset > 1.75m) on the main straight and slowed below 22 m/s
  const pulledIntoRightPitStall =
    onMainStraight &&
    vehicle.lateralOffset > 1.75 &&
    vehicle.speedMs < 22 &&
    (tires.avgTreadLife < 0.88 || tires.minIntegrity < 0.88 || tires.compound !== tires.nextPitCompound);

  const shouldEnterPitBox =
    (vehicle.isPlayer && tires.pitRequest) ||
    (onMainStraight && (tires.pitRequest || pulledIntoRightPitStall));

  if (shouldEnterPitBox) {
    // If triggered mid-lap by the player, bring the car directly into the Start/Finish Pit Lane Service Box
    if (!onMainStraight) {
      const startLookup = findClosestTrackSample(track, 0, 0);
      const pitIdx = (startLookup.sample.index + 5) % track.samples.length;
      vehicle.trackSampleIndex = pitIdx;
      vehicle.lapProgress = track.samples[pitIdx].s;
    }
    const sample = track.samples[vehicle.trackSampleIndex];
    const pitStallOffset = sample.width * 0.34;
    vehicle.x = sample.x + sample.rx * pitStallOffset;
    vehicle.z = sample.z + sample.rz * pitStallOffset;
    const exactLookup = findClosestTrackSample(track, vehicle.x, vehicle.z, vehicle.trackSampleIndex);
    vehicle.y = exactLookup.surfaceY;
    vehicle.lateralOffset = pitStallOffset;
    vehicle.yaw = Math.atan2(sample.tx, sample.tz);
    vehicle.vx = 0;
    vehicle.vz = 0;
    vehicle.speedMs = 0;
    vehicle.lateralSpeedMs = 0;
    vehicle.angularVelocity = 0;
    tires.inPitZone = true;
    tires.pitStopActive = true;
    tires.pitStopTimer = PIT_STOP_DURATION_SEC; // 2.4s 5-phase 3D classic pit crew tire change sequence
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
    vy: 0,
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
    suspensionOffsetM: 0,
    verticalLoadG: 1.0,
    asphaltGripFactor: 1.0,
    onKerb: false,
    kerbVibration: 0,
    isDrifting: false,
    isOffTrack: false,
    isDrafting: false,
    hitFlashTimer: 0,
    brakeTelegraphTimer: 0,
    collisionTimer: 0,
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
    redlineTremor: 0,
    manualGearOverrideTimer: 0,
    shiftCooldownTimer: 0,
    styleScore: 0,
    styleCombo: 1,
    comboTimer: 0,
    lastActionBanner: '',
    lastActionPoints: 0,
    lastActionTimer: 0,
  };
}

/**
 * Advances a single vehicle's physics state by `dt` seconds (clamped <= 0.05s)
 * with dynamic 4-corner tire wear/temperature/integrity simulation, Pit Stop service,
 * weather grip attenuation, track rubbering on-line grip bonus vs. off-line marbles,
 * realistic 3D hill gravity, crest unloading / valley compression normal load G,
 * serrated kerb rumble mechanics, and intuitive Pro-Assisted handling easiness.
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
  tireWearMultiplier = 1.0,
  handlingMode: HandlingMode = 'pro_assisted'
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

  const isAssisted = vehicle.isPlayer && handlingMode === 'pro_assisted';

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
  if ((vehicle.collisionTimer ?? 0) > 0) {
    vehicle.collisionTimer = Math.max(0, (vehicle.collisionTimer ?? 0) - dt);
  }
  const collisionShockRatio = clamp((vehicle.collisionTimer ?? 0) / 0.35, 0, 1);

  // Step Pit Stop Service Box Check (if currently in Pit Stop, vehicle is serviced by pit crew)
  const pitResult = stepPitStopService(vehicle, track, dt, Boolean(input.pitRequest));
  if (vehicle.tires.pitStopActive) {
    const pitLookup = findClosestTrackSample(track, vehicle.x, vehicle.z, vehicle.trackSampleIndex);
    vehicle.y = pitLookup.surfaceY;
    vehicle.vy = 0;
    vehicle.suspensionOffsetM = 0;
    vehicle.verticalLoadG = 1.0;
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
  vehicle.throttle += (targetThrottle - vehicle.throttle) * Math.min(1, dt * 18);
  vehicle.brake += (targetBrake - vehicle.brake) * Math.min(1, dt * 20);
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

  // Track surface lookup prior to steering so we know upcoming apex curvature and asphalt state
  const prevLookup = findClosestTrackSample(track, vehicle.x, vehicle.z, vehicle.trackSampleIndex);
  const roadHalfWidth = prevLookup.sample.width * 0.5;
  const absOffset = Math.abs(prevLookup.lateralOffset);
  vehicle.isOffTrack = absOffset > roadHalfWidth + 1.35;
  vehicle.onKerb = !vehicle.isOffTrack && absOffset >= roadHalfWidth - 0.55 && absOffset <= roadHalfWidth + 1.35;

  // Serrated apex kerb harmonic vibration
  if (vehicle.onKerb && vehicle.speedMs > 3) {
    vehicle.kerbVibration = Math.sin(vehicle.totalRaceDistanceM * 4.2) * clamp(vehicle.speedMs / 32, 0.25, 1.0);
  } else {
    vehicle.kerbVibration = 0;
  }

  // Steering input with progressive speed-sensitive authority, caster self-centering & apex turn-in easiness
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
  const frontTurnInFactor = 0.86 + 0.14 * frontTireHealth;

  const maxSteerRad =
    0.47 *
    (1 - speedRatio * (isAssisted ? 0.40 : 0.36)) *
    (stats.turnInRate / 1.08) *
    aquaSteerPenalty *
    frontTurnInFactor;

  // Intuitive Caster Counter-Steer & Slip-Angle Catch Assist (opposes excessive slip angle to prevent spinouts)
  const assistGain = isAssisted ? 0.52 : 0.30;
  const maxAssistRad = isAssisted ? 0.26 : 0.16;
  const driftAssistSteer =
    vehicle.isPlayer && Math.abs(vehicle.slipAngleRad) > 0.045 && !vehicle.handbrake
      ? clamp(vehicle.slipAngleRad * assistGain, -maxAssistRad, maxAssistRad)
      : 0;

  // Subtle Track-Tangent Alignment & Apex Guidance when cruising on-track in Assisted mode
  let tangentGuideSteer = 0;
  if (isAssisted && !vehicle.isOffTrack && vehicle.speedMs > 7) {
    const trackYaw = Math.atan2(prevLookup.tx, prevLookup.tz);
    const headingErr = normalizeAngle(trackYaw - vehicle.yaw);
    if (Math.abs(rawSteer) < 0.05 && Math.abs(headingErr) < 0.40) {
      // Gently self-align down straights and gentle sweepers when no steering key is pressed
      tangentGuideSteer = clamp(headingErr * 0.38, -0.095, 0.095);
    } else if (Math.abs(rawSteer) > 0.1 && Math.sign(rawSteer) === Math.sign(prevLookup.sample.curvature)) {
      // Smooth apex turn-in help when steering into a corner
      tangentGuideSteer = clamp(prevLookup.sample.curvature * 3.1, -0.068, 0.068);
    }
    tangentGuideSteer *= 1 - collisionShockRatio;
  }

  const targetSteer = clamp(
    rawSteer * maxSteerRad + driftAssistSteer + tangentGuideSteer,
    -0.54,
    0.54
  );
  // Progressive steering filter: crisp, non-twitchy initial turn-in and rapid self-centering release
  const steerLerpRate = Math.abs(rawSteer) < 0.05 ? 28 : isAssisted ? 18.0 : 16.0;
  vehicle.steerAngle += (targetSteer - vehicle.steerAngle) * Math.min(1, dt * steerLerpRate);

  const fx = Math.sin(vehicle.yaw);
  const fz = Math.cos(vehicle.yaw);
  const rx = fz;
  const rz = -fx;

  let forwardVel = vehicle.vx * fx + vehicle.vz * fz;
  let lateralVel = vehicle.vx * rx + vehicle.vz * rz;

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

  // 3D Vertical Gravity & Road Crest/Compression Normal Load Factor
  // Over blind crests (verticalCurvature < 0), centrifugal vertical acceleration unloads the suspension (< 1.0G);
  // In valley compressions (verticalCurvature > 0) and banked bowls, gravity + normal force press tires into the tarmac (> 1.0G).
  const vCurv = prevLookup.sample.verticalCurvature ?? 0;
  const slopeCos = Math.sqrt(Math.max(0.7, 1 - prevLookup.sample.ty * prevLookup.sample.ty));
  const verticalCentrifugalG = (forwardVel * forwardVel * vCurv) / 9.81;
  const bankingNormalBonus = Math.abs(Math.sin(prevLookup.sample.bankingRad)) * speedRatio * 0.16;
  const aeroNormalLoadG = speedRatio * speedRatio * stats.downforceFactor * 0.42;

  const rawVerticalLoadG = clamp(
    slopeCos + verticalCentrifugalG * 4.5 + bankingNormalBonus + aeroNormalLoadG,
    0.45,
    1.85
  );
  vehicle.verticalLoadG = Number(
    ((vehicle.verticalLoadG ?? 1.0) + (rawVerticalLoadG - (vehicle.verticalLoadG ?? 1.0)) * Math.min(1, dt * 14)).toFixed(3)
  );

  // Tire load sensitivity: normal force increases asphalt bite (with realistic diminishing returns at very high load)
  const gravityNormalGripMod = clamp(
    0.84 + (vehicle.verticalLoadG - 0.75) * 0.24,
    0.76,
    1.22
  );

  // Asphalt micro-macro texture & camber bite: crowned road camber helps when turning toward the crown
  const crownSlopeSign = -Math.sign(prevLookup.lateralOffset || 0.01);
  const camberGripBonus =
    Math.abs(vehicle.steerAngle) > 0.02 && Math.sign(vehicle.steerAngle) === crownSlopeSign
      ? 1.035
      : 1.0;

  // Serrated Kerb grip modifier (dry concrete kerbs have 95% grip; wet painted kerbs are slicker at 82%)
  const kerbGripMod = vehicle.onKerb ? (wetness > 0.3 ? 0.84 : 0.96) : 1.0;

  // Effective weather grip: Wet compound tires negate most of the rain grip loss!
  const effectiveWeatherGrip = isWetTire
    ? Math.max(weatherGripMult, 1.0 - wetness * 0.12)
    : weatherGripMult;

  // Combined Asphalt Mechanics + Gravity Normal Load + Tire Compound/Wear/Temp + Track Rubbering + Handling Assist Bonus
  const assistGripBonus = isAssisted ? 1.15 : 1.0;
  const surfaceGrip =
    track.surfaceGrip *
    effectiveWeatherGrip *
    tireGripMult *
    rubberEffect.lineGripModifier *
    gravityNormalGripMod *
    camberGripBonus *
    kerbGripMod *
    assistGripBonus *
    (vehicle.isOffTrack ? (isAssisted ? 0.82 : 0.76) : 1.0);

  vehicle.asphaltGripFactor = Number(surfaceGrip.toFixed(3));

  // Decay manual gear override & gamified style combo timers
  if ((vehicle.manualGearOverrideTimer ?? 0) > 0) {
    vehicle.manualGearOverrideTimer = Math.max(0, (vehicle.manualGearOverrideTimer ?? 0) - dt);
  }
  if ((vehicle.shiftCooldownTimer ?? 0) > 0) {
    vehicle.shiftCooldownTimer = Math.max(0, (vehicle.shiftCooldownTimer ?? 0) - dt);
  }
  if ((vehicle.lastActionTimer ?? 0) > 0) {
    vehicle.lastActionTimer = Math.max(0, (vehicle.lastActionTimer ?? 0) - dt);
  }
  if ((vehicle.comboTimer ?? 0) > 0) {
    vehicle.comboTimer = Math.max(0, (vehicle.comboTimer ?? 0) - dt);
    if (vehicle.comboTimer <= 0) {
      vehicle.styleCombo = 1;
    }
  }

  // 5-speed classic gearbox with Manual Redline Upshift/Downshift + Automatic Transmission
  const gearMaxSpeeds = [
    stats.maxSpeedMs * 0.25,
    stats.maxSpeedMs * 0.43,
    stats.maxSpeedMs * 0.63,
    stats.maxSpeedMs * 0.82,
    stats.maxSpeedMs * 1.02,
  ];
  const absSpeed = Math.abs(forwardVel);
  let manualShiftTriggered = false;

  if (
    vehicle.isPlayer &&
    (vehicle.shiftCooldownTimer ?? 0) <= 0 &&
    (input.shiftUp || input.shiftDown)
  ) {
    if (input.shiftUp && vehicle.gear < 5) {
      const wasInRedlineZone = vehicle.rpm >= 7000 && vehicle.rpm <= 8450;
      vehicle.gear += 1;
      gearChanged = true;
      manualShiftTriggered = true;
      vehicle.manualGearOverrideTimer = 4.5;
      vehicle.shiftCooldownTimer = 0.24;
      vehicle.rpm = Math.max(4100, vehicle.rpm - 2050);

      if (wasInRedlineZone) {
        // Perfect Redline Upshift! Award speed surge, nitro boost & gamified style points
        forwardVel = Math.min(stats.maxSpeedMs * 1.06, forwardVel + 2.35);
        vehicle.nitroCharge = Math.min(100, (vehicle.nitroCharge ?? 0) + 12);
        awardDriverMasteryAction(vehicle, 'PERFECT REDLINE SHIFT', 250);
      }
    } else if (input.shiftDown && vehicle.gear > 1) {
      vehicle.gear -= 1;
      gearChanged = true;
      manualShiftTriggered = true;
      vehicle.manualGearOverrideTimer = 4.5;
      vehicle.shiftCooldownTimer = 0.24;
      // Heel-and-toe downshift rev blip
      vehicle.rpm = clamp(vehicle.rpm + 1650, 2800, 8250);
    }
  }

  if (!manualShiftTriggered) {
    // If manual override is active, only auto-downshift on stall or auto-upshift at extreme rev limiter
    const isManualHold = (vehicle.manualGearOverrideTimer ?? 0) > 0;
    // Hold gears slightly deeper into the 7100..7950 RPM redline band under throttle so the driver
    // feels the authentic redline tremor and has a window to trigger a Manual Perfect Upshift [E]
    const upshiftRatio = isManualHold ? 0.995 : vehicle.isPlayer ? 0.935 : 0.88;
    let newGear = 1;
    for (let g = 0; g < 5; g++) {
      if (absSpeed > gearMaxSpeeds[g] * upshiftRatio && g < 4) {
        newGear = g + 2;
      }
    }
    if (isManualHold) {
      const minSafeFloor = vehicle.gear > 1 ? gearMaxSpeeds[vehicle.gear - 2] * 0.52 : 0;
      if (absSpeed < minSafeFloor && vehicle.gear > 1) {
        vehicle.gear -= 1;
        gearChanged = true;
      } else if (absSpeed > gearMaxSpeeds[vehicle.gear - 1] * 1.01 && vehicle.gear < 5) {
        vehicle.gear += 1;
        gearChanged = true;
      }
    } else if (newGear !== vehicle.gear) {
      gearChanged = true;
      vehicle.gear = newGear;
    }
  }

  const gearFloor = vehicle.gear === 1 ? 0 : gearMaxSpeeds[vehicle.gear - 2] * 0.66;
  const gearCeil = gearMaxSpeeds[vehicle.gear - 1];
  const gearProgress = clamp((absSpeed - gearFloor) / Math.max(1, gearCeil - gearFloor), 0, 1.06);
  const targetRpm = clamp(
    1450 + gearProgress * 6550 + vehicle.throttle * 420 + (vehicle.isBoosting ? 420 : 0),
    1150,
    8450
  );
  vehicle.rpm += (targetRpm - vehicle.rpm) * Math.min(1, dt * 16);
  vehicle.redlineTremor = computeRedlineTremor(vehicle.rpm, vehicle.gear);

  const rpmNorm = (vehicle.rpm - 1200) / 7000;
  const torqueCurve = 0.85 + Math.sin(clamp(rpmNorm, 0.05, 0.98) * Math.PI) * 0.35;
  const gearMultipliers = [1.62, 1.30, 1.08, 0.94, 0.84];
  const gearMult = gearMultipliers[vehicle.gear - 1] ?? 1.0;

  let driveForce = 0;
  if (forwardVel >= -0.5 && vehicle.throttle > 0.01) {
    const draftBoost = vehicle.isDrafting ? 1.14 : 1.0;
    const nitroBoostMult = vehicle.isBoosting ? 1.44 : 1.0;
    const lineTractionMod = vehicle.onRacingLine
      ? Math.max(1.0, rubberEffect.lineGripModifier)
      : vehicle.onMarbles
      ? 0.94
      : 1.0;
    // Worn rear tires lose longitudinal launch/exit traction, modulated by gravity normal load
    const rearTireTraction = clamp(
      (0.70 + 0.32 * tireGripMult) * clamp(vehicle.verticalLoadG, 0.78, 1.18),
      0.64,
      1.16
    );
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
    // Anti-Lock Braking Modulation (ABS-like stability under heavy braking while turning in Pro-Assisted mode)
    const steerLoad = Math.abs(vehicle.steerAngle) / 0.45;
    const absEfficiency = isAssisted ? 1.0 - steerLoad * 0.05 : 1.0 - steerLoad * 0.14;
    const brakingTireEfficiency =
      (0.80 + 0.24 * effectiveWeatherGrip) *
      rubberEffect.lineGripModifier *
      clamp(0.76 + 0.28 * tireGripMult, 0.70, 1.14) *
      clamp(vehicle.verticalLoadG, 0.75, 1.2) *
      absEfficiency;
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
  const tireIntegrityDrag = (1.0 - vehicle.tires.minIntegrity) * 260;
  // Forgiving off-track rolling resistance so dipping 2 wheels onto the grass verge never bogs the car down harshly
  const offTrackPenalty = vehicle.isOffTrack ? (isAssisted ? 620 : 1050) : 0;
  const rollingRes =
    (offTrackPenalty > 0
      ? offTrackPenalty
      : (vehicle.onMarbles ? 310 : vehicle.onKerb ? 245 : 215) + wetness * 165 + tireIntegrityDrag) *
    forwardVel;

  // Authentic 3D Hill Gravity Force: uphill climbs pull against momentum, downhill descents accelerate with true gravitational weight
  const headingDotSlope = fx * prevLookup.tx + fz * prevLookup.tz;
  const effectiveSlopeSin = prevLookup.sample.ty * headingDotSlope;
  const slopeGravity = -stats.weightKg * 9.81 * effectiveSlopeSin * 0.68;

  const netLongitudinalForce = driveForce - aeroDrag - rollingRes + slopeGravity;
  const longAccel = netLongitudinalForce / stats.weightKg;

  forwardVel += longAccel * dt;
  const maxAllowedSpeed =
    stats.maxSpeedMs *
    (vehicle.isDrafting ? 1.05 : 1.0) *
    (vehicle.isBoosting ? 1.12 : 1.0);
  forwardVel = clamp(forwardVel, -15, maxAllowedSpeed);

  // Cornering Yaw Rate, Traction Control & Tire Wear Oversteer Balance
  const minSteerSpeed = Math.min(1.0, Math.abs(forwardVel) / 2.4);
  const directionSign = forwardVel >= -0.2 ? 1 : -1;
  const handbrakeOversteer = vehicle.handbrake ? 1.75 : 1.0;
  const trailBrakeRotation =
    vehicle.brake > 0.12 && Math.abs(vehicle.steerAngle) > 0.03
      ? 1.0 + Math.min(0.20, vehicle.brake * 0.22)
      : 1.0;

  // Worn rear tires induce progressive power oversteer (attenuated by Traction Control in pro_assisted mode)
  const rearWearOversteer =
    Math.max(0, 0.85 - (vehicle.tires.rl.treadLife + vehicle.tires.rr.treadLife) * 0.5) *
    (isAssisted ? 0.22 : 0.42);
  const wetOversteerMod =
    1.0 +
    (1.0 - effectiveWeatherGrip) * (isAssisted ? 0.26 : 0.48) +
    (vehicle.onMarbles ? 0.16 : 0) +
    rearWearOversteer;
  const throttleOversteer =
    1 +
    vehicle.throttle *
      (stats.oversteerBias - 1.0) *
      (isAssisted ? 0.24 : 0.40) *
      wetOversteerMod;

  const targetAngularVel =
    vehicle.steerAngle *
    stats.turnInRate *
    minSteerSpeed *
    directionSign *
    handbrakeOversteer *
    trailBrakeRotation *
    throttleOversteer *
    (0.76 + 0.24 * surfaceGrip);

  if (vehicle.handbrake && Math.abs(forwardVel) > 7 && Math.abs(vehicle.steerAngle) > 0.04) {
    vehicle.angularVelocity += Math.sign(vehicle.steerAngle) * 3.2 * dt;
  }

  const isCounterSteering =
    vehicle.slipAngleRad * vehicle.steerAngle < -0.01 && Math.abs(vehicle.slipAngleRad) > 0.07;
  // Strong yaw stability damping during normal driving; relaxed briefly during collision shock so physical impacts rotate the chassis naturally
  const baseYawDamping = isCounterSteering ? 32 : Math.abs(rawSteer) < 0.05 ? 24 : isAssisted ? 19 : 15;
  const yawDamping = baseYawDamping * (1 - collisionShockRatio * 0.72);
  vehicle.angularVelocity +=
    (targetAngularVel - vehicle.angularVelocity) * Math.min(1, dt * yawDamping);
  vehicle.yaw = normalizeAngle(vehicle.yaw + vehicle.angularVelocity * dt);

  // Lateral slip & Pacejka-inspired tire cornering stiffness
  const centrifugalLateral =
    -vehicle.angularVelocity *
    forwardVel *
    (isAssisted ? 0.20 : 0.25) *
    stats.oversteerBias *
    (vehicle.handbrake ? 2.05 : 1.0);
  lateralVel += centrifugalLateral * dt * 3.6;

  const absSlip = Math.abs(vehicle.slipAngleRad);
  const pacejkaGripFactor =
    absSlip < 0.18
      ? 1.10
      : Math.max(isAssisted ? 0.85 : 0.75, 1.10 - (absSlip - 0.18) * (isAssisted ? 0.44 : 0.65));
  const handbrakeLateralGrip = vehicle.handbrake ? 0.26 : pacejkaGripFactor;
  const lateralGripDamping =
    stats.cornerStiffness * surfaceGrip * handbrakeLateralGrip * (1 - collisionShockRatio * 0.58);
  lateralVel *= Math.exp(-lateralGripDamping * dt);

  // Lateral gravity component on banked corners & crowned asphalt pulls car toward the inside of banked turns
  if (Math.abs(prevLookup.sample.bankingRad) > 0.008 && Math.abs(forwardVel) > 4) {
    lateralVel -= Math.sin(prevLookup.sample.bankingRad) * 9.81 * 0.62 * dt;
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

  // Query exact interpolated track surface & Realistic 4-Corner Oriented Bounding Box (OBB) Armco Guardrail Collision
  const currLookup = findClosestTrackSample(track, vehicle.x, vehicle.z, prevLookup.sample.index);
  const sample = currLookup.sample;

  const halfLen = 2.06;
  const halfWid = 0.90;
  const cornerBarrierLimit = sample.width * 0.5 + 1.82;
  const centerBarrierLimit = sample.width * 0.5 + 1.15;

  let maxPenetration = 0;
  let penSign = 0;
  let hitCornerLon = 0;
  let hitCornerLat = 0;

  const cornerOffsets: ReadonlyArray<readonly [number, number]> = [
    [halfLen, -halfWid],
    [halfLen, halfWid],
    [-halfLen, -halfWid],
    [-halfLen, halfWid],
  ];

  for (let c = 0; c < 4; c++) {
    const cLon = cornerOffsets[c][0];
    const cLat = cornerOffsets[c][1];
    const worldDx = newFx * cLon + newRx * cLat;
    const worldDz = newFz * cLon + newRz * cLat;
    const cornerLateral =
      currLookup.lateralOffset + worldDx * currLookup.rx + worldDz * currLookup.rz;
    const pen = Math.abs(cornerLateral) - cornerBarrierLimit;
    if (pen > maxPenetration) {
      maxPenetration = pen;
      penSign = Math.sign(cornerLateral);
      hitCornerLon = cLon;
      hitCornerLat = cLat;
    }
  }

  const centerPen = Math.abs(currLookup.lateralOffset) - centerBarrierLimit;
  if (centerPen > maxPenetration) {
    maxPenetration = centerPen;
    penSign = Math.sign(currLookup.lateralOffset);
    hitCornerLon = 0;
    hitCornerLat = penSign * halfWid;
  }

  if (maxPenetration > 0 && penSign !== 0) {
    // Push vehicle inward along barrier normal with 3cm clearance so it never snags on the next step
    const pushInward = maxPenetration + 0.03;
    const newLateralOffset = currLookup.lateralOffset - penSign * pushInward;
    currLookup.lateralOffset = newLateralOffset;
    vehicle.x = currLookup.interpX + currLookup.rx * newLateralOffset;
    vehicle.z = currLookup.interpZ + currLookup.rz * newLateralOffset;

    const contactWorldDx = newFx * hitCornerLon + newRx * hitCornerLat;
    const contactWorldDz = newFz * hitCornerLon + newRz * hitCornerLat;
    wallContactX = vehicle.x + contactWorldDx;
    wallContactZ = vehicle.z + contactWorldDz;

    // Velocity of the impacting corner (including rotational velocity v + omega x r)
    const cornerVx = vehicle.vx + vehicle.angularVelocity * contactWorldDz;
    const cornerVz = vehicle.vz - vehicle.angularVelocity * contactWorldDx;

    const vTang = vehicle.vx * currLookup.tx + vehicle.vz * currLookup.tz;
    const vNormCenter = vehicle.vx * currLookup.rx + vehicle.vz * currLookup.rz;
    const vNormCorner = cornerVx * currLookup.rx + cornerVz * currLookup.rz;
    const effectiveOutwardVel = Math.max(vNormCenter * penSign, vNormCorner * penSign);

    if (effectiveOutwardVel > -0.15) {
      wallImpactSpeedMs = Math.max(0, effectiveOutwardVel);
      wallScrapeSpeedMs = Math.abs(vTang);

      const totalSpeed = Math.max(1.0, vehicle.speedMs);
      const sinImpactAngle = clamp(wallImpactSpeedMs / totalSpeed, 0, 1);

      // Authentic metallic Armco barrier restitution (higher rebound on steeper impacts)
      const restitution = 0.28 + sinImpactAngle * 0.12;
      const reboundSpeed = Math.max(0.85, wallImpactSpeedMs * restitution);
      const bouncedNorm = -penSign * reboundSpeed;

      // Coulomb wall friction & structural crumple energy dissipation:
      // Shallow grazing scrapes lose modest speed; steep/head-on hits scrub significant speed
      const normalDeltaV = wallImpactSpeedMs + reboundSpeed;
      const wallMu = 0.42;
      const coulombSpeedDrop = normalDeltaV * wallMu * (0.45 + 0.55 * sinImpactAngle);
      const angleEnergyLoss = Math.abs(vTang) * (0.04 + sinImpactAngle * sinImpactAngle * 0.46);
      const totalTangDrop = coulombSpeedDrop + angleEnergyLoss;
      const newTangSpeed = Math.max(0, Math.abs(vTang) - totalTangDrop);
      const retainedTang = Math.sign(vTang) * newTangSpeed;

      vehicle.vx = currLookup.tx * retainedTang + currLookup.rx * bouncedNorm;
      vehicle.vz = currLookup.tz * retainedTang + currLookup.rz * bouncedNorm;
      vehicle.speedMs = Math.hypot(vehicle.vx, vehicle.vz);
      vehicle.hitFlashTimer = 0.09;
      vehicle.collisionTimer = Math.max(
        vehicle.collisionTimer ?? 0,
        clamp(0.14 + wallImpactSpeedMs * 0.018, 0.14, 0.40)
      );

      // Corner lever-arm yaw torque: hitting nose-first kicks the nose back inward away from the wall;
      // hitting tail-first kicks the tail inward
      const normalX = -penSign * currLookup.rx;
      const normalZ = -penSign * currLookup.rz;
      const leverTorque = contactWorldDz * normalX - contactWorldDx * normalZ;
      const yawImpulse = clamp(
        leverTorque * normalDeltaV * 0.058,
        -2.6,
        2.6
      );
      vehicle.angularVelocity = clamp(
        vehicle.angularVelocity * (1 - sinImpactAngle * 0.45) + yawImpulse,
        -3.2,
        3.2
      );

      // Partial heading deflection from barrier contact without robotic instant snapping
      const trackYaw = Math.atan2(currLookup.tx, currLookup.tz);
      const yawDiff = normalizeAngle(trackYaw - vehicle.yaw);
      vehicle.yaw = normalizeAngle(
        vehicle.yaw + yawDiff * clamp(0.16 + sinImpactAngle * 0.24, 0.16, 0.40)
      );

      // Physical suspension jolt & body roll/pitch impulse from barrier impact
      const impactJolt = clamp(wallImpactSpeedMs / 22, 0.08, 1.0);
      vehicle.rollRad = clamp(vehicle.rollRad - penSign * impactJolt * 0.055, -0.14, 0.14);
      vehicle.pitchRad = clamp(
        vehicle.pitchRad - Math.sign(hitCornerLon || 1) * impactJolt * 0.032,
        -0.09,
        0.09
      );
      vehicle.suspensionOffsetM = clamp(
        (vehicle.suspensionOffsetM ?? 0) - impactJolt * 0.024,
        -0.06,
        0.05
      );

      // Scrubbing or slamming the barrier heats and wears the outside tires
      if (vehicle.tires) {
        const outsideFront = penSign > 0 ? vehicle.tires.fr : vehicle.tires.fl;
        const outsideRear = penSign > 0 ? vehicle.tires.rr : vehicle.tires.rl;
        const targetTire = hitCornerLon >= 0 ? outsideFront : outsideRear;
        targetTire.temperature = clamp(targetTire.temperature + wallImpactSpeedMs * 0.35, 35, 145);
        targetTire.structuralIntegrity = clamp(
          targetTire.structuralIntegrity - wallImpactSpeedMs * 0.0012,
          0.25,
          1.0
        );
      }
    }
  }

  // Exact road surface height locking (reuse currLookup directly to avoid a redundant 3rd spline search)
  const finalLookup = currLookup;
  const prevSurfaceY = prevLookup.surfaceY;
  vehicle.y = finalLookup.surfaceY;
  wallContactY = vehicle.y + 0.42;

  // Vertical velocity & spring-damper suspension compression over crests, dips, and kerbs
  const newVy = (finalLookup.surfaceY - prevSurfaceY) / dt;
  const verticalAccel = (newVy - (vehicle.vy ?? 0)) / dt;
  vehicle.vy = newVy;

  const targetSuspHeave = clamp(
    -(vehicle.verticalLoadG - 1.0) * 0.028 -
      clamp(verticalAccel * 0.0008, -0.025, 0.025) +
      vehicle.kerbVibration * 0.011,
    -0.048,
    0.042
  );
  vehicle.suspensionOffsetM =
    (vehicle.suspensionOffsetM ?? 0) +
    (targetSuspHeave - (vehicle.suspensionOffsetM ?? 0)) * Math.min(1, dt * 22);

  const headingDotTangent = newFx * finalLookup.tx + newFz * finalLookup.tz;
  const effectiveSlopePitch = finalLookup.slopePitchRad * headingDotTangent;

  // Longitudinal squat under acceleration / nose-dive under braking + lateral body roll
  const suspPitch = clamp(-longAccel * 0.0018 * stats.bodyRollFactor, -0.032, 0.032);
  const suspRoll = clamp(
    vehicle.angularVelocity * forwardVel * 0.0017 * stats.bodyRollFactor +
      vehicle.kerbVibration * 0.012,
    -0.062,
    0.062
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

    if (vehicle.isPlayer) {
      awardDriverMasteryAction(vehicle, 'CLEAN LAP COMPLETED', 400);
    }

    if (vehicle.lap > track.laps && !vehicle.finished) {
      vehicle.finished = true;
      vehicle.finishTimeMs = raceElapsedMs;
      raceFinished = true;
    }
  }

  // Continuous style mastery accumulation for high-speed four-wheel drifts & slipstream drafting
  if (vehicle.isPlayer && !vehicle.isOffTrack) {
    if (vehicle.isDrifting && vehicle.speedMs > 16) {
      vehicle.styleScore = (vehicle.styleScore ?? 0) + Math.round(vehicle.speedMs * dt * 2.2);
      vehicle.comboTimer = Math.max(vehicle.comboTimer ?? 0, 2.5);
    } else if (vehicle.isDrafting && vehicle.speedMs > 28) {
      vehicle.styleScore = (vehicle.styleScore ?? 0) + Math.round(vehicle.speedMs * dt * 1.4);
      vehicle.comboTimer = Math.max(vehicle.comboTimer ?? 0, 2.0);
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

const VEHICLE_MASS_BY_SPEC: Record<string, number> = {
  aurelia_250_gto: 900,
  coventry_etype_lw: 945,
  stuttgart_911s_rs: 830,
  dearborn_gt40_mk2: 1080,
};

/**
 * 3-Sphere Longitudinal Capsule (Front + Center + Rear) Rigid-Body Car-to-Car Collision Resolution.
 * Uses authentic vehicle masses, yaw moments of inertia, contact-point rotational velocities,
 * normal restitution + Coulomb tangential friction impulses, lever-arm yaw torque (PIT maneuvers /
 * corner bumps), and suspension roll/pitch jolt transfer.
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
  const sphereOffsets = [-1.22, 0.0, 1.22];

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

      if (j > i && centerDist < 4.65) {
        const bfx = Math.sin(b.yaw);
        const bfz = Math.cos(b.yaw);

        let deepestOverlap = 0;
        let bestNx = 0;
        let bestNz = 0;
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
                contactX = (ax + bx) * 0.5;
                contactZ = (az + bz) * 0.5;
              }
            }
          }
        }

        if (deepestOverlap > 0) {
          const massA = VEHICLE_MASS_BY_SPEC[a.carSpecId] ?? 920;
          const massB = VEHICLE_MASS_BY_SPEC[b.carSpecId] ?? 920;
          const invMassA = 1 / massA;
          const invMassB = 1 / massB;
          const totalInvMass = invMassA + invMassB;

          // Separate positions inversely proportional to mass with a 2.5cm margin
          const totalSep = deepestOverlap + 0.025;
          const sepA = totalSep * (invMassA / totalInvMass);
          const sepB = totalSep * (invMassB / totalInvMass);
          a.x -= bestNx * sepA;
          a.z -= bestNz * sepA;
          b.x += bestNx * sepB;
          b.z += bestNz * sepB;

          // Contact lever arms from each vehicle's center of mass
          const rAx = contactX - a.x;
          const rAz = contactZ - a.z;
          const rBx = contactX - b.x;
          const rBz = contactZ - b.z;

          // Contact-point velocities including angular velocity (v_p = v_cm + omega x r)
          const vAx = a.vx + a.angularVelocity * rAz;
          const vAz = a.vz - a.angularVelocity * rAx;
          const vBx = b.vx + b.angularVelocity * rBz;
          const vBz = b.vz - b.angularVelocity * rBx;

          const rvx = vBx - vAx;
          const rvz = vBz - vAz;
          const relNormalVel = rvx * bestNx + rvz * bestNz;

          const tangX = -bestNz;
          const tangZ = bestNx;
          const relTangVel = rvx * tangX + rvz * tangZ;

          if (relNormalVel < 0.85) {
            const closingSpeed = Math.max(0, -relNormalVel);
            const restitution = closingSpeed > 3.0 ? 0.38 : 0.28;

            // Yaw moment of inertia for a ~1.84m x 4.22m historic GT coupe
            const inertiaA = massA * 1.76;
            const inertiaB = massB * 1.76;
            const invInertiaA = 1 / inertiaA;
            const invInertiaB = 1 / inertiaB;

            // Rotational lever-arm cross terms along contact normal
            const rnA = rAz * bestNx - rAx * bestNz;
            const rnB = rBz * bestNx - rBx * bestNz;
            const effectiveInvMass =
              totalInvMass + rnA * rnA * invInertiaA + rnB * rnB * invInertiaB;

            const targetDeltaVn = Math.max(1.15, (1 + restitution) * closingSpeed);
            const normalImpulseMag = targetDeltaVn / effectiveInvMass;

            // Coulomb tangential friction impulse between rubbing bodywork / tires
            const rtA = rAz * tangX - rAx * tangZ;
            const rtB = rBz * tangX - rBx * tangZ;
            const effectiveInvMassTang =
              totalInvMass + rtA * rtA * invInertiaA + rtB * rtB * invInertiaB;
            const maxFrictionImpulse = normalImpulseMag * 0.32;
            const tangImpulseMag = clamp(
              (-relTangVel / effectiveInvMassTang) * 0.45,
              -maxFrictionImpulse,
              maxFrictionImpulse
            );

            const impulseX = bestNx * normalImpulseMag + tangX * tangImpulseMag;
            const impulseZ = bestNz * normalImpulseMag + tangZ * tangImpulseMag;

            // Linear momentum transfer (F*dt / m)
            a.vx -= impulseX * invMassA;
            a.vz -= impulseZ * invMassA;
            b.vx += impulseX * invMassB;
            b.vz += impulseZ * invMassB;

            a.speedMs = Math.hypot(a.vx, a.vz);
            b.speedMs = Math.hypot(b.vx, b.vz);

            // Rotational impulse transfer (r x J / I_yaw) so offset bumper taps & PIT contacts rotate cars realistically
            const torqueImpulseA = rAz * impulseX - rAx * impulseZ;
            const torqueImpulseB = rBz * impulseX - rBx * impulseZ;
            a.angularVelocity = clamp(
              a.angularVelocity - torqueImpulseA * invInertiaA * 0.85,
              -3.2,
              3.2
            );
            b.angularVelocity = clamp(
              b.angularVelocity + torqueImpulseB * invInertiaB * 0.85,
              -3.2,
              3.2
            );

            const impactMag = closingSpeed + Math.abs(relTangVel) * 0.22;
            const shockDuration = clamp(0.12 + impactMag * 0.018, 0.12, 0.38);
            a.collisionTimer = Math.max(a.collisionTimer ?? 0, shockDuration);
            b.collisionTimer = Math.max(b.collisionTimer ?? 0, shockDuration);

            // Transfer physical suspension body roll & pitch jolt on impact
            const joltScale = clamp(impactMag / 18, 0.06, 1.0);
            const arx = afz;
            const arz = -afx;
            const brx = bfz;
            const brz = -bfx;
            const latDotA = bestNx * arx + bestNz * arz;
            const lonDotA = bestNx * afx + bestNz * afz;
            const latDotB = bestNx * brx + bestNz * brz;
            const lonDotB = bestNx * bfx + bestNz * bfz;

            a.rollRad = clamp(a.rollRad - latDotA * joltScale * 0.055, -0.14, 0.14);
            a.pitchRad = clamp(a.pitchRad + lonDotA * joltScale * 0.035, -0.09, 0.09);
            a.suspensionOffsetM = clamp((a.suspensionOffsetM ?? 0) - joltScale * 0.02, -0.05, 0.04);

            b.rollRad = clamp(b.rollRad + latDotB * joltScale * 0.055, -0.14, 0.14);
            b.pitchRad = clamp(b.pitchRad - lonDotB * joltScale * 0.035, -0.09, 0.09);
            b.suspensionOffsetM = clamp((b.suspensionOffsetM ?? 0) - joltScale * 0.02, -0.05, 0.04);

            if (impactMag > 1.0) {
              a.hitFlashTimer = 0.09;
              b.hitFlashTimer = 0.09;
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

export function calculateRaceRewardCredits(
  position: number,
  cleanLapBonus: boolean,
  styleScore = 0
): number {
  const basePayouts = [2800, 1900, 1350, 900];
  const base = basePayouts[clamp(position - 1, 0, 3)] ?? 900;
  const styleBonus = Math.min(1200, Math.round(styleScore * 0.25));
  return base + (cleanLapBonus ? 400 : 0) + styleBonus;
}

/**
 * Generates deterministic breakable trackside props (straw hay bales, apex marker cones,
 * and wooden chicane boards) along the circuit's corner verges and chicanes so drivers
 * can clip or smash through them with 3D physical debris & gamified style points.
 */
export function createTrackBreakableProps(track: TrackSpec): BreakablePropState[] {
  const props: BreakablePropState[] = [];
  const samples = track.samples;
  const n = samples.length;

  for (let i = 15; i < n - 15; i += 5) {
    const s = samples[i];
    const absCurv = Math.abs(s.curvature);
    const curveSign = Math.sign(s.curvature || (i % 20 === 0 ? 1 : -1));
    const roadHalfW = s.width * 0.5;
    const yaw = Math.atan2(s.tx, s.tz);

    // 1. Inside-apex striped marker cones right on the kerb shoulder
    if ((absCurv >= 0.0035 || i % 30 === 0) && i % 10 === 0) {
      const insideSide = curveSign >= 0 ? -1 : 1;
      const lat = insideSide * (roadHalfW + 0.36);
      const px = s.x + s.rx * lat;
      const pz = s.z + s.rz * lat;
      props.push({
        id: `cone-${i}`,
        type: 'apex_cone',
        baseX: px,
        baseY: s.y,
        baseZ: pz,
        baseYaw: yaw,
        x: px,
        y: s.y,
        z: pz,
        yaw,
        pitch: 0,
        roll: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        radius: 0.45,
        broken: false,
        respawnTimer: 0,
        points: 100,
        label: 'APEX CONE CLIP',
      });
    }

    // 2. Outside-verge frangible golden straw hay bales
    if ((absCurv >= 0.0035 || i % 30 === 0) && i % 15 === 0) {
      const outsideSide = curveSign >= 0 ? 1 : -1;
      const lat = outsideSide * (roadHalfW + 0.78);
      const px = s.x + s.rx * lat;
      const pz = s.z + s.rz * lat;
      props.push({
        id: `hay-${i}`,
        type: 'hay_bale',
        baseX: px,
        baseY: s.y,
        baseZ: pz,
        baseYaw: yaw + 0.15,
        x: px,
        y: s.y,
        z: pz,
        yaw: yaw + 0.15,
        pitch: 0,
        roll: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        radius: 0.72,
        broken: false,
        respawnTimer: 0,
        points: 150,
        label: 'HAY BALE SMASH',
      });
    }

    // 3. Wooden chicane chevron marker boards on corner entries
    if ((absCurv >= 0.0045 || i % 50 === 0) && i % 25 === 0) {
      const outsideSide = curveSign >= 0 ? 1 : -1;
      const lat = outsideSide * (roadHalfW + 0.65);
      const px = s.x + s.rx * lat;
      const pz = s.z + s.rz * lat;
      props.push({
        id: `sign-${i}`,
        type: 'chicane_sign',
        baseX: px,
        baseY: s.y,
        baseZ: pz,
        baseYaw: yaw,
        x: px,
        y: s.y,
        z: pz,
        yaw,
        pitch: 0,
        roll: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        radius: 0.65,
        broken: false,
        respawnTimer: 0,
        points: 200,
        label: 'CHICANE BOARD SMASH',
      });
    }
  }

  return props;
}

/**
 * Advances breakable trackside props, checking for vehicle impacts, launching struck props
 * into tumbling 3D ballistic trajectories, and awarding gamified style points to the player.
 */
export function stepBreakableProps(
  props: BreakablePropState[],
  vehicles: VehiclePhysicsState[],
  dt: number
): Array<{
  prop: BreakablePropState;
  vehicle: VehiclePhysicsState;
  x: number;
  y: number;
  z: number;
  type: BreakablePropType;
}> {
  const brokenEvents: Array<{
    prop: BreakablePropState;
    vehicle: VehiclePhysicsState;
    x: number;
    y: number;
    z: number;
    type: BreakablePropType;
  }> = [];

  const carHitRadius = 1.15;

  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    if (p.broken) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0) {
        p.broken = false;
        p.x = p.baseX;
        p.y = p.baseY;
        p.z = p.baseZ;
        p.yaw = p.baseYaw;
        p.pitch = 0;
        p.roll = 0;
        p.vx = 0;
        p.vy = 0;
        p.vz = 0;
        p.rx = 0;
        p.ry = 0;
        p.rz = 0;
        continue;
      }

      // Ballistic 3D flight + ground bounce for broken prop
      p.vy -= 18.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.yaw += p.ry * dt;
      p.pitch += p.rx * dt;
      p.roll += p.rz * dt;

      if (p.y < p.baseY) {
        p.y = p.baseY;
        p.vy = Math.abs(p.vy) * 0.36;
        p.vx *= 0.72;
        p.vz *= 0.72;
        p.rx *= 0.75;
        p.ry *= 0.75;
        p.rz *= 0.75;
      }
      continue;
    }

    for (let vIdx = 0; vIdx < vehicles.length; vIdx++) {
      const v = vehicles[vIdx];
      if (v.speedMs < 2.5) continue;
      const dx = p.x - v.x;
      const dz = p.z - v.z;
      const minDist = p.radius + carHitRadius;
      if (dx * dx + dz * dz <= minDist * minDist) {
        p.broken = true;
        p.respawnTimer = 14.0;

        const impactSpeed = Math.max(8, v.speedMs);
        const dirLen = Math.max(0.01, Math.hypot(dx, dz));
        const nx = dx / dirLen;
        const nz = dz / dirLen;

        p.vx = v.vx * 0.88 + nx * impactSpeed * 0.42;
        p.vy = 4.2 + Math.min(7.5, impactSpeed * 0.16);
        p.vz = v.vz * 0.88 + nz * impactSpeed * 0.42;
        p.rx = ( nx * 6.5) + 4.2;
        p.ry = (nz * 5.2);
        p.rz = (-nx * 5.8);

        // Frangible impact scrubs only ~1.8% speed and gives a crisp suspension tactile pulse
        v.vx *= 0.982;
        v.vz *= 0.982;
        v.speedMs = Math.hypot(v.vx, v.vz);
        v.suspensionOffsetM = clamp((v.suspensionOffsetM ?? 0) - 0.014, -0.05, 0.04);

        if (v.isPlayer) {
          awardDriverMasteryAction(v, p.label, p.points);
          v.nitroCharge = Math.min(100, (v.nitroCharge ?? 0) + 6);
        }

        brokenEvents.push({
          prop: p,
          vehicle: v,
          x: p.baseX,
          y: p.baseY + 0.35,
          z: p.baseZ,
          type: p.type,
        });
        break;
      }
    }
  }

  return brokenEvents;
}

