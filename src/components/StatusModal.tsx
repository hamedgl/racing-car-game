import React, { useState } from 'react';
import {
  CameraMode,
  ChampionshipLevelSpec,
  GameState,
  TireCompound,
  TrackRubberPreset,
  WeatherCondition,
} from '../game/types';
import { RaceFinishSummary } from './RaceCanvas';
import { formatLapTime } from '../game/format';

interface StatusModalProps {
  gameState: GameState;
  finishSummary: RaceFinishSummary | null;
  activeLevel: ChampionshipLevelSpec;
  creditsEarned: number;
  cameraMode: CameraMode;
  weatherCondition: WeatherCondition;
  nextPitCompound: TireCompound;
  trackRubberPreset: TrackRubberPreset;
  onCycleCamera: () => void;
  onCycleWeather: () => void;
  onCycleNextPitCompound: () => void;
  onCycleTrackRubberPreset: () => void;
  onResume: () => void;
  onRestart: () => void;
  onAdvanceNextLevel: () => void;
  onOpenGarageFromPause: () => void;
  onExitToTitle: () => void;
  onPostFinishToLeaderboard: () => Promise<void>;
}

const RUBBER_LABELS: Record<TrackRubberPreset, string> = {
  progressive: 'Progressive (Per Lap)',
  green: 'Green Track',
  rubbered: 'Rubbered-In',
  saturated: 'Saturated Groove',
};

export const StatusModal: React.FC<StatusModalProps> = ({
  gameState,
  finishSummary,
  activeLevel,
  creditsEarned,
  cameraMode,
  weatherCondition,
  nextPitCompound,
  trackRubberPreset,
  onCycleCamera,
  onCycleWeather,
  onCycleNextPitCompound,
  onCycleTrackRubberPreset,
  onResume,
  onRestart,
  onAdvanceNextLevel,
  onOpenGarageFromPause,
  onExitToTitle,
  onPostFinishToLeaderboard,
}) => {
  const [posted, setPosted] = useState(false);

  if (gameState !== 'paused' && gameState !== 'gameover') {
    return null;
  }

  // PAUSED MODAL CARD WITH RACE DIRECTOR & PIT STRATEGY SETTINGS
  if (gameState === 'paused') {
    return (
      <div
        role="dialog"
        aria-label="Race Paused"
        className="fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-auto"
        style={{ backgroundColor: 'rgba(9, 11, 16, 0.84)' }}
      >
        <div
          className="w-full max-w-md rounded border border-[#f5f2eb]/20 p-6 space-y-5"
          style={{ backgroundColor: '#0e131d' }}
        >
          <div className="border-b border-[#f5f2eb]/15 pb-3">
            <div className="text-xs font-semibold uppercase tracking-widest text-[#f59e0b]">
              Stewards Red Flag · Stage {activeLevel.level} Paused
            </div>
            <h2 className="font-display font-bold text-2xl text-[#f5f2eb] uppercase mt-0.5">
              Pit Lane Control
            </h2>
          </div>

          {/* Clean Race Director Settings (Camera, Rubbering, Weather, Next Pit Compound) */}
          <div className="grid grid-cols-2 gap-2.5 p-3 rounded bg-[#141c2b] border border-[#f5f2eb]/10">
            <button
              type="button"
              onClick={onCycleCamera}
              className="text-left p-2 rounded bg-[#0b0f17] hover:bg-[#1e293b] border border-[#f5f2eb]/10 cursor-pointer"
            >
              <div className="text-[10px] uppercase tracking-wider text-[#94a3b8]">Camera Angle [C]</div>
              <div className="text-xs font-bold text-[#f59e0b] uppercase mt-0.5">{cameraMode}</div>
            </button>

            <button
              type="button"
              onClick={onCycleNextPitCompound}
              className="text-left p-2 rounded bg-[#0b0f17] hover:bg-[#1e293b] border border-[#f5f2eb]/10 cursor-pointer"
            >
              <div className="text-[10px] uppercase tracking-wider text-[#94a3b8]">Next Pit Tire [T]</div>
              <div className="text-xs font-bold text-[#f59e0b] uppercase mt-0.5">{nextPitCompound}</div>
            </button>

            <button
              type="button"
              onClick={onCycleTrackRubberPreset}
              className="text-left p-2 rounded bg-[#0b0f17] hover:bg-[#1e293b] border border-[#f5f2eb]/10 cursor-pointer"
            >
              <div className="text-[10px] uppercase tracking-wider text-[#94a3b8]">Track Rubbering</div>
              <div className="text-xs font-bold text-[#f5f2eb] mt-0.5 truncate">
                {RUBBER_LABELS[trackRubberPreset]}
              </div>
            </button>

            <button
              type="button"
              onClick={onCycleWeather}
              className="text-left p-2 rounded bg-[#0b0f17] hover:bg-[#1e293b] border border-[#f5f2eb]/10 cursor-pointer"
            >
              <div className="text-[10px] uppercase tracking-wider text-[#94a3b8]">Weather</div>
              <div className="text-xs font-bold text-[#f5f2eb] uppercase mt-0.5">{weatherCondition}</div>
            </button>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={onResume}
              className="w-full py-3 px-4 rounded bg-[#d97706] hover:bg-[#f59e0b] text-[#09090b] font-display font-bold text-sm uppercase tracking-wider cursor-pointer"
            >
              Resume Race
            </button>
            <button
              type="button"
              onClick={onOpenGarageFromPause}
              className="w-full py-2.5 px-4 rounded bg-[#182030] hover:bg-[#222d42] border border-[#f5f2eb]/15 text-[#f5f2eb] font-semibold text-xs uppercase tracking-wider cursor-pointer"
            >
              Garage & Handling Setup
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="w-full py-2.5 px-4 rounded bg-[#182030] hover:bg-[#222d42] border border-[#f5f2eb]/15 text-[#f5f2eb] font-semibold text-xs uppercase tracking-wider cursor-pointer"
            >
              Restart Grid
            </button>
            <button
              type="button"
              onClick={onExitToTitle}
              className="w-full py-2.5 px-4 rounded bg-[#111722] hover:bg-[#1e293b] text-[#94a3b8] hover:text-[#f5f2eb] font-semibold text-xs uppercase tracking-wider cursor-pointer"
            >
              Return to Paddock Title
            </button>
          </div>
        </div>
      </div>
    );
  }

  // GAME OVER / RACE COMPLETE MODAL CARD
  const summary = finishSummary || {
    position: 1,
    totalTimeMs: 88420,
    bestLapMs: 28950,
    topSpeedKmh: 285,
    cleanRace: true,
    pitStopsCompleted: 1,
    standings: [],
  };

  const levelCleared = summary.position <= activeLevel.targetPosition;

  return (
    <div
      role="dialog"
      aria-label="Checkered Flag Results"
      className="fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-auto"
      style={{ backgroundColor: 'rgba(9, 11, 16, 0.85)' }}
    >
      <div
        className="w-full max-w-lg rounded border border-[#f5f2eb]/20 p-6 space-y-5"
        style={{ backgroundColor: '#0e131d' }}
      >
        <div className="border-b border-[#f5f2eb]/15 pb-3 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-[#f59e0b]">
              {levelCleared
                ? `Stage ${activeLevel.level} Cleared · Target P${activeLevel.targetPosition} Met`
                : `Stage ${activeLevel.level} Classification`}
            </div>
            <h2 className="font-display font-bold text-3xl text-[#f5f2eb] uppercase mt-0.5">
              Finished P{summary.position}
            </h2>
          </div>
          <div className="text-right">
            <div className="text-xs text-[#94a3b8]">Prize Purse</div>
            <div className="font-mono-tabular font-bold text-xl text-[#f59e0b]">
              +{creditsEarned.toLocaleString()} CR
            </div>
          </div>
        </div>

        {/* 3 Mastery Metric Tiles (tabular-nums) */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded bg-[#141c2b] border border-[#f5f2eb]/10">
            <div className="text-[10px] uppercase tracking-wider text-[#94a3b8]">Total Time</div>
            <div className="font-mono-tabular font-bold text-base text-[#f5f2eb] mt-0.5">
              {formatLapTime(summary.totalTimeMs)}
            </div>
          </div>
          <div className="p-3 rounded bg-[#141c2b] border border-[#f5f2eb]/10">
            <div className="text-[10px] uppercase tracking-wider text-[#94a3b8]">Best Lap</div>
            <div className="font-mono-tabular font-bold text-base text-[#f59e0b] mt-0.5">
              {formatLapTime(summary.bestLapMs)}
            </div>
          </div>
          <div className="p-3 rounded bg-[#141c2b] border border-[#f5f2eb]/10">
            <div className="text-[10px] uppercase tracking-wider text-[#94a3b8]">Pit Stops / Trap</div>
            <div className="font-mono-tabular font-bold text-base text-[#f5f2eb] mt-0.5">
              {summary.pitStopsCompleted} Pit · {summary.topSpeedKmh} km/h
            </div>
          </div>
        </div>

        {/* Standings Breakdown */}
        {summary.standings.length > 0 && (
          <div className="border border-[#f5f2eb]/12 rounded divide-y divide-[#f5f2eb]/10 text-xs">
            {summary.standings.map((row) => (
              <div
                key={row.position}
                className={`py-2 px-3 flex items-center justify-between ${
                  row.isPlayer ? 'bg-[#1e293b] text-[#f5f2eb] font-semibold' : 'text-[#cbd5e1]'
                }`}
              >
                <span>
                  P{row.position} · {row.driverName} ({row.carName})
                </span>
                <span className="font-mono-tabular">{formatLapTime(row.totalTimeMs)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Primary Action CTAs */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {levelCleared && activeLevel.level < 5 ? (
            <button
              type="button"
              data-start="true"
              onClick={onAdvanceNextLevel}
              className="py-3 px-4 rounded bg-[#d97706] hover:bg-[#f59e0b] text-[#09090b] font-display font-bold text-sm uppercase tracking-wider cursor-pointer"
            >
              Advance to Stage {activeLevel.level + 1}
            </button>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={onRestart}
              className="py-3 px-4 rounded bg-[#d97706] hover:bg-[#f59e0b] text-[#09090b] font-display font-bold text-sm uppercase tracking-wider cursor-pointer"
            >
              Race Again
            </button>
          )}
          <button
            type="button"
            disabled={posted}
            onClick={async () => {
              await onPostFinishToLeaderboard();
              setPosted(true);
            }}
            className="py-3 px-4 rounded bg-[#182030] hover:bg-[#222d42] border border-[#f5f2eb]/20 text-[#f5f2eb] font-display font-bold text-xs uppercase tracking-wider cursor-pointer"
          >
            {posted ? 'Saved to Global Board' : 'Post to Global Board'}
          </button>
        </div>

        <button
          type="button"
          onClick={onExitToTitle}
          className="w-full py-2 text-xs text-[#94a3b8] hover:text-[#f5f2eb] font-semibold cursor-pointer"
        >
          Return to Championship Paddock
        </button>
      </div>
    </div>
  );
};
