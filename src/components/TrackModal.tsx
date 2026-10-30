import React from 'react';
import { CHAMPIONSHIP_LEVELS, TRACK_LIST } from '../game/tracks';
import {
  ChampionshipLevelSpec,
  TireCompound,
  TrackRubberPreset,
  TrackSpec,
  WeatherCondition,
} from '../game/types';
import {
  getChampionshipCrestPng,
  getTireCompoundBadgePng,
  getTrackPreviewPng,
} from '../game/assets';

interface TrackModalProps {
  selectedTrack: TrackSpec;
  activeLevel: ChampionshipLevelSpec;
  weatherCondition: WeatherCondition;
  trackRubberPreset: TrackRubberPreset;
  startingCompound: TireCompound;
  showRacingLine?: boolean;
  onSelectTrack: (track: TrackSpec) => void;
  onSelectLevel: (level: ChampionshipLevelSpec) => void;
  onCycleWeather: () => void;
  onCycleTrackRubberPreset: () => void;
  onCycleStartingCompound: () => void;
  onToggleRacingLine?: () => void;
  onClose: () => void;
}

const RUBBER_PRESET_LABELS: Record<TrackRubberPreset, string> = {
  progressive: 'Progressive (Builds Per Lap)',
  green: 'Green Track (Clean Asphalt)',
  rubbered: 'Rubbered-In Groove (+7% Grip)',
  saturated: 'Saturated Finale (+11% Groove / Heavy Marbles)',
};

const COMPOUND_LABELS: Record<TireCompound, string> = {
  soft: 'Soft Red (+10% Peak Grip · Fast Wear)',
  medium: 'Medium Amber (Balanced Grip & Endurance)',
  hard: 'Hard White (Endurance Compound · Low Wear)',
  wet: 'Wet Blue Rain Tread (High Wet Grip)',
};

export const TrackModal: React.FC<TrackModalProps> = ({
  selectedTrack,
  activeLevel,
  weatherCondition,
  trackRubberPreset,
  startingCompound,
  showRacingLine = true,
  onSelectTrack,
  onSelectLevel,
  onCycleWeather,
  onCycleTrackRubberPreset,
  onCycleStartingCompound,
  onToggleRacingLine,
  onClose,
}) => {
  const crestPng = getChampionshipCrestPng();
  const compoundBadgePng = getTireCompoundBadgePng(startingCompound);

  return (
    <div
      role="dialog"
      aria-label="Select Championship Circuit"
      className="animate-backdrop-in fixed inset-0 z-30 flex items-center justify-center p-4 md:p-8 pointer-events-auto"
      style={{ backgroundColor: 'rgba(9, 11, 16, 0.86)' }}
    >
      <div
        className="animate-modal-in w-full max-w-5xl rounded border border-[#f5f2eb]/20 p-6 space-y-6 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: '#0e131d' }}
      >
        <div className="flex items-center justify-between border-b border-[#f5f2eb]/15 pb-4">
          <div className="flex items-center gap-3.5">
            <img
              src={crestPng}
              alt="Mille Corse Championship Crest"
              referrerPolicy="no-referrer"
              className="w-11 h-11 object-contain shrink-0"
            />
            <div>
              <h2 className="font-display font-bold text-2xl text-[#f5f2eb] uppercase tracking-wide">
                Championship Levels, Mountain Circuits & Telemetry Maps
              </h2>
              <p className="text-xs text-[#94a3b8]">
                Select a 5-Stage Championship Career Level or choose any historic European circuit with 3D Braking/Acceleration Racing Line telemetry.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded bg-[#1e293b] hover:bg-[#334155] text-xs font-semibold text-[#f5f2eb] cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* 5-Stage Championship Career Levels Progression */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-display font-bold uppercase tracking-wider text-[#f59e0b]">
              1967 FIA Championship Career Stages (Levels 1 – 5)
            </span>
            <span className="text-[11px] text-[#94a3b8]">
              Selecting a stage configures circuit, weather & tire wear rules
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
            {CHAMPIONSHIP_LEVELS.map((lvl) => {
              const isLvlActive = lvl.level === activeLevel.level && selectedTrack.id === lvl.trackId;
              return (
                <button
                  key={lvl.level}
                  type="button"
                  onClick={() => {
                    onSelectLevel(lvl);
                    onClose();
                  }}
                  className={`text-left p-3 rounded border transition-colors cursor-pointer flex flex-col justify-between ${
                    isLvlActive
                      ? 'bg-[#1a2234] border-[#f59e0b]'
                      : 'bg-[#131926] border-[#f5f2eb]/12 hover:border-[#f5f2eb]/35'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono-tabular font-bold">
                      <span className="text-[#f59e0b]">LEVEL {lvl.level}</span>
                      <span className="text-[#94a3b8]">TARGET P{lvl.targetPosition}</span>
                    </div>
                    <div className="font-display font-bold text-sm text-[#f5f2eb] mt-0.5 leading-snug">
                      {lvl.title}
                    </div>
                    <div className="text-[10px] text-[#94a3b8] mt-0.5">{lvl.subtitle}</div>
                  </div>
                  <div className="pt-2 mt-2 border-t border-[#f5f2eb]/10 flex items-center justify-between text-[10px] font-mono-tabular text-[#cbd5e1]">
                    <span>Wear {lvl.tireWearMultiplier.toFixed(2)}x</span>
                    <span className="text-[#f59e0b]">+{lvl.rewardCredits} CR</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Session Surface, Weather, Tire Compound & Dynamic Racing Line Setup Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3.5 rounded bg-[#141b29] border border-[#f5f2eb]/12">
          <button
            type="button"
            onClick={onCycleStartingCompound}
            className="text-left p-2.5 rounded bg-[#0b0f17] hover:bg-[#1e293b] border border-[#f5f2eb]/10 transition-colors cursor-pointer flex items-center gap-3"
          >
            <img
              src={compoundBadgePng}
              alt={`${startingCompound} Tire Compound`}
              referrerPolicy="no-referrer"
              className="w-9 h-9 object-contain shrink-0"
            />
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                Starting Tire Compound
              </div>
              <div className="text-xs font-bold text-[#f59e0b] mt-0.5 truncate">
                {COMPOUND_LABELS[startingCompound]}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onCycleTrackRubberPreset}
            className="text-left p-2.5 rounded bg-[#0b0f17] hover:bg-[#1e293b] border border-[#f5f2eb]/10 transition-colors cursor-pointer"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
              Track Rubbering Line
            </div>
            <div className="text-xs font-bold text-[#f5f2eb] mt-0.5 truncate">
              {RUBBER_PRESET_LABELS[trackRubberPreset]}
            </div>
          </button>

          <button
            type="button"
            onClick={onCycleWeather}
            className="text-left p-2.5 rounded bg-[#0b0f17] hover:bg-[#1e293b] border border-[#f5f2eb]/10 transition-colors cursor-pointer"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
              Weather Condition
            </div>
            <div className="text-xs font-bold text-[#f5f2eb] uppercase mt-0.5">
              {weatherCondition}
            </div>
          </button>

          <button
            type="button"
            onClick={onToggleRacingLine}
            className="text-left p-2.5 rounded bg-[#0b0f17] hover:bg-[#1e293b] border border-[#f5f2eb]/10 transition-colors cursor-pointer"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
              3D Racing Line Guide [L]
            </div>
            <div className={`text-xs font-bold mt-0.5 ${showRacingLine ? 'text-[#34d399]' : 'text-[#94a3b8]'}`}>
              {showRacingLine ? 'Active · Brake/Coast/Accel' : 'Disabled · Pure Asphalt'}
            </div>
          </button>
        </div>

        {/* 5 Historic European Circuits with Color-Coded Sector Telemetry Maps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TRACK_LIST.map((track) => {
            const isSelected = track.id === selectedTrack.id;
            const previewPng = getTrackPreviewPng(track.id);

            const samples = track.samples;
            let minX = Infinity,
              maxX = -Infinity,
              minZ = Infinity,
              maxZ = -Infinity;
            for (const s of samples) {
              if (s.x < minX) minX = s.x;
              if (s.x > maxX) maxX = s.x;
              if (s.z < minZ) minZ = s.z;
              if (s.z > maxZ) maxZ = s.z;
            }
            const span = Math.max(maxX - minX, maxZ - minZ) + 42;
            const sc = 128 / span;
            const toX = (wx: number) => 80 - (wx - (minX + maxX) * 0.5) * sc;
            const toY = (wz: number) => 70 + (wz - (minZ + maxZ) * 0.5) * sc;

            const step = 4;
            const pts = samples.filter((_, idx) => idx % step === 0);
            const m = pts.length;
            const d =
              pts
                .map((s, idx) => `${idx === 0 ? 'M' : 'L'}${toX(s.x).toFixed(1)},${toY(s.z).toFixed(1)}`)
                .join(' ') + ' Z';

            const zoneSegs: Array<{ d: string; color: string }> = [];
            let brakingZonesCount = 0;
            let inBrake = false;
            for (let i = 0; i < m; i++) {
              const s0 = pts[i];
              const s1 = pts[(i + 1) % m];
              const s2 = pts[(i + 2) % m];
              const s3 = pts[(i + 3) % m];
              const x0 = toX(s0.x + s0.rx * s0.racingLineOffset);
              const y0 = toY(s0.z + s0.rz * s0.racingLineOffset);
              const x1 = toX(s1.x + s1.rx * s1.racingLineOffset);
              const y1 = toY(s1.z + s1.rz * s1.racingLineOffset);
              const currK = Math.abs(s0.curvature);
              const aheadK = Math.max(Math.abs(s1.curvature), Math.abs(s2.curvature), Math.abs(s3.curvature));
              let color = '#10b981';
              if (aheadK >= 0.0085 && aheadK > currK * 1.05) {
                color = '#ef4444';
                if (!inBrake) {
                  brakingZonesCount++;
                  inBrake = true;
                }
              } else {
                inBrake = false;
                if (currK >= 0.0075) {
                  color = '#f59e0b';
                }
              }
              zoneSegs.push({
                d: `M${x0.toFixed(1)},${y0.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)}`,
                color,
              });
            }

            return (
              <button
                key={track.id}
                type="button"
                onClick={() => {
                  onSelectTrack(track);
                  onClose();
                }}
                className={`text-left p-4 rounded border transition-colors flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-[#1a2234] border-[#d97706]'
                    : 'bg-[#131926] border-[#f5f2eb]/12 hover:border-[#f5f2eb]/35'
                }`}
              >
                <div className="space-y-3">
                  {/* Illustrated Key-Art PNG Card + Telemetry Sector Circuit Map Overlay */}
                  <div className="relative h-36 w-full rounded overflow-hidden border border-[#f5f2eb]/15 bg-[#090d14]">
                    <img
                      src={previewPng}
                      alt={track.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-[#090d14]/88 border border-[#f5f2eb]/20 text-[10px] font-mono-tabular font-semibold text-[#f59e0b]">
                      +{track.elevationGainM}m · {Math.max(4, brakingZonesCount)} Braking Zones
                    </div>
                    <div className="absolute bottom-1.5 right-1.5 w-24 h-20 rounded bg-[#090d14]/92 border border-[#f5f2eb]/25 p-1">
                      <svg viewBox="0 0 160 140" className="w-full h-full">
                        <path
                          d={d}
                          fill="none"
                          stroke="#1e293b"
                          strokeWidth="8.5"
                          strokeLinejoin="round"
                        />
                        {zoneSegs.map((seg, idx) => (
                          <path
                            key={idx}
                            d={seg.d}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth="3.4"
                            strokeLinecap="round"
                          />
                        ))}
                        <circle cx={toX(0)} cy={toY(0)} r="4" fill="#f8fafc" stroke="#09090b" strokeWidth="1.4" />
                      </svg>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-[#f59e0b] font-semibold">
                      {track.country} · {track.difficulty}
                    </div>
                    <h3 className="font-display font-bold text-lg text-[#f5f2eb] mt-0.5">
                      {track.name}
                    </h3>
                  </div>

                  <p className="text-xs text-[#cbd5e1] leading-relaxed">{track.description}</p>
                </div>

                <div className="pt-3 mt-4 border-t border-[#f5f2eb]/10 flex items-center justify-between text-xs font-mono-tabular text-[#94a3b8]">
                  <span>{track.lengthKm} km</span>
                  <span>·</span>
                  <span>{track.laps} Laps</span>
                  <span>·</span>
                  <span>Abrasion {track.abrasiveness.toFixed(2)}x</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
