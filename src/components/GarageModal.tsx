import React, { useState } from 'react';
import {
  CarLivery,
  CarUpgrades,
  ClassicCarSpec,
  EffectiveCarStats,
  GarageCameraView,
  HandlingTuning,
  StripeStyle,
  WheelFinish,
} from '../game/types';
import {
  CLASSIC_CARS,
  getUpgradeCost,
  PAINT_SWATCHES,
  STRIPE_SWATCHES,
  TUNING_PRESETS,
} from '../game/cars';

interface GarageModalProps {
  selectedCar: ClassicCarSpec;
  livery: CarLivery;
  upgrades: CarUpgrades;
  tuning: HandlingTuning;
  effectiveStats: EffectiveCarStats;
  credits: number;
  activePresetKey: string;
  garageCameraView: GarageCameraView;
  onSelectGarageCameraView: (view: GarageCameraView) => void;
  onSelectCar: (car: ClassicCarSpec) => void;
  onUpdateLivery: (livery: CarLivery) => void;
  onBuyUpgrade: (system: keyof CarUpgrades) => void;
  onMaxAllUpgrades?: () => void;
  onUpdateTuning: (tuning: HandlingTuning, presetKey?: string) => void;
  onClose: () => void;
}

type GarageTab = 'cars' | 'livery' | 'upgrades' | 'tuning';

export const GarageModal: React.FC<GarageModalProps> = ({
  selectedCar,
  livery,
  upgrades,
  tuning,
  effectiveStats,
  credits,
  activePresetKey,
  garageCameraView,
  onSelectGarageCameraView,
  onSelectCar,
  onUpdateLivery,
  onBuyUpgrade,
  onMaxAllUpgrades,
  onUpdateTuning,
  onClose,
}) => {
  const [tab, setTab] = useState<GarageTab>('cars');

  const upgradeSystems: Array<{
    key: keyof CarUpgrades;
    title: string;
    subtitle: string;
    effect: string;
  }> = [
    {
      key: 'engineLevel',
      title: 'Weber Carburetors & Camshafts',
      subtitle: 'Engine Power Stage',
      effect: '+7.5% Horsepower & Higher Top Velocity per stage',
    },
    {
      key: 'transmissionLevel',
      title: 'Close-Ratio Dog-Leg Gearbox',
      subtitle: 'Drivetrain Stage',
      effect: 'Faster 0-100 KM/H Acceleration & Shift Efficiency',
    },
    {
      key: 'tiresLevel',
      title: 'Dunlop Vintage Racing Compound',
      subtitle: 'Mechanical Grip Stage',
      effect: '+6.0% Cornering Lateral G & Braking Traction',
    },
    {
      key: 'chassisWeightLevel',
      title: 'Aluminum Body Panels & Perspex',
      subtitle: 'Chassis Weight Reduction',
      effect: '-3.5% Curb Weight for Nimble Turn-In & Braking',
    },
  ];

  return (
    <div
      role="dialog"
      aria-label="Garage, Livery & Handling Tuning Workshop"
      className="fixed inset-y-0 left-0 z-30 w-full max-w-xl p-4 md:p-6 flex flex-col justify-between pointer-events-auto border-r border-[#f5f2eb]/15 overflow-y-auto"
      style={{ backgroundColor: 'rgba(13, 12, 11, 0.95)' }}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f5f2eb]/15 pb-3.5">
          <div>
            <h2 className="font-display font-bold text-xl tracking-wide text-[#f5f2eb] uppercase">
              Scuderia Paddock & Engineering
            </h2>
            <p className="text-xs text-[#a39c8e]">
              {selectedCar.name} · {selectedCar.coachbuilder} ·{' '}
              <span className="font-mono-tabular text-[#4ade80] font-semibold">
                ∞ UNLIMITED CR ({credits.toLocaleString()} CR)
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded bg-[#262320] hover:bg-[#3f3b36] text-xs font-semibold text-[#f5f2eb] transition-colors cursor-pointer whitespace-nowrap"
          >
            Done
          </button>
        </div>

        {/* 3D Paddock Inspection Camera Angle Bar */}
        <div className="p-2.5 rounded bg-[#181614] border border-[#f5f2eb]/10 space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[#a39c8e]">
              3D Paddock Inspection Camera
            </span>
            <span className="text-[10px] font-mono-tabular text-[#f59e0b]">
              {selectedCar.silhouetteTag}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {(
              [
                { id: 'orbit', label: 'Orbit 360°' },
                { id: 'front_quarter', label: 'Front 3/4' },
                { id: 'side_profile', label: 'Side View' },
                { id: 'rear_engine', label: 'Rear Bay' },
                { id: 'cockpit_closeup', label: 'Cockpit' },
              ] as Array<{ id: GarageCameraView; label: string }>
            ).map((cam) => (
              <button
                key={cam.id}
                type="button"
                data-testid={`garage-cam-${cam.id}`}
                onClick={() => onSelectGarageCameraView(cam.id)}
                className={`py-1.5 px-1.5 rounded text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap text-center ${
                  garageCameraView === cam.id
                    ? 'bg-[#262320] text-[#f59e0b] border border-[#f59e0b]/60'
                    : 'bg-[#12100e] text-[#cfc9bc] hover:text-[#f5f2eb] border border-[#f5f2eb]/5'
                }`}
              >
                {cam.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Telemetry Summary Strip (Updates immediately on any car/upgrade/tuning change) */}
        <div className="grid grid-cols-5 gap-2 p-3 rounded bg-[#181614] border border-[#f5f2eb]/10 text-center">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#a39c8e]">Top Speed</div>
            <div
              data-testid="stat-top-speed"
              className="font-mono-tabular font-bold text-sm text-[#f5f2eb]"
            >
              {effectiveStats.topSpeedKmh} km/h
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#a39c8e]">0-100 km/h</div>
            <div
              data-testid="stat-accel"
              className="font-mono-tabular font-bold text-sm text-[#f5f2eb]"
            >
              {effectiveStats.accel0to100Sec}s
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#a39c8e]">Cornering</div>
            <div
              data-testid="stat-grip"
              className="font-mono-tabular font-bold text-sm text-[#f5f2eb]"
            >
              {effectiveStats.lateralGripG} G
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#a39c8e]">Power / Wt</div>
            <div className="font-mono-tabular font-bold text-sm text-[#f5f2eb]">
              {effectiveStats.powerHp}hp / {effectiveStats.weightKg}kg
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#a39c8e]">Class PI</div>
            <div
              data-testid="stat-pi"
              className="font-mono-tabular font-bold text-sm text-[#f59e0b]"
            >
              {effectiveStats.performanceIndex}
            </div>
          </div>
        </div>

        {/* Segmented Workshop Tabs */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-[#181614] rounded border border-[#f5f2eb]/10">
          {(
            [
              { id: 'cars', label: 'Classic Cars' },
              { id: 'livery', label: 'Livery Studio' },
              { id: 'upgrades', label: 'Upgrades' },
              { id: 'tuning', label: 'Pro Tuning' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`py-2 px-2 rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
                tab === t.id
                  ? 'bg-[#d97706] text-[#09090b]'
                  : 'text-[#cfc9bc] hover:text-[#f5f2eb]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB 1: CLASSIC CARS */}
        {tab === 'cars' && (
          <div className="space-y-2.5">
            {CLASSIC_CARS.map((car) => {
              const isSelected = car.id === selectedCar.id;
              return (
                <button
                  key={car.id}
                  type="button"
                  data-testid={`select-car-${car.id}`}
                  onClick={() => onSelectCar(car)}
                  className={`w-full text-left p-3.5 rounded border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#221e1a] border-[#d97706]'
                      : 'bg-[#161412] border-[#f5f2eb]/10 hover:border-[#f5f2eb]/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-base text-[#f5f2eb]">
                      {car.name}
                    </span>
                    <span className="text-xs font-mono-tabular text-[#f59e0b]">
                      {car.baseStats.powerHp} HP · {car.baseStats.weightKg} KG
                    </span>
                  </div>
                  <div className="text-xs text-[#f59e0b]/90 font-medium mt-0.5">
                    {car.coachbuilder} · {car.silhouetteTag}
                  </div>
                  <div className="text-xs text-[#a39c8e] mt-0.5">
                    {car.origin} · {car.displacement} · {car.baseStats.topSpeedKmh} KM/H Factory Top
                  </div>
                  <p className="text-xs text-[#cfc9bc] mt-1.5 leading-relaxed">{car.description}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* TAB 2: LIVERY STUDIO */}
        {tab === 'livery' && (
          <div className="space-y-4">
            {/* Paint Swatches */}
            <div>
              <label className="block text-xs font-semibold text-[#cfc9bc] mb-2">
                Historic Coachwork Paint
              </label>
              <div className="grid grid-cols-4 gap-2">
                {PAINT_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.hex}
                    type="button"
                    onClick={() => onUpdateLivery({ ...livery, bodyColor: swatch.hex })}
                    className={`flex items-center gap-2 p-2 rounded border text-xs font-medium cursor-pointer transition-colors ${
                      livery.bodyColor === swatch.hex
                        ? 'border-[#f59e0b] bg-[#262320] text-[#f5f2eb]'
                        : 'border-[#f5f2eb]/15 bg-[#161412] text-[#b8b1a3]'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-sm shrink-0 border border-white/20"
                      style={{ backgroundColor: swatch.hex }}
                    />
                    <span className="truncate">{swatch.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Racing Stripe Style */}
            <div>
              <label className="block text-xs font-semibold text-[#cfc9bc] mb-2">
                Racing Stripe Pattern
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    { id: 'none', label: 'Clean Coach' },
                    { id: 'twin_center', label: 'Twin Center' },
                    { id: 'offset_lemans', label: 'Offset Le Mans' },
                    { id: 'hood_sill', label: 'Broad Band' },
                  ] as Array<{ id: StripeStyle; label: string }>
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => onUpdateLivery({ ...livery, stripeStyle: st.id })}
                    className={`py-2 px-2.5 rounded border text-xs font-semibold cursor-pointer whitespace-nowrap truncate ${
                      livery.stripeStyle === st.id
                        ? 'border-[#f59e0b] bg-[#262320] text-[#f5f2eb]'
                        : 'border-[#f5f2eb]/15 bg-[#161412] text-[#b8b1a3]'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stripe Color */}
            <div>
              <label className="block text-xs font-semibold text-[#cfc9bc] mb-2">
                Stripe Accent Hue
              </label>
              <div className="grid grid-cols-3 gap-2">
                {STRIPE_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.hex}
                    type="button"
                    onClick={() => onUpdateLivery({ ...livery, stripeColor: swatch.hex })}
                    className={`flex items-center gap-2 p-2 rounded border text-xs font-medium cursor-pointer ${
                      livery.stripeColor === swatch.hex
                        ? 'border-[#f59e0b] bg-[#262320] text-[#f5f2eb]'
                        : 'border-[#f5f2eb]/15 bg-[#161412] text-[#b8b1a3]'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-sm shrink-0 border border-white/20"
                      style={{ backgroundColor: swatch.hex }}
                    />
                    <span className="truncate">{swatch.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Racing Number & Wheel Rim Finish */}
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <label
                  htmlFor="livery-number-input"
                  className="block text-xs font-semibold text-[#cfc9bc] mb-1.5"
                >
                  Roundel Number (1–99)
                </label>
                <input
                  id="livery-number-input"
                  type="number"
                  min={1}
                  max={99}
                  value={livery.number}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(99, Number(e.target.value) || 1));
                    onUpdateLivery({ ...livery, number: val });
                  }}
                  className="w-full px-3 py-2 rounded bg-[#161412] border border-[#f5f2eb]/20 text-sm font-mono-tabular text-[#f5f2eb]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#cfc9bc] mb-1.5">
                  Wheel Finish
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'chrome_wire', label: 'Wire' },
                      { id: 'gold_magnesium', label: 'Gold' },
                      { id: 'gunmetal_alloy', label: 'Alloy' },
                    ] as Array<{ id: WheelFinish; label: string }>
                  ).map((wf) => (
                    <button
                      key={wf.id}
                      type="button"
                      onClick={() => onUpdateLivery({ ...livery, wheelFinish: wf.id })}
                      className={`py-2 px-2 rounded border text-xs font-semibold cursor-pointer ${
                        livery.wheelFinish === wf.id
                          ? 'border-[#f59e0b] bg-[#262320] text-[#f5f2eb]'
                          : 'border-[#f5f2eb]/15 bg-[#161412] text-[#b8b1a3]'
                      }`}
                    >
                      {wf.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PERFORMANCE UPGRADES */}
        {tab === 'upgrades' && (
          <div className="space-y-3">
            {onMaxAllUpgrades && (
              <div className="flex items-center justify-between p-2.5 rounded bg-[#182218] border border-[#22c55e]/30">
                <span className="text-xs font-semibold text-[#4ade80]">
                  ∞ Unlimited CR Treasury Active
                </span>
                <button
                  type="button"
                  onClick={onMaxAllUpgrades}
                  className="px-3 py-1.5 rounded bg-[#22c55e] hover:bg-[#4ade80] text-[#09090b] text-xs font-display font-bold uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Max All Stages (∞ CR)
                </button>
              </div>
            )}
            {upgradeSystems.map((sys) => {
              const currentLvl = upgrades[sys.key];
              const cost = getUpgradeCost(currentLvl);
              const isMax = currentLvl >= 5;
              const canAfford = !isMax && credits >= cost;

              return (
                <div
                  key={sys.key}
                  className="p-3.5 rounded bg-[#161412] border border-[#f5f2eb]/12 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-[#f5f2eb]">{sys.title}</div>
                    <div className="text-xs text-[#a39c8e]">{sys.effect}</div>
                    {/* Discrete 5-stage graphical pips */}
                    <div className="flex items-center gap-1.5 pt-1">
                      {[1, 2, 3, 4, 5].map((pip) => (
                        <span
                          key={pip}
                          className={`h-2 w-6 rounded-xs ${
                            pip <= currentLvl ? 'bg-[#f59e0b]' : 'bg-[#2c2825]'
                          }`}
                        />
                      ))}
                      <span className="text-[11px] font-mono-tabular text-[#cfc9bc] ml-2">
                        Stage {currentLvl}/5
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => onBuyUpgrade(sys.key)}
                    className={`px-3.5 py-2 rounded text-xs font-display font-bold tracking-wider uppercase transition-colors whitespace-nowrap shrink-0 ${
                      isMax
                        ? 'bg-[#262320] text-[#a39c8e] cursor-default'
                        : canAfford
                        ? 'bg-[#d97706] hover:bg-[#f59e0b] text-[#09090b] cursor-pointer'
                        : 'bg-[#262320] text-[#78716c] cursor-not-allowed'
                    }`}
                  >
                    {isMax ? 'Max Stage' : `Upgrade · ${cost} CR`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 4: PRO HANDLING TUNING */}
        {tab === 'tuning' && (
          <div className="space-y-4">
            {/* Quick Engineer Presets */}
            <div>
              <div className="text-xs font-semibold text-[#cfc9bc] mb-1.5">
                Chief Mechanic Setup Presets
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(TUNING_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onUpdateTuning({ ...preset.tuning }, key)}
                    className={`p-2 rounded border text-xs font-semibold cursor-pointer truncate ${
                      activePresetKey === key
                        ? 'border-[#f59e0b] bg-[#262320] text-[#f5f2eb]'
                        : 'border-[#f5f2eb]/15 bg-[#161412] text-[#b8b1a3]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 6 Mechanical Sliders */}
            <div className="space-y-3">
              {/* 1. Suspension Stiffness */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="slider-suspension" className="text-[#cfc9bc] font-medium">
                    Suspension Spring Rate (Soft ↔ Stiff)
                  </label>
                  <span className="font-mono-tabular text-[#f59e0b]">
                    {tuning.suspensionStiffness.toFixed(1)} kN/m
                  </span>
                </div>
                <input
                  id="slider-suspension"
                  type="range"
                  min={1.0}
                  max={10.0}
                  step={0.5}
                  value={tuning.suspensionStiffness}
                  onChange={(e) =>
                    onUpdateTuning(
                      { ...tuning, suspensionStiffness: Number(e.target.value) },
                      'custom'
                    )
                  }
                  className="w-full accent-[#d97706] cursor-pointer"
                />
              </div>

              {/* 2. Tire Pressure PSI */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="slider-psi" className="text-[#cfc9bc] font-medium">
                    Vintage Tire Pressure (Grip ↔ Low Drag)
                  </label>
                  <span className="font-mono-tabular text-[#f59e0b]">
                    {tuning.tirePressurePsi.toFixed(1)} PSI
                  </span>
                </div>
                <input
                  id="slider-psi"
                  type="range"
                  min={24.0}
                  max={38.0}
                  step={0.5}
                  value={tuning.tirePressurePsi}
                  onChange={(e) =>
                    onUpdateTuning({ ...tuning, tirePressurePsi: Number(e.target.value) }, 'custom')
                  }
                  className="w-full accent-[#d97706] cursor-pointer"
                />
              </div>

              {/* 3. Aero Downforce */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="slider-aero" className="text-[#cfc9bc] font-medium">
                    Spoiler Downforce Trim (Top Speed ↔ Corner Grip)
                  </label>
                  <span className="font-mono-tabular text-[#f59e0b]">
                    {tuning.aeroDownforce}%
                  </span>
                </div>
                <input
                  id="slider-aero"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={tuning.aeroDownforce}
                  onChange={(e) =>
                    onUpdateTuning({ ...tuning, aeroDownforce: Number(e.target.value) }, 'custom')
                  }
                  className="w-full accent-[#d97706] cursor-pointer"
                />
              </div>

              {/* 4. Final Drive Ratio */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="slider-ratio" className="text-[#cfc9bc] font-medium">
                    Final Drive Ratio (Tall Top Speed ↔ Short Accel)
                  </label>
                  <span className="font-mono-tabular text-[#f59e0b]">
                    {tuning.finalDriveRatio.toFixed(2)}:1
                  </span>
                </div>
                <input
                  id="slider-ratio"
                  type="range"
                  min={2.8}
                  max={4.5}
                  step={0.05}
                  value={tuning.finalDriveRatio}
                  onChange={(e) =>
                    onUpdateTuning({ ...tuning, finalDriveRatio: Number(e.target.value) }, 'custom')
                  }
                  className="w-full accent-[#d97706] cursor-pointer"
                />
              </div>

              {/* 5. Front Brake Bias */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="slider-brake-bias" className="text-[#cfc9bc] font-medium">
                    Front Brake Bias (Trail Rotation ↔ Straight Stability)
                  </label>
                  <span className="font-mono-tabular text-[#f59e0b]">
                    {tuning.brakeBiasFront}% Front
                  </span>
                </div>
                <input
                  id="slider-brake-bias"
                  type="range"
                  min={50}
                  max={70}
                  step={1}
                  value={tuning.brakeBiasFront}
                  onChange={(e) =>
                    onUpdateTuning({ ...tuning, brakeBiasFront: Number(e.target.value) }, 'custom')
                  }
                  className="w-full accent-[#d97706] cursor-pointer"
                />
              </div>

              {/* 6. Differential Lock */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="slider-diff" className="text-[#cfc9bc] font-medium">
                    Limited-Slip Diff Lock (Smooth Exit ↔ Power Slide)
                  </label>
                  <span className="font-mono-tabular text-[#f59e0b]">
                    {tuning.diffLockAccel}%
                  </span>
                </div>
                <input
                  id="slider-diff"
                  type="range"
                  min={15}
                  max={85}
                  step={5}
                  value={tuning.diffLockAccel}
                  onChange={(e) =>
                    onUpdateTuning({ ...tuning, diffLockAccel: Number(e.target.value) }, 'custom')
                  }
                  className="w-full accent-[#d97706] cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="pt-4 border-t border-[#f5f2eb]/15 flex items-center justify-between">
        <span className="text-xs text-[#a39c8e]">
          Live 3D Paddock Preview Active
        </span>
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 bg-[#d97706] hover:bg-[#f59e0b] text-[#09090b] font-display font-bold text-xs tracking-wider uppercase rounded transition-colors cursor-pointer"
        >
          Confirm Setup
        </button>
      </div>
    </div>
  );
};
