export type GameState = 'title' | 'playing' | 'paused' | 'gameover';

export type CameraMode = 'chase' | 'chase_far' | 'bonnet' | 'cockpit' | 'bumper' | 'tv_side';

export type TrackId =
  | 'monza_storico'
  | 'cote_dazur'
  | 'eifel_sprint'
  | 'stelvio_pass'
  | 'targa_madonie';

export type TireCompound = 'soft' | 'medium' | 'hard' | 'wet';

export interface CornerTireState {
  treadLife: number;           // 0.0 (bald/cord exposed) .. 1.0 (fresh 100% tread)
  temperature: number;         // °C (optimal ~75..104°C dry, ~55..85°C wet; >110°C blistering)
  structuralIntegrity: number; // 0.0 (critical failure) .. 1.0 (100% carcass & belt integrity)
  slipLoad: number;            // instantaneous corner thermal/wear load 0..1
}

export interface VehicleTireState {
  compound: TireCompound;
  nextPitCompound: TireCompound;
  fl: CornerTireState;
  fr: CornerTireState;
  rl: CornerTireState;
  rr: CornerTireState;
  avgTreadLife: number;        // 0..1 average across 4 tires
  minTreadLife: number;        // 0..1 lowest corner tread
  avgTemp: number;             // °C average across 4 tires
  peakTemp: number;            // °C hottest corner
  minIntegrity: number;        // 0..1 lowest corner structural integrity
  gripMultiplier: number;      // 0.52 .. 1.15 dynamic effective tire grip modifier
  wearRateMultiplier: number;  // 0.5 .. 2.5 session wear rate scale
  inPitZone: boolean;          // true when driving along the Pit Lane Service Box
  pitRequest: boolean;         // true when driver armed pit stop [B] or Pit Button
  pitStopActive: boolean;      // true while stationary in pit box being serviced
  pitStopTimer: number;        // countdown seconds remaining in pit stop (2.2s -> 0s)
  pitStopsCompleted: number;   // number of pit stops completed this race
}

export interface ChampionshipLevelSpec {
  level: number;
  id: string;
  title: string;
  subtitle: string;
  trackId: TrackId;
  laps: number;
  weather: WeatherCondition;
  recommendedCompound: TireCompound;
  tireWearMultiplier: number;
  targetPosition: number;
  rewardCredits: number;
  elevationChangeM: number;
  description: string;
}

export type StripeStyle = 'none' | 'twin_center' | 'offset_lemans' | 'hood_sill';

export type WheelFinish = 'chrome_wire' | 'gold_magnesium' | 'gunmetal_alloy';

export type AIArchetype = 'apex_precision' | 'late_braker' | 'slipstream_defender';

export interface CarLivery {
  bodyColor: string;
  stripeStyle: StripeStyle;
  stripeColor: string;
  number: number;
  wheelFinish: WheelFinish;
}

export interface CarUpgrades {
  engineLevel: number;       // 1..5
  transmissionLevel: number; // 1..5
  tiresLevel: number;        // 1..5
  chassisWeightLevel: number;// 1..5
}

export interface HandlingTuning {
  suspensionStiffness: number; // 1.0 .. 10.0 (default 5.5)
  tirePressurePsi: number;     // 24.0 .. 38.0 (default 30.0)
  aeroDownforce: number;       // 0 .. 100 % (default 35)
  finalDriveRatio: number;     // 2.8 .. 4.5 (default 3.55)
  brakeBiasFront: number;      // 50 .. 70 % (default 58)
  diffLockAccel: number;       // 15 .. 85 % (default 45)
}

export interface ClassicCarSpec {
  id: string;
  name: string;
  year: number;
  origin: string;
  engineConfig: 'V12' | 'I6' | 'F6' | 'V8';
  displacement: string;
  description: string;
  unlockCost: number;
  baseStats: {
    powerHp: number;
    weightKg: number;
    topSpeedKmh: number;
    accel0to100: number;
    lateralGripG: number;
    brakingG: number;
    dragCoeff: number;
    wheelbaseM: number;
  };
  bodyStyle: 'italian_gt' | 'british_coupe' | 'stuttgart_911' | 'detroit_proto';
  defaultLivery: CarLivery;
}

export interface EffectiveCarStats {
  powerHp: number;
  weightKg: number;
  topSpeedKmh: number;
  accel0to100Sec: number;
  lateralGripG: number;
  brakingG: number;
  maxSpeedMs: number;
  engineForceN: number;
  brakeForceN: number;
  dragFactor: number;
  downforceFactor: number;
  cornerStiffness: number;
  turnInRate: number;
  bodyRollFactor: number;
  oversteerBias: number; // < 1 understeer, 1 neutral, > 1 oversteer
  balanceLabel: 'Understeer' | 'Neutral-Balanced' | 'Oversteer-Agile';
  performanceIndex: number; // 400 .. 999 historic class rating
}

export type HandlingMode = 'pro_assisted' | 'pure_historic';

export interface TrackPointSample {
  index: number;
  s: number; // normalized 0..1 along lap
  distanceM: number;
  x: number;
  y: number;
  z: number;
  tx: number; // forward tangent x
  ty: number;
  tz: number; // forward tangent z
  rx: number; // right vector x
  rz: number; // right vector z
  width: number;
  bankingRad: number;
  curvature: number; // signed curvature for AI braking & apex offset
  verticalCurvature?: number; // signed vertical crest/compression curvature (d^2y/ds^2)
  racingLineOffset: number; // optimal lateral offset in meters (-left, +right)
  cornerLoadIntensity: number; // 0..1 braking + cornering rubber deposition weight
}

export type TrackRubberPreset = 'progressive' | 'green' | 'rubbered' | 'saturated';

export interface TrackRubberState {
  preset: TrackRubberPreset;
  globalRubberLevel: number; // 0.0 (green asphalt) .. 1.0 (heavily rubbered-in racing line)
  sectorRubber: Float32Array; // per-sample localized rubber buildup (0..1)
  lapsCompleted: number;
  dirtyVisuals: boolean;
}

export interface TrackSpec {
  id: TrackId;
  name: string;
  location: string;
  country: string;
  lengthKm: number;
  laps: number;
  elevationGainM: number;
  difficulty: 'Classic Fast' | 'Technical Street' | 'Master Endurance' | 'Alpine Climb' | 'Mountain Hills';
  surfaceGrip: number;
  abrasiveness: number; // 0.85 .. 1.35 tire wear factor
  description: string;
  theme: {
    skyTop: string;
    skyHorizon: string;
    fogColor: string;
    fogDensity: number;
    groundColor: string;
    asphaltColor: string;
    kerbPrimary: string;
    kerbSecondary: string;
    sunColor: string;
    hemiSky: string;
    hemiGround: string;
  };
  samples: TrackPointSample[];
  totalLengthM: number;
}

export interface VehiclePhysicsState {
  id: string;
  isPlayer: boolean;
  driverName: string;
  carSpecId: string;
  archetype?: AIArchetype;
  livery: CarLivery;
  // Spatial position & orientation
  x: number;
  y: number;
  z: number;
  yaw: number; // heading in radians (0 = +Z, or atan2(vx, vz))
  vx: number;
  vz: number;
  vy: number; // vertical suspension/gravity velocity
  speedMs: number;
  lateralSpeedMs: number;
  angularVelocity: number;
  // Drivetrain & Controls
  throttle: number;
  brake: number;
  steerAngle: number;
  handbrake: boolean;
  gear: number; // 1..5
  rpm: number;  // 1000..8500
  // Suspension, Gravity Load & Asphalt Feel
  pitchRad: number;
  rollRad: number;
  slipAngleRad: number;
  suspensionOffsetM: number; // vertical heave compression/extension (-0.06m .. +0.06m)
  verticalLoadG: number;     // normal load factor on asphalt (0.35G crest .. 1.85G dip)
  asphaltGripFactor: number; // combined effective asphalt friction multiplier
  onKerb: boolean;           // true when riding serrated apex rumble kerbs
  kerbVibration: number;     // high-frequency serrated kerb harmonic
  isDrifting: boolean;
  isOffTrack: boolean;
  isDrafting: boolean;
  hitFlashTimer: number;
  brakeTelegraphTimer: number;
  // Race progress
  trackSampleIndex: number;
  lapProgress: number; // 0..1
  lateralOffset: number; // meters from track centerline (-left, +right)
  lap: number; // 1..totalLaps
  maxSReachedThisLap: number;
  totalRaceDistanceM: number;
  currentLapStartTimeMs: number;
  lastLapTimeMs: number;
  bestLapTimeMs: number;
  finished: boolean;
  finishTimeMs: number;
  topSpeedAchievedKmh: number;
  // AI specific state
  aiTargetOffset: number;
  aiReactionTimer: number;
  // Weather & Legacy Damage compatibility
  damage: VehicleDamageState;
  aquaplaningTimer: number;
  // Dynamic 4-Corner Tire Wear, Heat, Structural Integrity & Pit Strategy
  tires: VehicleTireState;
  // Nitro Overboost System
  nitroCharge: number; // 0 .. 100
  isBoosting: boolean;
  // Track Rubbering & Thermal Brake Telemetry
  onRacingLine: boolean;
  onMarbles: boolean;
  lineGripModifier: number; // >1.0 on rubbered line, <1.0 on marbles
  frontBrakeGlow: number; // 0.0 .. 1.0 glowing rotor temperature
}

export type WeatherCondition = 'clear' | 'overcast' | 'rain' | 'storm' | 'dynamic';

export interface WeatherState {
  condition: WeatherCondition;
  activeType: 'clear' | 'overcast' | 'rain' | 'storm';
  wetness: number;         // 0.0 (bone dry) to 1.0 (waterlogged puddles)
  rainIntensity: number;   // 0.0 to 1.0
  gripMultiplier: number;  // 1.0 down to ~0.62
  windX: number;
  windZ: number;
  lightningTimer: number;
}

export type DamageMode = 'off' | 'visual' | 'simulation';

export interface VehicleDamageState {
  totalDamage: number;
  frontCrumple: number;
  rearCrumple: number;
  leftFenderDent: number;
  rightFenderDent: number;
  hoodBuckle: number;
  windshieldCrack: number;
  radiatorPunctured: boolean;
  aeroPenalty: number;
  enginePenalty: number;
}

export interface ControlInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
  nitro?: boolean;      // Nitro overboost activation
  pitRequest?: boolean; // Request / execute Pit Stop service in pit zone
  steerAxis?: number;   // Optional continuous analog steering (-1 full right .. +1 full left)
}

export interface LeaderboardEntry {
  id: string;
  driverName: string;
  trackId: TrackId;
  carId: string;
  carName: string;
  bestLapMs: number;
  totalTimeMs: number;
  topSpeedKmh: number;
  performanceIndex: number;
  liveryColor: string;
  liveryNumber: number;
  tuningLabel: string;
  createdAt: string;
}

export interface RemoteRacerTelemetry {
  id: string;
  driverName: string;
  trackId: TrackId;
  carId: string;
  livery: CarLivery;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speedKmh: number;
  lap: number;
  updatedAt: number;
}
