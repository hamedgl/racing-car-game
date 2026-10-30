import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIC_CARS, DEFAULT_TUNING, DEFAULT_UPGRADES } from './cars';
import { CHAMPIONSHIP_LEVELS, TRACK_LIST, TRACKS, findClosestTrackSample } from './tracks';
import {
  computeEffectiveCarStats,
  createInitialVehicleState,
  stepVehiclePhysics,
  computeAIControls,
  resolveMultiVehicleInteractions,
  getSortedStandings,
  calculateRaceRewardCredits,
  createInitialWeatherState,
  updateWeather,
  accumulateVehicleDamage,
  createInitialTrackRubberState,
  depositVehicleRubber,
  evaluateTrackRubberEffect,
  stepTireSimulation,
  stepPitStopService,
  refitFreshTires,
  evaluateTireGripMultiplier,
} from './physics';

test('computeEffectiveCarStats upgrades and tuning modify performance stats predictably', () => {
  const baseCar = CLASSIC_CARS[0];
  const stockStats = computeEffectiveCarStats(baseCar, DEFAULT_UPGRADES, DEFAULT_TUNING);

  const maxedUpgrades = {
    engineLevel: 5,
    transmissionLevel: 5,
    tiresLevel: 5,
    chassisWeightLevel: 5,
  };
  const upgradedStats = computeEffectiveCarStats(baseCar, maxedUpgrades, DEFAULT_TUNING);

  assert.ok(upgradedStats.powerHp > stockStats.powerHp, 'Engine upgrades should increase horsepower');
  assert.ok(upgradedStats.weightKg < stockStats.weightKg, 'Chassis upgrades should reduce weight');
  assert.ok(upgradedStats.topSpeedKmh > stockStats.topSpeedKmh, 'Upgrades should raise top speed');
  assert.ok(upgradedStats.accel0to100Sec < stockStats.accel0to100Sec, 'Upgrades should reduce 0-100 time');
  assert.ok(upgradedStats.lateralGripG > stockStats.lateralGripG, 'Tire upgrades should increase lateral G');
  assert.ok(upgradedStats.performanceIndex > stockStats.performanceIndex, 'Performance index should increase');
});

test('All 5 hilly circuits and 5 Championship Career Levels have valid 3D elevation profiles and metadata', () => {
  assert.equal(TRACK_LIST.length, 5, 'Should have 5 circuits');
  assert.equal(CHAMPIONSHIP_LEVELS.length, 5, 'Should have 5 championship levels');

  for (const track of TRACK_LIST) {
    assert.ok(track.elevationGainM >= 10, `Track ${track.id} should have hills (elevationGainM >= 10m)`);
    assert.ok(track.abrasiveness > 0.5, `Track ${track.id} should define surface abrasiveness`);
    let minY = Infinity;
    let maxY = -Infinity;
    for (const s of track.samples) {
      if (s.y < minY) minY = s.y;
      if (s.y > maxY) maxY = s.y;
    }
    assert.ok(maxY - minY >= 8, `Track ${track.id} 3D samples must have real vertical hill span (got ${maxY - minY}m)`);
  }
});

test('stepVehiclePhysics accelerates smoothly and locks Y strictly to exact 3D road crown/banking surface on alpine hills', () => {
  const track = TRACKS.stelvio_pass;
  const car = CLASSIC_CARS[0];
  const stats = computeEffectiveCarStats(car, DEFAULT_UPGRADES, DEFAULT_TUNING);
  const player = createInitialVehicleState({
    id: 'player',
    isPlayer: true,
    driverName: 'Driver',
    carSpecId: car.id,
    livery: car.defaultLivery,
    track,
    gridSlot: 0,
  });

  const centerSample = track.samples[0];
  const centerCheck = findClosestTrackSample(track, centerSample.x, centerSample.z, 0);
  assert.ok(
    Math.abs(centerCheck.surfaceY - (centerSample.y + 0.024)) < 0.015,
    `Centerline road surfaceY (${centerCheck.surfaceY}) must match 3D road crown (${centerSample.y + 0.024}) without floating`
  );

  const initialZ = player.z;
  for (let i = 0; i < 120; i++) {
    stepVehiclePhysics(
      player,
      { forward: true, backward: false, left: i > 60, right: false, handbrake: false },
      stats,
      track,
      1 / 60,
      i * 16.67
    );
    const check = findClosestTrackSample(track, player.x, player.z, player.trackSampleIndex);
    assert.ok(
      Math.abs(player.y - check.surfaceY) < 0.001,
      `Vehicle Y (${player.y}) must stay locked to exact road surface Y (${check.surfaceY})`
    );
  }

  assert.ok(player.speedMs > 15, 'Vehicle should accelerate forward under throttle');
  assert.ok(player.z > initialZ, 'Vehicle should advance along the straight');
});

test('Dynamic 4-corner tire wear, heat, and structural integrity degrade under race load and reduce grip', () => {
  const track = TRACKS.targa_madonie;
  const car = CLASSIC_CARS[0];
  const dryWeather = createInitialWeatherState('clear');

  const softCar = createInitialVehicleState({
    id: 'soft-car',
    isPlayer: true,
    driverName: 'Soft Driver',
    carSpecId: car.id,
    livery: car.defaultLivery,
    track,
    gridSlot: 0,
    startingCompound: 'soft',
  });
  const hardCar = createInitialVehicleState({
    id: 'hard-car',
    isPlayer: false,
    driverName: 'Hard Driver',
    carSpecId: car.id,
    livery: car.defaultLivery,
    track,
    gridSlot: 1,
    startingCompound: 'hard',
  });

  const initialSoftGrip = evaluateTireGripMultiplier(softCar.tires, dryWeather.wetness);
  const initialHardGrip = evaluateTireGripMultiplier(hardCar.tires, dryWeather.wetness);
  assert.ok(
    initialSoftGrip > initialHardGrip + 0.08,
    `Fresh Soft compound grip (${initialSoftGrip}) must exceed Hard compound grip (${initialHardGrip})`
  );

  // Simulate heavy cornering, braking, and drifting on abrasive asphalt
  softCar.speedMs = 52;
  softCar.throttle = 1.0;
  softCar.brake = 0.45;
  softCar.slipAngleRad = 0.28;
  softCar.isDrifting = true;

  hardCar.speedMs = 52;
  hardCar.throttle = 1.0;
  hardCar.brake = 0.45;
  hardCar.slipAngleRad = 0.28;
  hardCar.isDrifting = true;

  for (let step = 0; step < 300; step++) {
    stepTireSimulation(softCar, track, 0.1, dryWeather);
    stepTireSimulation(hardCar, track, 0.1, dryWeather);
  }

  const softAvgTread = softCar.tires.avgTreadLife;
  const hardAvgTread = hardCar.tires.avgTreadLife;

  assert.ok(softAvgTread < 0.75, `Soft tires should wear down under heavy load (got ${softAvgTread})`);
  assert.ok(
    hardAvgTread > softAvgTread + 0.08,
    `Hard tires (${hardAvgTread}) must retain more tread than Soft tires (${softAvgTread})`
  );
  assert.ok(
    softCar.tires.fl.temperature > 92,
    `Tire temperature should rise under heavy cornering/braking (got ${softCar.tires.fl.temperature}°C)`
  );
  assert.ok(
    softCar.tires.rl.structuralIntegrity < 0.99,
    `Tire carcass structural integrity should degrade under thermal/wear stress (got ${softCar.tires.rl.structuralIntegrity})`
  );
  assert.ok(
    softCar.tires.gripMultiplier < initialSoftGrip,
    `Degraded & overheated tires must lose grip (${softCar.tires.gripMultiplier} vs ${initialSoftGrip})`
  );
});

test('Pit stop service refits fresh tires, switches compound, and restores 100% tread and structural integrity', () => {
  const track = TRACKS.monza_storico;
  const car = CLASSIC_CARS[0];
  const player = createInitialVehicleState({
    id: 'player',
    isPlayer: true,
    driverName: 'Driver',
    carSpecId: car.id,
    livery: car.defaultLivery,
    track,
    gridSlot: 0,
    startingCompound: 'soft',
  });

  // Degrade player tires and arm pit stop for Hard compound
  player.tires.fl.treadLife = 0.22;
  player.tires.fr.treadLife = 0.25;
  player.tires.rl.structuralIntegrity = 0.4;
  player.tires.nextPitCompound = 'hard';
  player.tires.pitRequest = true;

  // Position player inside the Start/Finish pit lane zone at low speed
  const startStation = track.samples[5];
  player.trackSampleIndex = 5;
  player.lapProgress = startStation.s;
  player.x = startStation.x + startStation.rx * (startStation.width * 0.35);
  player.z = startStation.z + startStation.rz * (startStation.width * 0.35);
  player.speedMs = 8;

  // Trigger and complete 2.0-second pit stop service
  let completed = false;
  for (let i = 0; i < 30; i++) {
    const res = stepPitStopService(player, track, 0.1, true);
    if (res.pitStopCompleted) {
      completed = true;
      break;
    }
  }

  assert.ok(completed, 'Pit stop service must complete after ~2.0 seconds in pit stall');
  assert.equal(player.tires.compound, 'hard', 'Pit stop must fit the selected nextPitCompound');
  assert.equal(player.tires.fl.treadLife, 1.0, 'Freshly fitted tires must have 100% tread');
  assert.equal(player.tires.rl.structuralIntegrity, 1.0, 'Freshly fitted tires must have 100% structural integrity');
  assert.equal(player.tires.pitStopsCompleted, 1, 'Pit stops completed counter must increment');

  refitFreshTires(player.tires, 'wet');
  assert.equal(player.tires.compound, 'wet');
});

test('Visual car damage is completely disabled (accumulateVehicleDamage is a no-op)', () => {
  const track = TRACKS.monza_storico;
  const car = CLASSIC_CARS[0];
  const player = createInitialVehicleState({
    id: 'player',
    isPlayer: true,
    driverName: 'Driver',
    carSpecId: car.id,
    livery: car.defaultLivery,
    track,
    gridSlot: 0,
  });

  accumulateVehicleDamage(player, 28, 0, 'simulation');
  assert.equal(player.damage.totalDamage, 0, 'Total damage must remain 0');
  assert.equal(player.damage.frontCrumple, 0, 'Front crumple must remain 0');
  assert.equal(player.damage.hoodBuckle, 0, 'Hood buckle must remain 0');
  assert.equal(player.damage.radiatorPunctured, false, 'Radiator puncture must remain false');
});

test('3-sphere longitudinal capsule collision cleanly separates overlapping cars and emits world contact points', () => {
  const track = TRACKS.cote_dazur;
  const car = CLASSIC_CARS[1];

  const ai1 = createInitialVehicleState({
    id: 'ai1',
    isPlayer: false,
    driverName: 'Bandini',
    carSpecId: car.id,
    livery: car.defaultLivery,
    track,
    gridSlot: 1,
    archetype: 'apex_precision',
  });
  const ai2 = createInitialVehicleState({
    id: 'ai2',
    isPlayer: false,
    driverName: 'Ickx',
    carSpecId: car.id,
    livery: car.defaultLivery,
    track,
    gridSlot: 2,
    archetype: 'late_braker',
  });

  const ctrl1 = computeAIControls(ai1, [ai1, ai2], track, 1 / 60);
  assert.equal(typeof ctrl1.forward, 'boolean');

  ai2.x = ai1.x + 1.0;
  ai2.z = ai1.z;
  ai1.vx = 10;
  ai2.vx = -10;
  const { playerImpactSpeedMs, collisionContacts } = resolveMultiVehicleInteractions([ai1, ai2], 'off');
  assert.equal(playerImpactSpeedMs, 0);
  assert.ok(collisionContacts.length > 0, 'Overlapping colliding vehicles must emit world collisionContacts');
  const distAfter = Math.hypot(ai2.x - ai1.x, ai2.z - ai1.z);
  assert.ok(distAfter >= 1.83, `Overlapping cars should separate cleanly to >= 1.84m body width (got ${distAfter})`);

  ai1.totalRaceDistanceM = 500;
  ai2.totalRaceDistanceM = 650;
  const standings = getSortedStandings([ai1, ai2]);
  assert.equal(standings[0].id, 'ai2');
  assert.ok(calculateRaceRewardCredits(1, true) > calculateRaceRewardCredits(4, false));
});

test('Dynamic weather and track rubbering groove modify grip as expected', () => {
  const clearWeather = createInitialWeatherState('clear');
  const rainWeather = createInitialWeatherState('rain');
  assert.equal(clearWeather.gripMultiplier, 1.0);
  assert.ok(rainWeather.gripMultiplier < 0.8);

  const dynamicWeather = createInitialWeatherState('dynamic');
  updateWeather(dynamicWeather, 40, 45000);
  assert.equal(dynamicWeather.activeType, 'rain');

  const track = TRACKS.monza_storico;
  const car = CLASSIC_CARS[0];
  const rubberState = createInitialTrackRubberState(track.samples.length, 'progressive');
  const initialRubber = rubberState.globalRubberLevel;
  const cornerIdx = track.samples.findIndex((s) => s.cornerLoadIntensity > 0.45 && Math.abs(s.curvature) > 0.008);
  const targetIdx = cornerIdx >= 0 ? cornerIdx : 25;
  const cornerStation = track.samples[targetIdx];

  const vehicle = createInitialVehicleState({
    id: 'player',
    isPlayer: true,
    driverName: 'Driver',
    carSpecId: car.id,
    livery: car.defaultLivery,
    track,
    gridSlot: 0,
  });
  vehicle.trackSampleIndex = targetIdx;
  vehicle.speedMs = 45;
  vehicle.brake = 0.6;

  for (let pass = 0; pass < 40; pass++) {
    depositVehicleRubber(rubberState, track, vehicle, 0.1, true, pass === 15 || pass === 30);
  }
  assert.ok(rubberState.globalRubberLevel > initialRubber + 0.15);

  const onLineEval = evaluateTrackRubberEffect(track, targetIdx, cornerStation.racingLineOffset, rubberState, 0);
  assert.ok(onLineEval.onRacingLine);
  assert.ok(onLineEval.lineGripModifier > 1.03);
});

test('3D Gravity normal load G, asphalt grip factor, kerb rumble, and Pro-Assisted handling easiness operate accurately', () => {
  const track = TRACKS.stelvio_pass;
  const car = CLASSIC_CARS[0];
  const stats = computeEffectiveCarStats(car, DEFAULT_UPGRADES, DEFAULT_TUNING);

  // Verify track samples have verticalCurvature populated
  const hasCrestOrDip = track.samples.some((s) => Math.abs(s.verticalCurvature ?? 0) > 0.0005);
  assert.ok(hasCrestOrDip, 'Hilly circuits must compute signed verticalCurvature for crest/dip gravity load');

  const assistedCar = createInitialVehicleState({
    id: 'assisted',
    isPlayer: true,
    driverName: 'Pro Assisted',
    carSpecId: car.id,
    livery: car.defaultLivery,
    track,
    gridSlot: 0,
  });

  const historicCar = createInitialVehicleState({
    id: 'historic',
    isPlayer: true,
    driverName: 'Pure Historic',
    carSpecId: car.id,
    livery: car.defaultLivery,
    track,
    gridSlot: 0,
  });

  // Give both cars an initial yaw slip perturbation while cornering at high speed
  assistedCar.speedMs = 42;
  assistedCar.vx = Math.sin(assistedCar.yaw + 0.25) * 42;
  assistedCar.vz = Math.cos(assistedCar.yaw + 0.25) * 42;

  historicCar.speedMs = 42;
  historicCar.vx = Math.sin(historicCar.yaw + 0.25) * 42;
  historicCar.vz = Math.cos(historicCar.yaw + 0.25) * 42;

  for (let i = 0; i < 45; i++) {
    stepVehiclePhysics(
      assistedCar,
      { forward: true, backward: false, left: true, right: false, handbrake: false },
      stats,
      track,
      1 / 60,
      i * 16.67,
      undefined,
      'off',
      undefined,
      1.0,
      'pro_assisted'
    );
    stepVehiclePhysics(
      historicCar,
      { forward: true, backward: false, left: true, right: false, handbrake: false },
      stats,
      track,
      1 / 60,
      i * 16.67,
      undefined,
      'off',
      undefined,
      1.0,
      'pure_historic'
    );
  }

  assert.ok(
    (assistedCar.asphaltGripFactor ?? 1) > (historicCar.asphaltGripFactor ?? 1),
    `Pro-Assisted mode should provide higher effective asphalt grip (${assistedCar.asphaltGripFactor}) than Pure Historic (${historicCar.asphaltGripFactor})`
  );
  assert.ok(
    Math.abs(assistedCar.slipAngleRad) <= Math.abs(historicCar.slipAngleRad) + 0.02,
    'Pro-Assisted mode should stabilize slip angle during aggressive turn-in'
  );
  assert.ok(
    (assistedCar.verticalLoadG ?? 0) > 0.4 && (assistedCar.verticalLoadG ?? 0) < 2.0,
    `Vertical load G (${assistedCar.verticalLoadG}) must be within realistic physical bounds`
  );
});

