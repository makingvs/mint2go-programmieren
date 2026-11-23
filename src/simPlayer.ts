// Abspielen des Roboter-Programms mit Zeitablauf: Start, Einzelschritt, Zurücksetzen, Tempo, Ereignisse. Kein DOM (Zeitgeber austauschbar).
import type { BlockProgram, HatType } from './blocks';
import { Machine } from './machine';
import { apply, durationFor, initialState, noteFreq, type Instr, type RobotState, type World } from './sim';

/** idle = Anfang, playing = läuft, stepping = zwischen Einzelschritten, listening = Programm ist durch und wartet auf Ereignisse, done = fertig */
export type Mode = 'idle' | 'playing' | 'stepping' | 'listening' | 'done';

export type SoundEvent = { kind: 'beep'; freq: number } | { kind: 'bump' };

export interface PlayerHooks {
  /** Roboter hat sich bewegt (jedes Bild der Animation) */
  onFrame: (s: RobotState) => void;
  /** Aktuelle Anweisung (zum Hervorheben); null = keine */
  onInstr: (i: Instr | null) => void;
  onMode: (m: Mode) => void;
  onSound: (e: SoundEvent) => void;
}

export interface Clock {
  now(): number;
  request(cb: (t: number) => void): number;
  cancel(h: number): void;
}

export const realClock: Clock = {
  now: () => performance.now(),
  request: (cb) => requestAnimationFrame(cb),
  cancel: (h) => cancelAnimationFrame(h),
};

export class SimPlayer {
  mode: Mode = 'idle';
  state: RobotState;
  speed = 1;
  private machine: Machine | null = null;
  private cur: Instr | null = null;
  private base: RobotState;
  private t0 = 0;
  private dur = 1;
  private handle: number | null = null;
  private auto = false;

  constructor(
    private readonly world: World,
    private readonly hooks: PlayerHooks,
    private readonly clock: Clock = realClock,
  ) {
    this.state = initialState(world);
    this.base = this.state;
  }

  /** Anzahl der bisher ausgeführten Anweisungen */
  get executed(): number {
    return this.machine?.executed ?? 0;
  }

  /** Programm wurde wegen zu vieler Anweisungen abgebrochen (Endlosschleife) */
  get truncated(): boolean {
    return this.machine?.truncated ?? false;
  }

  setSpeed(v: number): void {
    // laufende Anweisung bleibt gleich lang: Zeitpunkt umrechnen, damit es keinen Sprung gibt
    if (this.cur) {
      const p = this.progress(this.clock.now());
      this.speed = v;
      this.t0 = this.clock.now() - (p * this.dur) / this.speed;
    } else this.speed = v;
  }

  private setMode(m: Mode): void {
    if (this.mode === m) return;
    this.mode = m;
    this.hooks.onMode(m);
  }

  private load(p: BlockProgram): void {
    this.cancelFrame();
    this.machine = new Machine(p, this.world);
    this.cur = null;
    this.state = this.machine.state;
    this.base = this.state;
    this.hooks.onFrame(this.state);
    this.hooks.onInstr(null);
  }

  /** Programm ablaufen lassen (aus dem Stillstand/Ende von vorn, aus dem Einzelschritt weiter). */
  play(p: BlockProgram): void {
    if (this.mode === 'playing' || this.mode === 'listening') return;
    if (this.mode === 'idle' || this.mode === 'done') this.load(p);
    this.auto = true;
    this.setMode('playing');
    if (!this.cur) this.beginNext();
  }

  /** Nur die nächste Anweisung ausführen. */
  step(p: BlockProgram): void {
    if (this.mode === 'playing' || this.mode === 'listening' || this.cur) return; // läuft gerade
    if (this.mode === 'idle' || this.mode === 'done') this.load(p);
    this.auto = false;
    this.setMode('stepping');
    this.beginNext();
  }

  /** Ereignis von außen (Roboter angetippt). Wirkt nur, wenn ein Programm läuft und ein passendes Skript hat. */
  event(hat: HatType): boolean {
    if (!this.machine || this.mode === 'idle' || this.mode === 'done') return false;
    if (!this.machine.fire(hat)) return false;
    // zwischen Einzelschritten wartet das Ereignis auf den nächsten Tipp; sonst geht es gleich los
    if (!this.cur && (this.mode === 'playing' || this.mode === 'listening')) this.beginNext();
    return true;
  }

  /** Zurück auf Anfang (Roboter an den Start, Spur weg). */
  stop(): void {
    this.cancelFrame();
    this.cur = null;
    this.machine = null;
    this.state = initialState(this.world);
    this.base = this.state;
    this.hooks.onFrame(this.state);
    this.hooks.onInstr(null);
    this.setMode('idle');
  }

  private beginNext(): void {
    const m = this.machine;
    if (!m) return;
    const i = m.next();
    if (!i) return this.finish();
    this.cur = i;
    this.base = this.state;
    this.dur = durationFor(this.state, i, this.world);
    this.t0 = this.clock.now();
    this.hooks.onInstr(i);
    if (i.kind === 'beep') this.hooks.onSound({ kind: 'beep', freq: noteFreq(i) });
    this.handle = this.clock.request(this.tick);
  }

  private progress(now: number): number {
    if (!this.cur) return 1;
    return Math.min(1, ((now - this.t0) * this.speed) / this.dur);
  }

  private tick = (now: number): void => {
    this.handle = null;
    const i = this.cur;
    const m = this.machine;
    if (!i || !m) return;
    const p = this.progress(now);
    if (p < 1) {
      this.hooks.onFrame(apply(this.base, i, this.world, p));
      this.handle = this.clock.request(this.tick);
      return;
    }
    m.complete(i); // übernimmt den Zustand und löst ggf. "Wand berührt" aus
    this.state = m.state;
    this.hooks.onFrame(this.state);
    if (this.state.bumped) this.hooks.onSound({ kind: 'bump' });
    this.cur = null;
    if (this.auto) this.beginNext();
    else if (m.idle) this.finish(); // letzter Einzelschritt
  };

  /** Kein Skript mehr: fertig, oder (mit Ereignis-Skripten) weiter auf Ereignisse warten. */
  private finish(): void {
    this.cur = null;
    this.hooks.onInstr(null);
    if (this.machine?.hasEvents && !this.machine.truncated) {
      this.auto = true;
      this.setMode('listening');
    } else this.setMode('done');
  }

  private cancelFrame(): void {
    if (this.handle !== null) this.clock.cancel(this.handle);
    this.handle = null;
  }

  dispose(): void {
    this.cancelFrame();
    this.cur = null;
  }
}
