/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CameraMode,
  CarLivery,
  CarUpgrades,
  ChampionshipLevelSpec,
  ClassicCarSpec,
  ControlInput,
  DamageMode,
  GameState,
  HandlingTuning,
  LeaderboardEntry,
  RemoteRacerTelemetry,
  TireCompound,
  TrackId,
  TrackRubberPreset,
  TrackSpec,
  WeatherCondition,
} from './game/types';
import {
  CLASSIC_CARS,
  DEFAULT_TUNING,
  DEFAULT_UPGRADES,
  getUpgradeCost,
  TUNING_PRESETS,
} from './game/cars';
import { CHAMPIONSHIP_LEVELS, TRACKS } from './game/tracks';
import {
  calculateRaceRewardCredits,
  computeEffectiveCarStats,
  createInitialTireState,
} from './game/physics';
import { racingAudio } from './game/audio';
import { LiveHudSnapshot, RaceCanvas, RaceFinishSummary } from './components/RaceCanvas';
import { TitleScreen } from './components/TitleScreen';
import { RacingHud } from './components/RacingHud';
import { GarageModal } from './components/GarageModal';
import { TrackModal } from './components/TrackModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { StatusModal } from './components/StatusModal';

const CAMERA_SEQUENCE: CameraMode[] = [
  'chase',
  'chase_far',
  'bonnet',
  'cockpit',
  'bumper',
  'tv_side',
];

const COMPOUND_SEQUENCE: TireCompound[] = ['soft', 'medium', 'hard', 'wet'];

export default function App() {
  // Check for ?autostart=1 query parameter
  const initialAutostart = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === '1';
  }, []);

  const [gameState, setGameState] = useState<GameState>(initialAutostart ? 'playing' : 'title');
  const [activeModal, setActiveModal] = useState<'none' | 'garage' | 'tracks' | 'leaderboards'>('none');

  const [selectedCar, setSelectedCar] = useState<ClassicCarSpec>(CLASSIC_CARS[0]);
  const [liveryMap, setLiveryMap] = useState<Record<string, CarLivery>>(() => {
    const map: Record<string, CarLivery> = {};
    for (const c of CLASSIC_CARS) {
      map[c.id] = { ...c.defaultLivery };
    }
    return map;
  });

  const [upgradesMap, setUpgradesMap] = useState<Record<string, CarUpgrades>>(() => {
    const map: Record<string, CarUpgrades> = {};
    for (const c of CLASSIC_CARS) {
      map[c.id] = { ...DEFAULT_UPGRADES };
    }
    return map;
  });

  const [tuning, setTuning] = useState<HandlingTuning>({ ...DEFAULT_TUNING });
  const [activePresetKey, setActivePresetKey] = useState<string>('balanced_gt');

  const [activeLevel, setActiveLevel] = useState<ChampionshipLevelSpec>(CHAMPIONSHIP_LEVELS[0]);
  const [selectedTrack, setSelectedTrack] = useState<TrackSpec>(TRACKS.monza_storico);
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Dynamic Weather, Tire Strategy & Track Rubbering Presets (Damage visual deformations disabled)
  const [weatherCondition, setWeatherCondition] = useState<WeatherCondition>('clear');
  const [damageMode] = useState<DamageMode>('off');
  const [trackRubberPreset, setTrackRubberPreset] = useState<TrackRubberPreset>('progressive');
  const [startingCompound, setStartingCompound] = useState<TireCompound>('medium');
  const [nextPitCompound, setNextPitCompound] = useState<TireCompound>('soft');
  const [pitRequestArmed, setPitRequestArmed] = useState<boolean>(false);

  const handleCycleWeather = useCallback(() => {
    const sequence: WeatherCondition[] = ['clear', 'overcast', 'rain', 'storm', 'dynamic'];
    setWeatherCondition((prev) => {
      const nextIdx = (sequence.indexOf(prev) + 1) % sequence.length;
      return sequence[nextIdx];
    });
  }, []);

  const handleCycleStartingCompound = useCallback(() => {
    setStartingCompound((prev) => {
      const nextIdx = (COMPOUND_SEQUENCE.indexOf(prev) + 1) % COMPOUND_SEQUENCE.length;
      return COMPOUND_SEQUENCE[nextIdx];
    });
  }, []);

  const handleCycleNextPitCompound = useCallback(() => {
    setNextPitCompound((prev) => {
      const nextIdx = (COMPOUND_SEQUENCE.indexOf(prev) + 1) % COMPOUND_SEQUENCE.length;
      return COMPOUND_SEQUENCE[nextIdx];
    });
  }, []);

  const handleTogglePitRequest = useCallback(() => {
    setPitRequestArmed((prev) => !prev);
  }, []);

  const handleCycleTrackRubberPreset = useCallback(() => {
    const sequence: TrackRubberPreset[] = ['progressive', 'green', 'rubbered', 'saturated'];
    setTrackRubberPreset((prev) => {
      const nextIdx = (sequence.indexOf(prev) + 1) % sequence.length;
      return sequence[nextIdx];
    });
  }, []);

  const handleSelectLevel = useCallback((lvl: ChampionshipLevelSpec) => {
    setActiveLevel(lvl);
    setSelectedTrack(TRACKS[lvl.trackId]);
    setWeatherCondition(lvl.weather);
    setStartingCompound(lvl.recommendedCompound);
    setNextPitCompound(lvl.recommendedCompound === 'soft' ? 'medium' : 'soft');
    setPitRequestArmed(false);
  }, []);

  // Start with 4,800 Championship Credits so players can immediately test upgrades
  const [credits, setCredits] = useState<number>(4800);
  const [driverName, setDriverName] = useState<string>('T. Nuvolari');

  const [raceResetTrigger, setRaceResetTrigger] = useState<number>(0);
  const [finishSummary, setFinishSummary] = useState<RaceFinishSummary | null>(null);
  const [lastEarnedCredits, setLastEarnedCredits] = useState<number>(0);

  // Multiplayer & Global Leaderboards state
  const [leaderboards, setLeaderboards] = useState<LeaderboardEntry[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [remoteRacers, setRemoteRacers] = useState<RemoteRacerTelemetry[]>([]);
  const remoteRacersRef = useRef<RemoteRacerTelemetry[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Touch input ref for mobile controls
  const touchInputRef = useRef<ControlInput>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    handbrake: false,
    nitro: false,
    pitRequest: false,
  });

  const activeLivery = liveryMap[selectedCar.id] || selectedCar.defaultLivery;
  const activeUpgrades = upgradesMap[selectedCar.id] || DEFAULT_UPGRADES;

  const effectiveStats = useMemo(
    () => computeEffectiveCarStats(selectedCar, activeUpgrades, tuning),
    [selectedCar, activeUpgrades, tuning]
  );

  const tuningLabel = useMemo(() => {
    if (activePresetKey !== 'custom' && TUNING_PRESETS[activePresetKey]) {
      return TUNING_PRESETS[activePresetKey].label;
    }
    return `Custom (${effectiveStats.balanceLabel})`;
  }, [activePresetKey, effectiveStats.balanceLabel]);

  const [hud, setHud] = useState<LiveHudSnapshot>(() => ({
    speedKmh: 0,
    rpm: 1200,
    gear: 1,
    lap: 1,
    totalLaps: selectedTrack.laps,
    position: 1,
    totalCars: 4,
    currentLapTimeMs: 0,
    bestLapTimeMs: 0,
    lastLapTimeMs: 0,
    isDrifting: false,
    isDrafting: false,
    isOffTrack: false,
    driftScore: 0,
    handbrake: false,
    isAquaplaning: false,
    nitroCharge: 100,
    isBoosting: false,
    trackRubberPercent: 18,
    onRacingLine: true,
    onMarbles: false,
    lineGripModifier: 1.02,
    weather: {
      condition: 'clear',
      activeType: 'clear',
      wetness: 0,
      rainIntensity: 0,
      gripMultiplier: 1.0,
      windX: 0,
      windZ: 0,
      lightningTimer: 0,
    },
    damage: {
      totalDamage: 0,
      frontCrumple: 0,
      rearCrumple: 0,
      leftFenderDent: 0,
      rightFenderDent: 0,
      hoodBuckle: 0,
      windshieldCrack: 0,
      radiatorPunctured: false,
      aeroPenalty: 0,
      enginePenalty: 0,
    },
    tires: createInitialTireState('medium'),
    standings: [],
  }));

  // Mirror game state to document.body.dataset.state
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  // Connect to REST API & WebSocket Server for Global Leaderboards & Multiplayer Ghosts
  useEffect(() => {
    let isMounted = true;
    let reconnectTimer = 0;

    fetch('/api/leaderboards')
      .then((r) => r.json())
      .then((data) => {
        if (!isMounted) return;
        if (Array.isArray(data.entries)) setLeaderboards(data.entries);
        if (typeof data.onlineCount === 'number') setOnlineCount(data.onlineCount);
      })
      .catch(() => {});

    const connectWs = () => {
      if (!isMounted) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}`;
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'init') {
              if (Array.isArray(msg.entries)) setLeaderboards(msg.entries);
              if (typeof msg.onlineCount === 'number') setOnlineCount(msg.onlineCount);
              if (Array.isArray(msg.activeRacers)) {
                remoteRacersRef.current = msg.activeRacers;
                setRemoteRacers(msg.activeRacers);
              }
            } else if (msg.type === 'leaderboard:updated' && Array.isArray(msg.entries)) {
              setLeaderboards(msg.entries);
            } else if (msg.type === 'presence:updated' && typeof msg.onlineCount === 'number') {
              setOnlineCount(msg.onlineCount);
            } else if (msg.type === 'racer:moved' && msg.racer) {
              const incoming: RemoteRacerTelemetry = msg.racer;
              const existing = remoteRacersRef.current.filter((r) => r.id !== incoming.id);
              const next = [...existing, incoming];
              remoteRacersRef.current = next;
              setRemoteRacers(next);
            } else if (msg.type === 'racer:left' && msg.id) {
              const next = remoteRacersRef.current.filter((r) => r.id !== msg.id);
              remoteRacersRef.current = next;
              setRemoteRacers(next);
              if (typeof msg.onlineCount === 'number') setOnlineCount(msg.onlineCount);
            }
          } catch {
            // ignore
          }
        };

        ws.onclose = () => {
          if (isMounted) {
            reconnectTimer = window.setTimeout(connectWs, 3500);
          }
        };
      } catch {
        // ignore
      }
    };

    connectWs();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const handleStartRace = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    racingAudio.init();
    setActiveModal('none');
    setFinishSummary(null);
    setPitRequestArmed(false);
    setRaceResetTrigger((prev) => prev + 1);
    setGameState('playing');
  }, []);

  const handleRestartRace = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setActiveModal('none');
    setFinishSummary(null);
    setPitRequestArmed(false);
    setRaceResetTrigger((prev) => prev + 1);
    setGameState('playing');
  }, []);

  const handleAdvanceNextLevel = useCallback(() => {
    const nextLvl =
      CHAMPIONSHIP_LEVELS.find((l) => l.level === activeLevel.level + 1) || CHAMPIONSHIP_LEVELS[0];
    handleSelectLevel(nextLvl);
    setActiveModal('none');
    setFinishSummary(null);
    setRaceResetTrigger((prev) => prev + 1);
    setGameState('playing');
  }, [activeLevel.level, handleSelectLevel]);

  const handleCycleCamera = useCallback(() => {
    setCameraMode((prev) => {
      const idx = CAMERA_SEQUENCE.indexOf(prev);
      return CAMERA_SEQUENCE[(idx + 1) % CAMERA_SEQUENCE.length];
    });
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      racingAudio.setMuted(next);
      return next;
    });
  }, []);

  const handleSubmitRecord = useCallback(
    async (params: {
      driverName: string;
      trackId: TrackId;
      bestLapMs: number;
      totalTimeMs: number;
      topSpeedKmh: number;
    }) => {
      const res = await fetch('/api/leaderboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverName: params.driverName,
          trackId: params.trackId,
          carId: selectedCar.id,
          carName: selectedCar.name,
          bestLapMs: params.bestLapMs,
          totalTimeMs: params.totalTimeMs,
          topSpeedKmh: params.topSpeedKmh,
          performanceIndex: effectiveStats.performanceIndex,
          liveryColor: activeLivery.bodyColor,
          liveryNumber: activeLivery.number,
          tuningLabel,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.entries)) {
          setLeaderboards(data.entries);
        }
      } else {
        throw new Error('Failed to post record');
      }
    },
    [selectedCar, effectiveStats.performanceIndex, activeLivery, tuningLabel]
  );

  const handleRaceFinish = useCallback(
    (summary: RaceFinishSummary) => {
      const baseEarned = calculateRaceRewardCredits(summary.position, summary.cleanRace);
      const stageBonus =
        summary.position <= activeLevel.targetPosition ? activeLevel.rewardCredits : 0;
      const earned = baseEarned + stageBonus;
      setCredits((prev) => prev + earned);
      setLastEarnedCredits(earned);
      setFinishSummary(summary);
      setGameState('gameover');
    },
    [activeLevel]
  );

  const handleBroadcastTelemetry = useCallback(
    (data: { x: number; y: number; z: number; yaw: number; speedKmh: number; lap: number }) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'racer:telemetry',
            data: {
              ...data,
              driverName,
              trackId: selectedTrack.id,
              carId: selectedCar.id,
              livery: activeLivery,
            },
          })
        );
      }
    },
    [driverName, selectedTrack.id, selectedCar.id, activeLivery]
  );

  // Global Keyboard Shortcuts (Title Start on Enter/Space, Pause on Esc/P, Camera on C, Tire Compound on T, Pit Request on B, Mute on M, Restart on R)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (gameState === 'title' && activeModal === 'none') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStartRace();
          return;
        }
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (activeModal !== 'none') {
          setActiveModal('none');
          return;
        }
        if (gameState === 'playing') {
          setGameState('paused');
        } else if (gameState === 'paused') {
          setGameState('playing');
        }
      } else if (e.code === 'KeyC' && (gameState === 'playing' || gameState === 'paused')) {
        handleCycleCamera();
      } else if (e.code === 'KeyT' && (gameState === 'playing' || gameState === 'paused')) {
        handleCycleNextPitCompound();
      } else if (e.code === 'KeyB' && gameState === 'playing') {
        handleTogglePitRequest();
      } else if (e.code === 'KeyM') {
        handleToggleMute();
      } else if (e.code === 'KeyR' && gameState === 'playing') {
        handleRestartRace();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    gameState,
    activeModal,
    handleStartRace,
    handleCycleCamera,
    handleCycleNextPitCompound,
    handleTogglePitRequest,
    handleToggleMute,
    handleRestartRace,
  ]);

  const handleBuyUpgrade = (system: keyof CarUpgrades) => {
    const currLvl = activeUpgrades[system];
    const cost = getUpgradeCost(currLvl);
    if (currLvl >= 5 || credits < cost) return;
    setCredits((prev) => prev - cost);
    setUpgradesMap((prev) => ({
      ...prev,
      [selectedCar.id]: {
        ...activeUpgrades,
        [system]: currLvl + 1,
      },
    }));
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden select-none bg-[#0d0c0b]">
      {/* Isolated 3D WebGL Viewport */}
      <RaceCanvas
        gameState={gameState}
        isGarageOpen={activeModal === 'garage'}
        selectedCar={selectedCar}
        livery={activeLivery}
        effectiveStats={effectiveStats}
        selectedTrack={selectedTrack}
        cameraMode={cameraMode}
        driverName={driverName}
        weatherCondition={weatherCondition}
        damageMode={damageMode}
        trackRubberPreset={trackRubberPreset}
        startingCompound={startingCompound}
        nextPitCompound={nextPitCompound}
        pitRequestArmed={pitRequestArmed}
        tireWearMultiplier={activeLevel.tireWearMultiplier}
        raceResetTrigger={raceResetTrigger}
        touchInputRef={touchInputRef}
        remoteRacersRef={remoteRacersRef}
        onUpdatePitRequestArmed={setPitRequestArmed}
        onHudUpdate={setHud}
        onRaceFinish={handleRaceFinish}
        onBroadcastTelemetry={handleBroadcastTelemetry}
      />

      {/* TITLE SCREEN OVERLAY */}
      {gameState === 'title' && activeModal === 'none' && (
        <TitleScreen
          selectedCar={selectedCar}
          livery={activeLivery}
          effectiveStats={effectiveStats}
          selectedTrack={selectedTrack}
          activeLevel={activeLevel}
          startingCompound={startingCompound}
          credits={credits}
          onlineCount={onlineCount}
          onStartRace={handleStartRace}
          onOpenGarage={() => setActiveModal('garage')}
          onOpenTracks={() => setActiveModal('tracks')}
          onOpenLeaderboards={() => setActiveModal('leaderboards')}
        />
      )}

      {/* PLAYING HUD OVERLAY */}
      {gameState === 'playing' && (
        <RacingHud
          hud={hud}
          track={selectedTrack}
          activeLevel={activeLevel}
          cameraMode={cameraMode}
          isMuted={isMuted}
          nextPitCompound={nextPitCompound}
          pitRequestArmed={pitRequestArmed}
          remoteRacers={remoteRacers}
          touchInputRef={touchInputRef}
          onCycleCamera={handleCycleCamera}
          onCycleNextPitCompound={handleCycleNextPitCompound}
          onTogglePitRequest={handleTogglePitRequest}
          onToggleMute={handleToggleMute}
          onPause={() => setGameState('paused')}
          onRestart={handleRestartRace}
        />
      )}

      {/* GARAGE, LIVERY, UPGRADES & TUNING WORKSHOP MODAL */}
      {activeModal === 'garage' && (
        <GarageModal
          selectedCar={selectedCar}
          livery={activeLivery}
          upgrades={activeUpgrades}
          tuning={tuning}
          effectiveStats={effectiveStats}
          credits={credits}
          activePresetKey={activePresetKey}
          onSelectCar={(car) => setSelectedCar(car)}
          onUpdateLivery={(newLiv) =>
            setLiveryMap((prev) => ({
              ...prev,
              [selectedCar.id]: newLiv,
            }))
          }
          onBuyUpgrade={handleBuyUpgrade}
          onUpdateTuning={(newTuning, presetKey) => {
            setTuning(newTuning);
            if (presetKey) setActivePresetKey(presetKey);
          }}
          onClose={() => setActiveModal('none')}
        />
      )}

      {/* CIRCUIT & CHAMPIONSHIP LEVELS SELECTION MODAL */}
      {activeModal === 'tracks' && (
        <TrackModal
          selectedTrack={selectedTrack}
          activeLevel={activeLevel}
          weatherCondition={weatherCondition}
          trackRubberPreset={trackRubberPreset}
          startingCompound={startingCompound}
          onSelectTrack={(track) => {
            setSelectedTrack(track);
            const matchingLevel = CHAMPIONSHIP_LEVELS.find((l) => l.trackId === track.id);
            if (matchingLevel) setActiveLevel(matchingLevel);
          }}
          onSelectLevel={handleSelectLevel}
          onCycleWeather={handleCycleWeather}
          onCycleTrackRubberPreset={handleCycleTrackRubberPreset}
          onCycleStartingCompound={handleCycleStartingCompound}
          onClose={() => setActiveModal('none')}
        />
      )}

      {/* GLOBAL MULTIPLAYER LEADERBOARDS MODAL */}
      {activeModal === 'leaderboards' && (
        <LeaderboardModal
          entries={leaderboards}
          activeTrackId={selectedTrack.id}
          driverName={driverName}
          selectedCar={selectedCar}
          livery={activeLivery}
          effectiveStats={effectiveStats}
          tuningLabel={tuningLabel}
          onlineCount={onlineCount}
          lastBestLapMs={hud.bestLapTimeMs || finishSummary?.bestLapMs || 0}
          onUpdateDriverName={setDriverName}
          onSubmitRecord={handleSubmitRecord}
          onClose={() => setActiveModal('none')}
        />
      )}

      {/* PAUSE & PODIUM / RACE FINISH STATUS MODALS */}
      {activeModal === 'none' && (gameState === 'paused' || gameState === 'gameover') && (
        <StatusModal
          gameState={gameState}
          finishSummary={finishSummary}
          activeLevel={activeLevel}
          creditsEarned={lastEarnedCredits}
          cameraMode={cameraMode}
          weatherCondition={weatherCondition}
          nextPitCompound={nextPitCompound}
          trackRubberPreset={trackRubberPreset}
          onCycleCamera={handleCycleCamera}
          onCycleWeather={handleCycleWeather}
          onCycleNextPitCompound={handleCycleNextPitCompound}
          onCycleTrackRubberPreset={handleCycleTrackRubberPreset}
          onResume={() => setGameState('playing')}
          onRestart={handleRestartRace}
          onAdvanceNextLevel={handleAdvanceNextLevel}
          onOpenGarageFromPause={() => setActiveModal('garage')}
          onExitToTitle={() => {
            setActiveModal('none');
            setGameState('title');
          }}
          onPostFinishToLeaderboard={async () => {
            if (!finishSummary) return;
            await handleSubmitRecord({
              driverName,
              trackId: selectedTrack.id,
              bestLapMs: finishSummary.bestLapMs,
              totalTimeMs: finishSummary.totalTimeMs,
              topSpeedKmh: finishSummary.topSpeedKmh,
            });
          }}
        />
      )}
    </main>
  );
}
