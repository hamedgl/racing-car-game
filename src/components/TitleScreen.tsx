import React, { useMemo } from 'react';
import {
  CarLivery,
  ChampionshipLevelSpec,
  ClassicCarSpec,
  EffectiveCarStats,
  TireCompound,
  TrackSpec,
} from '../game/types';
import {
  getCarBlueprintPng,
  getChampionshipCrestPng,
  getMarqueCrestPng,
  getTireCompoundBadgePng,
} from '../game/assets';

interface TitleScreenProps {
  selectedCar: ClassicCarSpec;
  livery: CarLivery;
  effectiveStats: EffectiveCarStats;
  selectedTrack: TrackSpec;
  activeLevel: ChampionshipLevelSpec;
  startingCompound: TireCompound;
  credits: number;
  onlineCount: number;
  onStartRace: () => void;
  onCycleCar: () => void;
  onOpenGarage: () => void;
  onOpenTracks: () => void;
  onOpenLeaderboards: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  selectedCar,
  livery,
  effectiveStats,
  selectedTrack,
  activeLevel,
  startingCompound,
  credits,
  onlineCount,
  onStartRace,
  onCycleCar,
  onOpenGarage,
  onOpenTracks,
  onOpenLeaderboards,
}) => {
  const crestPng = useMemo(() => getChampionshipCrestPng(), []);
  const marqueCrestPng = useMemo(
    () => getMarqueCrestPng(selectedCar.id),
    [selectedCar.id]
  );
  const blueprintPng = useMemo(
    () =>
      getCarBlueprintPng(
        selectedCar.id,
        livery.bodyColor,
        livery.stripeColor,
        livery.stripeStyle,
        livery.number,
        livery.wheelFinish
      ),
    [
      selectedCar.id,
      livery.bodyColor,
      livery.stripeColor,
      livery.stripeStyle,
      livery.number,
      livery.wheelFinish,
    ]
  );
  const tireBadgePng = useMemo(
    () => getTireCompoundBadgePng(startingCompound),
    [startingCompound]
  );

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-6 md:p-10">
      {/* Subtle left-side contrast scrim for negative-space legibility over the live 3D showcase */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(11,15,23,0.94) 0%, rgba(11,15,23,0.78) 36%, rgba(11,15,23,0.12) 66%, rgba(11,15,23,0.0) 100%)',
        }}
      />

      {/* Top Perimeter Status Line (Unboxed clean metadata, zero pills) */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs tracking-wider text-[#d6d1c7] font-medium">
          <span>FIA Historic Grand Touring & Formula 1 · 1967–68 Season</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular text-[#f59e0b]">
            STAGE {activeLevel.level}: {activeLevel.title.toUpperCase()}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular text-[#f59e0b]">
            ∞ UNLIMITED CR ({credits.toLocaleString()} CR)
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">{onlineCount} Drivers in Paddock</span>
        </div>
      </div>

      {/* Asymmetric Left-Third Hero Lockup & Primary Actions (Leaves >= 65% of 3D world open) */}
      <div className="max-w-md w-full my-auto space-y-5 pointer-events-auto">
        {/* High-DPI Cloisonné Enamel Crest PNG + Display Lockup */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-4">
            <img
              src={crestPng}
              alt="Mille Corse 1967 Cloisonné Crest"
              referrerPolicy="no-referrer"
              className="w-20 h-20 md:w-22 md:h-22 object-contain shrink-0 drop-shadow-[0_6px_16px_rgba(0,0,0,0.85)]"
            />
            <div>
              <div className="text-[11px] font-semibold tracking-[0.26em] uppercase text-[#f59e0b]">
                AUTOMOBILE CLUB STORICO
              </div>
              <h1 className="font-display font-bold italic text-4xl md:text-5xl text-[#f5f2eb] tracking-tight leading-none mt-1">
                MILLE CORSE
              </h1>
              <div className="h-[1.5px] w-full bg-[#d97706]/80 my-1.5" />
              <div className="text-xs font-semibold tracking-[0.22em] uppercase text-[#e5dec9]">
                HISTORIC GT & F1 CHAMPIONSHIP
              </div>
            </div>
          </div>

          <p className="text-sm text-[#cfc9bc] leading-relaxed">
            Authentic 1967–68 Grand Touring & Open-Wheel Formula 1 machinery. Master the dynamic 3D
            braking/acceleration racing line, 4-corner tire wear, and pit stop strategies across 5 European circuits.
          </p>
        </div>

        {/* Live Carrozzeria Homologation Blueprint & Paddock Technical Spec Card */}
        <div className="border-t border-b border-[#f5f2eb]/15 py-3 space-y-2.5">
          <div className="relative h-32 w-full rounded overflow-hidden border border-[#f5f2eb]/15 bg-[#090d16]">
            <img
              src={blueprintPng}
              alt={`${selectedCar.name} Orthographic Blueprint`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
            />
            <img
              src={marqueCrestPng}
              alt={`${selectedCar.name} Marque Crest`}
              referrerPolicy="no-referrer"
              className="absolute bottom-1.5 left-2 w-9 h-9 object-contain drop-shadow"
            />
            <button
              type="button"
              data-testid="cycle-chassis-btn"
              onClick={onCycleCar}
              className="absolute top-1.5 right-2 px-2 py-0.5 rounded bg-[#141824]/90 hover:bg-[#1e293b] border border-[#f59e0b]/40 text-[10px] font-mono-tabular font-semibold text-[#f59e0b] transition-colors cursor-pointer"
            >
              Switch Chassis [V] →
            </button>
            <img
              src={tireBadgePng}
              alt={`${startingCompound} Tire Compound`}
              referrerPolicy="no-referrer"
              className="absolute bottom-1.5 right-2 w-9 h-9 object-contain drop-shadow"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-[#b8b1a3]">
              <span>Active Chassis</span>
              <span className="text-[#f5f2eb] font-semibold">
                {selectedCar.name} · #{livery.number} · {startingCompound.toUpperCase()} TIRES
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-[#b8b1a3]">
              <span>Performance Spec</span>
              <span className="font-mono-tabular text-[#f5f2eb]">
                {effectiveStats.powerHp} HP · {effectiveStats.weightKg} KG · {effectiveStats.topSpeedKmh} KM/H · PI{' '}
                <span className="text-[#f59e0b] font-semibold">{effectiveStats.performanceIndex}</span>
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-[#b8b1a3]">
              <span>Stage {activeLevel.level} Circuit</span>
              <span className="text-[#f5f2eb] font-semibold">
                {selectedTrack.name} (+{selectedTrack.elevationGainM}m · {selectedTrack.laps} Laps)
              </span>
            </div>
          </div>
        </div>

        {/* Primary CTA + Secondary Paddock Actions (<= 3 secondary actions) */}
        <div className="space-y-2.5">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStartRace();
            }}
            className="w-full py-3.5 px-6 bg-[#d97706] hover:bg-[#f59e0b] active:bg-[#b45309] text-[#09090b] font-display font-bold text-lg tracking-wider uppercase rounded transition-colors cursor-pointer shadow-[0_4px_20px_rgba(217,119,6,0.35)] whitespace-nowrap"
          >
            Start Race
          </button>

          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={onOpenGarage}
              className="py-2.5 px-3 bg-[#141824] hover:bg-[#1e293b] text-[#f5f2eb] border border-[#f5f2eb]/20 rounded text-xs font-semibold tracking-wide transition-colors cursor-pointer whitespace-nowrap truncate"
            >
              Garage & Tuning
            </button>
            <button
              type="button"
              onClick={onOpenTracks}
              className="py-2.5 px-3 bg-[#141824] hover:bg-[#1e293b] text-[#f5f2eb] border border-[#f5f2eb]/20 rounded text-xs font-semibold tracking-wide transition-colors cursor-pointer whitespace-nowrap truncate"
            >
              Levels & Circuits
            </button>
            <button
              type="button"
              onClick={onOpenLeaderboards}
              className="py-2.5 px-3 bg-[#141824] hover:bg-[#1e293b] text-[#f5f2eb] border border-[#f5f2eb]/20 rounded text-xs font-semibold tracking-wide transition-colors cursor-pointer whitespace-nowrap truncate"
            >
              Leaderboards
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Safe Margin: Single flat borderless inline control-hint line */}
      <div className="flex items-center justify-between text-xs text-[#cfc9bc] tracking-wide">
        <span>
          WASD / Arrows Drive · Space Drift · Shift Nitro · L Racing Line · B Pit Stop · V Chassis · C Camera
        </span>
        <span className="hidden sm:inline text-[#a39c8e]">
          {selectedCar.origin} · {selectedCar.displacement}
        </span>
      </div>
    </div>
  );
};
