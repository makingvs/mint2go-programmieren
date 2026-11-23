import { describe, expect, it } from 'vitest';
import { EXAMPLES, getExample } from '../src/examples';
import {
  MAX_STEPS,
  addStep,
  cleanText,
  clearBugs,
  emptyProgram,
  firstBugIndex,
  fromList,
  hasBugs,
  indexOfStep,
  moveStep,
  parseProgram,
  removeStep,
  runBack,
  runFinished,
  runNext,
  runStart,
  serialize,
  setTitle,
  updateStep,
} from '../src/program';
import { LiveSession } from '../src/session';
import { STEP_ICONS, isStepIcon, stepIcon } from '../src/stepIcons';

const texts = (p: { steps: { text: string }[] }) => p.steps.map((s) => s.text);

describe('Live-Programm: Schritte', () => {
  it('hängt Schritte hinten an und vergibt fortlaufende ids', () => {
    let p = emptyProgram('Test');
    p = addStep(p, 'A').program;
    p = addStep(p, 'B', 'hand').program;
    expect(texts(p)).toEqual(['A', 'B']);
    expect(p.steps.map((s) => s.id)).toEqual([1, 2]);
    expect(p.steps[1].icon).toBe('hand');
    expect(p.nextId).toBe(3);
  });

  it('fügt an einer Position ein (auch am Anfang und Ende), Position wird begrenzt', () => {
    const p = fromList('', ['A', 'B', 'C']);
    expect(texts(addStep(p, 'X', null, 1).program)).toEqual(['A', 'X', 'B', 'C']);
    expect(texts(addStep(p, 'X', null, 0).program)).toEqual(['X', 'A', 'B', 'C']);
    expect(texts(addStep(p, 'X', null, 3).program)).toEqual(['A', 'B', 'C', 'X']);
    expect(texts(addStep(p, 'X', null, 99).program)).toEqual(['A', 'B', 'C', 'X']);
    expect(texts(addStep(p, 'X', null, -4).program)).toEqual(['X', 'A', 'B', 'C']);
  });

  it('leerer oder nur aus Leerzeichen bestehender Text legt keinen Schritt an', () => {
    const p = fromList('', ['A']);
    const r = addStep(p, '   \n ');
    expect(r.id).toBeNull();
    expect(r.program).toBe(p);
  });

  it('räumt Text auf (Leerzeichen, Länge)', () => {
    expect(cleanText('  Flasche   nehmen \n ')).toBe('Flasche nehmen');
    expect(cleanText('x'.repeat(200)).length).toBe(80);
  });

  it('begrenzt die Anzahl der Schritte', () => {
    let p = emptyProgram();
    for (let i = 0; i < MAX_STEPS + 5; i++) p = addStep(p, `S${i}`).program;
    expect(p.steps.length).toBe(MAX_STEPS);
    expect(addStep(p, 'noch einer').id).toBeNull();
  });

  it('ändert Text und Symbol, lässt leeren Text nicht zu', () => {
    let p = fromList('', ['A', 'B']);
    const id = p.steps[0].id;
    p = updateStep(p, id, { text: ' Neu ', icon: 'cap' });
    expect(p.steps[0]).toMatchObject({ text: 'Neu', icon: 'cap' });
    expect(updateStep(p, id, { text: '  ' })).toBe(p);
    expect(updateStep(p, 999, { text: 'x' })).toBe(p);
    p = updateStep(p, id, { icon: null });
    expect(p.steps[0].icon).toBeNull();
  });

  it('löscht und verschiebt Schritte', () => {
    let p = fromList('', ['A', 'B', 'C']);
    const [a, b, c] = p.steps.map((s) => s.id);
    p = moveStep(p, c, -1);
    expect(texts(p)).toEqual(['A', 'C', 'B']);
    p = moveStep(p, a, 1);
    expect(texts(p)).toEqual(['C', 'A', 'B']);
    expect(moveStep(p, c, -1)).toBe(p); // schon ganz oben
    expect(moveStep(p, b, 1)).toBe(p); // schon ganz unten
    p = removeStep(p, a);
    expect(texts(p)).toEqual(['C', 'B']);
    expect(indexOfStep(p, b)).toBe(1);
    expect(indexOfStep(p, a)).toBe(-1);
  });

  it('ids werden nach dem Löschen nicht neu vergeben', () => {
    let p = fromList('', ['A', 'B']);
    const last = p.steps[1].id;
    p = removeStep(p, last);
    p = addStep(p, 'C').program;
    expect(p.steps[1].id).not.toBe(last);
  });

  it('setzt den Titel', () => {
    expect(setTitle(emptyProgram(), '  Wasser  trinken ').title).toBe('Wasser trinken');
  });
});

describe('Fehlersuche', () => {
  it('markiert und löscht Fehler-Markierungen', () => {
    let p = fromList('', ['A', 'B', 'C']);
    expect(hasBugs(p)).toBe(false);
    expect(firstBugIndex(p)).toBe(0);
    p = updateStep(p, p.steps[2].id, { bug: true });
    expect(hasBugs(p)).toBe(true);
    expect(firstBugIndex(p)).toBe(2);
    const q = clearBugs(p);
    expect(hasBugs(q)).toBe(false);
    expect(clearBugs(q)).toBe(q); // nichts zu tun -> gleiches Objekt
  });

  it('Schritt vor dem markierten Schritt einfügen (Fehler beheben)', () => {
    let p = fromList('', ['Flasche nehmen', 'Flasche kippen']);
    p = updateStep(p, p.steps[1].id, { bug: true });
    const at = firstBugIndex(p);
    p = addStep(p, 'Deckel aufdrehen', 'cap', at).program;
    expect(texts(p)).toEqual(['Flasche nehmen', 'Deckel aufdrehen', 'Flasche kippen']);
    expect(p.steps[2].bug).toBe(true); // Markierung bleibt am richtigen Schritt
  });
});

describe('Vorführen', () => {
  it('läuft Schritt für Schritt bis zum Ende und wieder zurück', () => {
    let r = runStart();
    expect(r.index).toBe(0);
    expect(runFinished(r, 3)).toBe(false);
    r = runNext(r, 3);
    r = runNext(r, 3);
    r = runNext(r, 3);
    expect(r.index).toBe(3);
    expect(runFinished(r, 3)).toBe(true);
    expect(runNext(r, 3).index).toBe(3); // nicht über das Ende hinaus
    r = runBack(r);
    expect(r.index).toBe(2);
    expect(runFinished(r, 3)).toBe(false);
    expect(runBack(runStart()).index).toBe(0);
  });

  it('ein leeres Programm ist nie "fertig"', () => {
    expect(runFinished(runStart(), 0)).toBe(false);
  });
});

describe('Speichern und Laden', () => {
  it('Hin und zurück ohne Verlust', () => {
    let p = fromList('Titel', [['A', 'hand'], 'B']);
    p = updateStep(p, p.steps[1].id, { bug: true });
    expect(parseProgram(JSON.parse(serialize(p)))).toEqual(p);
  });

  it('lehnt kaputte Daten ab, ohne abzustürzen', () => {
    expect(parseProgram(null)).toBeNull();
    expect(parseProgram('x')).toBeNull();
    expect(parseProgram({})).toBeNull();
    expect(parseProgram({ title: 1, steps: [] })).toBeNull();
    expect(parseProgram({ title: '', steps: [{ id: 1, text: '', icon: null }] })).toBeNull();
    expect(parseProgram({ title: '', steps: [{ id: 1, text: 'a', icon: 5 }] })).toBeNull();
    expect(parseProgram({ title: '', steps: [{ id: 1, text: 'a', icon: null }, { id: 1, text: 'b', icon: null }] })).toBeNull();
    expect(parseProgram({ title: '', steps: [{ id: 0, text: 'a', icon: null }] })).toBeNull();
  });

  it('repariert nextId, wenn es fehlt oder zu klein ist', () => {
    const p = parseProgram({ title: 'x', steps: [{ id: 7, text: 'a', icon: null }], nextId: 2 });
    expect(p!.nextId).toBe(8);
  });
});

describe('Sitzung (Rückgängig)', () => {
  it('macht Änderungen rückgängig und wiederholt sie', () => {
    const s = new LiveSession(emptyProgram());
    expect(s.canUndo).toBe(false);
    s.commit(addStep(s.program, 'A').program);
    s.commit(addStep(s.program, 'B').program);
    expect(texts(s.program)).toEqual(['A', 'B']);
    expect(s.undo()).toBe(true);
    expect(texts(s.program)).toEqual(['A']);
    expect(s.canRedo).toBe(true);
    expect(s.redo()).toBe(true);
    expect(texts(s.program)).toEqual(['A', 'B']);
    expect(s.undo() && s.undo()).toBe(true);
    expect(s.undo()).toBe(false);
    expect(s.program.steps).toEqual([]);
  });

  it('gleicher Stand ist keine Änderung', () => {
    const s = new LiveSession(emptyProgram());
    expect(s.commit(s.program)).toBe(false);
    expect(s.canUndo).toBe(false);
  });
});

describe('Beispiele und Symbole', () => {
  it('alle Beispiele sind gültig', () => {
    expect(EXAMPLES.length).toBeGreaterThanOrEqual(5);
    const ids = new Set<string>();
    for (const ex of EXAMPLES) {
      expect(ids.has(ex.id)).toBe(false);
      ids.add(ex.id);
      expect(isStepIcon(ex.icon)).toBe(true);
      const p = ex.build();
      expect(p.title).toBe(ex.title);
      expect(p.steps.length).toBeGreaterThanOrEqual(5);
      expect(p.steps.length).toBeLessThanOrEqual(MAX_STEPS);
      for (const s of p.steps) {
        expect(s.text.length).toBeGreaterThan(0);
        if (s.icon) expect(isStepIcon(s.icon)).toBe(true);
        expect(s.bug).toBe(false);
      }
      expect(new Set(p.steps.map((s) => s.id)).size).toBe(p.steps.length);
      expect(parseProgram(JSON.parse(serialize(p)))).toEqual(p);
    }
  });

  it('das Flaschen-Beispiel enthält "Deckel aufdrehen", die Fehler-Variante nicht', () => {
    expect(texts(getExample('flasche')!.build())).toContain('Deckel aufdrehen');
    expect(texts(getExample('flasche-fehler')!.build())).not.toContain('Deckel aufdrehen');
  });

  it('Symbole: eindeutige ids, Inline-SVG', () => {
    expect(new Set(STEP_ICONS.map((i) => i.id)).size).toBe(STEP_ICONS.length);
    for (const i of STEP_ICONS) {
      expect(i.name.length).toBeGreaterThan(0);
      expect(stepIcon(i.id)).toMatch(/^<svg /);
    }
    expect(stepIcon(null)).toBe('');
    expect(stepIcon('gibt-es-nicht')).toBe('');
  });
});
