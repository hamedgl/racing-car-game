import { TrackId } from './types';

const assetCache: Record<string, string> = {};

function createFallbackSvgDataUrl(label: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#0B0F17"/><text x="50%" y="50%" fill="#F5F2EB" font-family="serif" font-size="18" text-anchor="middle">${label}</text></svg>`
  )}`;
}

/**
 * Generates a high-DPI PNG data-URL for the Mille Corse 1967 Championship Cloisonné Enamel Crest
 */
export function getChampionshipCrestPng(): string {
  if (assetCache.crest) return assetCache.crest;
  if (typeof document === 'undefined') return createFallbackSvgDataUrl('MILLE CORSE');

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return createFallbackSvgDataUrl('MILLE CORSE');

  const cx = 128;
  const cy = 128;

  // Golden laurel wreath branches
  ctx.save();
  ctx.strokeStyle = '#D97706';
  ctx.fillStyle = '#F59E0B';
  ctx.lineWidth = 3;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const angle = Math.PI * 0.72 - i * 0.14;
      const rx = cx + side * Math.sin(angle) * 96;
      const ry = cy + Math.cos(angle) * 86;
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(side * (-angle + 0.55));
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();

  // Outer chrome & gold shield bezel
  const drawShieldPath = (scale: number) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 92 * scale);
    ctx.bezierCurveTo(cx + 76 * scale, cy - 92 * scale, cx + 82 * scale, cy - 32 * scale, cx + 74 * scale, cy + 16 * scale);
    ctx.bezierCurveTo(cx + 64 * scale, cy + 62 * scale, cx + 28 * scale, cy + 88 * scale, cx, cy + 102 * scale);
    ctx.bezierCurveTo(cx - 28 * scale, cy + 88 * scale, cx - 64 * scale, cy + 62 * scale, cx - 74 * scale, cy + 16 * scale);
    ctx.bezierCurveTo(cx - 82 * scale, cy - 32 * scale, cx - 76 * scale, cy - 92 * scale, cx, cy - 92 * scale);
    ctx.closePath();
  };

  // Gold metallic bezel
  const goldGrad = ctx.createLinearGradient(40, 20, 216, 236);
  goldGrad.addColorStop(0, '#FDE68A');
  goldGrad.addColorStop(0.45, '#D97706');
  goldGrad.addColorStop(0.75, '#FEF3C7');
  goldGrad.addColorStop(1, '#92400E');
  drawShieldPath(1.0);
  ctx.fillStyle = goldGrad;
  ctx.fill();

  // Inner enamel crimson & carbon background
  drawShieldPath(0.9);
  ctx.save();
  ctx.clip();

  const crimsonGrad = ctx.createLinearGradient(cx, cy - 90, cx, cy + 95);
  crimsonGrad.addColorStop(0, '#DC2626');
  crimsonGrad.addColorStop(0.6, '#991B1B');
  crimsonGrad.addColorStop(1, '#450A0A');
  ctx.fillStyle = crimsonGrad;
  ctx.fillRect(0, 0, 256, 256);

  // Diagonal checkered racing sash
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.42);
  const sq = 16;
  for (let row = -1; row <= 1; row++) {
    for (let col = -8; col <= 8; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#F5F2EB' : '#0B0F17';
      ctx.fillRect(col * sq, row * sq - 8, sq, sq);
    }
  }
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(-140, -24, 280, 48);
  ctx.restore();

  // Top tricolore enamel header bar
  ctx.fillStyle = '#15803D';
  ctx.fillRect(cx - 80, cy - 88, 53, 18);
  ctx.fillStyle = '#F5F2EB';
  ctx.fillRect(cx - 27, cy - 88, 54, 18);
  ctx.fillStyle = '#B91C1C';
  ctx.fillRect(cx + 27, cy - 88, 53, 18);

  // Glossy cloisonné highlight
  const glossGrad = ctx.createLinearGradient(0, cy - 90, 0, cy + 10);
  glossGrad.addColorStop(0, 'rgba(255,255,255,0.34)');
  glossGrad.addColorStop(1, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = glossGrad;
  ctx.fillRect(cx - 80, cy - 90, 160, 95);

  // Year '67' gold emblem
  ctx.fillStyle = '#FEF3C7';
  ctx.font = 'bold 34px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 6;
  ctx.fillText('1967', cx, cy + 62);
  ctx.restore();

  // Inner shield outline
  drawShieldPath(0.9);
  ctx.strokeStyle = '#FEF3C7';
  ctx.lineWidth = 2;
  ctx.stroke();

  const url = canvas.toDataURL('image/png');
  assetCache.crest = url;
  return url;
}

/**
 * Generates high-DPI illustrated 16:9 PNG circuit preview cards for each track
 */
export function getTrackPreviewPng(trackId: TrackId): string {
  const key = `track_${trackId}`;
  if (assetCache[key]) return assetCache[key];
  if (typeof document === 'undefined') return createFallbackSvgDataUrl(trackId);

  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 340;
  const ctx = canvas.getContext('2d');
  if (!ctx) return createFallbackSvgDataUrl(trackId);

  const w = canvas.width;
  const h = canvas.height;

  // Sky gradient per track
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.58);
  if (trackId === 'monza_storico') {
    sky.addColorStop(0, '#1D4ED8');
    sky.addColorStop(0.55, '#60A5FA');
    sky.addColorStop(1, '#FDE68A');
  } else if (trackId === 'cote_dazur') {
    sky.addColorStop(0, '#0369A1');
    sky.addColorStop(0.6, '#38BDF8');
    sky.addColorStop(1, '#BAE6FD');
  } else if (trackId === 'stelvio_pass') {
    sky.addColorStop(0, '#0F172A');
    sky.addColorStop(0.5, '#3B82F6');
    sky.addColorStop(1, '#E0F2FE');
  } else if (trackId === 'targa_madonie') {
    sky.addColorStop(0, '#7C2D12');
    sky.addColorStop(0.5, '#EA580C');
    sky.addColorStop(1, '#FDE047');
  } else {
    sky.addColorStop(0, '#1E293B');
    sky.addColorStop(0.6, '#475569');
    sky.addColorStop(1, '#94A3B8');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Sun / atmospheric glow
  const sunGlow = ctx.createRadialGradient(w * 0.76, h * 0.24, 8, w * 0.76, h * 0.24, 150);
  sunGlow.addColorStop(0, 'rgba(254, 243, 199, 0.92)');
  sunGlow.addColorStop(0.4, 'rgba(251, 191, 36, 0.28)');
  sunGlow.addColorStop(1, 'rgba(251, 191, 36, 0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, w, h);

  // Distant mountain / coastline silhouette
  ctx.fillStyle =
    trackId === 'monza_storico'
      ? '#334155'
      : trackId === 'cote_dazur'
      ? '#0F172A'
      : trackId === 'stelvio_pass'
      ? '#475569'
      : trackId === 'targa_madonie'
      ? '#451A03'
      : '#1E293B';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.56);
  const peakAmp = trackId === 'stelvio_pass' || trackId === 'targa_madonie' ? 48 : 26;
  for (let x = 0; x <= w; x += 32) {
    const peak =
      Math.sin(x * 0.012 + (trackId === 'eifel_sprint' ? 1.4 : trackId === 'stelvio_pass' ? 2.2 : 0.3)) * peakAmp +
      Math.cos(x * 0.027) * (peakAmp * 0.55);
    ctx.lineTo(x, h * 0.48 - peak);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // Mediterranean sea for Cote d'Azur
  if (trackId === 'cote_dazur') {
    const seaGrad = ctx.createLinearGradient(0, h * 0.5, 0, h * 0.68);
    seaGrad.addColorStop(0, '#0284C7');
    seaGrad.addColorStop(1, '#0369A1');
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, h * 0.51, w, h * 0.17);
  }

  // Meadow / pine forest / alpine / Sicilian hills ground
  const groundGrad = ctx.createLinearGradient(0, h * 0.54, 0, h);
  if (trackId === 'monza_storico') {
    groundGrad.addColorStop(0, '#2F5233');
    groundGrad.addColorStop(1, '#1B3B22');
  } else if (trackId === 'cote_dazur') {
    groundGrad.addColorStop(0, '#334155');
    groundGrad.addColorStop(1, '#1E293B');
  } else if (trackId === 'stelvio_pass') {
    groundGrad.addColorStop(0, '#334155');
    groundGrad.addColorStop(1, '#1E293B');
  } else if (trackId === 'targa_madonie') {
    groundGrad.addColorStop(0, '#4D5D2B');
    groundGrad.addColorStop(1, '#2D3819');
  } else {
    groundGrad.addColorStop(0, '#1E3A2F');
    groundGrad.addColorStop(1, '#0F241C');
  }
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, h * 0.54, w, h * 0.46);

  // Perspective sweeping S-curve asphalt track
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(w * 0.05, h);
  ctx.bezierCurveTo(w * 0.24, h * 0.78, w * 0.62, h * 0.68, w * 0.48, h * 0.54);
  ctx.lineTo(w * 0.57, h * 0.54);
  ctx.bezierCurveTo(w * 0.76, h * 0.69, w * 0.64, h * 0.82, w * 0.86, h);
  ctx.closePath();
  ctx.fillStyle = '#333942';
  ctx.fill();

  // Red and white serrated kerbs on inside apex
  for (let i = 0; i < 12; i++) {
    const t = i / 12;
    const kx = w * (0.12 + t * 0.36 + Math.sin(t * Math.PI) * 0.12);
    const ky = h * (0.98 - t * 0.42);
    ctx.fillStyle = i % 2 === 0 ? '#DC2626' : '#F5F2EB';
    ctx.beginPath();
    ctx.ellipse(kx, ky, 18 * (1 - t * 0.55), 6 * (1 - t * 0.5), -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Darkened vulcanized rubbered racing line ribbon on asphalt
  ctx.strokeStyle = 'rgba(12, 15, 20, 0.72)';
  ctx.lineWidth = 36;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.34, h);
  ctx.bezierCurveTo(w * 0.38, h * 0.82, w * 0.61, h * 0.7, w * 0.52, h * 0.55);
  ctx.stroke();
  ctx.restore();

  // Foreground silhouette of 1967 GT prototype cresting apex
  ctx.save();
  ctx.translate(w * 0.44, h * 0.81);
  ctx.rotate(-0.08);
  // Contact shadow
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.beginPath();
  ctx.ellipse(0, 22, 62, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // Coachwork body
  ctx.fillStyle =
    trackId === 'monza_storico'
      ? '#DC2626'
      : trackId === 'cote_dazur'
      ? '#2563EB'
      : trackId === 'stelvio_pass'
      ? '#F59E0B'
      : trackId === 'targa_madonie'
      ? '#EF4444'
      : '#10B981';
  ctx.beginPath();
  ctx.roundRect(-54, -8, 108, 26, 12);
  ctx.fill();
  // Cabin canopy
  ctx.fillStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.arc(0, -8, 28, Math.PI, 0);
  ctx.fill();
  // Center stripe
  ctx.fillStyle = '#F5F2EB';
  ctx.fillRect(-6, -20, 12, 38);
  // Tires
  ctx.fillStyle = '#090D14';
  ctx.fillRect(-52, 4, 20, 20);
  ctx.fillRect(32, 4, 20, 20);
  ctx.restore();

  // Subtle bottom vignette for crisp typography contrast
  const vig = ctx.createLinearGradient(0, h * 0.45, 0, h);
  vig.addColorStop(0, 'rgba(11, 15, 23, 0)');
  vig.addColorStop(1, 'rgba(11, 15, 23, 0.84)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  const url = canvas.toDataURL('image/png');
  assetCache[key] = url;
  return url;
}

/**
 * Generates a high-DPI PNG data-URL for the Veglia Borletti 1967 Analog Tachometer Dial Face
 */
export function getTachometerDialPng(): string {
  if (assetCache.tachDial) return assetCache.tachDial;
  if (typeof document === 'undefined') return createFallbackSvgDataUrl('VEGLIA');

  const canvas = document.createElement('canvas');
  canvas.width = 360;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) return createFallbackSvgDataUrl('VEGLIA');

  const cx = 180;
  const cy = 180;
  const r = 166;

  // Brushed spun-aluminum & double-stepped chrome bezel
  const bezelGrad = ctx.createLinearGradient(20, 20, 340, 340);
  bezelGrad.addColorStop(0, '#F8FAFC');
  bezelGrad.addColorStop(0.35, '#94A3B8');
  bezelGrad.addColorStop(0.65, '#475569');
  bezelGrad.addColorStop(1, '#CBD5E1');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = bezelGrad;
  ctx.fill();

  // Inner dark carbon-matte dial face
  const faceGrad = ctx.createRadialGradient(cx, cy - 30, 10, cx, cy, r - 12);
  faceGrad.addColorStop(0, '#182030');
  faceGrad.addColorStop(0.75, '#0B0F17');
  faceGrad.addColorStop(1, '#06080D');
  ctx.beginPath();
  ctx.arc(cx, cy, r - 11, 0, Math.PI * 2);
  ctx.fillStyle = faceGrad;
  ctx.fill();

  // Subtle concentric Guilloché instrument rings
  ctx.strokeStyle = 'rgba(245, 242, 235, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 54, 0, Math.PI * 2);
  ctx.stroke();

  // Redline warning sector (7,000 to 9,000 RPM)
  const degToRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const startAngle = -130;
  const totalSweep = 260;
  const redStart = degToRad(startAngle + (7 / 9) * totalSweep);
  const redEnd = degToRad(startAngle + totalSweep);
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.85)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 22, redStart, redEnd);
  ctx.stroke();

  // Major & minor RPM ticks (0 to 90 -> x100 RPM)
  for (let i = 0; i <= 45; i++) {
    const frac = i / 45;
    const angle = degToRad(startAngle + frac * totalSweep);
    const isMajor = i % 5 === 0;
    const isRed = i >= 35;

    const outer = r - 17;
    const inner = isMajor ? r - 35 : r - 26;
    ctx.strokeStyle = isRed ? '#EF4444' : isMajor ? '#F5F2EB' : 'rgba(245, 242, 235, 0.48)';
    ctx.lineWidth = isMajor ? 3.2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.stroke();

    if (isMajor) {
      const rpmNum = (i / 5) * 10;
      const labelR = r - 54;
      const lx = cx + Math.cos(angle) * labelR;
      const ly = cy + Math.sin(angle) * labelR;
      ctx.fillStyle = isRed ? '#F87171' : '#F5F2EB';
      ctx.font = 'bold 17px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(rpmNum), lx, ly);
    }
  }

  // Vintage Veglia Borletti typography
  ctx.fillStyle = 'rgba(245, 242, 235, 0.78)';
  ctx.font = 'bold 13px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('VEGLIA BORLETTI', cx, cy - 54);
  ctx.fillStyle = 'rgba(217, 119, 6, 0.9)';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('GIRI × 100', cx, cy - 38);

  const url = canvas.toDataURL('image/png');
  assetCache.tachDial = url;
  return url;
}
