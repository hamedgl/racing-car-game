import { ClassicCarSpec, CarLivery, CarUpgrades, HandlingTuning } from './types';

export const CLASSIC_CARS: ClassicCarSpec[] = [
  {
    id: 'aurelia_250_gto',
    name: '1964 Aurelia 250 Corsa',
    year: 1964,
    origin: 'Maranello, Italy',
    engineConfig: 'V12',
    displacement: '3.0L Colombo V12',
    description: 'High-revving Italian thoroughbred with razor-sharp turn-in, balanced weight distribution, and an unmistakable V12 crescendo.',
    unlockCost: 0,
    baseStats: {
      powerHp: 302,
      weightKg: 900,
      topSpeedKmh: 280,
      accel0to100: 5.4,
      lateralGripG: 1.18,
      brakingG: 1.22,
      dragCoeff: 0.34,
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
    description: 'Aerodynamic aluminum monocoque GT built for sweeping high-speed bends and low-drag slipstream duels.',
    unlockCost: 0,
    baseStats: {
      powerHp: 320,
      weightKg: 945,
      topSpeedKmh: 288,
      accel0to100: 5.2,
      lateralGripG: 1.15,
      brakingG: 1.18,
      dragCoeff: 0.31,
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
    description: 'Featherweight rear-engine giant-killer. Unmatched corner-exit traction and late-braking rotation in tight hairpins.',
    unlockCost: 0,
    baseStats: {
      powerHp: 275,
      weightKg: 830,
      topSpeedKmh: 268,
      accel0to100: 4.9,
      lateralGripG: 1.25,
      brakingG: 1.30,
      dragCoeff: 0.36,
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
    description: 'Mid-engine endurance monster packing thunderous V8 torque and ground-hugging downforce for the Mulsanne and Monza.',
    unlockCost: 0,
    baseStats: {
      powerHp: 485,
      weightKg: 1080,
      topSpeedKmh: 318,
      accel0to100: 4.4,
      lateralGripG: 1.22,
      brakingG: 1.26,
      dragCoeff: 0.33,
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
    id: 'scuderia_f1_68',
    name: '1968 Scuderia 312 F1',
    year: 1968,
    origin: 'Maranello, Italy',
    engineConfig: 'V12',
    displacement: '3.0L 48-Valve F1 V12',
    description: 'Featherweight open-wheel Grand Prix monoposto with high-mounted aero wings, exposed double-wishbone suspension, and a screaming 10,800 RPM V12.',
    unlockCost: 0,
    baseStats: {
      powerHp: 435,
      weightKg: 540,
      topSpeedKmh: 342,
      accel0to100: 3.1,
      lateralGripG: 1.62,
      brakingG: 1.68,
      dragCoeff: 0.29,
      wheelbaseM: 2.40,
    },
    bodyStyle: 'f1_monoposto',
    defaultLivery: {
      bodyColor: '#c81d25',
      stripeStyle: 'twin_center',
      stripeColor: '#f8fafc',
      number: 5,
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
