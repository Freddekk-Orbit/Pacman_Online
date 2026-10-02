export class ChipAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  sfx = 0.45;
  music = 0.22;
  private waka = false;
  private siren: { stop: () => void } | null = null;

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  beep(freq: number, dur: number, type: OscillatorType = "square", vol = 0.2): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = vol * this.sfx;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  startJingle(): void {
    const notes = [196, 247, 294, 392, 294, 392];
    notes.forEach((n, i) => setTimeout(() => this.beep(n, 0.12, "square", 0.16), i * 90));
  }

  wakaEat(): void {
    this.waka = !this.waka;
    this.beep(this.waka ? 380 : 280, 0.05, "square", 0.12);
  }

  power(): void {
    this.beep(180, 0.3, "sawtooth", 0.14);
    setTimeout(() => this.beep(140, 0.3, "sawtooth", 0.12), 80);
  }

  ghostEat(): void {
    [500, 650, 800, 980].forEach((n, i) => setTimeout(() => this.beep(n, 0.08, "square", 0.14), i * 50));
  }

  death(): void {
    [400, 320, 250, 180, 120].forEach((n, i) => setTimeout(() => this.beep(n, 0.14, "triangle", 0.18), i * 110));
  }

  win(): void {
    [262, 330, 392, 523, 392, 523].forEach((n, i) => setTimeout(() => this.beep(n, 0.12, "square", 0.16), i * 100));
  }

  startSiren(): void {
    if (this.siren) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    g.gain.value = 0.04 * this.music;
    osc.frequency.value = 90;
    osc.connect(g);
    g.connect(this.master);
    osc.start();
    let t = 0;
    const id = setInterval(() => {
      t += 0.12;
      osc.frequency.value = 80 + Math.sin(t) * 18;
    }, 80);
    this.siren = {
      stop: () => {
        clearInterval(id);
        try {
          osc.stop();
        } catch {
          /* already stopped */
        }
      },
    };
  }

  stopSiren(): void {
    this.siren?.stop();
    this.siren = null;
  }
}

export const audio = new ChipAudio();
