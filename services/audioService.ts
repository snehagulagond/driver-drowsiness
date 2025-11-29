import { DriverState } from "../types";

class AudioService {
  private ctx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private intervalId: number | null = null;
  public isPlaying: boolean = false;
  private currentType: DriverState | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public startAlarm(type: DriverState) {
    this.init();
    
    // If already playing the same alarm type, do nothing
    if (this.isPlaying && this.currentType === type) return;
    
    // If playing a different type, stop first then start new
    if (this.isPlaying) this.stop();

    this.isPlaying = true;
    this.currentType = type;

    if (type === DriverState.DROWSY || type === DriverState.NODDING) {
      this.playCriticalAlarm();
    } else if (type === DriverState.YAWNING) {
      this.playWarningAlarm();
    } else if (type === DriverState.TIRED) {
      this.playCautionAlarm();
    }
  }

  private playCriticalAlarm() {
    // URGENT: Fast, oscillating siren (Ambulance style)
    // Used for Drowsiness and Nodding
    const playSiren = () => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = 'square'; // Harsh sound
      
      // Modulate frequency rapidly 800Hz <-> 1200Hz
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.1);
      osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.2);
      
      // Keep volume high
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.2);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.25);

      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 0.25);
    };

    // Very fast loop
    playSiren();
    this.intervalId = window.setInterval(playSiren, 250);
  }

  private playWarningAlarm() {
    // WARNING: Descending slide (Uh-oh sound)
    // Used for Yawning
    const playSlide = () => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = 'sawtooth'; // Buzzer-like
      
      // Pitch drop
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.5);
      
      // Volume fade
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);

      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 0.5);
    };

    // Slower loop
    playSlide();
    this.intervalId = window.setInterval(playSlide, 1500);
  }

  private playCautionAlarm() {
    // CAUTION: Double beep
    // Used for Tired/Frequency warnings
    const playBeep = () => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = 'sine'; // Soft
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      
      // Double beep pattern via gain
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.setValueAtTime(0, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0, this.ctx.currentTime + 0.3);

      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 0.3);
    };

    playBeep();
    // No interval, usually plays once or very slowly
    this.intervalId = window.setInterval(playBeep, 3000);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.oscillator) {
      try {
        this.oscillator.stop();
        this.oscillator.disconnect();
      } catch (e) {}
      this.oscillator = null;
    }
    this.isPlaying = false;
    this.currentType = null;
  }
}

export const audioService = new AudioService();