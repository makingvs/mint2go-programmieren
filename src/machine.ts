// Ablauf eines Block-Programms: Schleifen, Bedingungen und Ereignisse. Liefert eine Anweisung nach der anderen;
// Bedingungen werden erst ausgewertet, wenn sie dran sind (mit dem aktuellen Zustand des Roboters). Ohne DOM, ohne Zeit.
import { HAT_PARENT, type Block, type BlockProgram, type HatType } from './blocks';
import { DEFAULT_WORLD, apply, evalCompare, evalCondition, initialState, type Instr, type RobotState, type World } from './sim';

/** So viele Anweisungen höchstens je Programmlauf (Schutz vor Endlosschleifen im schnellen Test) */
export const MAX_INSTRS = 3000;

interface Frame {
  blocks: Block[];
  i: number;
  /** Block, dem dieser Rahmen gehört (Wiederholen, Wenn …); fehlt beim Skript selbst */
  owner?: Block;
  kind: 'seq' | 'repeat' | 'until' | 'forever';
  iter: number;
  total: number;
  /** Wiederhole bis: vor dem nächsten Durchgang prüfen */
  needTest: boolean;
}

/** Ein Skript in Arbeit (Hauptprogramm oder Ereignis-Skript). */
class Thread {
  private frames: Frame[];
  /** Ereignis-Skripte beginnen mit einer Marke, damit der Kopf aufleuchtet */
  private announce: Instr | null;

  constructor(
    blocks: Block[],
    readonly hat: HatType | null,
  ) {
    this.frames = [{ blocks, i: 0, kind: 'seq', iter: 0, total: 0, needTest: false }];
    this.announce = hat ? { id: HAT_PARENT[hat], kind: 'event', hat } : null;
  }

  /** Nächste Anweisung oder null, wenn das Skript zu Ende ist. */
  next(s: RobotState, w: World): Instr | null {
    if (this.announce) {
      const a = this.announce;
      this.announce = null;
      return a;
    }
    for (;;) {
      const f = this.frames[this.frames.length - 1];
      if (!f) return null;
      const o = f.owner;

      // Wiederhole bis: Bedingung vor jedem Durchgang prüfen
      if (f.kind === 'until' && f.needTest) {
        const result = evalCondition(String(o!.params.cond), s, w);
        f.needTest = false;
        if (result) this.frames.pop();
        return { id: o!.id, kind: 'check', result };
      }

      if (f.i >= f.blocks.length) {
        if (f.kind === 'seq') {
          this.frames.pop();
          continue;
        }
        if (f.kind === 'repeat') {
          if (f.iter < f.total) {
            f.iter++;
            f.i = 0;
            return { id: o!.id, kind: 'loop', iter: f.iter, total: f.total };
          }
          this.frames.pop();
          continue;
        }
        if (f.kind === 'forever') {
          f.iter++;
          f.i = 0;
          return { id: o!.id, kind: 'loop', iter: f.iter };
        }
        // until: Körper fertig -> erneut prüfen
        f.i = 0;
        f.needTest = true;
        continue;
      }

      const b = f.blocks[f.i++];
      const q = b.params;
      const kids = b.children ?? [];
      switch (b.type) {
        case 'forward':
        case 'backward':
          return { id: b.id, kind: b.type, n: q.n as number };
        case 'turnLeft':
        case 'turnRight':
          return { id: b.id, kind: b.type, deg: q.deg as number };
        case 'showImage':
          return { id: b.id, kind: 'showImage', img: q.img as string };
        case 'lightOff':
          return { id: b.id, kind: 'lightOff' };
        case 'beep':
          return { id: b.id, kind: 'beep', note: q.note as string };
        case 'wait':
          return { id: b.id, kind: 'wait', s: q.s as number };
        case 'setCount':
        case 'addCount':
          return { id: b.id, kind: b.type, n: q.n as number };
        case 'repeat':
          this.frames.push({ blocks: kids, i: 0, owner: b, kind: 'repeat', iter: 1, total: q.n as number, needTest: false });
          return { id: b.id, kind: 'loop', iter: 1, total: q.n as number };
        case 'forever':
          this.frames.push({ blocks: kids, i: 0, owner: b, kind: 'forever', iter: 1, total: 0, needTest: false });
          return { id: b.id, kind: 'loop', iter: 1 };
        case 'repeatUntil':
          this.frames.push({ blocks: kids, i: 0, owner: b, kind: 'until', iter: 0, total: 0, needTest: true });
          continue; // die erste Prüfung kommt gleich als Anweisung
        case 'if':
        case 'ifCount': {
          const result = b.type === 'if' ? evalCondition(String(q.cond), s, w) : evalCompare(String(q.cmp), s.count, q.n as number);
          if (result) this.frames.push({ blocks: kids, i: 0, owner: b, kind: 'seq', iter: 0, total: 0, needTest: false });
          return { id: b.id, kind: 'check', result };
        }
        default:
          continue; // unbekannter Block: überspringen
      }
    }
  }
}

/**
 * Das laufende Programm: Hauptprogramm plus Ereignis-Skripte. Ein Ereignis (getippt, Wand berührt) unterbricht das
 * Hauptprogramm zwischen zwei Anweisungen, das Ereignis-Skript läuft zu Ende, dann geht es weiter.
 */
export class Machine {
  state: RobotState;
  /** Anzahl der bisher gelieferten Anweisungen */
  executed = 0;
  /** Das Programm wurde wegen zu vieler Anweisungen abgebrochen */
  truncated = false;
  private threads: Thread[];
  private readonly events: Partial<Record<HatType, Block[]>>;

  constructor(
    program: BlockProgram,
    private readonly world: World = DEFAULT_WORLD,
  ) {
    this.state = initialState(world);
    this.events = program.events ?? {};
    this.threads = [new Thread(program.blocks, null)];
  }

  /** Gibt es Ereignis-Skripte? Dann wartet das Programm nach dem Ende weiter auf Ereignisse. */
  get hasEvents(): boolean {
    return Object.keys(this.events).length > 0;
  }

  /** Läuft gerade kein Skript mehr (fertig bzw. wartet auf Ereignisse)? */
  get idle(): boolean {
    return this.threads.length === 0;
  }

  /** Nächste Anweisung oder null (fertig, wartet oder abgebrochen). */
  next(): Instr | null {
    while (this.threads.length) {
      const t = this.threads[this.threads.length - 1];
      const i = t.next(this.state, this.world);
      if (i) {
        if (++this.executed > MAX_INSTRS) {
          this.truncated = true;
          this.threads = [];
          return null;
        }
        return i;
      }
      this.threads.pop();
    }
    return null;
  }

  /** Anweisung ist fertig: Zustand übernehmen; Wand-Stoß löst das Ereignis aus. */
  complete(i: Instr): void {
    this.state = apply(this.state, i, this.world, 1);
    if (this.state.bumped) this.fire('bump');
  }

  /** Ereignis auslösen. false = es gibt kein solches Skript oder es läuft schon. */
  fire(hat: HatType): boolean {
    const blocks = this.events[hat];
    if (!blocks || this.threads.some((t) => t.hat === hat)) return false;
    this.threads.push(new Thread(blocks, hat));
    return true;
  }
}

/**
 * Ganzes Programm sofort ausführen (für Tests und die Aufgaben-Prüfung). Wartet nicht auf Ereignisse;
 * `fire` löst nach dem Ende des Hauptprogramms Ereignisse aus (z. B. ['tap'] = der Roboter wird einmal angetippt).
 */
export function simulate(
  p: BlockProgram,
  w: World = DEFAULT_WORLD,
  opts: { fire?: HatType[] } = {},
): { state: RobotState; instrs: Instr[]; truncated: boolean; bumps: number } {
  const m = new Machine(p, w);
  const instrs: Instr[] = [];
  let bumps = 0;
  const run = (): void => {
    for (let i = m.next(); i; i = m.next()) {
      instrs.push(i);
      m.complete(i);
      if (m.state.bumped) bumps++;
    }
  };
  run();
  for (const hat of opts.fire ?? []) if (m.fire(hat)) run();
  return { state: m.state, instrs, truncated: m.truncated, bumps };
}
