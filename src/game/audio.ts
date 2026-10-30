// 100% Procedural Web Audio API Engine & Sound FX Synthesizer
class RacingAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted = false;
  private isRunning = false;

  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  private tireNoiseNode: AudioBufferSourceNode | null = null;
  private tireFilter: BiquadFilterNode | null = null;
  private tireGain: GainNode | null = null;

  public init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();

      // Engine harmonic synth
      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineGain = this.ctx.createGain();

      this.engineOsc1.type = 'sawtooth';
      this.engineOsc2.type = 'triangle';
      this.engineOsc1.frequency.value = 55;
      this.engineOsc2.frequency.value = 110;

      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 380;
      this.engineFilter.Q.value = 2.5;

      this.engineGain.gain.value = 0.0001;

      this.engineOsc1.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc1.start();
      this.engineOsc2.start();

      // Tire squeal filtered noise loop
      const bufferSize = this.ctx.sampleRate * 1.5;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      this.tireNoiseNode = this.ctx.createBufferSource();
      this.tireNoiseNode.buffer = noiseBuffer;
      this.tireNoiseNode.loop = true;

      this.tireFilter = this.ctx.createBiquadFilter();
      this.tireFilter.type = 'bandpass';
      this.tireFilter.frequency.value = 1150;
      this.tireFilter.Q.value = 6.5;

      this.tireGain = this.ctx.createGain();
      this.tireGain.gain.value = 0.0001;

      this.tireNoiseNode.connect(this.tireFilter);
      this.tireFilter.connect(this.tireGain);
      this.tireGain.connect(this.ctx.destination);
      this.tireNoiseNode.start();

      this.isRunning = true;
    } catch {
      // Ignore audio autoplay blockage until user gesture
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.isMuted) {
      this.silenceContinuous();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public silenceContinuous() {
    if (!this.ctx || !this.engineGain || !this.tireGain) return;
    const now = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(0.0001, now, 0.04);
    this.tireGain.gain.setTargetAtTime(0.0001, now, 0.04);
  }

  public updateTelemetry(params: {
    rpm: number;
    throttle: number;
    isDrifting: boolean;
    isOffTrack: boolean;
    speedMs: number;
    engineConfig: 'V12' | 'I6' | 'F6' | 'V8';
  }) {
    if (this.isMuted) return;
    if (!this.ctx) this.init();
    if (!this.ctx || !this.isRunning || !this.engineOsc1 || !this.engineOsc2 || !this.engineGain || !this.engineFilter || !this.tireGain || !this.tireFilter) {
      return;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    const rpmNorm = Math.max(0, Math.min(1, (params.rpm - 1000) / 7200));

    // Character multipliers per classic engine architecture
    let baseFreq = 38 + rpmNorm * 145;
    let harmonicRatio = 2.0;
    if (params.engineConfig === 'V12') {
      baseFreq = 52 + rpmNorm * 195;
      harmonicRatio = 1.5;
    } else if (params.engineConfig === 'V8') {
      baseFreq = 34 + rpmNorm * 120;
      harmonicRatio = 1.25;
    } else if (params.engineConfig === 'F6') {
      baseFreq = 44 + rpmNorm * 160;
      harmonicRatio = 1.66;
    }

    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.03);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * harmonicRatio, now, 0.03);
    this.engineFilter.frequency.setTargetAtTime(260 + rpmNorm * 1400 + params.throttle * 420, now, 0.04);

    const targetVol = 0.045 + params.throttle * 0.045 + rpmNorm * 0.025;
    this.engineGain.gain.setTargetAtTime(targetVol, now, 0.04);

    // Tire squeal or gravel rumble
    if (params.isDrifting && params.speedMs > 10) {
      this.tireFilter.frequency.setTargetAtTime(1180 + Math.sin(now * 18) * 90, now, 0.03);
      this.tireFilter.Q.setTargetAtTime(7.0, now, 0.03);
      this.tireGain.gain.setTargetAtTime(0.055, now, 0.04);
    } else if (params.isOffTrack && params.speedMs > 5) {
      this.tireFilter.frequency.setTargetAtTime(240, now, 0.03);
      this.tireFilter.Q.setTargetAtTime(1.5, now, 0.03);
      this.tireGain.gain.setTargetAtTime(0.045, now, 0.04);
    } else {
      this.tireGain.gain.setTargetAtTime(0.0001, now, 0.05);
    }
  }

  public playGearShift() {
    if (this.isMuted) return;
    if (!this.ctx) this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    // Pitch-varied (+/- 8%) mechanical exhaust pop
    const pitchVar = 0.92 + Math.random() * 0.16;
    osc.frequency.setValueAtTime(110 * pitchVar, now);
    osc.frequency.exponentialRampToValueAtTime(42 * pitchVar, now + 0.075);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  public playCollision(impactSpeedMs: number) {
    if (this.isMuted) return;
    if (!this.ctx) this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const weight = Math.min(1, impactSpeedMs / 25);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(135 - weight * 45, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.14 + weight * 0.1);

    gain.gain.setValueAtTime(0.08 + weight * 0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16 + weight * 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  public playLapChime(isFinalFinish: boolean) {
    if (this.isMuted) return;
    if (!this.ctx) this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = isFinalFinish ? [523.25, 659.25, 783.99, 1046.5] : [587.33, 880];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);

      gain.gain.setValueAtTime(0.07, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.26);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.28);
    });
  }
}

export const racingAudio = new RacingAudioEngine();
