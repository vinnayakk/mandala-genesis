const FFT_SIZE = 2048;
const SMOOTHING = 0.8;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private freqData = new Uint8Array(0); // Uint8Array<ArrayBuffer> — avoids generic mismatch
  private _active = false;

  async start(): Promise<void> {
    if (this._active) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      this.ctx = new AudioContext();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = FFT_SIZE;
      this.analyser.smoothingTimeConstant = SMOOTHING;
      this.source = this.ctx.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      this._active = true;
      console.log(
        `[AudioEngine] ✅ Mic active — ${this.analyser.frequencyBinCount} FFT bins`,
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
    this._active = false;
    console.log("[AudioEngine] 🔇 Mic stopped");
  }

  get active(): boolean {
    return this._active;
  }

  /**
   * Returns normalized overall amplitude [0..1].
   * Works reliably across all audio setups — no speaker quality assumptions.
   */
  getAmplitude(): number {
    if (!this._active || !this.analyser) return 0;
    this.analyser.getByteFrequencyData(this.freqData);
    let sum = 0;
    for (let i = 0; i < this.freqData.length; i++) sum += this.freqData[i];
    return sum / (this.freqData.length * 255);
  }
}
