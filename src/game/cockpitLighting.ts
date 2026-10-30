import { CockpitLightingState, CockpitLightingZone, WeatherState } from './types';

export interface TrackLightingSector {
  zone: CockpitLightingZone;
  startIdx: number;
  endIdx: number;
}

/**
 * Shared 600-station environmental lighting sectors used by both the 3D track builder
 * (`sceneBuilder.ts`) and the real-time cockpit lighting evaluator (`evaluateCockpitLightingState`).
 *
 * Starting grid is around station 48..52:
 * - Stations 44..63: Pit-Straight Grandstand & Pagoda Shade
 * - Stations 66..134: Tree Canopy Avenue #1 (immediate dappled sunlight flicker after start!)
 * - Stations 138..188: 3D Stone & Concrete Tunnel Gallery #1 (with warm sodium ceiling lights)
 * - Stations 205..285: Tree Canopy Avenue #2
 * - Stations 315..365: 3D Stone & Concrete Tunnel Gallery #2
 * - Stations 385..465: Tree Canopy Avenue #3
 * - Stations 520..578: Tree Canopy Avenue #4
 */
export const TUNNEL_GALLERY_SECTORS: ReadonlyArray<{ startIdx: number; endIdx: number }> = [
  { startIdx: 138, endIdx: 188 },
  { startIdx: 315, endIdx: 365 },
];

export const TREE_CANOPY_SECTORS: ReadonlyArray<{ startIdx: number; endIdx: number }> = [
  { startIdx: 66, endIdx: 134 },
  { startIdx: 205, endIdx: 285 },
  { startIdx: 385, endIdx: 465 },
  { startIdx: 520, endIdx: 578 },
];

export const GRANDSTAND_SHADE_SECTORS: ReadonlyArray<{ startIdx: number; endIdx: number }> = [
  { startIdx: 44, endIdx: 63 },
];

function computeSectorBlend(
  stationIndex: number,
  sectors: ReadonlyArray<{ startIdx: number; endIdx: number }>,
  rampStations = 4
): number {
  let maxWeight = 0;
  for (let i = 0; i < sectors.length; i++) {
    const { startIdx, endIdx } = sectors[i];
    if (stationIndex < startIdx - rampStations || stationIndex > endIdx + rampStations) {
      continue;
    }
    if (stationIndex >= startIdx && stationIndex <= endIdx) {
      return 1.0;
    }
    if (stationIndex < startIdx) {
      const w = 1 - (startIdx - stationIndex) / Math.max(1, rampStations);
      if (w > maxWeight) maxWeight = w;
    } else {
      const w = 1 - (stationIndex - endIdx) / Math.max(1, rampStations);
      if (w > maxWeight) maxWeight = w;
    }
  }
  return Math.max(0, Math.min(1, maxWeight));
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * Math.max(0, Math.min(1, t)));
}

function mixHexColors(hexA: number, hexB: number, t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  const rA = (hexA >> 16) & 0xff;
  const gA = (hexA >> 8) & 0xff;
  const bA = hexA & 0xff;

  const rB = (hexB >> 16) & 0xff;
  const gB = (hexB >> 8) & 0xff;
  const bB = hexB & 0xff;

  const r = lerpChannel(rA, rB, clamped);
  const g = lerpChannel(gA, gB, clamped);
  const b = lerpChannel(bA, bB, clamped);
  return (r << 16) | (g << 8) | b;
}

/**
 * Computes real-time dynamic cockpit lighting state based on track position,
 * vehicle speed, travelled distance, and weather conditions.
 *
 * - Under `tree_canopy` sectors: computes high-frequency dappled sunlight & leaf-shadow
 *   flickering whose frequency and contrast respond to vehicle velocity (`speedMs`) and
 *   forward distance (`distanceM`).
 * - Inside `tunnel` gallery sectors: drops ambient daylight to deep shadow (`0.14`),
 *   activates warm vintage instrument dial backlights (`0.95..1.0`), and pulses
 *   overhead warm sodium-vapor ceiling luminaires (`tunnelSodiumPulse`) sweeping from
 *   the front windshield across the dashboard and steering wheel (`sweepPhase`).
 */
export function evaluateCockpitLightingState(params: {
  trackSampleIndex: number;
  totalSamples?: number;
  distanceM: number;
  speedMs: number;
  timeSec: number;
  weather?: Pick<WeatherState, 'activeType' | 'wetness' | 'rainIntensity' | 'lightningTimer'>;
}): CockpitLightingState {
  const totalSamples = params.totalSamples ?? 600;
  const normIndex = ((params.trackSampleIndex % totalSamples) + totalSamples) % totalSamples;
  const scaleTo600 = (normIndex / Math.max(1, totalSamples)) * 600;

  const tunnelWeight = computeSectorBlend(scaleTo600, TUNNEL_GALLERY_SECTORS, 5);
  const canopyWeight =
    tunnelWeight > 0.85 ? 0 : computeSectorBlend(scaleTo600, TREE_CANOPY_SECTORS, 5) * (1 - tunnelWeight);
  const grandstandWeight =
    tunnelWeight > 0.5 || canopyWeight > 0.5
      ? 0
      : computeSectorBlend(scaleTo600, GRANDSTAND_SHADE_SECTORS, 4);

  // Weather attenuation
  const rainDim = params.weather ? params.weather.rainIntensity * 0.25 + params.weather.wetness * 0.12 : 0;
  const weatherSunScale = Math.max(0.45, 1.0 - rainDim);

  // 1. Tree Canopy Dappled Sunlight Flicker (spatial wave along distanceM + subtle leaf breeze)
  // Tree spacing ~7.2m along the road verge; secondary branch harmonic at ~2.8m
  const primaryWave = Math.sin(params.distanceM * 0.88 + params.timeSec * 1.4);
  const branchHarmonic = Math.cos(params.distanceM * 2.25 - params.timeSec * 2.1);
  const rawCanopyWave = Math.max(0, Math.min(1, 0.5 + primaryWave * 0.34 + branchHarmonic * 0.24));
  // Sharpen contrast into distinct sunbeams vs leaf shadow bands
  const shapedCanopySunbeam = Math.pow(rawCanopyWave, 1.35);
  // Motion enhances perceived flicker contrast when moving under trees
  const motionContrast = 0.45 + 0.55 * Math.min(1, Math.abs(params.speedMs) / 14);
  const dappledFlicker = Number((canopyWeight * shapedCanopySunbeam * motionContrast).toFixed(3));

  // 2. Tunnel Overhead Warm Sodium-Vapor Luminaire Pulse (spaced every 14m inside tunnel)
  const tunnelLampSpacingM = 14.0;
  const tunnelPhaseRad = ((params.distanceM % tunnelLampSpacingM) / tunnelLampSpacingM) * Math.PI * 2;
  // Sharp specular peak when passing directly beneath a ceiling sodium lamp
  const rawLampWave = Math.max(0, (Math.cos(tunnelPhaseRad) + 1) * 0.5);
  const shapedSodiumPulse = Math.pow(rawLampWave, 2.2);
  const tunnelSodiumPulse = Number((tunnelWeight * shapedSodiumPulse).toFixed(3));

  // 3. Longitudinal sweep phase (-1 rear .. +1 front windshield) as light sources pass overhead
  let sweepPhase = 0;
  if (tunnelWeight > 0.25) {
    sweepPhase = Math.sin(tunnelPhaseRad);
  } else if (canopyWeight > 0.2) {
    sweepPhase = Math.sin(params.distanceM * 0.88 + params.timeSec * 1.4);
  }

  // 4. Overall external ambient factor reaching the cabin
  const openAmbient = 0.94 * weatherSunScale;
  const canopyAmbient = (0.44 + dappledFlicker * 0.52) * weatherSunScale;
  const grandstandAmbient = 0.62 * weatherSunScale;
  const tunnelAmbient = 0.14 + tunnelSodiumPulse * 0.26;

  let ambientFactor = openAmbient;
  if (tunnelWeight > 0.01) {
    ambientFactor = openAmbient * (1 - tunnelWeight) + tunnelAmbient * tunnelWeight;
  } else if (canopyWeight > 0.01) {
    ambientFactor = openAmbient * (1 - canopyWeight) + canopyAmbient * canopyWeight;
  } else if (grandstandWeight > 0.01) {
    ambientFactor = openAmbient * (1 - grandstandWeight) + grandstandAmbient * grandstandWeight;
  }
  ambientFactor = Number(Math.max(0.12, Math.min(1.0, ambientFactor)).toFixed(3));

  // 5. Automatic Vintage Instrument Dial & Halda Backlight Glow
  // Glows warmly in tunnels, heavy storm/rain, or deep tree shade
  const rawBacklight = Math.max(
    tunnelWeight * 0.96,
    canopyWeight * (1 - shapedCanopySunbeam) * 0.58,
    grandstandWeight * 0.42,
    rainDim * 1.35,
    0.18
  );
  const instrumentBacklight = Number(Math.max(0.18, Math.min(1.0, rawBacklight)).toFixed(3));

  // 6. Active Zone Classification & Dominant Interior Light Color/Intensity
  let zone: CockpitLightingZone = 'open_sky';
  let zoneLabel = 'OPEN SKY';
  let lightColorHex = 0xfff4d6;
  let lightIntensity = 0.95 * weatherSunScale;

  if (tunnelWeight >= 0.45) {
    zone = 'tunnel';
    zoneLabel = 'TUNNEL GALLERY';
    // Blend deep cool tunnel shadow with warm amber sodium lamp pulses
    lightColorHex = mixHexColors(0x334155, 0xff9e2c, 0.35 + tunnelSodiumPulse * 0.65);
    lightIntensity = 0.38 + tunnelSodiumPulse * 2.15;
  } else if (canopyWeight >= 0.35) {
    zone = 'tree_canopy';
    zoneLabel = 'TREE CANOPY';
    // Blend cool dappled leaf shade with golden sunbeams filtering through overhead branches
    lightColorHex = mixHexColors(0x64748b, 0xffe89e, shapedCanopySunbeam);
    lightIntensity = 0.42 + dappledFlicker * 1.85;
  } else if (grandstandWeight >= 0.4) {
    zone = 'grandstand_shadow';
    zoneLabel = 'GRANDSTAND SHADE';
    lightColorHex = 0x94a3b8;
    lightIntensity = 0.58;
  }

  return {
    zone,
    zoneLabel,
    ambientFactor,
    dappledFlicker,
    tunnelSodiumPulse,
    instrumentBacklight,
    sweepPhase: Number(sweepPhase.toFixed(3)),
    lightColorHex,
    lightIntensity: Number(lightIntensity.toFixed(3)),
  };
}
