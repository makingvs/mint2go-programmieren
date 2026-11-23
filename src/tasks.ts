// Übungsaufgaben für den Roboter: Karte (Hindernisse, Ziel, Sterne), erlaubte Blöcke und automatische Prüfung.
// Geprüft wird mit simulate() nach jedem Lauf. Ohne DOM, damit testbar.
import { blockDef, countBlocks, flatten, hasEvent, type BlockProgram, type HatType } from './blocks';
import { simulate } from './machine';
import { inCell, visited, type Cell, type InstrKind, type RobotState, type World } from './sim';

export const MAP_W = 12;
export const MAP_H = 8;

export interface TaskDef {
  id: string;
  /** Stufe 1–4 (siehe LEVELS) */
  level: number;
  title: string;
  text: string;
  /** Karte, 8 Zeilen à 12 Zeichen: # Hindernis, S Start, G Ziel, X Start und Ziel, * Stern, . leer */
  map: string[];
  /** Blickrichtung am Start in Grad (0 = oben, 90 = rechts) */
  heading?: number;
  /** Block-Typen in der Palette (alle anderen sind ausgeblendet) */
  allowed: string[];
  /** Am Ende soll dieses Lichtbild leuchten */
  image?: string;
  /** Am Ende soll der Zähler diesen Wert haben */
  count?: number;
  /** Mindestens so viele ausgeführte Anweisungen dieser Art */
  does?: { kind: InstrKind; n: number }[];
  /** Höchstens so viele Blöcke im Programm */
  maxBlocks?: number;
  /** Diese Blöcke müssen im Programm vorkommen (whenTap/whenBump = Ereignis-Skript) */
  use?: string[];
  /** Ereignisse, die nach dem Lauf ausgelöst werden (der Roboter wird angetippt) */
  fire?: HatType[];
}

export interface Task extends TaskDef {
  world: World;
  /** Der Roboter soll in einem dieser Felder enden (leer = egal) */
  goal: Cell[];
  stars: Cell[];
}

export const LEVELS: { id: number; name: string; color: string }[] = [
  { id: 1, name: 'Reihenfolge', color: '#98c227' },
  { id: 2, name: 'Wiederholen', color: '#38b8e8' },
  { id: 3, name: 'Wenn und Bis', color: '#f0a030' },
  { id: 4, name: 'Zähler und Ereignisse', color: '#e01070' },
];

const MOVE = ['forward', 'backward', 'turnLeft', 'turnRight'];

const DEFS: TaskDef[] = [
  {
    id: 't01',
    level: 1,
    title: 'Zum Ziel',
    text: 'Fahre den Roboter zur Flagge.',
    map: ['............', '............', '.G..........', '............', '............', '............', '.S..........', '............'],
    allowed: MOVE,
  },
  {
    id: 't02',
    level: 1,
    title: 'Um die Ecke',
    text: 'Fahre zur Flagge. Du musst dich drehen.',
    map: ['............', '............', '............', '....G.......', '............', '............', '.S..........', '............'],
    allowed: MOVE,
  },
  {
    id: 't03',
    level: 1,
    title: 'Umweg',
    text: 'Die Mauer steht im Weg. Fahre außen herum zur Flagge.',
    map: ['............', '............', '............', '............', '...#....G...', '...#........', '.S.#........', '...#........'],
    allowed: MOVE,
  },
  {
    id: 't04',
    level: 1,
    title: 'Sterne sammeln',
    text: 'Fahre über alle Sterne.',
    map: ['............', '......*.....', '............', '............', '..*...*.....', '............', '..S.........', '............'],
    allowed: MOVE,
  },
  {
    id: 't05',
    level: 2,
    title: 'Treppe',
    text: 'Fahre die Treppe hinauf und sammle die Sterne. Mit Wiederholen brauchst du nur wenige Blöcke.',
    map: ['............', '............', '.....G......', '....*.......', '...*........', '..*.........', '.S..........', '............'],
    allowed: [...MOVE, 'repeat'],
    maxBlocks: 6,
  },
  {
    id: 't06',
    level: 2,
    title: 'Quadrat',
    text: 'Fahre ein Quadrat und komm zum Start zurück. Sammle unterwegs die Sterne.',
    map: ['............', '............', '....*..*....', '............', '............', '....X..*....', '............', '............'],
    allowed: [...MOVE, 'repeat'],
    maxBlocks: 4,
  },
  {
    id: 't07',
    level: 2,
    title: 'Piep-Straße',
    text: 'Fahre die Straße entlang. Bei jedem Stern macht der Roboter Piep.',
    map: ['............', '............', '............', '............', '.S.*.*.*.*.*', '............', '............', '............'],
    heading: 90,
    allowed: [...MOVE, 'repeat', 'beep'],
    does: [{ kind: 'beep', n: 5 }],
    maxBlocks: 4,
  },
  {
    id: 't08',
    level: 2,
    title: 'Lichtshow',
    text: 'Zeige abwechselnd Herz und Lächeln. Am Ende soll das Lächeln leuchten.',
    map: ['............', '............', '............', '............', '............', '............', '.S..........', '............'],
    allowed: ['showImage', 'lightOff', 'wait', 'repeat'],
    does: [{ kind: 'showImage', n: 6 }],
    image: 'smile',
    maxBlocks: 6,
    use: ['repeat'],
  },
  {
    id: 't09',
    level: 3,
    title: 'Bis zur Wand',
    text: 'Fahre bis zur Wand. Du weißt nicht, wie weit sie weg ist: nimm Wiederhole bis.',
    map: ['............', '............', '............', '............', '.S.........G', '............', '............', '............'],
    heading: 90,
    allowed: [...MOVE, 'repeat', 'repeatUntil'],
    use: ['repeatUntil'],
    maxBlocks: 3,
  },
  {
    id: 't10',
    level: 3,
    title: 'Rundkurs',
    text: 'Fahre einmal rundherum an der Wand entlang. Sammle die drei Sterne und komm zum Start zurück.',
    map: ['*..........*', '............', '............', '............', '............', '............', '............', 'X..........*'],
    allowed: [...MOVE, 'repeat', 'repeatUntil'],
    use: ['repeat'],
    maxBlocks: 5,
  },
  {
    id: 't11',
    level: 3,
    title: 'Umweg mit Wenn',
    text: 'Fahre nach rechts. Wenn ein Hindernis im Weg ist, fahre außen herum. Ziel: rechter Rand, oben.',
    map: ['...........G', '...........G', '...........G', '.......#....', 'S..#........', '............', '............', '............'],
    heading: 90,
    allowed: [...MOVE, 'repeat', 'repeatUntil', 'if'],
    use: ['if'],
  },
  {
    id: 't12',
    level: 4,
    title: 'Zähle bis 5',
    text: 'Der Roboter zählt bis 5 und piept bei jeder Zahl.',
    map: ['............', '............', '............', '............', '............', '............', '.S..........', '............'],
    allowed: ['beep', 'repeat', 'wait', 'setCount', 'addCount'],
    count: 5,
    does: [{ kind: 'beep', n: 5 }],
    maxBlocks: 5,
  },
  {
    id: 't13',
    level: 4,
    title: 'Drei Schritte',
    text: 'Fahre 3 Schritte und zähle mit. Wenn der Zähler 3 zeigt, soll das Herz leuchten.',
    map: ['............', '............', '............', '.G..........', '............', '............', '.S..........', '............'],
    allowed: [...MOVE, 'showImage', 'lightOff', 'repeat', 'if', 'ifCount', 'setCount', 'addCount'],
    count: 3,
    image: 'heart',
    use: ['ifCount'],
  },
  {
    id: 't14',
    level: 4,
    title: 'Tippen!',
    text: 'Wenn man den Roboter antippt, soll das Herz leuchten. Starte und tippe ihn an.',
    map: ['............', '............', '............', '............', '............', '............', '.S..........', '............'],
    allowed: ['whenTap', 'showImage', 'lightOff', 'beep'],
    image: 'heart',
    use: ['whenTap'],
    does: [{ kind: 'event', n: 1 }],
    fire: ['tap'],
  },
  {
    id: 't15',
    level: 4,
    title: 'Aua, Wand!',
    text: 'Der Roboter fährt gegen die Wand. Dann soll er traurig schauen und piepen.',
    map: ['............', '............', '............', '............', '.S..........', '............', '............', '............'],
    heading: 90,
    allowed: [...MOVE, 'whenBump', 'showImage', 'lightOff', 'beep'],
    image: 'sad',
    use: ['whenBump'],
    does: [
      { kind: 'beep', n: 1 },
      { kind: 'event', n: 1 },
    ],
  },
];

/** Karte lesen. Wirft bei einer fehlerhaften Karte (wird in den Tests geprüft). */
export function parseMap(rows: string[], heading = 0): { world: World; goal: Cell[]; stars: Cell[] } {
  if (rows.length !== MAP_H || rows.some((r) => r.length !== MAP_W)) throw new Error('Karte muss 12 x 8 Felder haben');
  const obstacles: Cell[] = [];
  const stars: Cell[] = [];
  const goal: Cell[] = [];
  let start: Cell | null = null;
  rows.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c === '#') obstacles.push([x, y]);
      else if (c === '*') stars.push([x, y]);
      else if (c === 'G') goal.push([x, y]);
      else if (c === 'S' || c === 'X') {
        if (start) throw new Error('Mehr als ein Start');
        start = [x, y];
        if (c === 'X') goal.push([x, y]);
      } else if (c !== '.') throw new Error(`Unbekanntes Zeichen ${c}`);
    });
  });
  if (!start) throw new Error('Kein Start');
  const [sx, sy] = start as Cell;
  return { world: { w: MAP_W, h: MAP_H, start: { x: sx + 0.5, y: sy + 0.5, heading }, obstacles }, goal, stars };
}

export const TASKS: Task[] = DEFS.map((d) => ({ ...d, ...parseMap(d.map, d.heading ?? 0) }));

export function taskById(id: string): Task | undefined {
  return TASKS.find((t) => t.id === id);
}

export function nextTask(id: string): Task | undefined {
  const i = TASKS.findIndex((t) => t.id === id);
  return i >= 0 ? TASKS[i + 1] : undefined;
}

// ---------- Prüfung ----------

/** Eine Bedingung der Aufgabe (zum Anzeigen) */
export interface Req {
  id: string;
  /** Symbol: 'goal', 'star', 'stack', 'hash', 'showImage' oder ein Block-Typ */
  icon: string;
  label: string;
  /** Kurze Zahl am Symbol (z. B. "3", "5×", "≤6") */
  badge?: string;
  /** Lichtbild für das Symbol */
  img?: string;
}

export interface CheckResult extends Req {
  ok: boolean;
}

export interface TaskResult {
  checks: CheckResult[];
  passed: boolean;
  /** Das Programm wurde wegen zu vieler Anweisungen abgebrochen */
  truncated: boolean;
}

interface Ctx {
  state: RobotState;
  executed: Record<string, number>;
  p: BlockProgram;
}

interface Rule extends Req {
  test: (c: Ctx) => boolean;
}

export const IMAGE_NAMES: Record<string, string> = {
  heart: 'Herz',
  smile: 'Lächeln',
  sad: 'Traurig',
  star: 'Stern',
  check: 'Haken',
  cross: 'Kreuz',
  arrow: 'Pfeil',
  house: 'Haus',
};

const KIND_LABEL: Partial<Record<InstrKind, { icon: string; label: (n: number) => string }>> = {
  beep: { icon: 'beep', label: (n) => `${n}× Ton spielen` },
  showImage: { icon: 'showImage', label: (n) => `${n}× ein Bild zeigen` },
  event: { icon: 'whenTap', label: () => 'Das Ereignis wird ausgelöst' },
};

function usesType(p: BlockProgram, type: string): boolean {
  const hat = blockDef(type)?.hat;
  if (hat) return hasEvent(p, hat);
  return flatten(p).some((b) => b.type === type);
}

function rules(t: Task): Rule[] {
  const out: Rule[] = [];
  if (t.goal.length) out.push({ id: 'goal', icon: 'goal', label: 'Zum Ziel fahren', test: (c) => t.goal.some((g) => inCell(c.state, g)) });
  if (t.stars.length) {
    const n = t.stars.length;
    out.push({ id: 'stars', icon: 'star', label: n === 1 ? '1 Stern einsammeln' : `${n} Sterne einsammeln`, badge: String(n), test: (c) => t.stars.every((s) => visited(c.state, s)) });
  }
  for (const d of t.does ?? []) {
    const info = KIND_LABEL[d.kind];
    const icon = d.kind === 'event' && t.use?.includes('whenBump') ? 'whenBump' : (info?.icon ?? d.kind);
    out.push({ id: `does-${d.kind}`, icon, label: info?.label(d.n) ?? `${d.n}×`, badge: d.kind === 'event' ? undefined : `${d.n}×`, test: (c) => (c.executed[d.kind] ?? 0) >= d.n });
  }
  if (t.image) out.push({ id: 'image', icon: 'showImage', label: `Am Ende leuchtet: ${IMAGE_NAMES[t.image] ?? t.image}`, img: t.image, test: (c) => c.state.image === t.image });
  if (t.count !== undefined) out.push({ id: 'count', icon: 'hash', label: `Am Ende zeigt der Zähler ${t.count}`, badge: String(t.count), test: (c) => c.state.count === t.count });
  for (const type of t.use ?? []) {
    out.push({ id: `use-${type}`, icon: type, label: `Benutze: ${blockDef(type)?.name ?? type}`, test: (c) => usesType(c.p, type) });
  }
  if (t.maxBlocks !== undefined) {
    out.push({ id: 'max', icon: 'stack', label: `Höchstens ${t.maxBlocks} Blöcke`, badge: `≤${t.maxBlocks}`, test: (c) => countBlocks(c.p) <= t.maxBlocks! });
  }
  return out;
}

/** Was die Aufgabe verlangt (zum Anzeigen vor dem Lauf). */
export function requirements(t: Task): Req[] {
  return rules(t).map(({ test: _test, ...r }) => r);
}

/** Programm sofort ausführen und gegen die Aufgabe prüfen. */
export function checkTask(t: Task, p: BlockProgram): TaskResult {
  const r = simulate(p, t.world, { fire: t.fire });
  const executed: Record<string, number> = {};
  for (const i of r.instrs) executed[i.kind] = (executed[i.kind] ?? 0) + 1;
  const ctx: Ctx = { state: r.state, executed, p };
  const checks = rules(t).map(({ test, ...req }) => ({ ...req, ok: test(ctx) }));
  return { checks, passed: checks.every((c) => c.ok), truncated: r.truncated };
}

// ---------- Fortschritt ----------

/** Liste der gelösten Aufgaben aus gespeicherten Daten lesen (unbekannte ids fallen weg). */
export function parseDone(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set(TASKS.map((t) => t.id));
  return [...new Set(raw.filter((x): x is string => typeof x === 'string' && known.has(x)))];
}
