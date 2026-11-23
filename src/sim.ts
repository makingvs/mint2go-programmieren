// Roboter-Simulator: Zustand des simulierten Spike-Roboters und was eine einzelne Anweisung daran ändert. Ohne DOM, damit testbar.
// Koordinaten in Feldern (1 Schritt = 1 Feld), Ursprung links oben, y nach unten.
// Blickrichtung (heading) in Grad: 0 = nach oben, 90 = nach rechts (im Uhrzeigersinn).
// Der Ablauf eines Programms (Schleifen, Bedingungen, Ereignisse) steht in machine.ts.
import { COUNT_MAX, COUNT_MIN, NOTES, type HatType } from './blocks';

/** Ein Feld des Bodens (Spalte, Zeile), links oben ist 0/0 */
export type Cell = [number, number];

export interface World {
  /** Breite und Höhe des Bodens in Feldern */
  w: number;
  h: number;
  start: { x: number; y: number; heading: number };
  /** Felder mit einem Hindernis (der Roboter stoppt davor wie vor der Wand) */
  obstacles?: Cell[];
}

export const DEFAULT_WORLD: World = { w: 12, h: 8, start: { x: 1.5, y: 6.5, heading: 0 } };

export interface RobotState {
  x: number;
  y: number;
  heading: number;
  /** Bild auf der Lichtmatrix oder null (aus) */
  image: string | null;
  /** Eckpunkte der gefahrenen Spur (beginnt mit der Startposition) */
  trail: [number, number][];
  /** Der Roboter ist in dieser Anweisung gegen die Wand gestoßen */
  bumped: boolean;
  /** Der Zähler (eine Zahl, die sich der Roboter merkt) */
  count: number;
}

export type InstrKind =
  | 'forward'
  | 'backward'
  | 'turnLeft'
  | 'turnRight'
  | 'showImage'
  | 'lightOff'
  | 'beep'
  | 'wait'
  | 'loop'
  | 'check'
  | 'setCount'
  | 'addCount'
  | 'event';

export interface Instr {
  /** Block, aus dem die Anweisung stammt (zum Hervorheben); bei 'event' die Eltern-id des Ereignis-Skripts */
  id: number;
  kind: InstrKind;
  /** Schritte (Vorwärts/Rückwärts) bzw. Zahl für den Zähler */
  n?: number;
  /** Grad (Drehen) */
  deg?: number;
  img?: string;
  note?: string;
  /** Sekunden (Warten) */
  s?: number;
  /** Wiederholen: aktueller Durchlauf und Anzahl */
  iter?: number;
  total?: number;
  /** Prüfung (Wenn, Wiederhole bis): Ergebnis */
  result?: boolean;
  /** Ereignis-Skript beginnt */
  hat?: HatType;
}

export function initialState(w: World): RobotState {
  return { x: w.start.x, y: w.start.y, heading: w.start.heading, image: null, trail: [[w.start.x, w.start.y]], bumped: false, count: 0 };
}

const round = (v: number): number => Math.round(v * 1e6) / 1e6;
const norm = (deg: number): number => ((deg % 360) + 360) % 360;
/** Abstand zur Wand, den der Mittelpunkt des Roboters mindestens hat (Felder) */
export const WALL_MARGIN = 0.5;

/**
 * Zustand nach der Anweisung `i`, wenn der Bruchteil `t` (0..1) davon erledigt ist. t = 1 ist das Ergebnis.
 * Die Spur bekommt erst bei t = 1 einen neuen Eckpunkt (die Anzeige zeichnet zusätzlich bis zur aktuellen Position).
 */
export function apply(s: RobotState, i: Instr, w: World, t = 1): RobotState {
  const f = Math.max(0, Math.min(1, t));
  const next: RobotState = { ...s, bumped: false };
  switch (i.kind) {
    case 'forward':
    case 'backward': {
      // Ziel zuerst bestimmen (an der Wand gestoppt), dann auf dem Weg dorthin den Bruchteil f zurücklegen:
      // so ist die Animation nicht länger als die Fahrt bis zur Wand.
      const dist = (i.n ?? 0) * (i.kind === 'forward' ? 1 : -1);
      const rad = (s.heading * Math.PI) / 180;
      const ex = s.x + Math.sin(rad) * dist;
      const ey = s.y - Math.cos(rad) * dist;
      const wx = Math.min(w.w - WALL_MARGIN, Math.max(WALL_MARGIN, ex));
      const wy = Math.min(w.h - WALL_MARGIN, Math.max(WALL_MARGIN, ey));
      const [cx, cy] = sweep(s.x, s.y, wx, wy, w);
      next.bumped = f >= 1 && (Math.abs(cx - ex) > 1e-9 || Math.abs(cy - ey) > 1e-9);
      next.x = round(s.x + (cx - s.x) * f);
      next.y = round(s.y + (cy - s.y) * f);
      if (f >= 1 && (next.x !== s.x || next.y !== s.y)) next.trail = [...s.trail, [next.x, next.y]];
      break;
    }
    case 'turnLeft':
      next.heading = norm(s.heading - (i.deg ?? 0) * f);
      break;
    case 'turnRight':
      next.heading = norm(s.heading + (i.deg ?? 0) * f);
      break;
    case 'showImage':
      next.image = i.img ?? null;
      break;
    case 'lightOff':
      next.image = null;
      break;
    case 'setCount':
      next.count = clampCount(i.n ?? 0);
      break;
    case 'addCount':
      next.count = clampCount(s.count + (i.n ?? 0));
      break;
    default:
      break; // beep, wait, loop, check, event: ändern den Roboter nicht
  }
  next.heading = round(next.heading);
  return next;
}

function clampCount(n: number): number {
  return Math.min(COUNT_MAX, Math.max(COUNT_MIN, Math.round(n)));
}

// ---------- Hindernisse ----------

/** Der Roboter ist ein Kreis mit diesem Radius (Felder): in einem Gang von einem Feld Breite passt er gerade */
export const ROBOT_RADIUS = 0.5;

/** Berührt der Roboter an dieser Stelle ein Hindernis? */
export function blockedAt(x: number, y: number, w: World): boolean {
  for (const [ox, oy] of w.obstacles ?? []) {
    const dx = Math.max(ox - x, 0, x - (ox + 1));
    const dy = Math.max(oy - y, 0, y - (oy + 1));
    if (Math.hypot(dx, dy) < ROBOT_RADIUS - 1e-6) return true;
  }
  return false;
}

/** Halbe Felder genau treffen (der Roboter hält vor einem Hindernis in der Feldmitte), sonst auf 6 Stellen runden */
function snap(v: number): number {
  const half = Math.round(v * 2) / 2;
  return Math.abs(v - half) < 1e-4 ? half : round(v);
}

/** Fahrt von (sx, sy) nach (ex, ey): Endpunkt, wenn ein Hindernis im Weg ist, sonst (ex, ey). */
function sweep(sx: number, sy: number, ex: number, ey: number, w: World): [number, number] {
  if (!w.obstacles?.length) return [ex, ey];
  const len = Math.hypot(ex - sx, ey - sy);
  if (len < 1e-9) return [ex, ey];
  const at = (t: number): [number, number] => [sx + (ex - sx) * t, sy + (ey - sy) * t];
  const n = Math.ceil(len / 0.02);
  for (let k = 1; k <= n; k++) {
    const [px, py] = at(k / n);
    if (!blockedAt(px, py, w)) continue;
    // erste blockierte Stelle: den letzten freien Punkt genau suchen
    let lo = (k - 1) / n;
    let hi = k / n;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      const [mx, my] = at(mid);
      if (blockedAt(mx, my, w)) hi = mid;
      else lo = mid;
    }
    const [fx, fy] = at(lo);
    return [snap(fx), snap(fy)];
  }
  return [ex, ey];
}

// ---------- Weg des Roboters ----------

/** Kleinster Abstand des Punkts (px, py) von der Strecke a–b */
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Aufgesammelt: der Weg des Roboters (Spur bis jetzt) kommt dem Feldmittelpunkt nah genug. */
export const PICKUP_DIST = 0.35;

export function visited(s: RobotState, cell: Cell): boolean {
  const cx = cell[0] + 0.5;
  const cy = cell[1] + 0.5;
  const pts: [number, number][] = [...s.trail, [s.x, s.y]];
  if (pts.length === 1) return Math.hypot(pts[0][0] - cx, pts[0][1] - cy) < PICKUP_DIST;
  for (let i = 1; i < pts.length; i++) {
    if (distToSegment(cx, cy, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) < PICKUP_DIST) return true;
  }
  return false;
}

/** Steht der Roboter in diesem Feld? */
export function inCell(s: RobotState, cell: Cell): boolean {
  return Math.floor(s.x) === cell[0] && Math.floor(s.y) === cell[1];
}

// ---------- Sensoren ----------

/** Steht eine Wand direkt vor dem Roboter? (ein ganzer Schritt nach vorn ist nicht mehr möglich) */
export function wallAhead(s: RobotState, w: World): boolean {
  const e = apply(s, { id: 0, kind: 'forward', n: 1 }, w, 1);
  return Math.hypot(e.x - s.x, e.y - s.y) < 1 - 1e-9;
}

export function evalCondition(cond: string, s: RobotState, w: World): boolean {
  const wall = wallAhead(s, w);
  return cond === 'free' ? !wall : wall;
}

export function evalCompare(cmp: string, count: number, n: number): boolean {
  if (cmp === 'lt') return count < n;
  if (cmp === 'gt') return count > n;
  return count === n;
}

// ---------- Zeit ----------

/** Dauer einer Anweisung in Millisekunden (Tempo 1). */
export function durationMs(i: Instr): number {
  switch (i.kind) {
    case 'forward':
    case 'backward':
      return Math.max(250, (i.n ?? 1) * 450);
    case 'turnLeft':
    case 'turnRight':
      return Math.max(250, ((i.deg ?? 90) / 90) * 450);
    case 'showImage':
      return 350;
    case 'lightOff':
      return 250;
    case 'beep':
      return 500;
    case 'wait':
      return Math.max(100, (i.s ?? 1) * 1000);
    case 'loop':
      return 160;
    case 'check':
      return 450;
    case 'setCount':
    case 'addCount':
      return 300;
    case 'event':
      return 250;
  }
}

/** Dauer in diesem Zustand: Fahren dauert nur so lange wie die Strecke bis zum Ziel bzw. zur Wand. */
export function durationFor(s: RobotState, i: Instr, w: World): number {
  if (i.kind === 'forward' || i.kind === 'backward') {
    const e = apply(s, i, w, 1);
    return Math.max(250, Math.hypot(e.x - s.x, e.y - s.y) * 450);
  }
  return durationMs(i);
}

/** Tonhöhe einer Ton-Anweisung in Hz (0 = keine). */
export function noteFreq(i: Instr): number {
  return i.kind === 'beep' ? (NOTES[i.note ?? '']?.freq ?? 0) : 0;
}
