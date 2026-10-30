import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface LeaderboardEntry {
  id: string;
  driverName: string;
  trackId: 'monza_storico' | 'cote_dazur' | 'eifel_sprint';
  carId: string;
  carName: string;
  bestLapMs: number;
  totalTimeMs: number;
  topSpeedKmh: number;
  performanceIndex: number;
  liveryColor: string;
  liveryNumber: number;
  tuningLabel: string;
  createdAt: string;
}

interface RemoteRacerTelemetry {
  id: string;
  driverName: string;
  trackId: string;
  carId: string;
  livery: {
    bodyColor: string;
    stripeStyle: string;
    stripeColor: string;
    number: number;
    wheelFinish: string;
  };
  x: number;
  y: number;
  z: number;
  yaw: number;
  speedKmh: number;
  lap: number;
  updatedAt: number;
}

const DATA_DIR = path.join(__dirname, 'data');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboards.json');

const SEED_LEADERBOARDS: LeaderboardEntry[] = [
  {
    id: 'seed-monza-1',
    driverName: 'A. Ascari',
    trackId: 'monza_storico',
    carId: 'dearborn_gt40_mk2',
    carName: '1966 Dearborn Mk.II Prototype',
    bestLapMs: 28420,
    totalTimeMs: 86890,
    topSpeedKmh: 314,
    performanceIndex: 785,
    liveryColor: '#1e3a8a',
    liveryNumber: 2,
    tuningLabel: 'Monza High-Velocity',
    createdAt: '2026-10-28T10:15:00.000Z',
  },
  {
    id: 'seed-monza-2',
    driverName: 'L. Bandini',
    trackId: 'monza_storico',
    carId: 'aurelia_250_gto',
    carName: '1964 Aurelia 250 Corsa',
    bestLapMs: 29650,
    totalTimeMs: 90410,
    topSpeedKmh: 294,
    performanceIndex: 720,
    liveryColor: '#c81d25',
    liveryNumber: 14,
    tuningLabel: 'Factory Historic GT',
    createdAt: '2026-10-28T11:20:00.000Z',
  },
  {
    id: 'seed-monza-3',
    driverName: 'J. Surtees',
    trackId: 'monza_storico',
    carId: 'coventry_etype_lw',
    carName: '1967 Coventry E-Series LW',
    bestLapMs: 30880,
    totalTimeMs: 94120,
    topSpeedKmh: 291,
    performanceIndex: 695,
    liveryColor: '#0f4c3a',
    liveryNumber: 7,
    tuningLabel: 'Monza High-Velocity',
    createdAt: '2026-10-28T12:05:00.000Z',
  },
  {
    id: 'seed-cote-1',
    driverName: 'G. Hill',
    trackId: 'cote_dazur',
    carId: 'stuttgart_911s_rs',
    carName: '1969 Stuttgart 911S Rennsport',
    bestLapMs: 27190,
    totalTimeMs: 83150,
    topSpeedKmh: 262,
    performanceIndex: 740,
    liveryColor: '#e2e8f0',
    liveryNumber: 46,
    tuningLabel: 'Riviera Hairpin Master',
    createdAt: '2026-10-28T13:10:00.000Z',
  },
  {
    id: 'seed-cote-2',
    driverName: 'J. Stewart',
    trackId: 'cote_dazur',
    carId: 'coventry_etype_lw',
    carName: '1967 Coventry E-Series LW',
    bestLapMs: 28540,
    totalTimeMs: 87220,
    topSpeedKmh: 271,
    performanceIndex: 710,
    liveryColor: '#0f4c3a',
    liveryNumber: 11,
    tuningLabel: 'Factory Historic GT',
    createdAt: '2026-10-28T14:00:00.000Z',
  },
  {
    id: 'seed-eifel-1',
    driverName: 'J. Ickx',
    trackId: 'eifel_sprint',
    carId: 'aurelia_250_gto',
    carName: '1964 Aurelia 250 Corsa',
    bestLapMs: 33410,
    totalTimeMs: 101950,
    topSpeedKmh: 286,
    performanceIndex: 760,
    liveryColor: '#c81d25',
    liveryNumber: 22,
    tuningLabel: 'Factory Historic GT',
    createdAt: '2026-10-28T15:30:00.000Z',
  },
  {
    id: 'seed-eifel-2',
    driverName: 'V. Elford',
    trackId: 'eifel_sprint',
    carId: 'stuttgart_911s_rs',
    carName: '1969 Stuttgart 911S Rennsport',
    bestLapMs: 34280,
    totalTimeMs: 104600,
    topSpeedKmh: 274,
    performanceIndex: 735,
    liveryColor: '#f5f2eb',
    liveryNumber: 36,
    tuningLabel: 'Riviera Hairpin Master',
    createdAt: '2026-10-28T16:00:00.000Z',
  },
];

function loadLeaderboards(): LeaderboardEntry[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(LEADERBOARD_FILE)) {
      fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(SEED_LEADERBOARDS, null, 2), 'utf-8');
      return [...SEED_LEADERBOARDS];
    }
    const raw = fs.readFileSync(LEADERBOARD_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.error('Failed to load leaderboards, using seed:', err);
  }
  return [...SEED_LEADERBOARDS];
}

function saveLeaderboards(entries: LeaderboardEntry[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist leaderboards:', err);
  }
}

let leaderboards: LeaderboardEntry[] = loadLeaderboards();
const activeRacers = new Map<string, RemoteRacerTelemetry>();

async function startServer() {
  const app = express();
  app.use(express.json());

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  function broadcastAll(payload: unknown, excludeWs?: WebSocket) {
    const msg = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  // REST API: Get Global Leaderboards & Active Multiplayer Count
  app.get('/api/leaderboards', (req, res) => {
    const trackId = typeof req.query.trackId === 'string' ? req.query.trackId : undefined;
    const filtered = trackId
      ? leaderboards.filter((e) => e.trackId === trackId)
      : leaderboards;
    const sorted = [...filtered].sort((a, b) => a.bestLapMs - b.bestLapMs);
    res.json({
      entries: sorted,
      onlineCount: Math.max(1, wss.clients.size),
      activeRacers: Array.from(activeRacers.values()),
    });
  });

  // REST API: Submit Lap / Race Time to Global Leaderboard
  app.post('/api/leaderboards', (req, res) => {
    const {
      id,
      driverName,
      trackId,
      carId,
      carName,
      bestLapMs,
      totalTimeMs,
      topSpeedKmh,
      performanceIndex,
      liveryColor,
      liveryNumber,
      tuningLabel,
    } = req.body || {};

    if (!driverName || typeof driverName !== 'string' || !driverName.trim()) {
      res.status(400).json({ error: 'Driver callsign is required.' });
      return;
    }
    if (!trackId || !['monza_storico', 'cote_dazur', 'eifel_sprint'].includes(trackId)) {
      res.status(400).json({ error: 'Valid trackId is required.' });
      return;
    }
    const lapMs = Number(bestLapMs);
    const raceMs = Number(totalTimeMs);
    if (!Number.isFinite(lapMs) || lapMs < 8000) {
      res.status(400).json({ error: 'Valid bestLapMs is required.' });
      return;
    }

    const entryId = typeof id === 'string' && id ? id : `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    // Idempotency guard: if entry with same ID exists, return current state
    if (!leaderboards.some((e) => e.id === entryId)) {
      const newEntry: LeaderboardEntry = {
        id: entryId,
        driverName: driverName.trim().slice(0, 22),
        trackId,
        carId: String(carId || 'aurelia_250_gto'),
        carName: String(carName || '1964 Aurelia 250 Corsa'),
        bestLapMs: Math.round(lapMs),
        totalTimeMs: Math.round(Number.isFinite(raceMs) && raceMs > 0 ? raceMs : lapMs * 3),
        topSpeedKmh: Math.round(Number(topSpeedKmh) || 260),
        performanceIndex: Math.round(Number(performanceIndex) || 650),
        liveryColor: String(liveryColor || '#c81d25'),
        liveryNumber: Math.round(Number(liveryNumber) || 14),
        tuningLabel: String(tuningLabel || 'Custom Historic Setup'),
        createdAt: new Date().toISOString(),
      };
      leaderboards.push(newEntry);
      leaderboards.sort((a, b) => a.bestLapMs - b.bestLapMs);
      if (leaderboards.length > 100) {
        leaderboards = leaderboards.slice(0, 100);
      }
      saveLeaderboards(leaderboards);

      broadcastAll({
        type: 'leaderboard:updated',
        entry: newEntry,
        entries: leaderboards,
      });
    }

    res.status(201).json({
      entries: leaderboards,
      onlineCount: Math.max(1, wss.clients.size),
    });
  });

  // WebSocket Multiplayer & Live Ghost Telemetry Handler
  wss.on('connection', (ws) => {
    const clientId = `racer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Send initial authoritative state
    ws.send(
      JSON.stringify({
        type: 'init',
        clientId,
        entries: leaderboards,
        onlineCount: wss.clients.size,
        activeRacers: Array.from(activeRacers.values()),
      })
    );

    broadcastAll({
      type: 'presence:updated',
      onlineCount: wss.clients.size,
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'racer:telemetry' && msg.data) {
          const telemetry: RemoteRacerTelemetry = {
            id: clientId,
            driverName: String(msg.data.driverName || 'Historic Driver').slice(0, 18),
            trackId: String(msg.data.trackId || 'monza_storico'),
            carId: String(msg.data.carId || 'aurelia_250_gto'),
            livery: msg.data.livery || {
              bodyColor: '#c81d25',
              stripeStyle: 'twin_center',
              stripeColor: '#f8fafc',
              number: 14,
              wheelFinish: 'chrome_wire',
            },
            x: Number(msg.data.x) || 0,
            y: Number(msg.data.y) || 0,
            z: Number(msg.data.z) || 0,
            yaw: Number(msg.data.yaw) || 0,
            speedKmh: Math.round(Number(msg.data.speedKmh) || 0),
            lap: Number(msg.data.lap) || 1,
            updatedAt: Date.now(),
          };
          activeRacers.set(clientId, telemetry);
          broadcastAll({ type: 'racer:moved', racer: telemetry }, ws);
        }
      } catch {
        // Ignore malformed socket messages
      }
    });

    ws.on('close', () => {
      activeRacers.delete(clientId);
      broadcastAll({
        type: 'racer:left',
        id: clientId,
        onlineCount: wss.clients.size,
      });
    });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Mille Corse Racing Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
