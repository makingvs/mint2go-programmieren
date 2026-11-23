// Reine Logik des Live-Programms (Einstieg): Schritte, Bearbeiten, Vorführen. Ohne DOM, damit testbar.

export interface Step {
  id: number;
  text: string;
  /** Symbol-Name aus stepIcons.ts oder null */
  icon: string | null;
  /** Beim Vorführen als "klappt nicht" markiert (Fehlersuche) */
  bug: boolean;
}

export interface Program {
  title: string;
  steps: Step[];
  nextId: number;
}

export const MAX_TEXT = 80;
export const MAX_TITLE = 60;
export const MAX_STEPS = 60;

/** Leerzeichen zusammenfassen, kürzen. */
export function cleanText(s: string, max = MAX_TEXT): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, max);
}

export function emptyProgram(title = ''): Program {
  return { title: cleanText(title, MAX_TITLE), steps: [], nextId: 1 };
}

/** Programm aus einer Liste von Texten (oder Text + Symbol) bauen. */
export function fromList(title: string, items: (string | [string, string | null])[]): Program {
  let p = emptyProgram(title);
  for (const it of items) {
    const [text, icon] = typeof it === 'string' ? [it, null] : it;
    p = addStep(p, text, icon).program;
  }
  return p;
}

/** Fügt einen Schritt an Position `at` ein (Standard: am Ende). Leerer Text -> unverändert, id = null. */
export function addStep(p: Program, text: string, icon: string | null = null, at?: number): { program: Program; id: number | null } {
  const t = cleanText(text);
  if (!t || p.steps.length >= MAX_STEPS) return { program: p, id: null };
  const pos = at === undefined ? p.steps.length : Math.max(0, Math.min(p.steps.length, Math.round(at)));
  const step: Step = { id: p.nextId, text: t, icon, bug: false };
  const steps = [...p.steps.slice(0, pos), step, ...p.steps.slice(pos)];
  return { program: { ...p, steps, nextId: p.nextId + 1 }, id: step.id };
}

export function indexOfStep(p: Program, id: number): number {
  return p.steps.findIndex((s) => s.id === id);
}

export function updateStep(p: Program, id: number, patch: Partial<Pick<Step, 'text' | 'icon' | 'bug'>>): Program {
  const i = indexOfStep(p, id);
  if (i < 0) return p;
  const cur = p.steps[i];
  const text = patch.text === undefined ? cur.text : cleanText(patch.text);
  if (!text) return p; // ein Schritt ohne Text ist nicht erlaubt
  const next: Step = { ...cur, text, icon: patch.icon === undefined ? cur.icon : patch.icon, bug: patch.bug ?? cur.bug };
  const steps = p.steps.slice();
  steps[i] = next;
  return { ...p, steps };
}

export function removeStep(p: Program, id: number): Program {
  return { ...p, steps: p.steps.filter((s) => s.id !== id) };
}

/** Schritt um `delta` Plätze verschieben (-1 = nach oben). */
export function moveStep(p: Program, id: number, delta: number): Program {
  const i = indexOfStep(p, id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= p.steps.length || delta === 0) return p;
  const steps = p.steps.slice();
  const [s] = steps.splice(i, 1);
  steps.splice(j, 0, s);
  return { ...p, steps };
}

export function setTitle(p: Program, title: string): Program {
  return { ...p, title: cleanText(title, MAX_TITLE) };
}

export function clearBugs(p: Program): Program {
  return p.steps.some((s) => s.bug) ? { ...p, steps: p.steps.map((s) => (s.bug ? { ...s, bug: false } : s)) } : p;
}

export function hasBugs(p: Program): boolean {
  return p.steps.some((s) => s.bug);
}

// ---------- Vorführen: ein Kind macht das Programm Schritt für Schritt ----------

/** index = aktueller Schritt (0-basiert); index === Anzahl -> fertig. */
export interface RunState {
  index: number;
}

export function runStart(): RunState {
  return { index: 0 };
}

export function runNext(s: RunState, count: number): RunState {
  return { index: Math.min(count, s.index + 1) };
}

export function runBack(s: RunState): RunState {
  return { index: Math.max(0, s.index - 1) };
}

export function runFinished(s: RunState, count: number): boolean {
  return count > 0 && s.index >= count;
}

/** Aus welcher Stelle soll nach einer Fehlersuche weitergemacht werden? (erster markierter Schritt, sonst 0) */
export function firstBugIndex(p: Program): number {
  return Math.max(0, p.steps.findIndex((s) => s.bug));
}

// ---------- Speichern (Entwurf auf dem Gerät) ----------

export function serialize(p: Program): string {
  return JSON.stringify(p);
}

/** Prüft ein geladenes Objekt streng; ungültiges liefert null (nie ein Absturz wegen kaputter Daten). */
export function parseProgram(raw: unknown): Program | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.title !== 'string' || !Array.isArray(o.steps)) return null;
  const steps: Step[] = [];
  const seen = new Set<number>();
  let maxId = 0;
  for (const s of o.steps) {
    if (!s || typeof s !== 'object') return null;
    const r = s as Record<string, unknown>;
    if (typeof r.id !== 'number' || !Number.isInteger(r.id) || r.id < 1 || seen.has(r.id)) return null;
    if (typeof r.text !== 'string' || !cleanText(r.text)) return null;
    if (r.icon !== null && typeof r.icon !== 'string') return null;
    seen.add(r.id);
    maxId = Math.max(maxId, r.id);
    steps.push({ id: r.id, text: cleanText(r.text), icon: (r.icon as string | null) ?? null, bug: r.bug === true });
  }
  if (steps.length > MAX_STEPS) return null;
  const nextId = typeof o.nextId === 'number' && Number.isInteger(o.nextId) && o.nextId > maxId ? o.nextId : maxId + 1;
  return { title: cleanText(o.title, MAX_TITLE), steps, nextId };
}
