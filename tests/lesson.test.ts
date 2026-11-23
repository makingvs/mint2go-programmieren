import { describe, expect, it } from 'vitest';
import { BLOCK_DEFS, blockDef, isContainer, normalizeParam } from '../src/blocks';
import { LESSONS, clampSlide, lessonById, type VisualBlock } from '../src/lesson';
import { TASKS, taskById } from '../src/tasks';

function walk(v: VisualBlock[], fn: (b: VisualBlock) => void): void {
  for (const b of v) {
    fn(b);
    if (b.children) walk(b.children, fn);
  }
}

describe('Unterrichtsfolge', () => {
  it('ids sind eindeutig, jede Lektion hat Ziel und Folien', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    const slideIds = LESSONS.flatMap((l) => l.slides.map((s) => s.id));
    expect(new Set(slideIds).size).toBe(slideIds.length);
    for (const l of LESSONS) {
      expect(l.title.length).toBeGreaterThan(0);
      expect(l.goal.length).toBeGreaterThan(0);
      expect(l.minutes).toBeGreaterThan(0);
      expect(l.slides.length).toBeGreaterThan(2);
      for (const s of l.slides) {
        expect(s.title.length, s.id).toBeGreaterThan(0);
        expect(s.text.length, s.id).toBeGreaterThan(0);
        expect(s.notes.length, s.id).toBeGreaterThan(0);
        expect(s.text.length, `${s.id}: Text zu lang für den Beamer`).toBeLessThan(150);
      }
    }
  });

  it('Aktionen verweisen auf vorhandene Aufgaben und haben eine Beschriftung', () => {
    for (const l of LESSONS) {
      for (const s of l.slides) {
        if (!s.action) continue;
        expect(s.action.label.length, s.id).toBeGreaterThan(0);
        if (s.action.kind === 'task') expect(taskById(s.action.id), `${s.id}: ${s.action.id}`).toBeDefined();
      }
    }
  });

  it('Beispiel-Blöcke gibt es im Katalog, Werte sind gültig, Container nur mit Inhalt', () => {
    for (const l of LESSONS) {
      for (const s of l.slides) {
        walk(s.visual ?? [], (b) => {
          const def = blockDef(b.type);
          expect(def, `${s.id}: ${b.type}`).toBeDefined();
          for (const [k, v] of Object.entries(b.params ?? {})) {
            const pd = def!.params.find((p) => p.key === k);
            expect(pd, `${s.id}: ${b.type}.${k}`).toBeDefined();
            expect(normalizeParam(pd!, v), `${s.id}: ${b.type}.${k}=${v}`).toBe(v);
          }
          if (b.children) expect(isContainer(b.type) || !!def!.hat, `${s.id}: ${b.type} kann nichts enthalten`).toBe(true);
        });
      }
    }
  });

  it('jede Aufgabe-Stufe wird in einer Lektion geübt und alle Konzepte kommen vor', () => {
    const used = new Set<string>();
    for (const l of LESSONS) for (const s of l.slides) walk(s.visual ?? [], (b) => used.add(b.type));
    for (const t of ['forward', 'turnRight', 'repeat', 'repeatUntil', 'if', 'whenTap', 'setCount', 'addCount']) expect(used.has(t), t).toBe(true);
    // jede Lektion führt zur Aufgabenliste
    for (const l of LESSONS) expect(l.slides.some((s) => s.action?.kind === 'tasks'), l.id).toBe(true);
    expect(BLOCK_DEFS.length).toBeGreaterThan(0);
    expect(TASKS.length).toBe(15);
  });

  it('lessonById und clampSlide', () => {
    expect(lessonById('l1')?.title).toBe('Befehle und Reihenfolge');
    expect(lessonById('x')).toBeUndefined();
    expect(clampSlide(-3, 5)).toBe(0);
    expect(clampSlide(9, 5)).toBe(4);
    expect(clampSlide(2, 5)).toBe(2);
    expect(clampSlide(1, 0)).toBe(0);
  });
});
