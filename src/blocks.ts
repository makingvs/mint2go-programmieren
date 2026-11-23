// Block-Programm: Katalog der Blöcke und reine Logik (Einfügen, Verschieben, Löschen, Werte). Ohne DOM, damit testbar.
// Aufbau: Hauptprogramm (`blocks`, startet mit der Start-Taste) und bis zu zwei Ereignis-Skripte (`events`: Wenn getippt, Wenn Wand berührt).

export type Category = 'move' | 'light' | 'sound' | 'control' | 'event' | 'count';

/** Ereignisse, auf die ein Skript warten kann */
export type HatType = 'tap' | 'bump';

/**
 * Ereignis-Skripte haben feste negative "Eltern-ids" (Blöcke haben positive ids, das Hauptprogramm ist null).
 * So lassen sich alle Listen mit der gleichen Schreibweise (Eltern-id + Position) ansprechen.
 */
export const HAT_PARENT: Record<HatType, number> = { tap: -1, bump: -2 };
export const HAT_TYPES: HatType[] = ['tap', 'bump'];

export function hatOfParent(id: number | null): HatType | null {
  if (id === null) return null;
  return HAT_TYPES.find((h) => HAT_PARENT[h] === id) ?? null;
}

export interface NumParam {
  kind: 'number';
  key: string;
  min: number;
  max: number;
  step: number;
  def: number;
  /** Anhang in der Anzeige, z. B. "°" oder "×" */
  suffix: string;
}

export interface ChoiceParam {
  kind: 'choice';
  key: string;
  options: string[];
  def: string;
}

export type ParamDef = NumParam | ChoiceParam;

export interface BlockDef {
  type: string;
  category: Category;
  name: string;
  params: ParamDef[];
  /** Enthält andere Blöcke (z. B. Wiederholen) */
  container?: boolean;
  /** Kopf eines Ereignis-Skripts (kein Block in einer Liste) */
  hat?: HatType;
}

export interface Block {
  id: number;
  type: string;
  params: Record<string, number | string>;
  children?: Block[];
}

export interface BlockProgram {
  blocks: Block[];
  nextId: number;
  /** Ereignis-Skripte (nur vorhandene Einträge) */
  events?: Partial<Record<HatType, Block[]>>;
}

/** Bilder für die Lichtmatrix (5 x 5, "#" = Licht an) */
export const LED_IMAGES: Record<string, string[]> = {
  heart: ['.#.#.', '#####', '#####', '.###.', '..#..'],
  smile: ['.#.#.', '.#.#.', '.....', '#...#', '.###.'],
  sad: ['.#.#.', '.#.#.', '.....', '.###.', '#...#'],
  star: ['..#..', '..#..', '#####', '.###.', '.#.#.'],
  check: ['.....', '....#', '...#.', '#.#..', '.#...'],
  cross: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  arrow: ['..#..', '.###.', '#.#.#', '..#..', '..#..'],
  house: ['..#..', '.###.', '#####', '#...#', '#####'],
};

/** Töne (Tonhöhe in Hz für den Simulator) */
export const NOTES: Record<string, { name: string; freq: number }> = {
  c: { name: 'C', freq: 261.63 },
  d: { name: 'D', freq: 293.66 },
  e: { name: 'E', freq: 329.63 },
  g: { name: 'G', freq: 392 },
  a: { name: 'A', freq: 440 },
};

/** Bedingungen mit dem Sensor des Roboters */
export const CONDITIONS = ['wall', 'free'] as const;
/** Vergleiche mit dem Zähler: kleiner, gleich, größer */
export const COMPARES = ['lt', 'eq', 'gt'] as const;
export const COUNT_MIN = -99;
export const COUNT_MAX = 99;

const num = (key: string, min: number, max: number, step: number, def: number, suffix = ''): NumParam => ({ kind: 'number', key, min, max, step, def, suffix });
const choice = (key: string, options: readonly string[], def: string): ChoiceParam => ({ kind: 'choice', key, options: [...options], def });

export const CATEGORIES: { id: Category; name: string }[] = [
  { id: 'move', name: 'Bewegung' },
  { id: 'light', name: 'Licht' },
  { id: 'sound', name: 'Ton' },
  { id: 'control', name: 'Steuerung' },
  { id: 'event', name: 'Ereignisse' },
  { id: 'count', name: 'Zähler' },
];

export const BLOCK_DEFS: BlockDef[] = [
  { type: 'forward', category: 'move', name: 'Vorwärts', params: [num('n', 1, 20, 1, 2)] },
  { type: 'backward', category: 'move', name: 'Rückwärts', params: [num('n', 1, 20, 1, 2)] },
  { type: 'turnLeft', category: 'move', name: 'Links drehen', params: [num('deg', 45, 360, 45, 90, '°')] },
  { type: 'turnRight', category: 'move', name: 'Rechts drehen', params: [num('deg', 45, 360, 45, 90, '°')] },
  { type: 'showImage', category: 'light', name: 'Bild zeigen', params: [choice('img', Object.keys(LED_IMAGES), 'heart')] },
  { type: 'lightOff', category: 'light', name: 'Licht aus', params: [] },
  { type: 'beep', category: 'sound', name: 'Ton', params: [choice('note', Object.keys(NOTES), 'c')] },
  { type: 'wait', category: 'control', name: 'Warten', params: [num('s', 1, 10, 1, 1, ' s')] },
  { type: 'repeat', category: 'control', name: 'Wiederholen', params: [num('n', 2, 20, 1, 3, '×')], container: true },
  { type: 'repeatUntil', category: 'control', name: 'Wiederhole bis', params: [choice('cond', CONDITIONS, 'wall')], container: true },
  { type: 'forever', category: 'control', name: 'Immer', params: [], container: true },
  { type: 'if', category: 'control', name: 'Wenn', params: [choice('cond', CONDITIONS, 'wall')], container: true },
  { type: 'ifCount', category: 'control', name: 'Wenn Zähler', params: [choice('cmp', COMPARES, 'gt'), num('n', COUNT_MIN, COUNT_MAX, 1, 3)], container: true },
  { type: 'whenTap', category: 'event', name: 'Wenn getippt', params: [], hat: 'tap' },
  { type: 'whenBump', category: 'event', name: 'Wenn Wand', params: [], hat: 'bump' },
  { type: 'setCount', category: 'count', name: 'Zähler setzen', params: [num('n', COUNT_MIN, COUNT_MAX, 1, 0)] },
  { type: 'addCount', category: 'count', name: 'Zähler ändern', params: [num('n', -9, 9, 1, 1)] },
];

const DEF_BY_TYPE = new Map(BLOCK_DEFS.map((d) => [d.type, d]));

export function blockDef(type: string): BlockDef | undefined {
  return DEF_BY_TYPE.get(type);
}

export function isContainer(type: string): boolean {
  return !!DEF_BY_TYPE.get(type)?.container;
}

export const MAX_BLOCKS = 80;
/** Höchstens so viele Container (Wiederholen, Wenn …) ineinander */
export const MAX_NEST = 3;

export function emptyBlockProgram(): BlockProgram {
  return { blocks: [], nextId: 1 };
}

// ---------- Listen ansprechen ----------

/** Alle Listen des Programms mit ihrer Eltern-id (null = Hauptprogramm, negativ = Ereignis-Skript). */
function topLists(p: BlockProgram): [number | null, Block[]][] {
  const out: [number | null, Block[]][] = [[null, p.blocks]];
  for (const h of HAT_TYPES) {
    const list = p.events?.[h];
    if (list) out.push([HAT_PARENT[h], list]);
  }
  return out;
}

export function hasEvent(p: BlockProgram, hat: HatType): boolean {
  return !!p.events?.[hat];
}

// ---------- Suchen ----------

export interface Found {
  block: Block;
  /** null = Hauptprogramm, negativ = Ereignis-Skript, sonst Wiederholen/Wenn-Block */
  parentId: number | null;
  index: number;
}

export function findBlock(p: BlockProgram, id: number): Found | null {
  const walk = (list: Block[], parentId: number | null): Found | null => {
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) return { block: list[i], parentId, index: i };
      const kids = list[i].children;
      if (kids) {
        const r = walk(kids, list[i].id);
        if (r) return r;
      }
    }
    return null;
  };
  for (const [parent, list] of topLists(p)) {
    const r = walk(list, parent);
    if (r) return r;
  }
  return null;
}

/** Alle Blöcke in Reihenfolge (Hauptprogramm zuerst, Container vor ihrem Inhalt). */
export function flatten(p: BlockProgram): Block[] {
  const out: Block[] = [];
  const walk = (list: Block[]): void => {
    for (const b of list) {
      out.push(b);
      if (b.children) walk(b.children);
    }
  };
  for (const [, list] of topLists(p)) walk(list);
  return out;
}

export function countBlocks(p: BlockProgram): number {
  return flatten(p).length;
}

export function descendantIds(b: Block): number[] {
  const out: number[] = [];
  const walk = (list: Block[]): void => {
    for (const c of list) {
      out.push(c.id);
      if (c.children) walk(c.children);
    }
  };
  if (b.children) walk(b.children);
  return out;
}

/** Anzahl der Container um die Stelle `parentId` (null und Ereignis-Skripte = 0). */
function parentLevel(p: BlockProgram, parentId: number | null): number {
  let level = 0;
  let cur = parentId;
  while (cur !== null && cur > 0) {
    level++;
    cur = findBlock(p, cur)?.parentId ?? null;
  }
  return level;
}

/** Wie tief verschachtelt ist der Block selbst (Blatt = 0, Container ohne Inhalt = 1). */
function nestHeight(b: Block): number {
  if (!isContainer(b.type)) return 0;
  return 1 + Math.max(0, ...(b.children ?? []).map(nestHeight));
}

// ---------- Werte ----------

export function defaultParams(type: string): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  for (const d of blockDef(type)?.params ?? []) out[d.key] = d.def;
  return out;
}

/** Wert gültig machen: Zahl in Bereich und Raster, Auswahl nur aus der Liste. null = unbrauchbar. */
export function normalizeParam(d: ParamDef, v: unknown): number | string | null {
  if (d.kind === 'number') {
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    const snapped = d.min + Math.round((v - d.min) / d.step) * d.step;
    return Math.min(d.max, Math.max(d.min, snapped));
  }
  return typeof v === 'string' && d.options.includes(v) ? v : null;
}

export function paramLabel(d: ParamDef, v: number | string): string {
  return d.kind === 'number' ? `${v}${d.suffix}` : String(v);
}

// ---------- Bearbeiten (alles unveränderlich: gibt ein neues Programm zurück) ----------

/** Bearbeitet die Liste unter `parentId` (null = Hauptprogramm, negativ = Ereignis-Skript). */
function editSeq(p: BlockProgram, parentId: number | null, fn: (list: Block[]) => Block[]): BlockProgram {
  if (parentId === null) return { ...p, blocks: fn(p.blocks) };
  const hat = hatOfParent(parentId);
  if (hat) return { ...p, events: { ...p.events, [hat]: fn(p.events?.[hat] ?? []) } };
  const rec = (blocks: Block[]): Block[] =>
    blocks.map((b) => {
      if (b.id === parentId) return { ...b, children: fn(b.children ?? []) };
      return b.children ? { ...b, children: rec(b.children) } : b;
    });
  const next: BlockProgram = { ...p, blocks: rec(p.blocks) };
  if (p.events) {
    const events: Partial<Record<HatType, Block[]>> = {};
    for (const h of HAT_TYPES) if (p.events[h]) events[h] = rec(p.events[h]!);
    next.events = events;
  }
  return next;
}

/** Existiert die Liste, in die eingefügt werden soll? */
function parentExists(p: BlockProgram, parentId: number | null): boolean {
  if (parentId === null) return true;
  const hat = hatOfParent(parentId);
  if (hat) return hasEvent(p, hat);
  const par = findBlock(p, parentId);
  return !!par && isContainer(par.block.type);
}

/** Kann ein Block dieser Art an diese Stelle? (Ziel muss ein Container oder Skript sein, Verschachtelung begrenzt) */
export function canInsert(p: BlockProgram, type: string, parentId: number | null): boolean {
  const def = blockDef(type);
  if (!def || def.hat) return false;
  if (!parentExists(p, parentId)) return false;
  return parentLevel(p, parentId) + (isContainer(type) ? 1 : 0) <= MAX_NEST;
}

/** Neuen Block an Position `index` der Liste unter `parentId` einfügen. id = null, wenn es nicht geht. */
export function insertBlock(p: BlockProgram, type: string, parentId: number | null, index: number, params?: Record<string, number | string>): { program: BlockProgram; id: number | null } {
  if (countBlocks(p) >= MAX_BLOCKS || !canInsert(p, type, parentId)) return { program: p, id: null };
  const block: Block = { id: p.nextId, type, params: { ...defaultParams(type), ...(params ?? {}) } };
  if (isContainer(type)) block.children = [];
  const next = editSeq(p, parentId, (list) => {
    const pos = Math.max(0, Math.min(list.length, Math.round(index)));
    return [...list.slice(0, pos), block, ...list.slice(pos)];
  });
  return { program: { ...next, nextId: p.nextId + 1 }, id: block.id };
}

/**
 * Antippen in der Palette: kommt in den gewählten Container (ans Ende), sonst hinter den gewählten Block,
 * ohne Auswahl ans Ende des Hauptprogramms.
 */
export function addAtCursor(p: BlockProgram, type: string, selectedId: number | null): { program: BlockProgram; id: number | null } {
  const sel = selectedId === null ? null : findBlock(p, selectedId);
  if (sel) {
    if (isContainer(sel.block.type)) {
      const r = insertBlock(p, type, sel.block.id, sel.block.children?.length ?? 0);
      if (r.id !== null) return r;
    }
    const r = insertBlock(p, type, sel.parentId, sel.index + 1);
    if (r.id !== null) return r;
  }
  return insertBlock(p, type, null, p.blocks.length);
}

export function removeBlock(p: BlockProgram, id: number): BlockProgram {
  const f = findBlock(p, id);
  if (!f) return p;
  return editSeq(p, f.parentId, (list) => list.filter((b) => b.id !== id));
}

/** Kann der Block an diese Stelle verschoben werden? (nicht in sich selbst, Verschachtelung begrenzt) */
export function canMove(p: BlockProgram, id: number, parentId: number | null): boolean {
  const f = findBlock(p, id);
  if (!f) return false;
  if (parentId !== null && parentId > 0 && (parentId === id || descendantIds(f.block).includes(parentId))) return false;
  if (!parentExists(p, parentId)) return false;
  return parentLevel(p, parentId) + nestHeight(f.block) <= MAX_NEST;
}

/** `index` ist die Position in der angezeigten Liste (zwischen den Blöcken), bevor der Block herausgenommen wird. */
export function moveBlock(p: BlockProgram, id: number, parentId: number | null, index: number): BlockProgram {
  const f = findBlock(p, id);
  if (!f || !canMove(p, id, parentId)) return p;
  let pos = Math.round(index);
  if (f.parentId === parentId && f.index < pos) pos -= 1; // der Block selbst zählt nicht mehr mit
  if (f.parentId === parentId && f.index === pos) return p;
  const without = removeBlock(p, id);
  return editSeq(without, parentId, (list) => {
    const at = Math.max(0, Math.min(list.length, pos));
    return [...list.slice(0, at), f.block, ...list.slice(at)];
  });
}

function cloneWithNewIds(b: Block, next: { id: number }): Block {
  const copy: Block = { id: next.id++, type: b.type, params: { ...b.params } };
  if (b.children) copy.children = b.children.map((c) => cloneWithNewIds(c, next));
  return copy;
}

/** Kopie direkt hinter dem Block (mit allem, was darin liegt). */
export function duplicateBlock(p: BlockProgram, id: number): { program: BlockProgram; id: number | null } {
  const f = findBlock(p, id);
  if (!f) return { program: p, id: null };
  const size = 1 + descendantIds(f.block).length;
  if (countBlocks(p) + size > MAX_BLOCKS) return { program: p, id: null };
  const next = { id: p.nextId };
  const copy = cloneWithNewIds(f.block, next);
  const out = editSeq(p, f.parentId, (list) => [...list.slice(0, f.index + 1), copy, ...list.slice(f.index + 1)]);
  return { program: { ...out, nextId: next.id }, id: copy.id };
}

export function setParam(p: BlockProgram, id: number, key: string, value: number | string): BlockProgram {
  const f = findBlock(p, id);
  const d = f ? blockDef(f.block.type)?.params.find((x) => x.key === key) : undefined;
  if (!f || !d) return p;
  const v = normalizeParam(d, value);
  if (v === null || f.block.params[key] === v) return p;
  return editSeq(p, f.parentId, (list) => list.map((b) => (b.id === id ? { ...b, params: { ...b.params, [key]: v } } : b)));
}

/** Ereignis-Skript anlegen (gibt es es schon, bleibt alles wie es ist). */
export function addEvent(p: BlockProgram, hat: HatType): BlockProgram {
  if (hasEvent(p, hat)) return p;
  return { ...p, events: { ...p.events, [hat]: [] } };
}

/** Ereignis-Skript samt Inhalt löschen. */
export function removeEvent(p: BlockProgram, hat: HatType): BlockProgram {
  if (!hasEvent(p, hat)) return p;
  const events = { ...p.events };
  delete events[hat];
  const next: BlockProgram = { ...p, events };
  if (!Object.keys(events).length) delete next.events;
  return next;
}

/** Programm leeren (alle Skripte). Die ids werden nicht neu vergeben. */
export function clearBlocks(p: BlockProgram): BlockProgram {
  return p.blocks.length || p.events ? { blocks: [], nextId: p.nextId } : p;
}

/** Verwendet das Programm den Zähler? (für die Anzeige auf der Bühne) */
export function usesCounter(p: BlockProgram): boolean {
  return flatten(p).some((b) => b.type === 'setCount' || b.type === 'addCount' || b.type === 'ifCount');
}

// ---------- Speichern ----------

export function serializeBlocks(p: BlockProgram): string {
  return JSON.stringify(p);
}

/** Strenge Prüfung geladener Daten; ungültiges liefert null. */
export function parseBlockProgram(raw: unknown): BlockProgram | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.blocks)) return null;
  const seen = new Set<number>();
  let maxId = 0;
  let total = 0;
  const parseList = (list: unknown[], level: number): Block[] | null => {
    const out: Block[] = [];
    for (const item of list) {
      if (!item || typeof item !== 'object' || ++total > MAX_BLOCKS) return null;
      const r = item as Record<string, unknown>;
      const def = typeof r.type === 'string' ? blockDef(r.type) : undefined;
      if (!def || def.hat || typeof r.id !== 'number' || !Number.isInteger(r.id) || r.id < 1 || seen.has(r.id)) return null;
      seen.add(r.id);
      maxId = Math.max(maxId, r.id);
      const given = r.params && typeof r.params === 'object' ? (r.params as Record<string, unknown>) : {};
      const params: Record<string, number | string> = {};
      for (const d of def.params) params[d.key] = normalizeParam(d, given[d.key]) ?? d.def;
      const block: Block = { id: r.id, type: def.type, params };
      if (def.container) {
        if (level + 1 > MAX_NEST) return null;
        const kids = Array.isArray(r.children) ? parseList(r.children, level + 1) : [];
        if (!kids) return null;
        block.children = kids;
      } else if (r.children !== undefined && !(Array.isArray(r.children) && r.children.length === 0)) {
        return null;
      }
      out.push(block);
    }
    return out;
  };
  const blocks = parseList(o.blocks, 0);
  if (!blocks) return null;
  const result: BlockProgram = { blocks, nextId: 0 };
  if (o.events !== undefined) {
    if (!o.events || typeof o.events !== 'object' || Array.isArray(o.events)) return null;
    const ev = o.events as Record<string, unknown>;
    const events: Partial<Record<HatType, Block[]>> = {};
    for (const h of HAT_TYPES) {
      if (ev[h] === undefined) continue;
      if (!Array.isArray(ev[h])) return null;
      const list = parseList(ev[h] as unknown[], 0);
      if (!list) return null;
      events[h] = list;
    }
    if (Object.keys(events).length) result.events = events;
  }
  result.nextId = typeof o.nextId === 'number' && Number.isInteger(o.nextId) && o.nextId > maxId ? o.nextId : maxId + 1;
  return result;
}
