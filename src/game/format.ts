export function formatLapTime(ms: number): string {
  if (!ms || ms <= 0 || !Number.isFinite(ms)) return '--:--.--';
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const hundredths = Math.floor((ms % 1000) / 10);

  const mStr = String(minutes).padStart(1, '0');
  const sStr = String(seconds).padStart(2, '0');
  const hStr = String(hundredths).padStart(2, '0');
  return `${mStr}:${sStr}.${hStr}`;
}
