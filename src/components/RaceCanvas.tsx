import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CameraMode,
  CarLivery,
  ClassicCarSpec,
  ControlInput,
  DamageMode,
  EffectiveCarStats,
  GameState,
  GarageCameraView,
  RemoteRacerTelemetry,
  TireCompound,
  TireGripSurfaceParams,
  TrackRubberPreset,
  TrackRubberState,
  TrackSpec,
  VehicleDamageState,
  VehiclePhysicsState,
  VehicleTireState,
  WeatherCondition,
  WeatherState,
} from '../game/types';
import { AI_RIVALS, CLASSIC_CARS, DEFAULT_TUNING } from '../game/cars';
import {
  applyTrackRubberPreset,
  computeAIControls,
  computeEffectiveCarStats,
  createInitialTrackRubberState,
  createInitialVehicleState,
  createInitialWeatherState,
  getSortedStandings,
  resolveMultiVehicleInteractions,
  stepVehiclePhysics,
  updateWeather,
} from '../game/physics';
import {
  buildClassicCarMesh,
  CarMeshRig,
  createLiveryCanvasTexture,
  updateCarWipers,
} from '../game/carBuilder';
import {
  buildTrackEnvironment,
  createParticlePool,
  createRainSystem,
  RainSystem,
  TrackEnvironmentRig,
} from '../game/sceneBuilder';
import { createSkidMarkSystem, SkidMarkSystem } from '../game/skidMarks';
import { findClosestTrackSample } from '../game/tracks';
import { racingAudio } from '../game/audio';

export interface LiveHudSnapshot {
  speedKmh: number;
  rpm: number;
  gear: number;
  lap: number;
  totalLaps: number;
  position: number;
  totalCars: number;
  currentLapTimeMs: number;
  bestLapTimeMs: number;
  lastLapTimeMs: number;
  isDrifting: boolean;
  isDrafting: boolean;
  isOffTrack: boolean;
  driftScore: number;
  handbrake: boolean;
  isAquaplaning: boolean;
  nitroCharge: number;
  isBoosting: boolean;
  trackRubberPercent: number;
  onRacingLine: boolean;
  onMarbles: boolean;
  lineGripModifier: number;
  surfaceGripParams: TireGripSurfaceParams;
  weather: WeatherState;
  damage: VehicleDamageState;
  tires: VehicleTireState;
  standings: Array<{
    id: string;
    driverName: string;
    isPlayer: boolean;
    position: number;
    lap: number;
    x: number;
    z: number;
    color: string;
    brakeTelegraph: boolean;
    compound: TireCompound;
    pitStops: number;
  }>;
}

export interface RaceFinishSummary {
  position: number;
  totalTimeMs: number;
  bestLapMs: number;
  topSpeedKmh: number;
  cleanRace: boolean;
  pitStopsCompleted: number;
  standings: Array<{
    position: number;
    driverName: string;
    carName: string;
    isPlayer: boolean;
    totalTimeMs: number;
    bestLapMs: number;
  }>;
}

interface RaceCanvasProps {
  gameState: GameState;
  isGarageOpen: boolean;
  garageCameraView?: GarageCameraView;
  selectedCar: ClassicCarSpec;
  livery: CarLivery;
  effectiveStats: EffectiveCarStats;
  selectedTrack: TrackSpec;
  cameraMode: CameraMode;
  driverName: string;
  weatherCondition: WeatherCondition;
  damageMode: DamageMode;
  trackRubberPreset: TrackRubberPreset;
  startingCompound: TireCompound;
  nextPitCompound: TireCompound;
  pitRequestArmed: boolean;
  tireWearMultiplier: number;
  raceResetTrigger: number;
  touchInputRef: React.MutableRefObject<ControlInput>;
  remoteRacersRef: React.MutableRefObject<RemoteRacerTelemetry[]>;
  onUpdatePitRequestArmed: (armed: boolean) => void;
  onHudUpdate: (snapshot: LiveHudSnapshot) => void;
  onRaceFinish: (summary: RaceFinishSummary) => void;
  onBroadcastTelemetry: (data: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    speedKmh: number;
    lap: number;
  }) => void;
}

const _camTargetPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();
const _smoothLookAt = new THREE.Vector3();
const _ghostTargetPos = new THREE.Vector3();

function disposeMaterial(mat: THREE.Material) {
  const anyMat = mat as unknown as Record<string, unknown>;
  for (const key of ['map', 'bumpMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) {
    const tex = anyMat[key] as THREE.Texture | undefined;
    if (tex && !tex.userData?.shared) {
      tex.dispose();
    }
  }
  mat.dispose();
}

function disposeObject3D(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      geometries.add(mesh.geometry);
    }
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        for (const m of mesh.material) materials.add(m);
      } else {
        materials.add(mesh.material);
      }
    }
  });

  for (const geo of geometries) {
    geo.dispose();
  }
  for (const mat of materials) {
    disposeMaterial(mat);
  }
}

export const RaceCanvas: React.FC<RaceCanvasProps> = ({
  gameState,
  isGarageOpen,
  garageCameraView = 'orbit',
  selectedCar,
  livery,
  effectiveStats,
  selectedTrack,
  cameraMode,
  driverName,
  weatherCondition,
  damageMode,
  trackRubberPreset,
  startingCompound,
  nextPitCompound,
  pitRequestArmed,
  tireWearMultiplier,
  raceResetTrigger,
  touchInputRef,
  remoteRacersRef,
  onUpdatePitRequestArmed,
  onHudUpdate,
  onRaceFinish,
  onBroadcastTelemetry,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const stateRef = useRef({
    gameState,
    isGarageOpen,
    garageCameraView,
    selectedCar,
    livery,
    effectiveStats,
    selectedTrack,
    cameraMode,
    driverName,
    weatherCondition,
    damageMode,
    trackRubberPreset,
    startingCompound,
    nextPitCompound,
    pitRequestArmed,
    tireWearMultiplier,
    onUpdatePitRequestArmed,
    onHudUpdate,
    onRaceFinish,
    onBroadcastTelemetry,
  });

  useEffect(() => {
    stateRef.current = {
      gameState,
      isGarageOpen,
      garageCameraView,
      selectedCar,
      livery,
      effectiveStats,
      selectedTrack,
      cameraMode,
      driverName,
      weatherCondition,
      damageMode,
      trackRubberPreset,
      startingCompound,
      nextPitCompound,
      pitRequestArmed,
      tireWearMultiplier,
      onUpdatePitRequestArmed,
      onHudUpdate,
      onRaceFinish,
      onBroadcastTelemetry,
    };
  }, [
    gameState,
    isGarageOpen,
    garageCameraView,
    selectedCar,
    livery,
    effectiveStats,
    selectedTrack,
    cameraMode,
    driverName,
    weatherCondition,
    damageMode,
    trackRubberPreset,
    startingCompound,
    nextPitCompound,
    pitRequestArmed,
    tireWearMultiplier,
    onUpdatePitRequestArmed,
    onHudUpdate,
    onRaceFinish,
    onBroadcastTelemetry,
  ]);

  const rebuildTrackRef = useRef<((track: TrackSpec) => void) | null>(null);
  const rebuildPlayerCarRef = useRef<((spec: ClassicCarSpec, liv: CarLivery) => void) | null>(null);
  const updatePlayerLiveryOnlyRef = useRef<((liv: CarLivery) => void) | null>(null);
  const resetRaceSimulationRef = useRef<(() => void) | null>(null);
  const updateWeatherConditionRef = useRef<((cond: WeatherCondition) => void) | null>(null);
  const updateRubberPresetRef = useRef<((preset: TrackRubberPreset) => void) | null>(null);
  const syncPitStrategyRef = useRef<((nextComp: TireCompound, armed: boolean) => void) | null>(null);

  const prevCarIdRef = useRef(selectedCar.id);
  const prevWheelFinishRef = useRef(livery.wheelFinish);

  useEffect(() => {
    if (rebuildTrackRef.current) {
      rebuildTrackRef.current(selectedTrack);
    }
    if (resetRaceSimulationRef.current) {
      resetRaceSimulationRef.current();
    }
  }, [selectedTrack]);

  useEffect(() => {
    const carChanged = prevCarIdRef.current !== selectedCar.id;
    const wheelChanged = prevWheelFinishRef.current !== livery.wheelFinish;
    prevCarIdRef.current = selectedCar.id;
    prevWheelFinishRef.current = livery.wheelFinish;

    if (carChanged || wheelChanged) {
      rebuildPlayerCarRef.current?.(selectedCar, livery);
    } else {
      updatePlayerLiveryOnlyRef.current?.(livery);
    }
  }, [selectedCar, livery]);

  useEffect(() => {
    if (updateWeatherConditionRef.current) {
      updateWeatherConditionRef.current(weatherCondition);
    }
  }, [weatherCondition]);

  useEffect(() => {
    if (updateRubberPresetRef.current) {
      updateRubberPresetRef.current(trackRubberPreset);
    }
  }, [trackRubberPreset]);

  useEffect(() => {
    syncPitStrategyRef.current?.(nextPitCompound, pitRequestArmed);
  }, [nextPitCompound, pitRequestArmed]);

  useEffect(() => {
    if (resetRaceSimulationRef.current) {
      resetRaceSimulationRef.current();
    }
  }, [raceResetTrigger, startingCompound]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initialRect = container.getBoundingClientRect();
    renderer.setSize(initialRect.width || window.innerWidth, initialRect.height || window.innerHeight);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      62,
      (initialRect.width || window.innerWidth) / Math.max(1, initialRect.height || window.innerHeight),
      0.2,
      900
    );

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x3a4f28, 0.68);
    hemiLight.position.set(0, 80, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff1d0, 1.95);
    dirLight.position.set(65, 110, 45);
    if (!isSoftwareGl) {
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      const d = 75;
      dirLight.shadow.camera.left = -d;
      dirLight.shadow.camera.right = d;
      dirLight.shadow.camera.top = d;
      dirLight.shadow.camera.bottom = -d;
      dirLight.shadow.camera.near = 10;
      dirLight.shadow.camera.far = 260;
      dirLight.shadow.bias = -0.0004;
      dirLight.shadow.normalBias = 0.018;
    }
    scene.add(dirLight);
    scene.add(dirLight.target);

    // Dynamic Systems: Particles, Skid Marks, and Rain
    const particles = createParticlePool(180);
    scene.add(particles.mesh);

    const skidMarks: SkidMarkSystem = createSkidMarkSystem(900);
    scene.add(skidMarks.mesh);

    const rainSystem: RainSystem = createRainSystem(isSoftwareGl ? 450 : 750);
    scene.add(rainSystem.lines);

    // Track & Vehicle containers
    let trackEnvRig: TrackEnvironmentRig | null = null;
    const vehiclesGroup = new THREE.Group();
    scene.add(vehiclesGroup);

    const remoteGhostsGroup = new THREE.Group();
    scene.add(remoteGhostsGroup);
    const remoteGhostMeshes = new Map<string, CarMeshRig>();

    let carRigs: Map<string, CarMeshRig> = new Map();
    let vehiclesState: VehiclePhysicsState[] = [];
    const aiEffectiveStats = new Map<string, EffectiveCarStats>();

    let currentWeather: WeatherState = createInitialWeatherState(stateRef.current.weatherCondition);
    let currentRubberState: TrackRubberState = createInitialTrackRubberState(
      stateRef.current.selectedTrack.samples.length,
      stateRef.current.trackRubberPreset
    );
    let driftScoreAccumulator = 0;
    let raceElapsedMs = 0;
    let cleanRaceFlag = true;
    let hitstopTimer = 0;
    let trauma = 0;
    let titleOrbitAngle = 0.4;
    let lastHudEmitTime = 0;
    let lastBroadcastTime = 0;

    const buildTrack = (track: TrackSpec) => {
      if (trackEnvRig) {
        scene.remove(trackEnvRig.group);
        disposeObject3D(trackEnvRig.group);
      }
      scene.background = new THREE.Color(track.theme.skyHorizon);
      scene.fog = new THREE.FogExp2(track.theme.fogColor, track.theme.fogDensity);
      hemiLight.color.set(track.theme.hemiSky);
      hemiLight.groundColor.set(track.theme.hemiGround);
      dirLight.color.set(track.theme.sunColor);

      currentRubberState = createInitialTrackRubberState(
        track.samples.length,
        stateRef.current.trackRubberPreset
      );
      trackEnvRig = buildTrackEnvironment(track, isSoftwareGl, maxAnisotropy);
      trackEnvRig.updateWeatherVisuals(currentWeather);
      trackEnvRig.updateTrackRubberVisuals(currentRubberState, currentWeather);
      scene.add(trackEnvRig.group);
      skidMarks.clear();
    };

    const updateWeatherCondition = (cond: WeatherCondition) => {
      currentWeather = createInitialWeatherState(cond);
      if (trackEnvRig) {
        trackEnvRig.updateWeatherVisuals(currentWeather);
        trackEnvRig.updateTrackRubberVisuals(currentRubberState, currentWeather);
      }
    };

    const updateRubberPreset = (preset: TrackRubberPreset) => {
      applyTrackRubberPreset(currentRubberState, preset);
      if (trackEnvRig) {
        trackEnvRig.updateTrackRubberVisuals(currentRubberState, currentWeather);
      }
    };

    const initRaceVehicles = () => {
      const {
        selectedCar: pCar,
        livery: pLivery,
        selectedTrack: track,
        driverName: dName,
        trackRubberPreset: rPreset,
        startingCompound: sCompound,
        nextPitCompound: nCompound,
      } = stateRef.current;

      disposeObject3D(vehiclesGroup);
      vehiclesGroup.clear();
      carRigs.clear();
      aiEffectiveStats.clear();
      skidMarks.clear();
      driftScoreAccumulator = 0;

      currentRubberState = createInitialTrackRubberState(track.samples.length, rPreset);
      if (trackEnvRig) {
        trackEnvRig.updateTrackRubberVisuals(currentRubberState, currentWeather);
      }

      const playerVehicle = createInitialVehicleState({
        id: 'player',
        isPlayer: true,
        driverName: dName || 'Historic Driver',
        carSpecId: pCar.id,
        livery: pLivery,
        track,
        gridSlot: 0,
        startingCompound: sCompound,
      });
      playerVehicle.tires.nextPitCompound = nCompound;

      const playerRig = buildClassicCarMesh(pCar, pLivery, isSoftwareGl, maxAnisotropy);
      vehiclesGroup.add(playerRig.root);
      carRigs.set('player', playerRig);

      const newVehicles: VehiclePhysicsState[] = [playerVehicle];
      const aiCompounds: TireCompound[] = ['soft', 'medium', 'hard'];

      AI_RIVALS.forEach((rival, idx) => {
        const spec = CLASSIC_CARS.find((c) => c.id === rival.carSpecId) || CLASSIC_CARS[0];
        const aiUpgrades = {
          engineLevel: 2,
          transmissionLevel: 2,
          tiresLevel: 2,
          chassisWeightLevel: 2,
        };
        aiEffectiveStats.set(`ai-${idx}`, computeEffectiveCarStats(spec, aiUpgrades, DEFAULT_TUNING));

        const aiStartCompound: TireCompound =
          currentWeather.wetness > 0.35 ? 'wet' : aiCompounds[idx % aiCompounds.length];
        const aiState = createInitialVehicleState({
          id: `ai-${idx}`,
          isPlayer: false,
          driverName: rival.name,
          carSpecId: spec.id,
          livery: rival.livery,
          track,
          gridSlot: idx + 1,
          archetype: rival.archetype,
          startingCompound: aiStartCompound,
        });
        newVehicles.push(aiState);

        const aiRig = buildClassicCarMesh(spec, rival.livery, isSoftwareGl, maxAnisotropy);
        vehiclesGroup.add(aiRig.root);
        carRigs.set(aiState.id, aiRig);
      });

      vehiclesState = newVehicles;
      raceElapsedMs = 0;
      cleanRaceFlag = true;
      hitstopTimer = 0;
      trauma = 0;

      for (const v of vehiclesState) {
        const rig = carRigs.get(v.id);
        if (rig) {
          rig.root.position.set(v.x, v.y, v.z);
          rig.root.rotation.set(0, v.yaw, 0);
        }
      }

      const p = vehiclesState[0];
      const initAngle = p.yaw + 0.58;
      titleOrbitAngle = initAngle;
      const radX = Math.sin(initAngle) * 6.2;
      const radZ = Math.cos(initAngle) * 6.2;
      const lookLeftX = -Math.cos(initAngle) * 1.15;
      const lookLeftZ = Math.sin(initAngle) * 1.15;
      camera.position.set(p.x + radX, p.y + 1.85, p.z + radZ);
      _smoothLookAt.set(p.x + lookLeftX, p.y + 0.52, p.z + lookLeftZ);
      camera.lookAt(_smoothLookAt);
    };

    const rebuildPlayerCar = (spec: ClassicCarSpec, liv: CarLivery) => {
      const oldRig = carRigs.get('player');
      if (oldRig) {
        vehiclesGroup.remove(oldRig.root);
        disposeObject3D(oldRig.root);
      }
      const newRig = buildClassicCarMesh(spec, liv, isSoftwareGl, maxAnisotropy);
      vehiclesGroup.add(newRig.root);
      carRigs.set('player', newRig);

      if (vehiclesState[0]) {
        vehiclesState[0].carSpecId = spec.id;
        vehiclesState[0].livery = liv;
        newRig.root.position.set(vehiclesState[0].x, vehiclesState[0].y, vehiclesState[0].z);
        newRig.root.rotation.set(0, vehiclesState[0].yaw, 0);
      }
      renderer.render(scene, camera);
    };

    const updatePlayerLiveryOnly = (liv: CarLivery) => {
      const rig = carRigs.get('player');
      if (!rig) return;
      const newTex = createLiveryCanvasTexture(
        liv,
        maxAnisotropy,
        stateRef.current.selectedCar.bodyStyle
      );
      rig.liveryTexture.dispose();
      rig.liveryTexture = newTex;
      rig.bodyPaintMat.map = newTex;
      rig.bodyPaintMat.needsUpdate = true;
      if (vehiclesState[0]) {
        vehiclesState[0].livery = liv;
      }
      renderer.render(scene, camera);
    };

    const syncPitStrategy = (nextComp: TireCompound, armed: boolean) => {
      if (vehiclesState[0]) {
        vehiclesState[0].tires.nextPitCompound = nextComp;
        vehiclesState[0].tires.pitRequest = armed;
      }
    };

    rebuildTrackRef.current = buildTrack;
    rebuildPlayerCarRef.current = rebuildPlayerCar;
    updatePlayerLiveryOnlyRef.current = updatePlayerLiveryOnly;
    resetRaceSimulationRef.current = initRaceVehicles;
    updateWeatherConditionRef.current = updateWeatherCondition;
    updateRubberPresetRef.current = updateRubberPreset;
    syncPitStrategyRef.current = syncPitStrategy;

    buildTrack(stateRef.current.selectedTrack);
    initRaceVehicles();

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const keysHeld = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      keysHeld.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysHeld.delete(e.code);
    };
    const clearInputs = () => {
      keysHeld.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
          renderer.render(scene, camera);
        }
      }
    });
    resizeObserver.observe(container);

    let frameId = 0;
    let isDisposed = false;
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (isDisposed) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      if (isDisposed) return;
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      const {
        gameState: currentGameState,
        isGarageOpen: garageOpen,
        effectiveStats: pStats,
        selectedTrack: track,
        cameraMode: camMode,
        selectedCar: pCarSpec,
        damageMode,
        tireWearMultiplier: wearMult,
        nextPitCompound: activeNextPitComp,
        pitRequestArmed: activePitArmed,
      } = stateRef.current;

      const player = vehiclesState[0];

      if (currentGameState === 'playing' && player) {
        player.tires.nextPitCompound = activeNextPitComp;
        if (activePitArmed) {
          player.tires.pitRequest = true;
        }

        trauma = Math.max(0, trauma - dt * 1.8);
        if (hitstopTimer > 0) {
          hitstopTimer = Math.max(0, hitstopTimer - dt);
        } else {
          raceElapsedMs += dt * 1000;

          // Update Dynamic Weather, Puddle Formation, Track Drying & Track Rubbering Visuals in real-time
          updateWeather(currentWeather, dt, raceElapsedMs, track, vehiclesState);
          if (trackEnvRig) {
            trackEnvRig.updateWeatherVisuals(currentWeather);
            trackEnvRig.updateTrackRubberVisuals(currentRubberState, currentWeather);
          }

          // Rain streaks & Skid marks updates
          rainSystem.update(camera.position, currentWeather, dt);
          skidMarks.update(dt);

          // Combine keyboard & analog/digital touch inputs
          const tInput = touchInputRef.current;
          const playerInput: ControlInput = {
            forward: keysHeld.has('KeyW') || keysHeld.has('ArrowUp') || tInput.forward,
            backward: keysHeld.has('KeyS') || keysHeld.has('ArrowDown') || tInput.backward,
            left: keysHeld.has('KeyA') || keysHeld.has('ArrowLeft') || tInput.left,
            right: keysHeld.has('KeyD') || keysHeld.has('ArrowRight') || tInput.right,
            handbrake: keysHeld.has('Space') || tInput.handbrake,
            nitro:
              keysHeld.has('ShiftLeft') ||
              keysHeld.has('ShiftRight') ||
              keysHeld.has('KeyN') ||
              keysHeld.has('KeyX') ||
              Boolean(tInput.nitro),
            pitRequest: keysHeld.has('KeyB') || Boolean(tInput.pitRequest) || activePitArmed,
            steerAxis: tInput.steerAxis,
          };

          // Step Player Physics with Weather, Tire Wear/Heat/Integrity, Pit Service & Track Rubbering
          const pEvents = stepVehiclePhysics(
            player,
            playerInput,
            pStats,
            track,
            dt,
            raceElapsedMs,
            currentWeather,
            damageMode,
            currentRubberState,
            wearMult
          );
          if (player.isOffTrack) cleanRaceFlag = false;

          if (pEvents.pitStopCompleted) {
            stateRef.current.onUpdatePitRequestArmed(false);
            racingAudio.playLapChime(false);
            const fx = Math.sin(player.yaw);
            const fz = Math.cos(player.yaw);
            const rx = fz;
            const rz = -fx;
            for (const cOff of [
              [-0.82, 1.25],
              [0.82, 1.25],
              [-0.82, -1.22],
              [0.82, -1.22],
            ]) {
              for (let s = 0; s < 6; s++) {
                particles.spawn(
                  player.x + rx * cOff[0] + fx * cOff[1],
                  player.y + 0.34,
                  player.z + rz * cOff[0] + fz * cOff[1],
                  (Math.random() - 0.5) * 6,
                  1.5 + Math.random() * 3.5,
                  (Math.random() - 0.5) * 6,
                  s % 2 === 0 ? 0x38bdf8 : 0xfef08a,
                  0.65,
                  0.38
                );
              }
            }
          }

          // Lay down persistent dual tire tracks if tires are slipping
          if (pEvents.tireSlipping) {
            const fx = Math.sin(player.yaw);
            const fz = Math.cos(player.yaw);
            const rx = fz;
            const rz = -fx;
            const halfTrack = 0.78;
            const rearOff = -1.2;
            const bankLift = Math.sin(player.rollRad) * halfTrack;

            const lx = player.x - rx * halfTrack + fx * rearOff;
            const lz = player.z - rz * halfTrack + fz * rearOff;
            const rxPos = player.x + rx * halfTrack + fx * rearOff;
            const rzPos = player.z + rz * halfTrack + fz * rearOff;
            skidMarks.addMarkPair(
              player.id,
              lx,
              player.y - bankLift,
              lz,
              rxPos,
              player.y + bankLift,
              rzPos,
              pEvents.slipIntensity,
              raceElapsedMs
            );

            // Under heavy braking, front tires also leave lockup traces
            if (player.brake > 0.65 && player.speedMs > 8) {
              const frontOff = 1.22;
              skidMarks.addMarkPair(
                'player-front',
                player.x - rx * halfTrack + fx * frontOff,
                player.y - bankLift,
                player.z - rz * halfTrack + fz * frontOff,
                player.x + rx * halfTrack + fx * frontOff,
                player.y + bankLift,
                player.z + rz * halfTrack + fz * frontOff,
                pEvents.slipIntensity * 0.75,
                raceElapsedMs
              );
            }
          }

          // Continuous Armco barrier scraping sparks at exact barrier contact coordinates
          if (pEvents.wallScrapeSpeedMs > 4.0) {
            const fx = Math.sin(player.yaw);
            const fz = Math.cos(player.yaw);
            for (let s = 0; s < 3; s++) {
              particles.spawn(
                pEvents.wallContactX,
                pEvents.wallContactY,
                pEvents.wallContactZ,
                -fx * (player.speedMs * 0.45) + (Math.random() - 0.5) * 6,
                1.2 + Math.random() * 3.8,
                -fz * (player.speedMs * 0.45) + (Math.random() - 0.5) * 6,
                s % 2 === 0 ? 0xfbbf24 : 0xfef08a,
                0.52,
                0.24
              );
            }
          }

          // Accumulate Drift Points
          if (player.isDrifting) {
            driftScoreAccumulator += Math.round(
              player.speedMs * Math.abs(player.slipAngleRad) * 45 * dt * (player.handbrake ? 1.4 : 1.0)
            );
          }

          if (pEvents.gearChanged) {
            racingAudio.playGearShift();
            const pRig = carRigs.get('player');
            if (pRig) {
              pRig.exhaustFlameTimer = 0.22;
            }
          }

          if (pEvents.lapCompleted) {
            racingAudio.playLapChime(pEvents.raceFinished);
          }

          // Step AI Competitors (also depositing rubber & managing tire pit strategy!)
          for (let i = 1; i < vehiclesState.length; i++) {
            const ai = vehiclesState[i];
            const aiStats = aiEffectiveStats.get(ai.id) || pStats;
            const aiCtrl = computeAIControls(ai, vehiclesState, track, dt, currentWeather);
            const aiEvents = stepVehiclePhysics(
              ai,
              aiCtrl,
              aiStats,
              track,
              dt,
              raceElapsedMs,
              currentWeather,
              damageMode,
              currentRubberState,
              wearMult
            );

            if (aiEvents.gearChanged) {
              const aiRig = carRigs.get(ai.id);
              if (aiRig) {
                aiRig.exhaustFlameTimer = 0.18;
              }
            }

            if (aiEvents.tireSlipping) {
              const afx = Math.sin(ai.yaw);
              const afz = Math.cos(ai.yaw);
              const arx = afz;
              const arz = -afx;
              const halfTrack = 0.78;
              const rearOff = -1.2;
              const aiBankLift = Math.sin(ai.rollRad) * halfTrack;
              skidMarks.addMarkPair(
                ai.id,
                ai.x - arx * halfTrack + afx * rearOff,
                ai.y - aiBankLift,
                ai.z - arz * halfTrack + afz * rearOff,
                ai.x + arx * halfTrack + afx * rearOff,
                ai.y + aiBankLift,
                ai.z + arz * halfTrack + afz * rearOff,
                aiEvents.slipIntensity,
                raceElapsedMs
              );
            }
          }

          // Multi-vehicle collision & tangential rubbing resolution with world contact coordinates
          const { playerImpactSpeedMs, collisionContacts } = resolveMultiVehicleInteractions(
            vehiclesState,
            damageMode
          );

          for (const contact of collisionContacts) {
            const sparkCount = Math.min(18, Math.round(5 + contact.impactSpeedMs * 1.1));
            for (let s = 0; s < sparkCount; s++) {
              particles.spawn(
                contact.x + (Math.random() - 0.5) * 0.6,
                contact.y + (Math.random() - 0.5) * 0.25,
                contact.z + (Math.random() - 0.5) * 0.6,
                (Math.random() - 0.5) * 15,
                2.2 + Math.random() * 6.5,
                (Math.random() - 0.5) * 15,
                s % 3 === 0 ? 0xfef08a : s % 2 === 0 ? 0xf59e0b : 0xf97316,
                0.65,
                0.34
              );
            }
            // Tangential tire-rubbing smoke puff at contact point
            particles.spawn(
              contact.x,
              contact.y,
              contact.z,
              (Math.random() - 0.5) * 3,
              1.0 + Math.random() * 1.4,
              (Math.random() - 0.5) * 3,
              0xe2e8f0,
              1.25,
              0.38
            );
          }

          const combinedImpactMs = Math.max(playerImpactSpeedMs, pEvents.wallImpactSpeedMs);
          if (combinedImpactMs > 2.2) {
            cleanRaceFlag = false;
            if (playerImpactSpeedMs > 3.5) {
              hitstopTimer = Math.min(0.055, 0.02 + (playerImpactSpeedMs / 35) * 0.035);
            }
            trauma = Math.min(1.0, trauma + 0.28 + (combinedImpactMs / 30) * 0.52);
            racingAudio.playCollision(combinedImpactMs);

            if (pEvents.wallImpactSpeedMs > 2.0) {
              for (let s = 0; s < 14; s++) {
                particles.spawn(
                  pEvents.wallContactX + (Math.random() - 0.5) * 0.5,
                  pEvents.wallContactY,
                  pEvents.wallContactZ + (Math.random() - 0.5) * 0.5,
                  (Math.random() - 0.5) * 14,
                  2 + Math.random() * 6,
                  (Math.random() - 0.5) * 14,
                  s % 2 === 0 ? 0xfbbf24 : 0xfef08a,
                  0.68,
                  0.32
                );
              }
            }
          }

          // Tire smoke, Off-line rubber marble pickup, Off-track dirt, and Wet Water Spray
          for (const v of vehiclesState) {
            const fx = Math.sin(v.yaw);
            const fz = Math.cos(v.yaw);
            const rx = fz;
            const rz = -fx;

            // Kick up dark vulcanized rubber marble debris when running wide off the racing line in corners
            if (v.onMarbles && v.speedMs > 12 && Math.random() < 0.55) {
              const mSide = Math.random() > 0.5 ? 0.82 : -0.82;
              particles.spawn(
                v.x - fx * 1.35 + rx * mSide,
                v.y + 0.14,
                v.z - fz * 1.35 + rz * mSide,
                -fx * (v.speedMs * 0.25) + (Math.random() - 0.5) * 3.5,
                0.8 + Math.random() * 1.8,
                -fz * (v.speedMs * 0.25) + (Math.random() - 0.5) * 3.5,
                0x18181b,
                0.48,
                0.28
              );
            }

            // Wet water spray roostertail behind spinning wheels
            if (currentWeather.wetness > 0.22 && v.speedMs > 8 && Math.random() < 0.75) {
              const spraySide = Math.random() > 0.5 ? 0.8 : -0.8;
              particles.spawn(
                v.x - fx * 2.1 + rx * spraySide,
                v.y + 0.2,
                v.z - fz * 2.1 + rz * spraySide,
                -fx * (v.speedMs * 0.35) + (Math.random() - 0.5) * 3,
                1.5 + Math.random() * 2.5,
                -fz * (v.speedMs * 0.35) + (Math.random() - 0.5) * 3,
                0xdbeafe,
                1.4,
                0.38
              );
            }

            // Dry tire smoke on drift or dirt spray
            if (
              currentWeather.wetness <= 0.22 &&
              (v.isDrifting || v.isOffTrack) &&
              v.speedMs > 10 &&
              Math.random() < 0.65
            ) {
              const side = Math.random() > 0.5 ? 0.85 : -0.85;
              particles.spawn(
                v.x - fx * 1.3 + rx * side,
                v.y + 0.16,
                v.z - fz * 1.3 + rz * side,
                (Math.random() - 0.5) * 2.5,
                0.6 + Math.random() * 1.2,
                (Math.random() - 0.5) * 2.5,
                v.isOffTrack ? 0x78350f : 0xe2e8f0,
                1.35,
                0.42
              );
            }
          }

          particles.update(dt);

          // Update Web Audio engine synth
          racingAudio.updateTelemetry({
            rpm: player.rpm,
            throttle: player.throttle,
            isDrifting: player.isDrifting,
            isOffTrack: player.isOffTrack,
            speedMs: player.speedMs,
            engineConfig: pCarSpec.engineConfig,
          });

          // Check if player finished all laps
          if (pEvents.raceFinished) {
            racingAudio.silenceContinuous();
            const standings = getSortedStandings(vehiclesState);
            const playerPos = standings.findIndex((s) => s.isPlayer) + 1;
            stateRef.current.onRaceFinish({
              position: playerPos,
              totalTimeMs: Math.round(player.finishTimeMs),
              bestLapMs: Math.round(player.bestLapTimeMs || player.finishTimeMs / track.laps),
              topSpeedKmh: Math.round(player.topSpeedAchievedKmh),
              cleanRace: cleanRaceFlag,
              pitStopsCompleted: player.tires.pitStopsCompleted,
              standings: standings.map((v, idx) => {
                const cSpec = CLASSIC_CARS.find((c) => c.id === v.carSpecId) || CLASSIC_CARS[0];
                const estTotal = v.finished
                  ? Math.round(v.finishTimeMs)
                  : Math.round(player.finishTimeMs + (idx + 1) * 1850);
                return {
                  position: idx + 1,
                  driverName: v.driverName,
                  carName: cSpec.name,
                  isPlayer: v.isPlayer,
                  totalTimeMs: estTotal,
                  bestLapMs: Math.round(v.bestLapTimeMs || estTotal / track.laps),
                };
              }),
            });
          }
        }

        // Update 3D Vehicle Meshes (Steering Wheel, Wipers, Glowing Brake Rotors, Tire Compound Ring, Lights)
        for (const v of vehiclesState) {
          const rig = carRigs.get(v.id);
          if (!rig) continue;

          rig.root.position.set(v.x, v.y, v.z);
          rig.root.rotation.set(0, v.yaw, 0);

          rig.bodyGroup.rotation.x = v.pitchRad;
          rig.bodyGroup.rotation.z = v.rollRad;

          rig.frontLeftPivot.rotation.y = v.steerAngle;
          rig.frontRightPivot.rotation.y = v.steerAngle;

          // Turn cockpit steering wheel with steering angle
          rig.steeringWheelPivot.rotation.z = -v.steerAngle * 2.6;

          // Hide player's own helmet in first-person cockpit view so camera is never obstructed
          if (v.isPlayer) {
            rig.helmetMesh.visible = camMode !== 'cockpit';
          }

          // Animate working windshield wipers in rain, brake rotor thermal glow, exhaust flames, and tire compound ring color
          updateCarWipers(
            rig,
            dt,
            currentWeather.rainIntensity > 0.08,
            v.isBoosting,
            v.frontBrakeGlow,
            v.tires.compound
          );

          const wheelSpinDelta = (v.speedMs * dt) / 0.305;
          for (const w of rig.wheels) {
            w.rotation.x += wheelSpinDelta;
          }

          if (v.hitFlashTimer > 0) {
            rig.brakeLightsMat.emissive.setHex(0xffffff);
            rig.brakeLightsMat.emissiveIntensity = 3.0;
          } else if (v.brake > 0.1 || v.brakeTelegraphTimer > 0) {
            rig.brakeLightsMat.emissive.setHex(0xef4444);
            rig.brakeLightsMat.emissiveIntensity = 2.4;
          } else {
            rig.brakeLightsMat.emissive.setHex(0x991b1b);
            rig.brakeLightsMat.emissiveIntensity = 0.35;
          }
        }

        // Update Multiplayer Remote Ghost Cars
        const remotes = remoteRacersRef.current.filter((r) => r.trackId === track.id);
        for (const r of remotes) {
          let ghostRig = remoteGhostMeshes.get(r.id);
          if (!ghostRig) {
            const spec = CLASSIC_CARS.find((c) => c.id === r.carId) || CLASSIC_CARS[0];
            ghostRig = buildClassicCarMesh(spec, r.livery, isSoftwareGl, maxAnisotropy);
            remoteGhostsGroup.add(ghostRig.root);
            remoteGhostMeshes.set(r.id, ghostRig);
          }
          _ghostTargetPos.set(r.x, r.y, r.z);
          ghostRig.root.position.lerp(_ghostTargetPos, 0.25);
          ghostRig.root.rotation.y = r.yaw;
        }

        // 6-Mode Precision Camera Rig ('chase' | 'chase_far' | 'bonnet' | 'cockpit' | 'bumper' | 'tv_side')
        const fx = Math.sin(player.yaw);
        const fz = Math.cos(player.yaw);
        const rx = fz; // Right vector X (-X in local car space)
        const rz = -fx; // Right vector Z

        const speedNorm = Math.min(1, player.speedMs / pStats.maxSpeedMs);
        const baseFov =
          camMode === 'chase'
            ? 59
            : camMode === 'chase_far'
            ? 56
            : camMode === 'bumper'
            ? 68
            : camMode === 'tv_side'
            ? 52
            : 64;
        const targetFov =
          baseFov + speedNorm * 11 + (player.isDrafting ? 3.5 : 0) + (player.isBoosting ? 6.5 : 0);
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 6, dt);
        camera.updateProjectionMatrix();

        if (camMode === 'chase' || camMode === 'chase_far') {
          const distBack = camMode === 'chase_far' ? 8.6 : 6.1;
          const heightOffset = camMode === 'chase_far' ? 3.05 : 2.12;
          const lookAhead = camMode === 'chase_far' ? 10.5 : 8.2;
          const swingOffset = -player.angularVelocity * 0.85;
          const targetX = player.x - fx * distBack + rx * swingOffset;
          const targetZ = player.z - fz * distBack + rz * swingOffset;
          const camGround = findClosestTrackSample(track, targetX, targetZ, player.trackSampleIndex);
          const minCamY = Math.max(player.y + 1.25, camGround.surfaceY + 1.3);
          _camTargetPos.set(
            targetX,
            Math.max(minCamY, player.y + heightOffset + Math.sin(Math.max(0, player.pitchRad)) * 2.0),
            targetZ
          );
          _camLookAt.set(
            player.x + fx * lookAhead,
            player.y + 0.78 - Math.sin(player.pitchRad) * 2.2,
            player.z + fz * lookAhead
          );
          const dampAlpha = 1 - Math.exp(-13 * dt);
          camera.position.lerp(_camTargetPos, dampAlpha);
          if (camera.position.y < minCamY) {
            camera.position.y = minCamY;
          }
          _smoothLookAt.lerp(_camLookAt, 1 - Math.exp(-17 * dt));
          camera.lookAt(_smoothLookAt);
        } else if (camMode === 'bonnet') {
          camera.position.set(player.x + fx * 0.42, player.y + 0.94, player.z + fz * 0.42);
          _camLookAt.set(
            player.x + fx * 24,
            player.y + 0.78 - player.pitchRad * 6,
            player.z + fz * 24
          );
          camera.lookAt(_camLookAt);
        } else if (camMode === 'cockpit') {
          // Left-hand driver seat is at local +X = +0.19 -> world (-rx * 0.19, -rz * 0.19)
          camera.position.set(
            player.x - fx * 0.22 - rx * 0.19,
            player.y + 0.85,
            player.z - fz * 0.22 - rz * 0.19
          );
          _camLookAt.set(
            player.x + fx * 12 - rx * 0.16,
            player.y + 0.68 - player.pitchRad * 6,
            player.z + fz * 12 - rz * 0.16
          );
          camera.lookAt(_camLookAt);
        } else if (camMode === 'bumper') {
          // Low-slung high-speed front splitter / bumper camera
          camera.position.set(player.x + fx * 2.15, player.y + 0.44, player.z + fz * 2.15);
          _camLookAt.set(
            player.x + fx * 28,
            player.y + 0.42 - player.pitchRad * 6,
            player.z + fz * 28
          );
          camera.lookAt(_camLookAt);
        } else if (camMode === 'tv_side') {
          // Dynamic low wheel-arch / helicam action angle showing front wheel suspension & apex kerbs
          const targetX = player.x - fx * 3.4 + rx * 2.55;
          const targetZ = player.z - fz * 3.4 + rz * 2.55;
          const camGround = findClosestTrackSample(track, targetX, targetZ, player.trackSampleIndex);
          _camTargetPos.set(
            targetX,
            Math.max(camGround.surfaceY + 0.95, player.y + 1.18),
            targetZ
          );
          _camLookAt.set(player.x + fx * 4.2, player.y + 0.58, player.z + fz * 4.2);
          camera.position.lerp(_camTargetPos, 1 - Math.exp(-14 * dt));
          _smoothLookAt.lerp(_camLookAt, 1 - Math.exp(-18 * dt));
          camera.lookAt(_smoothLookAt);
        }

        const shakeAmt = trauma * trauma;
        if (shakeAmt > 0.001) {
          camera.position.x += (Math.random() - 0.5) * shakeAmt * 0.45;
          camera.position.y += (Math.random() - 0.5) * shakeAmt * 0.35;
        }
        camera.rotation.z += -player.rollRad * 0.45;

        dirLight.position.set(player.x + 55, player.y + 95, player.z + 40);
        dirLight.target.position.set(player.x, player.y, player.z);

        // Throttle React HUD state updates to ~10Hz
        if (now - lastHudEmitTime > 95) {
          lastHudEmitTime = now;
          const sorted = getSortedStandings(vehiclesState);
          const playerPos = sorted.findIndex((s) => s.isPlayer) + 1;
          stateRef.current.onHudUpdate({
            speedKmh: Math.round(player.speedMs * 3.6),
            rpm: Math.round(player.rpm),
            gear: player.gear,
            lap: player.lap,
            totalLaps: track.laps,
            position: playerPos,
            totalCars: vehiclesState.length,
            currentLapTimeMs: Math.max(0, Math.round(raceElapsedMs - player.currentLapStartTimeMs)),
            bestLapTimeMs: Math.round(player.bestLapTimeMs),
            lastLapTimeMs: Math.round(player.lastLapTimeMs),
            isDrifting: player.isDrifting,
            isDrafting: player.isDrafting,
            isOffTrack: player.isOffTrack,
            driftScore: driftScoreAccumulator,
            handbrake: player.handbrake,
            isAquaplaning: player.aquaplaningTimer > 0.15,
            nitroCharge: Math.round(player.nitroCharge),
            isBoosting: player.isBoosting,
            trackRubberPercent: Math.round(currentRubberState.globalRubberLevel * 100),
            onRacingLine: player.onRacingLine,
            onMarbles: player.onMarbles,
            lineGripModifier: player.lineGripModifier,
            surfaceGripParams: { ...player.surfaceGripParams },
            weather: { ...currentWeather },
            damage: { ...player.damage },
            tires: {
              ...player.tires,
              fl: { ...player.tires.fl },
              fr: { ...player.tires.fr },
              rl: { ...player.tires.rl },
              rr: { ...player.tires.rr },
            },
            standings: sorted.map((v, idx) => ({
              id: v.id,
              driverName: v.driverName,
              isPlayer: v.isPlayer,
              position: idx + 1,
              lap: v.lap,
              x: v.x,
              z: v.z,
              color: v.livery.bodyColor,
              brakeTelegraph: v.brakeTelegraphTimer > 0,
              compound: v.tires.compound,
              pitStops: v.tires.pitStopsCompleted,
            })),
          });
        }

        if (now - lastBroadcastTime > 250) {
          lastBroadcastTime = now;
          stateRef.current.onBroadcastTelemetry({
            x: Number(player.x.toFixed(2)),
            y: Number(player.y.toFixed(2)),
            z: Number(player.z.toFixed(2)),
            yaw: Number(player.yaw.toFixed(3)),
            speedKmh: Math.round(player.speedMs * 3.6),
            lap: player.lap,
          });
        }
      } else {
        racingAudio.silenceContinuous();

        if (player && (currentGameState === 'title' || garageOpen)) {
          const gView = stateRef.current.garageCameraView;
          let targetAngle = titleOrbitAngle;
          let radius = garageOpen ? 6.0 : 6.4;
          let height = garageOpen ? 1.55 : 2.05;
          let lookY = garageOpen ? 0.46 : 0.55;
          // Shift camera lookAt to screen-left (-cos(a), 0, +sin(a)) so the 3D car sits centered in the open right 62% of the viewport
          let screenRightCarShift = garageOpen ? 1.35 : 1.15;
          let targetFov = garageOpen ? 44 : 48;

          if (!garageOpen || gView === 'orbit') {
            titleOrbitAngle += dt * (garageOpen ? 0.42 : 0.22);
            targetAngle = titleOrbitAngle;
          } else if (gView === 'front_quarter') {
            targetAngle = player.yaw + 0.62;
            radius = 5.75;
            height = 1.38;
            lookY = 0.44;
            screenRightCarShift = 1.28;
            targetFov = 43;
          } else if (gView === 'side_profile') {
            targetAngle = player.yaw + Math.PI * 0.5;
            radius = 6.45;
            height = 1.18;
            lookY = 0.45;
            screenRightCarShift = 1.42;
            targetFov = 43;
          } else if (gView === 'rear_engine') {
            targetAngle = player.yaw + Math.PI - 0.58;
            radius = 5.65;
            height = 1.48;
            lookY = 0.46;
            screenRightCarShift = 1.25;
            targetFov = 43;
          } else if (gView === 'cockpit_closeup') {
            targetAngle = player.yaw + 1.05;
            radius = 3.85;
            height = 1.52;
            lookY = 0.56;
            screenRightCarShift = 0.85;
            targetFov = 42;
          }

          const radX = Math.sin(targetAngle) * radius;
          const radZ = Math.cos(targetAngle) * radius;

          _camTargetPos.set(player.x + radX, player.y + height, player.z + radZ);
          // Camera forward F = (-sin(a), 0, -cos(a)), Up U = (0, 1, 0) => Screen-Right R = F x U = (cos(a), 0, -sin(a)).
          // Looking toward -R shifts the car toward +R (the open right side of the viewport).
          const lookLeftX = -Math.cos(targetAngle) * screenRightCarShift;
          const lookLeftZ = Math.sin(targetAngle) * screenRightCarShift;
          _camLookAt.set(player.x + lookLeftX, player.y + lookY, player.z + lookLeftZ);

          if (garageOpen && gView !== 'orbit') {
            camera.fov = targetFov;
            camera.updateProjectionMatrix();
            camera.position.copy(_camTargetPos);
            _smoothLookAt.copy(_camLookAt);
            camera.lookAt(_smoothLookAt);
          } else {
            camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 10, dt);
            camera.updateProjectionMatrix();
            const snapAlpha = 1 - Math.exp(-8 * dt);
            camera.position.lerp(_camTargetPos, snapAlpha);
            _smoothLookAt.lerp(_camLookAt, snapAlpha);
            camera.lookAt(_smoothLookAt);
          }
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      resizeObserver.disconnect();
      racingAudio.silenceContinuous();
      disposeObject3D(scene);
      if (scene.environment) {
        scene.environment.dispose();
      }
      renderer.dispose();
    };
  }, [touchInputRef, remoteRacersRef]);

  return (
    <div
      ref={mountRef}
      data-testid="race-canvas-container"
      className="fixed inset-0 w-full h-full overflow-hidden bg-[#0d0c0b]"
    />
  );
};
