import {
  CarUpgrades,
  EffectiveCarStats,
  HandlingTuning,
  StripeStyle,
  TireCompound,
  TrackId,
  WheelFinish,
} from './types';

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
    ctx.bezierCurveTo(
      cx + 76 * scale,
      cy - 92 * scale,
      cx + 82 * scale,
      cy - 32 * scale,
      cx + 74 * scale,
      cy + 16 * scale
    );
    ctx.bezierCurveTo(
      cx + 64 * scale,
      cy + 62 * scale,
      cx + 28 * scale,
      cy + 88 * scale,
      cx,
      cy + 102 * scale
    );
    ctx.bezierCurveTo(
      cx - 28 * scale,
      cy + 88 * scale,
      cx - 64 * scale,
      cy + 62 * scale,
      cx - 74 * scale,
      cy + 16 * scale
    );
    ctx.bezierCurveTo(
      cx - 82 * scale,
      cy - 32 * scale,
      cx - 76 * scale,
      cy - 92 * scale,
      cx,
      cy - 92 * scale
    );
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
 * Generates authentic 1967 Cloisonné Manufacturer Marque Crests for each of the 4 classic cars
 */
export function getMarqueCrestPng(carId: string): string {
  const key = `marque_${carId}`;
  if (assetCache[key]) return assetCache[key];
  if (typeof document === 'undefined') return createFallbackSvgDataUrl(carId);

  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return createFallbackSvgDataUrl(carId);

  const cx = 80;
  const cy = 80;

  // Metallic gold/chrome outer shield
  const drawShield = (rScale: number) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 64 * rScale);
    ctx.bezierCurveTo(
      cx + 56 * rScale,
      cy - 64 * rScale,
      cx + 60 * rScale,
      cy - 18 * rScale,
      cx + 52 * rScale,
      cy + 16 * rScale
    );
    ctx.bezierCurveTo(
      cx + 42 * rScale,
      cy + 48 * rScale,
      cx + 18 * rScale,
      cy + 64 * rScale,
      cx,
      cy + 72 * rScale
    );
    ctx.bezierCurveTo(
      cx - 18 * rScale,
      cy + 64 * rScale,
      cx - 42 * rScale,
      cy + 48 * rScale,
      cx - 52 * rScale,
      cy + 16 * rScale
    );
    ctx.bezierCurveTo(
      cx - 60 * rScale,
      cy - 18 * rScale,
      cx - 56 * rScale,
      cy - 64 * rScale,
      cx,
      cy - 64 * rScale
    );
    ctx.closePath();
  };

  const rimGrad = ctx.createLinearGradient(20, 10, 140, 150);
  rimGrad.addColorStop(0, '#FEF3C7');
  rimGrad.addColorStop(0.5, '#D97706');
  rimGrad.addColorStop(1, '#78350F');
  drawShield(1.0);
  ctx.fillStyle = rimGrad;
  ctx.fill();

  drawShield(0.88);
  ctx.save();
  ctx.clip();

  if (carId === 'aurelia_250_gto') {
    // Modena Giallo field + Italian tricolore top + black stallion silhouette
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(0, 0, 160, 160);
    ctx.fillStyle = '#15803D';
    ctx.fillRect(cx - 55, cy - 58, 36, 12);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(cx - 19, cy - 58, 38, 12);
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(cx + 19, cy - 58, 36, 12);

    // Stylized prancing crest motif
    ctx.fillStyle = '#090D14';
    ctx.beginPath();
    ctx.arc(cx, cy - 6, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 16px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('V12', cx, cy - 1);

    ctx.fillStyle = '#090D14';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('MODENA', cx, cy + 36);
  } else if (carId === 'coventry_etype_lw') {
    // British Racing Green enamel + gold Coventry wings
    ctx.fillStyle = '#064E3B';
    ctx.fillRect(0, 0, 160, 160);
    ctx.strokeStyle = '#FDE68A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 44, cy - 8);
    ctx.lineTo(cx + 44, cy - 8);
    ctx.moveTo(cx - 34, cy + 2);
    ctx.lineTo(cx + 34, cy + 2);
    ctx.stroke();

    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.arc(cx, cy - 3, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FEF3C7';
    ctx.font = 'bold 13px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('3.8', cx, cy + 2);
    ctx.font = 'bold 11px monospace';
    ctx.fillText('COVENTRY', cx, cy + 36);
  } else if (carId === 'stuttgart_911s_rs') {
    // Stuttgart quartered gold, red, and black heraldic crest
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(0, 0, 160, 160);
    ctx.fillStyle = '#991B1B';
    ctx.fillRect(cx, cy - 60, 60, 56);
    ctx.fillRect(cx - 60, cy - 4, 60, 68);
    ctx.fillStyle = '#090D14';
    for (let y = -42; y <= 38; y += 16) {
      ctx.fillRect(cx - 44, cy + y, 88, 5);
    }
    ctx.fillStyle = '#FDE68A';
    ctx.fillRect(cx - 28, cy - 16, 56, 26);
    ctx.fillStyle = '#090D14';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('911 RS', cx, cy + 1);
  } else if (carId === 'scuderia_f1_68') {
    // Scuderia Maranello F1 Grand Prix Crest: Giallo Modena shield, Italian tricolore & F1 312 badge
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(0, 0, 160, 160);
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(cx - 48, cy - 38, 96, 66);
    ctx.fillStyle = '#15803D';
    ctx.fillRect(cx - 55, cy - 58, 36, 12);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(cx - 19, cy - 58, 38, 12);
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(cx + 19, cy - 58, 36, 12);

    ctx.fillStyle = '#090D14';
    ctx.font = 'bold 17px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('312 F1', cx, cy - 4);
    ctx.font = 'bold 10px monospace';
    ctx.fillText('48V · V12', cx, cy + 16);
    ctx.fillStyle = '#FEF3C7';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('SCUDERIA', cx, cy + 44);
  } else {
    // Dearborn Blue, White & Crimson Le Mans Prototype Crest
    ctx.fillStyle = '#1E3A8A';
    ctx.fillRect(0, 0, 160, 160);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(cx - 60, cy - 22, 120, 22);
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(cx - 60, cy - 44, 120, 22);
    ctx.fillStyle = '#090D14';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GT40 MK.II', cx, cy - 7);
    ctx.fillStyle = '#FDE68A';
    ctx.font = 'bold 12px Georgia, serif';
    ctx.fillText('7.0L V8', cx, cy + 28);
  }

  // Enamel dome highlight
  const gloss = ctx.createLinearGradient(0, cy - 60, 0, cy + 10);
  gloss.addColorStop(0, 'rgba(255,255,255,0.32)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(0, 0, 160, 90);
  ctx.restore();

  drawShield(0.88);
  ctx.strokeStyle = '#FEF3C7';
  ctx.lineWidth = 2;
  ctx.stroke();

  const url = canvas.toDataURL('image/png');
  assetCache[key] = url;
  return url;
}

/**
 * Generates an authentic 1967 Carrozzeria Orthographic Side-Profile & Technical Blueprint Plate
 * reflecting the car's live body paint, stripe color, racing number, and wheel finish.
 */
export function getCarBlueprintPng(
  carId: string,
  bodyColor: string,
  stripeColor: string,
  stripeStyle: StripeStyle,
  number: number,
  wheelFinish: WheelFinish
): string {
  const key = `bp_${carId}_${bodyColor}_${stripeColor}_${stripeStyle}_${number}_${wheelFinish}`;
  if (assetCache[key]) return assetCache[key];
  if (typeof document === 'undefined') return createFallbackSvgDataUrl(carId);

  const canvas = document.createElement('canvas');
  canvas.width = 560;
  canvas.height = 210;
  const ctx = canvas.getContext('2d');
  if (!ctx) return createFallbackSvgDataUrl(carId);

  const w = canvas.width;
  const h = canvas.height;

  // Deep blueprint vellum charcoal-indigo drafting background
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#0D131F');
  bg.addColorStop(0.6, '#111827');
  bg.addColorStop(1, '#090D16');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Fine engineering drafting grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Technical border & corner ticks
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  // Dimension datum line & wheelbase markers
  const groundY = 164;
  ctx.strokeStyle = 'rgba(245, 242, 235, 0.28)';
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(28, groundY);
  ctx.lineTo(w - 28, groundY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Contact shadow on datum plane
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, groundY + 2, 188, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  const is911 = carId === 'stuttgart_911s_rs';
  const isProto = carId === 'dearborn_gt40_mk2';
  const isBritish = carId === 'coventry_etype_lw';
  const isF1 = carId === 'scuderia_f1_68';

  // Draw sculpted side-elevation silhouette per classic chassis
  ctx.save();
  ctx.beginPath();
  if (isF1) {
    // Low-slung 1968 Formula 1 cigar/wedge monoposto fuselage with open cockpit
    ctx.moveTo(118, 142); // Rear gearbox lower edge
    ctx.lineTo(112, 116); // Rear engine bay deck
    ctx.lineTo(222, 112); // Behind cockpit bulkhead
    ctx.lineTo(234, 98);  // Cockpit headrest cowl
    ctx.lineTo(260, 108); // Open cockpit rim dip
    ctx.lineTo(318, 106); // Forward cockpit cowl
    ctx.bezierCurveTo(378, 108, 438, 118, 488, 134); // Tapered F1 shark nosecone
    ctx.lineTo(488, 144); // Lower nosecone tip
    ctx.lineTo(118, 144);
  } else if (isProto) {
    // Low-slung 40.5-inch Le Mans Prototype wedge & Kamm tail
    ctx.moveTo(86, 146); // rear lower valence
    ctx.lineTo(78, 114); // Kamm tail vertical transom
    ctx.lineTo(92, 108); // Integrated ducktail lip
    ctx.bezierCurveTo(145, 106, 195, 96, 235, 84); // Engine cover & rear haunch
    ctx.bezierCurveTo(275, 74, 322, 74, 358, 98); // Low wraparound windshield
    ctx.bezierCurveTo(398, 96, 448, 104, 474, 126); // Front pontoon fender
    ctx.lineTo(482, 142); // Front chin spoiler
    ctx.lineTo(462, 148);
  } else if (is911) {
    // Iconic Stuttgart sloped fastback + RS ducktail spoiler
    ctx.moveTo(92, 146);
    ctx.lineTo(84, 122);
    ctx.lineTo(96, 102); // Ducktail kick
    ctx.lineTo(118, 104);
    ctx.bezierCurveTo(165, 78, 225, 66, 286, 68); // Sloped roof arch
    ctx.bezierCurveTo(318, 70, 344, 86, 362, 104); // Steep windshield
    ctx.bezierCurveTo(405, 104, 446, 112, 470, 134); // Sloped front trunk & high fenders
    ctx.lineTo(476, 148);
  } else if (isBritish) {
    // Long-bonnet Coventry E-Type Lightweight teardrop fastback
    ctx.moveTo(84, 144);
    ctx.bezierCurveTo(78, 124, 96, 108, 142, 92); // Tapered fastback tail
    ctx.bezierCurveTo(190, 72, 245, 68, 288, 74); // Compact GT greenhouse
    ctx.lineTo(324, 100); // Raked windscreen
    ctx.bezierCurveTo(378, 96, 444, 102, 476, 124); // Endless sculpted bonnet
    ctx.lineTo(478, 146);
  } else {
    // 1964 Aurelia 250 GTO: Scaglietti long nose, pontoon fenders & Kammback ducktail
    ctx.moveTo(84, 146);
    ctx.lineTo(78, 106); // Kammback vertical cut
    ctx.lineTo(92, 96); // Integrated spoiler lip
    ctx.bezierCurveTo(140, 98, 185, 74, 245, 72); // Fastback roofline
    ctx.lineTo(312, 74);
    ctx.lineTo(348, 102); // Windshield base
    ctx.bezierCurveTo(395, 96, 448, 102, 478, 126); // Low Scaglietti nose
    ctx.lineTo(482, 146);
  }
  ctx.closePath();

  // Fill with live coachwork body color + metallic highlight gradient
  ctx.fillStyle = bodyColor;
  ctx.fill();

  const bodySheen = ctx.createLinearGradient(0, 68, 0, 152);
  bodySheen.addColorStop(0, 'rgba(255,255,255,0.28)');
  bodySheen.addColorStop(0.45, 'rgba(255,255,255,0.03)');
  bodySheen.addColorStop(1, 'rgba(0,0,0,0.48)');
  ctx.fillStyle = bodySheen;
  ctx.fill();

  // Optional side sill / Le Mans stripe band
  if (stripeStyle !== 'none') {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = stripeColor;
    ctx.fillRect(70, isF1 ? 124 : 132, 420, 7);
    if (stripeStyle === 'hood_sill') {
      ctx.fillRect(345, 96, 130, 12);
    }
    ctx.restore();
  }

  ctx.strokeStyle = 'rgba(248, 250, 252, 0.55)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();

  if (isF1) {
    // F1 High-Mounted Rear Wing + Struts, Front Aero Wing, Roll Hoop, Driver Helmet & V12 Velocity Trumpets
    // Rear wing struts
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(142, 114);
    ctx.lineTo(130, 66);
    ctx.moveTo(156, 114);
    ctx.lineTo(144, 66);
    ctx.stroke();

    // Rear bi-plane wing & endplate
    ctx.fillStyle = bodyColor;
    ctx.fillRect(114, 56, 42, 16);
    ctx.strokeStyle = stripeColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(114, 56, 42, 16);

    // Front wing & endplate ahead of front wheel
    ctx.fillStyle = bodyColor;
    ctx.fillRect(466, 132, 34, 14);
    ctx.strokeRect(466, 132, 34, 14);

    // Chrome roll hoop & driver helmet in open cockpit
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(228, 100);
    ctx.lineTo(234, 74);
    ctx.lineTo(248, 102);
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.arc(266, 95, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(268, 91, 8, 5);

    // Tinted wrap-around Perspex aero windscreen
    ctx.fillStyle = 'rgba(56, 189, 248, 0.38)';
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(286, 106);
    ctx.lineTo(304, 92);
    ctx.lineTo(326, 106);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Exposed V12 intake velocity trumpets & white bundle-of-snakes exhaust
    ctx.fillStyle = '#CBD5E1';
    for (let t = 0; t < 6; t++) {
      ctx.fillRect(162 + t * 9, 98, 5, 14);
    }
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(165, 118);
    ctx.lineTo(92, 116);
    ctx.moveTo(175, 123);
    ctx.lineTo(90, 122);
    ctx.stroke();
  } else {
    // Greenhouse side windows with chrome framing
    ctx.save();
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    if (isProto) {
      ctx.moveTo(232, 88);
      ctx.quadraticCurveTo(285, 76, 346, 98);
      ctx.lineTo(240, 100);
    } else if (is911) {
      ctx.moveTo(186, 98);
      ctx.quadraticCurveTo(245, 72, 336, 98);
      ctx.lineTo(350, 104);
      ctx.lineTo(186, 104);
    } else {
      ctx.moveTo(196, 96);
      ctx.quadraticCurveTo(255, 74, 310, 78);
      ctx.lineTo(340, 102);
      ctx.lineTo(196, 102);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Triple shark-gill fender louvers on front flank
  ctx.fillStyle = '#090D14';
  for (let g = 0; g < 3; g++) {
    ctx.save();
    ctx.translate(342 + g * 9, 118);
    ctx.rotate(0.28);
    ctx.fillRect(-2, -10, 3.5, 20);
    ctx.restore();
  }

  // White FIA door roundel & racing number
  const roundelX = isF1 ? 348 : 278;
  const roundelY = 124;
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.arc(roundelX, roundelY, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#090D14';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#090D14';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), roundelX, roundelY + 1);

  if (!isF1) {
    // Front and rear chrome bumper blades + quad exhaust pipes
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(468, 134, 18, 5);
    ctx.fillRect(72, 132, 18, 5);
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(68, 141, 14, 3.5);
    ctx.fillRect(68, 146, 14, 3.5);
  }

  // Front & Rear Wheels with Borrani wire / Gold Magnesium / Gunmetal Alloy detail
  const wheelPositions = [152, 404];
  const rimColor =
    wheelFinish === 'gold_magnesium'
      ? '#F59E0B'
      : wheelFinish === 'gunmetal_alloy'
      ? '#94A3B8'
      : '#E2E8F0';

  for (const wx of wheelPositions) {
    const wy = 142;
    // Wheel well arch cutout
    ctx.fillStyle = '#05070B';
    ctx.beginPath();
    ctx.arc(wx, wy, 27, Math.PI, 0);
    ctx.lineTo(wx + 27, wy + 8);
    ctx.lineTo(wx - 27, wy + 8);
    ctx.closePath();
    ctx.fill();

    // Dunlop Bias-Ply Tire
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(wx, wy, 23, 0, Math.PI * 2);
    ctx.fill();

    // Amber sidewall stripe
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(wx, wy, 18.5, 0, Math.PI * 2);
    ctx.stroke();

    // Rim barrel
    ctx.fillStyle = rimColor;
    ctx.beginPath();
    ctx.arc(wx, wy, 14, 0, Math.PI * 2);
    ctx.fill();

    // Inner brake disc & spokes
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.arc(wx, wy, 11, 0, Math.PI * 2);
    ctx.fill();

    // Bronze caliper
    ctx.fillStyle = '#D97706';
    ctx.fillRect(wx - 9, wy - 5, 5, 10);

    // Spokes
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = wheelFinish === 'chrome_wire' ? 1.1 : 2.4;
    const spokeCount = wheelFinish === 'chrome_wire' ? 12 : 5;
    for (let s = 0; s < spokeCount; s++) {
      const ang = (s * Math.PI * 2) / spokeCount;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + Math.cos(ang) * 13, wy + Math.sin(ang) * 13);
      ctx.stroke();
    }

    // Knock-off center spinner
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.arc(wx, wy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Technical Blueprint Callout Typography
  ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(
    isF1
      ? 'FIA FORMULA 1 MONOPOSTO · ORTHOGRAPHIC ELEVATION 1:18'
      : 'FIA GROUP 4 HOMOLOGATION · ORTHOGRAPHIC ELEVATION 1:18',
    20,
    24
  );
  ctx.fillStyle = 'rgba(203, 213, 225, 0.75)';
  ctx.fillText('WHEELBASE: 2,400 MM', 152, 188);
  ctx.textAlign = 'right';
  ctx.fillText(`CHASSIS NO. #${number} · ${wheelFinish.replace('_', ' ').toUpperCase()}`, w - 20, 24);

  const url = canvas.toDataURL('image/png');
  assetCache[key] = url;
  return url;
}

/**
 * Generates high-DPI 1967 Officina Meccanica Technical Cutaway & Hardware Schematics
 * for each of the 4 mechanical upgrade systems in the Garage.
 */
export function getUpgradePartSchematicPng(
  partKey: keyof CarUpgrades,
  stageLevel: number
): string {
  const key = `part_${partKey}_${stageLevel}`;
  if (assetCache[key]) return assetCache[key];
  if (typeof document === 'undefined') return createFallbackSvgDataUrl(partKey);

  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 180;
  const ctx = canvas.getContext('2d');
  if (!ctx) return createFallbackSvgDataUrl(partKey);

  const w = canvas.width;
  const h = canvas.height;

  // Dark slate workshop background with subtle blueprint grid
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.5, 10, w * 0.5, h * 0.5, 140);
  bg.addColorStop(0, '#1E2430');
  bg.addColorStop(1, '#0B0E14');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(245, 242, 235, 0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  if (partKey === 'engineLevel') {
    // Six Weber 40 DCN Downdraft Carburetors & Spun-Aluminum Velocity Trumpets
    // Crinkle-black V12 intake manifold bridge
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.5;
    ctx.fillRect(28, 96, 184, 48);
    ctx.strokeRect(28, 96, 184, 48);

    // Brass fuel rail & braided lines
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(20, 114);
    ctx.lineTo(220, 114);
    ctx.stroke();

    // 6 Velocity Stack Trumpets
    const xs = [44, 74, 104, 136, 166, 196];
    for (const tx of xs) {
      // Carburetor float bowl
      ctx.fillStyle = '#64748B';
      ctx.fillRect(tx - 10, 74, 20, 26);

      // Brass throttle linkage jet
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(tx, 87, 4, 0, Math.PI * 2);
      ctx.fill();

      // Flared spun-aluminum velocity trumpet
      const trumpGrad = ctx.createLinearGradient(tx - 12, 34, tx + 12, 74);
      trumpGrad.addColorStop(0, '#F8FAFC');
      trumpGrad.addColorStop(0.5, '#94A3B8');
      trumpGrad.addColorStop(1, '#CBD5E1');
      ctx.fillStyle = trumpGrad;
      ctx.beginPath();
      ctx.moveTo(tx - 13, 38);
      ctx.lineTo(tx + 13, 38);
      ctx.lineTo(tx + 8, 74);
      ctx.lineTo(tx - 8, 74);
      ctx.closePath();
      ctx.fill();

      // Trumpet mouth rim
      ctx.fillStyle = stageLevel >= 3 ? '#F59E0B' : '#090D14';
      ctx.beginPath();
      ctx.ellipse(tx, 38, 13, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  } else if (partKey === 'transmissionLevel') {
    // Close-Ratio 5-Speed Dog-Leg Gearbox Helical Gears & Open-Gate Shifter
    const gears = [
      { x: 68, y: 92, r: 34, teeth: 14, color: '#94A3B8' },
      { x: 122, y: 78, r: 26, teeth: 11, color: '#CBD5E1' },
      { x: 168, y: 102, r: 30, teeth: 12, color: '#F59E0B' },
    ];
    for (const g of gears) {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.fillStyle = g.color;
      for (let t = 0; t < g.teeth; t++) {
        const a = (t * Math.PI * 2) / g.teeth;
        ctx.save();
        ctx.rotate(a);
        ctx.fillRect(-4, -g.r - 5, 8, 8);
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, g.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(0, 0, g.r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Chrome Open-Gate 5-Speed Shift Plate inset
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(142, 22, 76, 48, 6);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2.2;
    for (const gx of [158, 180, 202]) {
      ctx.beginPath();
      ctx.moveTo(gx, 30);
      ctx.lineTo(gx, 62);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(158, 46);
    ctx.lineTo(202, 46);
    ctx.stroke();
  } else if (partKey === 'tiresLevel') {
    // Borrani 72-Spoke Wire Wheel + Dunlop Racing Tread + Girling Caliper
    const cx = 120;
    const cy = 90;
    // Outer tire with tread blocks
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(cx, cy, 64, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.setLineDash([7, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, 63, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Yellow Dunlop sidewall ring
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 50, 0, Math.PI * 2);
    ctx.stroke();

    // Ventilated cast-iron brake rotor
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(cx, cy, 38, 0, Math.PI * 2);
    ctx.fill();

    // Bronze Girling Brake Caliper
    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.roundRect(cx - 38, cy - 16, 16, 32, 3);
    ctx.fill();

    // Cross-laced chrome wire spokes
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI * 2) / 24;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10);
      ctx.lineTo(cx + Math.cos(a + 0.35) * 41, cy + Math.sin(a + 0.35) * 41);
      ctx.stroke();
    }

    // 3-eared knock-off spinner
    ctx.fillStyle = '#F8FAFC';
    for (let e = 0; e < 3; e++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((e * Math.PI * 2) / 3);
      ctx.fillRect(-3.5, -18, 7, 18);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#D97706';
    ctx.fill();
  } else {
    // Superleggera Tubular Spaceframe & Drilled Aluminum Coachwork Panel
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    const tubes = [
      [28, 134, 92, 46],
      [92, 46, 174, 46],
      [174, 46, 214, 134],
      [28, 134, 214, 134],
      [92, 46, 136, 134],
      [174, 46, 136, 134],
      [60, 90, 194, 90],
    ];
    for (const [x1, y1, x2, y2] of tubes) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Brushed aluminum gusset plate with weight-saving flanged holes
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(46, 108, 148, 34);
    for (const hx of [68, 98, 128, 158]) {
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(hx, 125, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Leather bonnet buckle strap
    ctx.fillStyle = '#7C2D12';
    ctx.fillRect(172, 26, 18, 66);
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 2;
    ctx.strokeRect(169, 48, 24, 16);
  }

  // Stage stamp badge in top-left corner
  ctx.fillStyle = 'rgba(9, 13, 20, 0.85)';
  ctx.fillRect(8, 8, 84, 20);
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(8, 8, 84, 20);
  ctx.fillStyle = '#F59E0B';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`STAGE ${stageLevel}/5 SPEC`, 14, 18);

  const url = canvas.toDataURL('image/png');
  assetCache[key] = url;
  return url;
}

/**
 * Generates a top-down 1967 Coachwork Bonnet & Roof Livery Preview Plate
 */
export function getLiveryPatternPreviewPng(
  stripeStyle: StripeStyle,
  bodyColor: string,
  stripeColor: string,
  number: number
): string {
  const key = `liv_prev_${stripeStyle}_${bodyColor}_${stripeColor}_${number}`;
  if (assetCache[key]) return assetCache[key];
  if (typeof document === 'undefined') return createFallbackSvgDataUrl(stripeStyle);

  const canvas = document.createElement('canvas');
  canvas.width = 220;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');
  if (!ctx) return createFallbackSvgDataUrl(stripeStyle);

  ctx.fillStyle = '#0D1119';
  ctx.fillRect(0, 0, 220, 120);

  // Sculpted top-down GT hood silhouette
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(24, 22);
  ctx.quadraticCurveTo(110, 12, 196, 28);
  ctx.quadraticCurveTo(206, 60, 196, 92);
  ctx.quadraticCurveTo(110, 108, 24, 98);
  ctx.quadraticCurveTo(16, 60, 24, 22);
  ctx.closePath();
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.clip();

  // Stripe geometry
  ctx.fillStyle = stripeColor;
  if (stripeStyle === 'twin_center') {
    ctx.fillRect(10, 46, 200, 10);
    ctx.fillRect(10, 64, 200, 10);
  } else if (stripeStyle === 'offset_lemans') {
    ctx.fillRect(10, 32, 200, 14);
    ctx.fillRect(10, 50, 200, 5);
  } else if (stripeStyle === 'hood_sill') {
    ctx.fillRect(10, 38, 200, 44);
  }

  // Hood roundel
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.arc(146, 60, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#090D14';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#090D14';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), 146, 61);

  // Twin leather bonnet straps
  ctx.fillStyle = '#78350F';
  ctx.fillRect(82, 16, 8, 22);
  ctx.fillRect(82, 82, 8, 22);
  ctx.restore();

  ctx.strokeStyle = 'rgba(248, 250, 252, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(4, 4, 212, 112);

  const url = canvas.toDataURL('image/png');
  assetCache[key] = url;
  return url;
}

/**
 * Generates a high-DPI 1967 Racing Wheel & Brake Assembly Preview for the Livery Studio
 */
export function getWheelFinishPreviewPng(wheelFinish: WheelFinish): string {
  const key = `wheel_prev_${wheelFinish}`;
  if (assetCache[key]) return assetCache[key];
  if (typeof document === 'undefined') return createFallbackSvgDataUrl(wheelFinish);

  const canvas = document.createElement('canvas');
  canvas.width = 140;
  canvas.height = 140;
  const ctx = canvas.getContext('2d');
  if (!ctx) return createFallbackSvgDataUrl(wheelFinish);

  const cx = 70;
  const cy = 70;
  ctx.fillStyle = '#0D1119';
  ctx.fillRect(0, 0, 140, 140);

  // Dunlop tire outer ring
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(cx, cy, 58, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 46, 0, Math.PI * 2);
  ctx.stroke();

  const rimColor =
    wheelFinish === 'gold_magnesium'
      ? '#F59E0B'
      : wheelFinish === 'gunmetal_alloy'
      ? '#94A3B8'
      : '#E2E8F0';

  // Rim lip
  ctx.fillStyle = rimColor;
  ctx.beginPath();
  ctx.arc(cx, cy, 39, 0, Math.PI * 2);
  ctx.fill();

  // Inner brake drum/disc
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(cx, cy, 31, 0, Math.PI * 2);
  ctx.fill();

  // Caliper
  ctx.fillStyle = '#D97706';
  ctx.fillRect(cx - 28, cy - 12, 10, 24);

  // Spokes
  ctx.strokeStyle = rimColor;
  const spokes = wheelFinish === 'chrome_wire' ? 20 : 5;
  ctx.lineWidth = wheelFinish === 'chrome_wire' ? 1.2 : 5.5;
  for (let i = 0; i < spokes; i++) {
    const a = (i * Math.PI * 2) / spokes;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * 35, cy + Math.sin(a) * 35);
    ctx.stroke();
  }

  // Spinner
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fill();

  const url = canvas.toDataURL('image/png');
  assetCache[key] = url;
  return url;
}

/**
 * Generates a high-DPI 1967 Magneti Marelli Engine Dynamometer & Suspension Geometry Chart
 * that updates dynamically with the player's effective stats and 6 mechanical tuning sliders.
 */
export function getDynoAndChassisTelemetryPng(
  effectiveStats: EffectiveCarStats,
  tuning: HandlingTuning
): string {
  const key = `dyno_${effectiveStats.powerHp}_${effectiveStats.topSpeedKmh}_${tuning.suspensionStiffness}_${tuning.tirePressurePsi}_${tuning.aeroDownforce}_${tuning.finalDriveRatio}_${tuning.brakeBiasFront}_${tuning.diffLockAccel}`;
  if (assetCache[key]) return assetCache[key];
  if (typeof document === 'undefined') return createFallbackSvgDataUrl('DYNO');

  const canvas = document.createElement('canvas');
  canvas.width = 560;
  canvas.height = 175;
  const ctx = canvas.getContext('2d');
  if (!ctx) return createFallbackSvgDataUrl('DYNO');

  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = '#0C1017';
  ctx.fillRect(0, 0, w, h);

  // Oscilloscope / Dyno graph grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
  ctx.lineWidth = 1;
  for (let x = 16; x <= w - 16; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 16);
    ctx.lineTo(x, h - 22);
    ctx.stroke();
  }
  for (let y = 16; y <= h - 22; y += 22) {
    ctx.beginPath();
    ctx.moveTo(16, y);
    ctx.lineTo(w - 16, y);
    ctx.stroke();
  }

  // Left half: Weber / Magneti Marelli Power & Torque Dyno Curve (1,000 – 8,500 RPM)
  const gx0 = 24;
  const gx1 = 290;
  const gy0 = 28;
  const gy1 = h - 28;

  // Torque curve (emerald)
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const x = gx0 + t * (gx1 - gx0);
    const torqueShape =
      Math.sin(t * Math.PI * 0.88) * 0.78 +
      0.22 -
      (tuning.finalDriveRatio - 3.5) * 0.04 * (1 - t);
    const y = gy1 - Math.max(0.1, Math.min(0.95, torqueShape)) * (gy1 - gy0);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Horsepower curve (amber gold)
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const x = gx0 + t * (gx1 - gx0);
    const hpFactor = Math.pow(t, 1.18) * Math.sin(t * Math.PI * 0.62) * 1.12;
    const y = gy1 - Math.max(0.06, Math.min(0.96, hpFactor)) * (gy1 - gy0);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = '#F59E0B';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`BANCO PROVA WEBER · ${effectiveStats.powerHp} CV @ 7,800 RPM`, gx0, 20);
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('2,000 RPM', gx0, h - 8);
  ctx.textAlign = 'right';
  ctx.fillText('8,500 RPM', gx1, h - 8);

  // Right half: 4-Corner Chassis Balance, Downforce Vector & Brake Bias Schematic
  const cx = 428;
  const cy = 90;

  // Chassis plan-view frame
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - 58, cy - 28, 116, 56);

  // Brake bias distribution bar between front and rear axles
  const frontBiasFrac = tuning.brakeBiasFront / 100;
  const biasX = cx - 50 + (1 - frontBiasFrac) * 100;
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(biasX, cy, 5, 0, Math.PI * 2);
  ctx.fill();

  // Four wheels at corners
  const corners = [
    [-58, -34],
    [-58, 22],
    [42, -34],
    [42, 22],
  ];
  for (const [ox, oy] of corners) {
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(cx + ox, cy + oy, 18, 12);
  }

  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(
    `AERO: ${tuning.aeroDownforce}% · LSD: ${tuning.diffLockAccel}%`,
    320,
    20
  );
  ctx.fillStyle = '#CBD5E1';
  ctx.fillText(
    `SPRING: ${tuning.suspensionStiffness.toFixed(1)} kN/m · BIAS: ${tuning.brakeBiasFront}%F`,
    320,
    h - 8
  );

  const url = canvas.toDataURL('image/png');
  assetCache[key] = url;
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
      Math.sin(
        x * 0.012 + (trackId === 'eifel_sprint' ? 1.4 : trackId === 'stelvio_pass' ? 2.2 : 0.3)
      ) *
        peakAmp +
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
 * Generates a high-DPI Dunlop Vintage Racing Tire Compound Emblem (Soft, Medium, Hard, Wet)
 */
export function getTireCompoundBadgePng(compound: TireCompound): string {
  const key = `tire_badge_${compound}`;
  if (assetCache[key]) return assetCache[key];
  if (typeof document === 'undefined') return createFallbackSvgDataUrl(compound);

  const canvas = document.createElement('canvas');
  canvas.width = 120;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');
  if (!ctx) return createFallbackSvgDataUrl(compound);

  const cx = 60;
  const cy = 60;
  const ringColor =
    compound === 'soft'
      ? '#EF4444'
      : compound === 'medium'
      ? '#F59E0B'
      : compound === 'hard'
      ? '#F8FAFC'
      : '#38BDF8';

  // Vulcanized rubber tire casing
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(cx, cy, 52, 0, Math.PI * 2);
  ctx.fill();

  // Tread blocks around circumference
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 4;
  ctx.setLineDash(compound === 'wet' ? [4, 3] : [9, 3]);
  ctx.beginPath();
  ctx.arc(cx, cy, 51, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Compound sidewall band
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, 38, 0, Math.PI * 2);
  ctx.stroke();

  // Wire wheel center
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(cx, cy, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = ringColor;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(compound.toUpperCase(), cx, cy + 1);

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
