import { ClassicCarSpec, CarLivery, CarUpgrades, HandlingTuning } from './types';

export const CLASSIC_CARS: ClassicCarSpec[] = [
  {
    id: 'aurelia_250_gto',
    name: '1964 Aurelia 250 Corsa',
    year: 1964,
    origin: 'Maranello, Italy',
    engineConfig: 'V12',
    displacement: '3.0L Colombo V12',
    coachbuilder: 'Carrozzeria Scaglietti',
    silhouetteTag: 'Triple-Nostril V12 Berlinetta · Borrani Wire Wheels',
    description:
      'Hand-hammered Scaglietti aluminum Berlinetta featuring triple Bizzarrini nose nostrils, Plexiglas headlamp fairings, leather-strapped Weber V12 hood bulge, and an upswept Kamm ducktail.',
    unlockCost: 0,
    baseStats: {
      powerHp: 395,
      weightKg: 880,
      topSpeedKmh: 332,
      accel0to100: 3.9,
      lateralGripG: 1.42,
      brakingG: 1.48,
      dragCoeff: 0.30,
      wheelbaseM: 2.40,
    },
    bodyStyle: 'italian_gt',
    defaultLivery: {
      bodyColor: '#c81d25',
      stripeStyle: 'twin_center',
      stripeColor: '#f8fafc',
      number: 14,
      wheelFinish: 'chrome_wire',
    },
  },
  {
    id: 'coventry_etype_lw',
    name: '1967 Coventry E-Series LW',
    year: 1967,
    origin: 'Coventry, Great Britain',
    engineConfig: 'I6',
    displacement: '3.8L Twin-Cam Straight-6',
    coachbuilder: 'Malcolm Sayer Aero Works',
    silhouetteTag: 'Slender Long-Nose Fuselage · Dunlop Alloy Discs',
    description:
      'Ultra-slender cigar-fuselage monocoque GT with a sweeping 18-louver clamshell bonnet, chrome spear oval intake, rearward teardrop cabin, and perforated Dunlop alloy disc wheels.',
    unlockCost: 0,
    baseStats: {
      powerHp: 410,
      weightKg: 915,
      topSpeedKmh: 338,
      accel0to100: 3.8,
      lateralGripG: 1.40,
      brakingG: 1.45,
      dragCoeff: 0.28,
      wheelbaseM: 2.44,
    },
    bodyStyle: 'british_coupe',
    defaultLivery: {
      bodyColor: '#0f4c3a',
      stripeStyle: 'offset_lemans',
      stripeColor: '#eab308',
      number: 7,
      wheelFinish: 'chrome_wire',
    },
  },
  {
    id: 'stuttgart_911s_rs',
    name: '1969 Stuttgart 911S Rennsport',
    year: 1969,
    origin: 'Stuttgart, Germany',
    engineConfig: 'F6',
    displacement: '2.4L Air-Cooled Flat-6',
    coachbuilder: 'Zuffenhausen Werks',
    silhouetteTag: 'Cannon-Fender Fastback · Bürzel Ducktail Wing · Fuchs 5-Spoke',
    description:
      'Short-wheelbase rear-engine giant-killer sporting upright frog-eye cannon fenders, quad Cibie hood rally pods, iconic Carrera RS Bürzel ducktail wing, and forged 5-petal Fuchs wheels.',
    unlockCost: 0,
    baseStats: {
      powerHp: 375,
      weightKg: 815,
      topSpeedKmh: 324,
      accel0to100: 3.6,
      lateralGripG: 1.48,
      brakingG: 1.54,
      dragCoeff: 0.31,
      wheelbaseM: 2.27,
    },
    bodyStyle: 'stuttgart_911',
    defaultLivery: {
      bodyColor: '#e2e8f0',
      stripeStyle: 'hood_sill',
      stripeColor: '#dc2626',
      number: 46,
      wheelFinish: 'gold_magnesium',
    },
  },
  {
    id: 'dearborn_gt40_mk2',
    name: '1966 Dearborn Mk.II Prototype',
    year: 1966,
    origin: 'Dearborn, USA',
    engineConfig: 'V8',
    displacement: '7.0L Big-Block V8',
    coachbuilder: 'Kar Kraft / Abbey Panels',
    silhouetteTag: '40-Inch Low Wedge · Twin Hood Troughs · Glass V8 Deck',
    description:
      'Ground-hugging 40-inch Le Mans prototype with deep twin radiator hood troughs, rear periscope air scoops, glass-covered 8-stack Bundle-of-Snakes V8 engine bay, and 6-spoke Halibrand wheels.',
    unlockCost: 0,
    baseStats: {
      powerHp: 585,
      weightKg: 1020,
      topSpeedKmh: 368,
      accel0to100: 3.2,
      lateralGripG: 1.46,
      brakingG: 1.52,
      dragCoeff: 0.29,
      wheelbaseM: 2.41,
    },
    bodyStyle: 'detroit_proto',
    defaultLivery: {
      bodyColor: '#1e3a8a',
      stripeStyle: 'twin_center',
      stripeColor: '#f8fafc',
      number: 2,
      wheelFinish: 'gunmetal_alloy',
    },
  },
  {
    id: 'shelby_daytona_65',
    name: '1965 Daytona Kammtail Coupe',
    year: 1965,
    origin: 'Venice, California',
    engineConfig: 'V8',
    displacement: '4.7L Hi-Po V8',
    coachbuilder: 'Pete Brock / Carrozzeria Gransport',
    silhouetteTag: 'Wide-Body Kamm Coupe · Dual Side-Exit Pipes · Tall Tail Blade',
    description:
      'Muscular American Kamm-tail coupe featuring a deep pitot nose intake, raised Cobra ram-air hood scoop, exposed chrome dual side-exit rocker exhaust pipes, and a riveted aluminum tail spoiler.',
    unlockCost: 0,
    baseStats: {
      powerHp: 495,
      weightKg: 980,
      topSpeedKmh: 354,
      accel0to100: 3.4,
      lateralGripG: 1.44,
      brakingG: 1.50,
      dragCoeff: 0.28,
      wheelbaseM: 2.38,
    },
    bodyStyle: 'daytona_kammtail',
    defaultLivery: {
      bodyColor: '#38bdf8',
      stripeStyle: 'twin_center',
      stripeColor: '#f8fafc',
      number: 98,
      wheelFinish: 'gold_magnesium',
    },
  },
  {
    id: 'alfa_33_stradale',
    name: '1968 Arese Tipo 33 Stradale',
    year: 1968,
    origin: 'Arese, Italy',
    engineConfig: 'V8',
    displacement: '2.0L Screaming Flat-Crank V8',
    coachbuilder: 'Franco Scaglione / Carrozzeria Marazzi',
    silhouetteTag: 'Butterfly Glass Dome · Scudetto Nose · Campagnolo Star Rims',
    description:
      'Exotic mid-engine sculpture with high-crested wheel-arch pontoons, wraparound dihedral butterfly-door glass roof canopy, triangular Scudetto shield, and gold Campagnolo Millerighe wheels.',
    unlockCost: 0,
    baseStats: {
      powerHp: 435,
      weightKg: 790,
      topSpeedKmh: 346,
      accel0to100: 3.3,
      lateralGripG: 1.52,
      brakingG: 1.56,
      dragCoeff: 0.29,
      wheelbaseM: 2.35,
    },
    bodyStyle: 'stradale_proto',
    defaultLivery: {
      bodyColor: '#c81d25',
      stripeStyle: 'offset_lemans',
      stripeColor: '#eab308',
      number: 33,
      wheelFinish: 'gold_magnesium',
    },
  },
];

export const PAINT_SWATCHES = [
  { name: 'Rosso Corsa', hex: '#c81d25' },
  { name: 'British Racing Green', hex: '#0f4c3a' },
  { name: 'Silver Arrow', hex: '#cbd5e1' },
  { name: 'Le Mans Royal Blue', hex: '#1e3a8a' },
  { name: 'Giallo Modena', hex: '#eab308' },
  { name: 'Gulf Heritage Blue', hex: '#38bdf8' },
  { name: 'Chamonix Ivory', hex: '#f5f2eb' },
  { name: 'Nero Obsidian', hex: '#18181b' },
];

export const STRIPE_SWATCHES = [
  { name: 'Alpine White', hex: '#f8fafc' },
  { name: 'Vintage Gold', hex: '#eab308' },
  { name: 'Signal Orange', hex: '#f97316' },
  { name: 'Monza Crimson', hex: '#dc2626' },
  { name: 'Obsidian Black', hex: '#09090b' },
  { name: 'Riviera Cyan', hex: '#0284c7' },
];

export const DEFAULT_UPGRADES: CarUpgrades = {
  engineLevel: 1,
  transmissionLevel: 1,
  tiresLevel: 1,
  chassisWeightLevel: 1,
};

export const DEFAULT_TUNING: HandlingTuning = {
  suspensionStiffness: 5.5,
  tirePressurePsi: 30.0,
  aeroDownforce: 35,
  finalDriveRatio: 3.55,
  brakeBiasFront: 58,
  diffLockAccel: 45,
};

export const TUNING_PRESETS: Record<string, { label: string; description: string; tuning: HandlingTuning }> = {
  balanced_gt: {
    label: 'Factory Historic GT',
    description: 'Neutral FIA historic balance suited for mixed elevation and fast sweepers.',
    tuning: {
      suspensionStiffness: 5.5,
      tirePressurePsi: 30.0,
      aeroDownforce: 35,
      finalDriveRatio: 3.55,
      brakeBiasFront: 58,
      diffLockAccel: 45,
    },
  },
  monza_low_drag: {
    label: 'Monza High-Velocity',
    description: 'Trimmed aero drag, tall gearing, and higher tire pressure for maximum straight-line velocity.',
    tuning: {
      suspensionStiffness: 6.5,
      tirePressurePsi: 34.0,
      aeroDownforce: 15,
      finalDriveRatio: 3.05,
      brakeBiasFront: 62,
      diffLockAccel: 35,
    },
  },
  monte_carlo_grip: {
    label: 'Riviera Hairpin Master',
    description: 'High mechanical grip, short acceleration ratios, and aggressive diff lock for tight rotation.',
    tuning: {
      suspensionStiffness: 4.8,
      tirePressurePsi: 27.5,
      aeroDownforce: 75,
      finalDriveRatio: 4.15,
      brakeBiasFront: 54,
      diffLockAccel: 70,
    },
  },
};

export function getUpgradeCost(currentLevel: number): number {
  if (currentLevel >= 5) return 0;
  return currentLevel * 1200;
}

export const AI_RIVALS: Array<{
  name: string;
  carSpecId: string;
  archetype: 'apex_precision' | 'late_braker' | 'slipstream_defender';
  livery: CarLivery;
}> = [
  {
    name: 'L. Bandini',
    carSpecId: 'aurelia_250_gto',
    archetype: 'apex_precision',
    livery: {
      bodyColor: '#c81d25',
      stripeStyle: 'hood_sill',
      stripeColor: '#eab308',
      number: 22,
      wheelFinish: 'chrome_wire',
    },
  },
  {
    name: 'J. Ickx',
    carSpecId: 'dearborn_gt40_mk2',
    archetype: 'late_braker',
    livery: {
      bodyColor: '#38bdf8',
      stripeStyle: 'twin_center',
      stripeColor: '#f97316',
      number: 9,
      wheelFinish: 'gold_magnesium',
    },
  },
  {
    name: 'G. Hill',
    carSpecId: 'coventry_etype_lw',
    archetype: 'slipstream_defender',
    livery: {
      bodyColor: '#0f4c3a',
      stripeStyle: 'twin_center',
      stripeColor: '#f8fafc',
      number: 11,
      wheelFinish: 'chrome_wire',
    },
  },
];
