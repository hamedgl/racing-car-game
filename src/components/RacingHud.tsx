import React, { useMemo } from 'react';
import {
  CameraMode,
  ChampionshipLevelSpec,
  ControlInput,
  CornerTireState,
  HandlingMode,
  RemoteRacerTelemetry,
  TireCompound,
  TrackSpec,
} from '../game/types';
import { LiveHudSnapshot } from './RaceCanvas';
import { formatLapTime } from '../game/format';
import { getTachometerDialPng } from '../game/assets';

interface RacingHudProps {
  hud: LiveHudSnapshot;
  track: TrackSpec;
  activeLevel: ChampionshipLevelSpec;
  cameraMode: CameraMode;
  handlingMode: HandlingMode;
  isMuted: boolean;
  nextPitCompound: TireCompound;
  pitRequestArmed: boolean;
  remoteRacers: RemoteRacerTelemetry[];
  touchInputRef: React.MutableRefObject<ControlInput>;
  onCycleCamera: () => void;
  onToggleHandlingMode: () => void;
  onCycleNextPitCompound: () => void;
  onTogglePitRequest: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
}

const CAMERA_LABELS: Record<CameraMode, string> = {
  chase: 'CHASE',
  chase_far: 'FAR',
  bonnet: 'HOOD',
  cockpit: 'COCKPIT',
  bumper: 'BUMPER',
  tv_side: 'ACTION',
};

const COMPOUND_BADGE: Record<
  TireCompound,
  { short: string; label: string; bg: string; border: string; text: string }
> = {
  soft: {
    short: 'S',
    label: 'SOFT',
    bg: 'rgba(239, 68, 68, 0.2)',
    border: '#ef4444',
    text: '#fca5a5',
  },
  medium: {
    short: 'M',
    label: 'MEDIUM',
    bg: 'rgba(245, 158, 11, 0.2)',
    border: '#f59e0b',
    text: '#fcd34d',
  },
  hard: {
    short: 'H',
    label: 'HARD',
    bg: 'rgba(248, 250, 252, 0.16)',
    border: '#f8fafc',
    text: '#f8fafc',
  },
  wet: {
    short: 'W',
    label: 'WET',
    bg: 'rgba(56, 189, 248, 0.2)',
    border: '#38bdf8',
    text: '#7dd3fc',
  },
};

function getTempColor(tempC: number): string {
  if (tempC > 106) return '#ef4444'; // Overheating / blistering
  if (tempC < 66) return '#38bdf8'; // Cold
  return '#22c55e'; // Optimal operating window
}

function getTreadBarColor(tread: number): string {
  if (tread < 0.35) return '#ef4444';
  if (tread < 0.65) return '#f59e0b';
  return '#22c55e';
}

export const RacingHud: React.FC<RacingHudProps> = ({
  hud,
  track,
  activeLevel,
  cameraMode,
  handlingMode,
  isMuted,
  nextPitCompound,
  pitRequestArmed,
  remoteRacers,
  touchInputRef,
  onCycleCamera,
  onToggleHandlingMode,
  onCycleNextPitCompound,
  onTogglePitRequest,
  onToggleMute,
  onPause,
  onRestart,
}) => {
  const tachDialPng = useMemo(() => getTachometerDialPng(), []);

  const samples = track.samples;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const s of samples) {
    if (s.x < minX) minX = s.x;
    if (s.x > maxX) maxX = s.x;
    if (s.z < minZ) minZ = s.z;
    if (s.z > maxZ) maxZ = s.z;
  }
  const pad = 28;
  const spanX = Math.max(1, maxX - minX + pad * 2);
  const spanZ = Math.max(1, maxZ - minZ + pad * 2);
  const scale = 112 / Math.max(spanX, spanZ);

  const toMapX = (wx: number) => 64 - (wx - (minX + maxX) * 0.5) * scale;
  const toMapY = (wz: number) => 64 + (wz - (minZ + maxZ) * 0.5) * scale;

  const trackPathD =
    samples
      .filter((_, idx) => idx % 4 === 0)
      .map((s, idx) => `${idx === 0 ? 'M' : 'L'}${toMapX(s.x).toFixed(1)},${toMapY(s.z).toFixed(1)}`)
      .join(' ') + ' Z';

  const racingLinePathD =
    samples
      .filter((_, idx) => idx % 4 === 0)
      .map((s, idx) => {
        const lx = s.x + s.rx * s.racingLineOffset;
        const lz = s.z + s.rz * s.racingLineOffset;
        return `${idx === 0 ? 'M' : 'L'}${toMapX(lx).toFixed(1)},${toMapY(lz).toFixed(1)}`;
      })
      .join(' ') + ' Z';

  const rpmRatio = Math.max(0, Math.min(1, hud.rpm / 9000));
  const needleDeg = -130 + rpmRatio * 260;
  const isRedline = hud.rpm >= 7200;

  const [visualSteer, setVisualSteer] = React.useState(0);
  const [autoGas, setAutoGas] = React.useState(false);

  const setTouchField = (
    field: 'forward' | 'backward' | 'left' | 'right' | 'handbrake' | 'nitro',
    val: boolean
  ) => {
    touchInputRef.current[field] = val;
    if (field === 'nitro' && val) {
      touchInputRef.current.forward = true;
    }
    if (field === 'backward' && val) {
      touchInputRef.current.forward = false;
    } else if (field === 'backward' && !val && autoGas) {
      touchInputRef.current.forward = true;
    }
  };

  const toggleAutoGas = () => {
    setAutoGas((prev) => {
      const next = !prev;
      touchInputRef.current.forward = next;
      return next;
    });
  };

  const handleSteerPadPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / Math.max(1, rect.width);
    const centered = Math.max(-1, Math.min(1, (relX - 0.5) * 2.2));
    const curved = Math.sign(centered) * Math.pow(Math.abs(centered), 1.2);
    touchInputRef.current.steerAxis = -curved;
    touchInputRef.current.left = curved < -0.15;
    touchInputRef.current.right = curved > 0.15;
    setVisualSteer(curved);
  };

  const releaseSteerPad = () => {
    touchInputRef.current.steerAxis = 0;
    touchInputRef.current.left = false;
    touchInputRef.current.right = false;
    setVisualSteer(0);
  };

  const weather = hud.weather;
  const tires = hud.tires;
  const activeCompoundMeta = COMPOUND_BADGE[tires.compound];
  const nextCompoundMeta = COMPOUND_BADGE[nextPitCompound];
  const avgTreadPct = Math.round(tires.avgTreadLife * 100);
  const minIntegrityPct = Math.round(tires.minIntegrity * 100);
  const anyPuncture = tires.minIntegrity < 0.25;
  const needsPitWarning = avgTreadPct < 38 || minIntegrityPct < 45 || anyPuncture;

  const renderCornerWidget = (label: string, corner: CornerTireState) => {
    const treadPct = Math.round(corner.treadLife * 100);
    const intPct = Math.round(corner.structuralIntegrity * 100);
    const tempVal = Math.round(corner.temperature);
    const tempColor = getTempColor(corner.temperature);
    const treadColor = getTreadBarColor(corner.treadLife);
    const isCritical = corner.structuralIntegrity < 0.35 || corner.treadLife < 0.2;

    return (
      <div
        key={label}
        className={`p-1.5 rounded border ${
          isCritical
            ? 'border-[#ef4444] bg-[#450a0a]/60 animate-pulse'
            : 'border-[#f5f2eb]/12 bg-[#090d16]/90'
        }`}
      >
        <div className="flex items-center justify-between text-[10px] font-mono-tabular font-bold">
          <span className="text-[#94a3b8]">{label}</span>
          <span style={{ color: tempColor }}>{tempVal}°C</span>
        </div>
        {/* Tread life bar */}
        <div className="w-full h-1.5 bg-[#1e293b] rounded overflow-hidden mt-1">
          <div
            className="h-full transition-all duration-150"
            style={{ width: `${treadPct}%`, backgroundColor: treadColor }}
          />
        </div>
        <div className="flex items-center justify-between text-[9px] font-mono-tabular mt-0.5">
          <span className="text-[#f5f2eb] font-semibold">{treadPct}%</span>
          <span className={intPct < 55 ? 'text-[#ef4444]' : 'text-[#64748b]'}>
            {isCritical ? 'WARN' : `S:${intPct}%`}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 md:p-6 overflow-hidden">
      {/* TOP ROW: Clean Broadcast Race Timing Plaque (Left), Center Notifications, & Camera / Minimap Radar (Right) */}
      <div className="flex items-start justify-between gap-2 w-full">
        {/* CLUSTER 1: Clean Motorsport Timing, Level & Track Groove Plaque */}
        <div
          className="px-3 py-2 md:px-4 md:py-3 rounded border border-[#f5f2eb]/15 space-y-1.5"
          style={{ backgroundColor: 'rgba(11, 15, 23, 0.88)' }}
        >
          <div className="flex items-baseline gap-3 sm:gap-4 md:gap-5">
            <div>
              <div className="text-[9px] md:text-[10px] font-semibold tracking-widest uppercase text-[#94a3b8]">
                POS
              </div>
              <div className="font-display font-bold text-lg sm:text-xl md:text-3xl text-[#f5f2eb] font-mono-tabular hud-stroke leading-none whitespace-nowrap">
                {hud.position}
                <span className="text-xs md:text-base text-[#64748b]">/{hud.totalCars}</span>
              </div>
            </div>

            <div className="h-5 md:h-7 w-px bg-[#f5f2eb]/15" />

            <div>
              <div className="text-[9px] md:text-[10px] font-semibold tracking-widest uppercase text-[#94a3b8]">
                LAP
              </div>
              <div className="font-display font-bold text-lg sm:text-xl md:text-3xl text-[#f59e0b] font-mono-tabular hud-stroke leading-none whitespace-nowrap">
                {hud.lap}
                <span className="text-xs md:text-base text-[#64748b]">/{hud.totalLaps}</span>
              </div>
            </div>

            <div className="h-5 md:h-7 w-px bg-[#f5f2eb]/15" />

            <div>
              <div className="text-[9px] md:text-[10px] font-semibold tracking-widest uppercase text-[#94a3b8]">
                LAP TIME
              </div>
              <div className="font-mono-tabular font-bold text-xs sm:text-sm md:text-xl text-[#f5f2eb] leading-tight whitespace-nowrap">
                {formatLapTime(hud.currentLapTimeMs)}
              </div>
              <div className="text-[9px] sm:text-[10px] md:text-[11px] font-mono-tabular text-[#94a3b8] whitespace-nowrap">
                BEST {formatLapTime(hud.bestLapTimeMs)}
              </div>
            </div>
          </div>

          {/* Standings list on Desktop/Tablet with tire compound indicator */}
          <div className="hidden sm:flex items-center gap-3 pt-1 border-t border-[#f5f2eb]/10 text-[11px] text-[#cbd5e1]">
            {hud.standings.map((r) => (
              <span
                key={r.id}
                className={
                  r.isPlayer
                    ? 'text-[#f59e0b] font-semibold whitespace-nowrap'
                    : 'text-[#94a3b8] whitespace-nowrap'
                }
              >
                {r.position}. {r.driverName}{' '}
                <span className="text-[9px] font-mono-tabular opacity-80">
                  [{COMPOUND_BADGE[r.compound].short}]
                </span>
              </span>
            ))}
          </div>

          {/* Subtle Integrated Track Groove, Gravity Load G & Asphalt Status Line */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[10px] font-semibold tracking-wider uppercase whitespace-nowrap">
            <span className="text-[#f59e0b]">LVL {activeLevel.level}</span>
            <span className="text-[#475569]">·</span>
            <span
              className={
                (hud.verticalLoadG ?? 1) > 1.15
                  ? 'text-[#38bdf8]'
                  : (hud.verticalLoadG ?? 1) < 0.88
                  ? 'text-[#f59e0b]'
                  : 'text-[#cbd5e1]'
              }
            >
              {(hud.verticalLoadG ?? 1.0).toFixed(2)}G LOAD
            </span>
            <span className="text-[#475569]">·</span>
            <span className="text-[#94a3b8]">
              {weather.wetness > 0.4 ? '🌧️ WET' : weather.activeType === 'overcast' ? '☁️ DRY' : '☀️ DRY'}
            </span>
            <span className="text-[#475569]">·</span>
            {hud.isOffTrack ? (
              <span className="text-[#ef4444]">OFF-TRACK VERGE</span>
            ) : hud.onKerb ? (
              <span className="text-[#f59e0b]">APEX KERB RUMBLE</span>
            ) : hud.onMarbles ? (
              <span className="text-[#f59e0b]">TIRE MARBLES</span>
            ) : hud.onRacingLine ? (
              <span className="text-[#22c55e]">
                RUBBER GROOVE ({Math.round((hud.asphaltGripFactor ?? 1.08) * 100)}%)
              </span>
            ) : (
              <span className="text-[#cbd5e1]">
                TARMAC {Math.round((hud.asphaltGripFactor ?? 1.0) * 100)}%
              </span>
            )}
            {hud.isBoosting && (
              <>
                <span className="text-[#475569]">·</span>
                <span className="text-[#38bdf8]">⚡ NITRO</span>
              </>
            )}
          </div>
        </div>

        {/* CENTER PIT STOP / DRIFT NOTIFICATION BANNERS */}
        <div className="flex flex-col items-center gap-1.5 self-start mt-1">
          {tires.pitStopActive ? (
            <div className="px-4 py-2 rounded border border-[#22c55e] bg-[#0b0f17]/95 text-center shadow-lg min-w-[220px]">
              <div className="text-[10px] font-bold tracking-widest text-[#4ade80] uppercase">
                PIT CREW SERVICE · REFITTING {nextCompoundMeta.label} TIRES
              </div>
              <div className="w-full h-2 bg-[#1e293b] rounded overflow-hidden mt-1.5 border border-[#22c55e]/40">
                <div
                  className="h-full bg-[#22c55e] transition-all duration-75"
                  style={{
                    width: `${Math.min(100, Math.max(0, (1 - tires.pitStopTimer / 2.0) * 100))}%`,
                  }}
                />
              </div>
              <div className="text-[10px] font-mono-tabular text-[#f5f2eb] mt-1">
                {tires.pitStopTimer.toFixed(1)}s REMAINING
              </div>
            </div>
          ) : tires.inPitZone ? (
            <div className="px-3.5 py-1.5 rounded border border-[#f59e0b] bg-[#0b0f17]/92 text-center shadow-lg">
              <div className="text-[10px] font-bold tracking-widest text-[#f59e0b] uppercase">
                PIT LANE ZONE · HOLD [B] OR SLOW BELOW 65 KM/H ON RIGHT APRON
              </div>
            </div>
          ) : needsPitWarning ? (
            <div className="px-3.5 py-1.5 rounded border border-[#ef4444]/80 bg-[#0b0f17]/92 text-center shadow-lg">
              <div className="text-[10px] font-bold tracking-widest text-[#f87171] uppercase">
                {anyPuncture
                  ? '⚠️ TIRE CARCASS FAILURE — BOX THIS LAP [B]'
                  : '⚠️ TIRES DEGRADED — ARM PIT STOP [B]'}
              </div>
            </div>
          ) : null}

          {hud.isDrifting && !tires.pitStopActive && (
            <div className="px-3.5 py-1.5 rounded border border-[#f59e0b]/50 bg-[#0b0f17]/90 text-center shadow-lg">
              <div className="text-[9px] md:text-[10px] font-bold tracking-widest text-[#f59e0b] uppercase">
                FOUR-WHEEL DRIFT
              </div>
              <div className="text-xs md:text-lg font-display font-extrabold text-[#f5f2eb] font-mono-tabular">
                +{hud.driftScore} PTS
              </div>
            </div>
          )}
        </div>

        {/* CLUSTER 2: Top-Right Camera Switcher, Utility Controls & Circuit Radar */}
        <div className="flex flex-col items-end gap-1.5 md:gap-2 shrink-0">
          <div className="flex items-center gap-1 md:gap-1.5 pointer-events-auto">
            {/* Handling Assistance Mode Toggle Button */}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Toggle Handling Mode"
              title={`Toggle Handling Assist [H]: ${
                handlingMode === 'pro_assisted' ? 'Pro Assisted (Easier Cornering & Counter-Steer)' : 'Pure Historic 1967'
              }`}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleHandlingMode();
              }}
              className={`h-8 md:h-9 px-2 md:px-2.5 flex items-center gap-1.5 rounded border transition-colors cursor-pointer ${
                handlingMode === 'pro_assisted'
                  ? 'border-[#22c55e]/50 bg-[#0b0f17]/90 hover:bg-[#14532d]/50 text-[#4ade80]'
                  : 'border-[#f59e0b]/50 bg-[#0b0f17]/90 hover:bg-[#78350f]/50 text-[#fcd34d]'
              }`}
            >
              <span className="text-[10px] md:text-[11px] font-mono-tabular font-bold tracking-wider uppercase">
                {handlingMode === 'pro_assisted' ? 'ASSIST: PRO' : 'PURE 67'}
              </span>
            </button>

            {/* Multi-Angle Camera Switcher Button */}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Cycle Camera View"
              title={`Switch Camera Angle: ${CAMERA_LABELS[cameraMode]} [C]`}
              onClick={(e) => {
                e.currentTarget.blur();
                onCycleCamera();
              }}
              className="h-8 md:h-9 px-2 md:px-2.5 flex items-center gap-1.5 rounded border border-[#f5f2eb]/20 bg-[#0b0f17]/90 hover:bg-[#1e293b] text-[#f5f2eb] transition-colors cursor-pointer"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#f59e0b]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span className="text-[10px] md:text-[11px] font-mono-tabular font-bold tracking-wider uppercase">
                {CAMERA_LABELS[cameraMode]}
              </span>
            </button>

            {/* Audio mute */}
            <button
              type="button"
              tabIndex={-1}
              aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              title={isMuted ? 'Unmute Audio [M]' : 'Mute Audio [M]'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded border border-[#f5f2eb]/20 bg-[#0b0f17]/90 hover:bg-[#1e293b] text-[#f5f2eb] transition-colors cursor-pointer"
            >
              {isMuted ? (
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              )}
            </button>

            {/* Restart race */}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Restart Race"
              title="Restart Circuit [R]"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded border border-[#f5f2eb]/20 bg-[#0b0f17]/90 hover:bg-[#1e293b] text-[#f5f2eb] transition-colors cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>

            {/* Pause & Race Director Settings */}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Pause Race"
              title="Pause & Race Settings [P / Esc]"
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded border border-[#f5f2eb]/20 bg-[#0b0f17]/90 hover:bg-[#1e293b] text-[#f5f2eb] transition-colors cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            </button>
          </div>

          {/* Circuit Minimap showing optimal rubbered racing groove & Pit Stall */}
          <div
            className="w-20 h-20 md:w-32 md:h-32 rounded border border-[#f5f2eb]/15 p-1 md:p-1.5 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(11, 15, 23, 0.88)' }}
          >
            <svg viewBox="0 0 128 128" className="w-full h-full">
              <path d={trackPathD} fill="none" stroke="#475569" strokeWidth="5.5" strokeLinejoin="round" />
              <path
                d={racingLinePathD}
                fill="none"
                stroke="#0f172a"
                strokeWidth="2.2"
                strokeDasharray="3 2"
                strokeLinejoin="round"
              />
              <circle cx={toMapX(0)} cy={toMapY(0)} r="3.2" fill="#f8fafc" stroke="#09090b" strokeWidth="1" />

              {remoteRacers
                .filter((r) => r.trackId === track.id)
                .map((r) => (
                  <circle key={r.id} cx={toMapX(r.x)} cy={toMapY(r.z)} r="3" fill="#38bdf8" />
                ))}

              {hud.standings.map((v) => (
                <circle
                  key={v.id}
                  cx={toMapX(v.x)}
                  cy={toMapY(v.z)}
                  r={v.isPlayer ? 4.5 : 3.5}
                  fill={v.isPlayer ? '#f59e0b' : v.color}
                  stroke="#09090b"
                  strokeWidth="1.2"
                />
              ))}
            </svg>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: Tire & Pit Strategy Cluster (Desktop Left), Mobile Controls, & Veglia Tachometer (Desktop Right) */}
      <div className="flex flex-col md:flex-row items-stretch md:items-end justify-between gap-2 w-full">
        {/* DESKTOP: 4-Corner Dynamic Tire Telemetry & Pit Stop Strategy Module (Docks right in Cockpit mode so 3D wheel & gauges are 100% clear) */}
        <div
          data-testid="tire-telemetry-panel"
          className={`hidden md:flex flex-col gap-2 px-3.5 py-3 rounded border border-[#f5f2eb]/15 w-72 pointer-events-auto ${
            cameraMode === 'cockpit' ? 'ml-auto' : ''
          }`}
          style={{ backgroundColor: 'rgba(11, 15, 23, 0.90)' }}
        >
          <div className="flex items-center justify-between border-b border-[#f5f2eb]/10 pb-1.5">
            <div className="flex items-center gap-2">
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-display font-bold tracking-wider uppercase border"
                style={{
                  backgroundColor: activeCompoundMeta.bg,
                  borderColor: activeCompoundMeta.border,
                  color: activeCompoundMeta.text,
                }}
              >
                {activeCompoundMeta.label}
              </span>
              <span className="text-[11px] font-mono-tabular font-semibold text-[#cbd5e1]">
                GRIP {Math.round(tires.gripMultiplier * 100)}%
              </span>
            </div>
            <span className="text-[10px] font-mono-tabular text-[#94a3b8]">
              PITS: {tires.pitStopsCompleted}
            </span>
          </div>

          {/* 4-Corner Tire Grid (FL, FR, RL, RR) */}
          <div className="grid grid-cols-2 gap-1.5">
            {renderCornerWidget('FL', tires.fl)}
            {renderCornerWidget('FR', tires.fr)}
            {renderCornerWidget('RL', tires.rl)}
            {renderCornerWidget('RR', tires.rr)}
          </div>

          {/* Interactive Pit Strategy Controls */}
          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onCycleNextPitCompound();
              }}
              className="px-2 py-1.5 rounded border border-[#f5f2eb]/15 bg-[#141c2b] hover:bg-[#1e293b] text-left transition-colors cursor-pointer"
            >
              <div className="text-[9px] uppercase tracking-wider text-[#94a3b8]">NEXT TIRE [T]</div>
              <div
                className="text-[11px] font-display font-bold uppercase truncate"
                style={{ color: nextCompoundMeta.text }}
              >
                {nextCompoundMeta.label}
              </div>
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onTogglePitRequest();
              }}
              className={`px-2 py-1.5 rounded border text-left transition-colors cursor-pointer ${
                pitRequestArmed || tires.pitRequest
                  ? 'border-[#22c55e] bg-[#14532d]/60 text-[#4ade80]'
                  : tires.inPitZone
                  ? 'border-[#f59e0b] bg-[#78350f]/50 text-[#fcd34d]'
                  : 'border-[#f5f2eb]/15 bg-[#141c2b] hover:bg-[#1e293b] text-[#f5f2eb]'
              }`}
            >
              <div className="text-[9px] uppercase tracking-wider text-[#94a3b8]">PIT BOX [B]</div>
              <div className="text-[11px] font-display font-bold uppercase truncate">
                {tires.pitStopActive
                  ? 'SERVICING...'
                  : pitRequestArmed || tires.pitRequest
                  ? 'BOX ARMED'
                  : 'REQUEST PIT'}
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Compact Telemetry Strip (with Tire % & Pit Button) */}
        <div className="flex md:hidden items-center justify-between px-2.5 py-1.5 rounded border border-[#f5f2eb]/15 bg-[#0b0f17]/92 pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <span className="font-mono-tabular font-bold text-sm text-[#f59e0b]">G{hud.gear}</span>
            <button
              type="button"
              onClick={onCycleNextPitCompound}
              className="px-1.5 py-0.5 rounded text-[9px] font-mono-tabular font-bold border"
              style={{
                backgroundColor: activeCompoundMeta.bg,
                borderColor: activeCompoundMeta.border,
                color: activeCompoundMeta.text,
              }}
            >
              {activeCompoundMeta.short} {avgTreadPct}%
            </button>
            <button
              type="button"
              onClick={onTogglePitRequest}
              className={`px-1.5 py-0.5 rounded text-[9px] font-display font-bold uppercase border ${
                pitRequestArmed || tires.pitRequest
                  ? 'bg-[#22c55e]/25 border-[#22c55e] text-[#4ade80]'
                  : 'bg-[#1e293b] border-[#f5f2eb]/20 text-[#cbd5e1]'
              }`}
            >
              {pitRequestArmed || tires.pitRequest ? 'PIT: ON' : 'PIT'}
            </button>
            <button
              type="button"
              onClick={toggleAutoGas}
              className={`px-1.5 py-0.5 rounded text-[9px] font-display font-bold uppercase tracking-wider border transition-colors whitespace-nowrap ${
                autoGas
                  ? 'bg-[#22c55e]/25 border-[#22c55e] text-[#4ade80]'
                  : 'bg-[#1e293b] border-[#f5f2eb]/20 text-[#94a3b8]'
              }`}
            >
              {autoGas ? 'CRUISE: ON' : 'CRUISE'}
            </button>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-display font-bold text-2xl text-[#f5f2eb] font-mono-tabular">
              {Math.round(hud.speedKmh)}
            </span>
            <span className="text-[9px] font-semibold uppercase text-[#94a3b8]">KM/H</span>
          </div>
        </div>

        {/* Mobile Touch Steering Pad & Ergonomic Pedals */}
        <div className="flex md:hidden items-end justify-between gap-2 pointer-events-auto w-full touch-none select-none">
          <div
            role="slider"
            aria-label="Touch Analog Steering Pad"
            aria-valuemin={-100}
            aria-valuemax={100}
            aria-valuenow={Math.round(visualSteer * 100)}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              handleSteerPadPointer(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons > 0 || e.pressure > 0) {
                handleSteerPadPointer(e);
              }
            }}
            onPointerUp={releaseSteerPad}
            onPointerCancel={releaseSteerPad}
            className="relative w-40 h-16 rounded-lg border border-[#f5f2eb]/25 bg-[#0b0f17]/95 flex flex-col justify-between p-2 overflow-hidden cursor-pointer touch-none select-none shadow-lg"
          >
            <div className="flex items-center justify-between gap-1 text-[#f5f2eb] font-display font-bold text-xs whitespace-nowrap pointer-events-none">
              <span className={visualSteer < -0.15 ? 'text-[#f59e0b]' : 'text-[#cbd5e1]'}>◀ LEFT</span>
              <span className="text-[8px] uppercase tracking-wider text-[#94a3b8]">STEER</span>
              <span className={visualSteer > 0.15 ? 'text-[#f59e0b]' : 'text-[#cbd5e1]'}>RIGHT ▶</span>
            </div>

            <div className="relative w-full h-3 rounded-full bg-[#1e293b] border border-[#f5f2eb]/10 pointer-events-none">
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 bg-[#f5f2eb]/30" />
              <div
                className="absolute top-0.5 bottom-0.5 w-6 -ml-3 rounded-full bg-[#f59e0b] shadow transition-transform duration-75"
                style={{
                  left: `${50 + visualSteer * 42}%`,
                }}
              />
            </div>
          </div>

          <div className="flex items-end gap-1 touch-none select-none">
            <button
              type="button"
              aria-label="Brake Pedal"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setTouchField('backward', true);
              }}
              onPointerUp={() => setTouchField('backward', false)}
              onPointerCancel={() => setTouchField('backward', false)}
              className="w-11 h-14 rounded-lg border border-[#ef4444]/50 bg-[#0b0f17]/95 active:bg-[#ef4444] text-[#f5f2eb] font-display font-bold text-[10px] uppercase touch-none select-none shadow-lg"
            >
              BRK
            </button>
            <button
              type="button"
              aria-label="Handbrake"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setTouchField('handbrake', true);
              }}
              onPointerUp={() => setTouchField('handbrake', false)}
              onPointerCancel={() => setTouchField('handbrake', false)}
              className="w-12 h-14 rounded-lg border border-[#f59e0b]/50 bg-[#0b0f17]/95 active:bg-[#f59e0b] text-[#f5f2eb] font-display font-bold text-[10px] uppercase touch-none select-none shadow-lg"
            >
              DRIFT
            </button>
            <button
              type="button"
              aria-label="Nitro Boost"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setTouchField('nitro', true);
              }}
              onPointerUp={() => {
                setTouchField('nitro', false);
                if (!autoGas) setTouchField('forward', false);
              }}
              onPointerCancel={() => {
                setTouchField('nitro', false);
                if (!autoGas) setTouchField('forward', false);
              }}
              className={`w-12 h-14 rounded-lg border font-display font-bold text-[10px] uppercase touch-none select-none shadow-lg ${
                hud.isBoosting
                  ? 'border-[#38bdf8] bg-[#0284c7] text-[#f8fafc]'
                  : 'border-[#38bdf8]/60 bg-[#0c1928]/95 active:bg-[#0284c7] text-[#38bdf8]'
              }`}
            >
              NITRO
            </button>
            <button
              type="button"
              aria-label="Throttle Pedal"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setTouchField('forward', true);
              }}
              onPointerUp={() => {
                if (!autoGas) setTouchField('forward', false);
              }}
              onPointerCancel={() => {
                if (!autoGas) setTouchField('forward', false);
              }}
              className={`w-14 h-16 rounded-lg border font-display font-bold text-xs uppercase touch-none select-none shadow-lg ${
                autoGas
                  ? 'border-[#22c55e] bg-[#15803d]/80 text-[#f5f2eb]'
                  : 'border-[#22c55e]/50 bg-[#0b0f17]/95 active:bg-[#22c55e] text-[#f5f2eb]'
              }`}
            >
              GAS
            </button>
          </div>
        </div>

        {/* Desktop Instrument Cluster: Full Veglia Dial in External Views, Sleek Chronometer Telemetry in 3D Cockpit View */}
        <div
          className={`hidden md:flex items-end gap-3 ${
            cameraMode === 'cockpit' ? '' : 'ml-auto'
          }`}
        >
          <div
            data-testid="speedometer-cluster"
            className="flex items-center gap-4 px-4 py-3 rounded border border-[#f5f2eb]/15"
            style={{ backgroundColor: 'rgba(11, 15, 23, 0.90)' }}
          >
            {cameraMode !== 'cockpit' && (
              <div className="relative w-28 h-28 shrink-0">
                <img
                  src={tachDialPng}
                  alt="Veglia Borletti Tachometer"
                  className="w-full h-full object-contain select-none pointer-events-none"
                />
                <svg viewBox="0 0 110 110" className="absolute inset-0 w-full h-full">
                  <text
                    x="55"
                    y="78"
                    fill={isRedline ? '#ef4444' : '#f59e0b'}
                    fontSize="16"
                    fontWeight="bold"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    G{hud.gear}
                  </text>
                  {hud.handbrake && (
                    <text x="55" y="91" fill="#ef4444" fontSize="7.5" fontWeight="bold" textAnchor="middle">
                      BRAKE
                    </text>
                  )}
                  <g transform={`rotate(${needleDeg.toFixed(1)} 55 55)`}>
                    <line
                      x1="55"
                      y1="62"
                      x2="55"
                      y2="16"
                      stroke="#f59e0b"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                    />
                    <circle cx="55" cy="55" r="5.5" fill="#e2e8f0" stroke="#0f172a" strokeWidth="1.5" />
                  </g>
                </svg>
              </div>
            )}

            <div className="flex flex-col items-end min-w-[132px]">
              <div className="flex items-center justify-between w-full gap-2">
                <span
                  className={`px-1.5 py-0.5 rounded text-xs font-mono-tabular font-bold border ${
                    isRedline
                      ? 'border-[#ef4444] bg-[#ef4444]/20 text-[#fca5a5] animate-pulse'
                      : 'border-[#f59e0b]/40 bg-[#f59e0b]/15 text-[#f59e0b]'
                  }`}
                >
                  GEAR {hud.gear}
                </span>
                <span className="text-[10px] font-semibold tracking-widest uppercase text-[#94a3b8]">
                  KM/H
                </span>
              </div>
              <div className="font-display font-extrabold text-4xl text-[#f5f2eb] font-mono-tabular leading-none hud-stroke mt-1">
                {Math.round(hud.speedKmh)}
              </div>
              <div className="flex items-center justify-between w-full text-xs font-mono-tabular text-[#94a3b8] mt-1">
                <span>{(hud.verticalLoadG ?? 1.0).toFixed(2)}G</span>
                <span>{Math.round(hud.rpm)} RPM</span>
              </div>

              {/* Nitro Overboost Bar */}
              <div className="w-full mt-2 pt-1.5 border-t border-[#f5f2eb]/10">
                <div className="flex items-center justify-between text-[10px] font-mono-tabular font-bold">
                  <span className={hud.isBoosting ? 'text-[#38bdf8] animate-pulse' : 'text-[#7dd3fc]'}>
                    ⚡ N2O [SHIFT]
                  </span>
                  <span className="text-[#f5f2eb]">{hud.nitroCharge}%</span>
                </div>
                <div className="w-full h-2 bg-[#0f172a] rounded overflow-hidden mt-1 border border-[#38bdf8]/30">
                  <div
                    className="h-full transition-all duration-150"
                    style={{
                      width: `${hud.nitroCharge}%`,
                      backgroundColor: hud.isBoosting ? '#38bdf8' : '#0284c7',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
