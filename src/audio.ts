// Töne des simulierten Roboters (Web Audio). Alles optional: ohne Audio (oder stumm) passiert einfach nichts.
import type { SoundEvent } from './simPlayer';

const KEY = 'code.sound';
let ctx: AudioContext | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === 'off';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(v: boolean): void {
  muted = v;
  try {
    localStorage.setItem(KEY, v ? 'off' : 'on');
  } catch {
    /* egal */
  }
}

/** Muss in einem Tipp (Benutzeraktion) aufgerufen werden, sonst bleibt Safari auf dem iPad stumm. */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, ms: number, type: OscillatorType, volume: number): void {
  if (!ctx || muted || freq <= 0) return;
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + ms / 1000 + 0.05);
  } catch {
    /* Ton ist nur Zugabe */
  }
}

export function playSound(e: SoundEvent): void {
  if (e.kind === 'beep') tone(e.freq, 450, 'triangle', 0.25);
  else tone(110, 160, 'square', 0.12);
}
