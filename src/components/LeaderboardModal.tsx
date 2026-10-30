import React, { useState } from 'react';
import {
  CarLivery,
  ClassicCarSpec,
  EffectiveCarStats,
  LeaderboardEntry,
  TrackId,
} from '../game/types';
import { TRACK_LIST } from '../game/tracks';
import { formatLapTime } from '../game/format';
import {
  getCarBlueprintPng,
  getChampionshipCrestPng,
  getMarqueCrestPng,
} from '../game/assets';

interface LeaderboardModalProps {
  entries: LeaderboardEntry[];
  activeTrackId: TrackId;
  driverName: string;
  selectedCar: ClassicCarSpec;
  livery: CarLivery;
  effectiveStats: EffectiveCarStats;
  tuningLabel: string;
  onlineCount: number;
  lastBestLapMs: number;
  onUpdateDriverName: (name: string) => void;
  onSubmitRecord: (params: {
    driverName: string;
    trackId: TrackId;
    bestLapMs: number;
    totalTimeMs: number;
    topSpeedKmh: number;
  }) => Promise<void>;
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  entries,
  activeTrackId,
  driverName,
  selectedCar,
  livery,
  effectiveStats,
  tuningLabel,
  onlineCount,
  lastBestLapMs,
  onUpdateDriverName,
  onSubmitRecord,
  onClose,
}) => {
  const [filterTrack, setFilterTrack] = useState<TrackId>(activeTrackId);
  const [callsignInput, setCallsignInput] = useState(driverName);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'saved'>('idle');

  const crestPng = getChampionshipCrestPng();
  const carBlueprintPng = getCarBlueprintPng(
    selectedCar.id,
    livery.bodyColor,
    livery.stripeColor,
    livery.stripeStyle,
    livery.number,
    livery.wheelFinish
  );
  const marqueCrestPng = getMarqueCrestPng(selectedCar.id);

  const filteredEntries = entries
    .filter((e) => e.trackId === filterTrack)
    .sort((a, b) => a.bestLapMs - b.bestLapMs);

  const handleSaveDriverAndPost = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = callsignInput.trim();
    if (!trimmed) {
      setErrorMsg('Please enter a valid FIA Driver Callsign before submitting.');
      return;
    }
    setErrorMsg('');
    onUpdateDriverName(trimmed);

    setSubmitStatus('submitting');
    // Calculate realistic shakedown lap from player's effective car PI if they haven't set a lap yet, or use their actual best lap
    const lapMs =
      lastBestLapMs > 0
        ? lastBestLapMs
        : Math.round(36500 - (effectiveStats.performanceIndex - 500) * 24);

    try {
      await onSubmitRecord({
        driverName: trimmed,
        trackId: filterTrack,
        bestLapMs: lapMs,
        totalTimeMs: lapMs * 3 + 1200,
        topSpeedKmh: effectiveStats.topSpeedKmh,
      });
      setSubmitStatus('saved');
    } catch {
      setErrorMsg('Could not sync record to timing server.');
      setSubmitStatus('idle');
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Global Multiplayer Leaderboards"
      className="animate-backdrop-in fixed inset-0 z-30 flex items-center justify-center p-4 md:p-8 pointer-events-auto"
      style={{ backgroundColor: 'rgba(9, 9, 11, 0.86)' }}
    >
      <div
        className="animate-modal-in w-full max-w-4xl rounded border border-[#f5f2eb]/20 p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: '#121110' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f5f2eb]/15 pb-4">
          <div className="flex items-center gap-3.5">
            <img
              src={crestPng}
              alt="FIA Historic Championship Crest"
              referrerPolicy="no-referrer"
              className="w-11 h-11 object-contain shrink-0"
            />
            <div>
              <h2 className="font-display font-bold text-2xl text-[#f5f2eb] uppercase tracking-wide">
                FIA Historic Global Timing Standings
              </h2>
              <p className="text-xs text-[#a39c8e]">
                Live WebSocket Timing Server · <span className="font-mono-tabular text-[#f59e0b]">{onlineCount}</span> Connected Drivers
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded bg-[#262320] hover:bg-[#3f3b36] text-xs font-semibold text-[#f5f2eb] cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Driver Callsign & Telemetry Registration Form with Active Machine Blueprint */}
        <form
          onSubmit={handleSaveDriverAndPost}
          className="p-4 rounded bg-[#181614] border border-[#f5f2eb]/12 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        >
          <div className="w-full md:w-64">
            <label
              htmlFor="driver-callsign-input"
              className="block text-xs font-semibold text-[#cfc9bc] mb-1.5"
            >
              Official FIA Driver Callsign
            </label>
            <input
              id="driver-callsign-input"
              type="text"
              maxLength={22}
              placeholder="e.g. E. Castellotti"
              value={callsignInput}
              onChange={(e) => {
                setCallsignInput(e.target.value);
                if (errorMsg) setErrorMsg('');
                if (submitStatus === 'saved') setSubmitStatus('idle');
              }}
              className="w-full px-3 py-2 rounded bg-[#0d0c0b] border border-[#f5f2eb]/20 text-sm text-[#f5f2eb] focus:outline-none focus:border-[#f59e0b]"
            />
            {errorMsg && (
              <p role="alert" className="text-xs text-[#ef4444] mt-1">
                {errorMsg}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative w-32 h-16 rounded overflow-hidden border border-white/15 bg-[#090d16] shrink-0">
              <img
                src={carBlueprintPng}
                alt={selectedCar.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
              <img
                src={marqueCrestPng}
                alt="Marque Crest"
                referrerPolicy="no-referrer"
                className="absolute top-1 left-1 w-5 h-5 object-contain"
              />
            </div>
            <div className="text-xs text-[#a39c8e] space-y-0.5 min-w-0">
              <div className="truncate">
                Registered Entry: <span className="text-[#f5f2eb] font-semibold">{selectedCar.name}</span> · #{livery.number}
              </div>
              <div className="font-mono-tabular truncate">
                Setup: {tuningLabel} · PI {effectiveStats.performanceIndex} · Top {effectiveStats.topSpeedKmh} KM/H
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitStatus === 'submitting'}
            className="px-4 py-2.5 rounded bg-[#d97706] hover:bg-[#f59e0b] text-[#09090b] font-display font-bold text-xs uppercase tracking-wider cursor-pointer whitespace-nowrap shrink-0"
          >
            {submitStatus === 'submitting'
              ? 'Posting...'
              : submitStatus === 'saved'
              ? 'Telemetry Posted'
              : 'Post Official Time'}
          </button>
        </form>

        {/* Circuit Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-[#181614] rounded border border-[#f5f2eb]/10">
          {TRACK_LIST.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilterTrack(t.id)}
              className={`flex-1 py-2 px-3 rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
                filterTrack === t.id
                  ? 'bg-[#d97706] text-[#09090b]'
                  : 'text-[#cfc9bc] hover:text-[#f5f2eb]'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* Standings Table (Tabular Numerals, Zero Table Row Dot Scatter) */}
        <div className="overflow-x-auto border border-[#f5f2eb]/12 rounded">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#f5f2eb]/15 bg-[#181614] text-[11px] uppercase tracking-wider text-[#a39c8e]">
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">Driver</th>
                <th className="py-2.5 px-3">Historic Machine</th>
                <th className="py-2.5 px-3">Tuning Setup</th>
                <th className="py-2.5 px-3 text-right">Class PI</th>
                <th className="py-2.5 px-3 text-right">Top Speed</th>
                <th className="py-2.5 px-3 text-right">Best Lap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f5f2eb]/10 text-xs">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#a39c8e]">
                    No verified lap times recorded for this circuit yet.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry, idx) => (
                  <tr
                    key={entry.id}
                    className={
                      entry.driverName.toLowerCase() === driverName.trim().toLowerCase()
                        ? 'bg-[#262018]'
                        : 'hover:bg-[#181614]'
                    }
                  >
                    <td className="py-2.5 px-3 font-mono-tabular font-bold text-[#f59e0b]">
                      #{idx + 1}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-[#f5f2eb]">
                      {entry.driverName} · #{entry.liveryNumber}
                    </td>
                    <td className="py-2.5 px-3 text-[#cfc9bc]">{entry.carName}</td>
                    <td className="py-2.5 px-3 text-[#a39c8e]">{entry.tuningLabel}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular text-[#cfc9bc]">
                      {entry.performanceIndex}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular text-[#cfc9bc]">
                      {entry.topSpeedKmh} km/h
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-[#f5f2eb]">
                      {formatLapTime(entry.bestLapMs)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
