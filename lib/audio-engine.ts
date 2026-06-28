const FFT_SIZE = 2048;
const SMOOTHING = 0.8;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private freqData = new Uint8Array(0);
  private timeDomainData = new Uint8Array(0); // for RMS amplitude
  private _active = false;

  async start(): Promise<void> {
    if (this._active) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      this.ctx = new AudioContext();
      // Resume explicitly — Chrome may create AudioContext in suspended
      // state if the permission dialog delayed the user gesture
      await this.ctx.resume();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = FFT_SIZE;
      this.analyser.smoothingTimeConstant = SMOOTHING;
      this.source = this.ctx.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeDomainData = new Uint8Array(FFT_SIZE); // full waveform buffer
      this._active = true;
      console.log(
        `[AudioEngine] ✅ Mic active — ${this.analyser.frequencyBinCount} FFT bins, state: ${this.ctx.state}`,
      );
    } catch (err) {
      console.error("[AudioEngine] ❌ Mic access failed:", err);
      throw err;
    }
  }

  stop(): void {
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close();
    this.ctx = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.freqData = new Uint8Array(0);
    this.timeDomainData = new Uint8Array(0);
    this._active = false;
    console.log("[AudioEngine] 🔇 Mic stopped");
  }

  get active(): boolean {
    return this._active;
  }

  /**
   * Returns RMS amplitude [0..1] from raw waveform data.
   *
   * Why time-domain RMS instead of frequency-domain average:
   * getByteFrequencyData averages across 1024 bins, most of which are
   * near-silent high frequencies — even loud music only scores ~0.03.
   * Time-domain RMS measures actual waveform loudness directly:
   * silence ≈ 0.0, speech ≈ 0.1–0.3, loud music ≈ 0.3–0.8.
   */
  getAmplitude(): number {
    if (!this._active || !this.analyser) return 0;
    this.analyser.getByteTimeDomainData(this.timeDomainData);
    let sum = 0;
    for (let i = 0; i < this.timeDomainData.length; i++) {
      const normalized = (this.timeDomainData[i] - 128) / 128; // centre on 0
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / this.timeDomainData.length);
  }
}
