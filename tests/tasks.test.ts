import { describe, expect, it } from 'vitest';
import { BLOCK_DEFS, HAT_PARENT, addEvent, emptyBlockProgram, flatten, hasEvent, insertBlock, type BlockProgram, type HatType } from '../src/blocks';
import { simulate } from '../src/machine';
import { DEFAULT_WORLD, apply, blockedAt, initialState, inCell, visited, wallAhead, type World } from '../src/sim';
import { LEVELS, MAP_H, MAP_W, TASKS, checkTask, nextTask, parseDone, parseMap, requirements, taskById, type Task } from '../src/tasks';

type Spec = string | [string] | [string, Record<string, number | string>] | [string, Record<string, number | string>, Spec[]];

/** Programm aus Kurzschreibweise: ['repeat', {n: 4}, ['forward']] */
function build(main: Spec[], events: Partial<Record<HatType, Spec[]>> = {}): BlockProgram {
  let p = emptyBlockProgram();
  const add = (list: Spec[], parent: number | null) => {
    list.forEach((s, i) => {
      const [type, params = {}, kids = []] = (typeof s === 'string' ? [s] : s) as [string, Record<string, number | string>?, Spec[]?];
      const r = insertBlock(p, type, parent, i, params);
      if (r.id === null) throw new Error('insert failed ' + type);
      p = r.program;
      if (kids.length) add(kids, r.id);
    });
  };
  add(main, null);
  for (const h of ['tap', 'bump'] as HatType[]) {
    if (events[h]) {
      p = addEvent(p, h);
      add(events[h]!, HAT_PARENT[h]);
    }
  }
  return p;
}

const right: Spec = ['turnRight', { deg: 90 }];
const left: Spec = ['turnLeft', { deg: 90 }];
const fwd = (n: number): Spec => ['forward', { n }];

/** Musterlösung je Aufgabe */
const SOLUTIONS: Record<string, BlockProgram> = {
  t01: build([fwd(4)]),
  t02: build([fwd(3), right, fwd(3)]),
  t03: build([fwd(3), right, fwd(7), right, fwd(1)]),
  t04: build([fwd(2), right, fwd(4), left, fwd(3)]),
  t05: build([['repeat', { n: 4 }, [fwd(1), right, fwd(1), left]]]),
  t06: build([['repeat', { n: 4 }, [fwd(3), right]]]),
  t07: build([['repeat', { n: 5 }, [fwd(2), ['beep', { note: 'c' }]]]]),
  t08: build([['repeat', { n: 3 }, [['showImage', { img: 'heart' }], ['showImage', { img: 'smile' }]]]]),
  t09: build([['repeatUntil', { cond: 'wall' }, [fwd(1)]]]),
  t10: build([['repeat', { n: 4 }, [fwd(20), right]]]),
  t11: build([['repeat', { n: 11 }, [['if', { cond: 'wall' }, [left, fwd(1), right]], fwd(1)]]]),
  t12: build([['repeat', { n: 5 }, [['addCount', { n: 1 }], ['beep', { note: 'c' }]]]]),
  t13: build([['repeat', { n: 3 }, [fwd(1), ['addCount', { n: 1 }]]], ['ifCount', { cmp: 'eq', n: 3 }, [['showImage', { img: 'heart' }]]]]),
  t14: build([], { tap: [['showImage', { img: 'heart' }]] }),
  t15: build([fwd(20)], { bump: [['showImage', { img: 'sad' }], ['beep', { note: 'c' }]] }),
};

const task = (id: string): Task => taskById(id)!;

describe('Hindernisse im Simulator', () => {
  const world: World = { w: 12, h: 8, start: { x: 1.5, y: 6.5, heading: 0 }, obstacles: [[1, 3]] };

  it('der Roboter stoppt genau vor dem Hindernis und meldet einen Stoß', () => {
    const s = apply(initialState(world), { id: 1, kind: 'forward', n: 5 }, world);
    expect(s.x).toBe(1.5);
    expect(s.y).toBe(4.5); // Feld darüber ist das Hindernis (Zeile 3)
    expect(s.bumped).toBe(true);
  });

  it('ohne Hindernis im Weg gibt es keinen Stoß', () => {
    const s = apply(initialState(world), { id: 1, kind: 'forward', n: 2 }, world);
    expect(s.y).toBe(4.5);
    expect(s.bumped).toBe(false);
  });

  it('rückwärts und seitlich vorbei: ein Gang von einem Feld Breite lässt den Roboter durch', () => {
    const w2: World = { w: 12, h: 8, start: { x: 1.5, y: 3.5, heading: 90 }, obstacles: [[1, 2], [1, 4]] };
    const s = apply(initialState(w2), { id: 1, kind: 'forward', n: 5 }, w2);
    expect(s.x).toBe(6.5);
    expect(s.bumped).toBe(false);
  });

  it('Rückwärtsfahren gegen ein Hindernis stoppt ebenfalls', () => {
    const w2: World = { w: 12, h: 8, start: { x: 5.5, y: 3.5, heading: 90 }, obstacles: [[3, 3]] };
    const s = apply(initialState(w2), { id: 1, kind: 'backward', n: 5 }, w2);
    expect(s.x).toBe(4.5);
    expect(s.bumped).toBe(true);
  });

  it('Wand vor mir erkennt auch Hindernisse', () => {
    const near = apply(initialState(world), { id: 1, kind: 'forward', n: 3 }, world); // stoppt bei y = 4.5
    expect(wallAhead(near, world)).toBe(true);
    expect(wallAhead(initialState(world), world)).toBe(false);
  });

  it('blockedAt: Berührung am Rand zählt nicht, Eindringen schon', () => {
    expect(blockedAt(1.5, 4.5, world)).toBe(false);
    expect(blockedAt(1.5, 4.3, world)).toBe(true);
    expect(blockedAt(0.2, 0.2, DEFAULT_WORLD)).toBe(false);
  });

  it('Fahrt schräg an einer Ecke: stoppt, bevor der Kreis das Hindernis berührt', () => {
    const w2: World = { w: 12, h: 8, start: { x: 1.5, y: 1.5, heading: 135 }, obstacles: [[3, 3]] };
    const s = apply(initialState(w2), { id: 1, kind: 'forward', n: 4 }, w2);
    expect(blockedAt(s.x, s.y, w2)).toBe(false);
    expect(s.bumped).toBe(true);
    expect(s.x).toBeLessThan(3);
  });

  it('visited und inCell', () => {
    const r = simulate(build([fwd(3)]), { ...DEFAULT_WORLD, start: { x: 1.5, y: 6.5, heading: 0 } });
    expect(visited(r.state, [1, 5])).toBe(true); // Feld auf dem Weg
    expect(visited(r.state, [1, 4])).toBe(true);
    expect(visited(r.state, [2, 5])).toBe(false);
    expect(inCell(r.state, [1, 3])).toBe(true);
    expect(inCell(r.state, [1, 4])).toBe(false);
  });

  it('Startfeld zählt als besucht', () => {
    expect(visited(initialState(DEFAULT_WORLD), [1, 6])).toBe(true);
  });
});

describe('Karten', () => {
  it('parseMap liest Hindernisse, Start, Ziel und Sterne', () => {
    const m = parseMap(['#...........', '.S..........', '..*G........', '............', '............', '............', '............', '............'], 90);
    expect(m.world.obstacles).toEqual([[0, 0]]);
    expect(m.world.start).toEqual({ x: 1.5, y: 1.5, heading: 90 });
    expect(m.stars).toEqual([[2, 2]]);
    expect(m.goal).toEqual([[3, 2]]);
  });

  it('X ist Start und Ziel zugleich', () => {
    const m = parseMap(['X...........', '............', '............', '............', '............', '............', '............', '............']);
    expect(m.goal).toEqual([[0, 0]]);
    expect(m.world.start.x).toBe(0.5);
  });

  it('fehlerhafte Karten werden abgelehnt', () => {
    const ok = ['S...........', '............', '............', '............', '............', '............', '............', '............'];
    expect(() => parseMap(ok.slice(1))).toThrow();
    expect(() => parseMap(ok.map((r) => r.slice(1)))).toThrow();
    expect(() => parseMap(ok.map((r, i) => (i === 1 ? '?...........' : r)))).toThrow();
    expect(() => parseMap(ok.map((r, i) => (i === 1 ? 'S...........' : r)))).toThrow(); // zwei Starts
    expect(() => parseMap(ok.map((r) => r.replace('S', '.')))).toThrow(); // kein Start
  });
});

describe('Aufgaben: Daten', () => {
  it('ids sind eindeutig, Stufen gibt es, Karten haben das richtige Format', () => {
    expect(new Set(TASKS.map((t) => t.id)).size).toBe(TASKS.length);
    for (const t of TASKS) {
      expect(LEVELS.some((l) => l.id === t.level)).toBe(true);
      expect(t.map).toHaveLength(MAP_H);
      for (const row of t.map) expect(row).toHaveLength(MAP_W);
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.text.length).toBeGreaterThan(0);
    }
  });

  it('jede Stufe hat Aufgaben und die Reihenfolge geht von leicht nach schwer', () => {
    for (const l of LEVELS) expect(TASKS.some((t) => t.level === l.id)).toBe(true);
    const levels = TASKS.map((t) => t.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  it('erlaubte Blöcke, Pflichtblöcke und Ereignisse gibt es wirklich', () => {
    const types = new Set(BLOCK_DEFS.map((d) => d.type));
    for (const t of TASKS) {
      for (const a of t.allowed) expect(types.has(a), `${t.id}: ${a}`).toBe(true);
      for (const u of t.use ?? []) expect(t.allowed.includes(u), `${t.id} benutzt ${u}, aber es ist nicht erlaubt`).toBe(true);
    }
  });

  it('Start steht nicht in einem Hindernis und Sterne/Ziele liegen frei', () => {
    for (const t of TASKS) {
      expect(blockedAt(t.world.start.x, t.world.start.y, t.world), t.id).toBe(false);
      for (const c of [...t.stars, ...t.goal]) expect(t.world.obstacles?.some(([x, y]) => x === c[0] && y === c[1]), `${t.id} ${c}`).toBeFalsy();
    }
  });

  it('nextTask und taskById', () => {
    expect(taskById('t01')?.title).toBe('Zum Ziel');
    expect(taskById('gibt-es-nicht')).toBeUndefined();
    expect(nextTask('t01')?.id).toBe('t02');
    expect(nextTask(TASKS[TASKS.length - 1].id)).toBeUndefined();
    expect(nextTask('x')).toBeUndefined();
  });

  it('requirements nennt alle Bedingungen mit Symbol und Text', () => {
    const r = requirements(task('t05'));
    expect(r.map((x) => x.id)).toEqual(['goal', 'stars', 'max']);
    expect(r.find((x) => x.id === 'stars')?.label).toBe('3 Sterne einsammeln');
    expect(r.find((x) => x.id === 'max')?.badge).toBe('≤6');
    expect(requirements(task('t14')).some((x) => x.icon === 'whenTap')).toBe(true);
    expect(requirements(task('t15')).some((x) => x.icon === 'whenBump')).toBe(true);
  });
});

describe('Aufgaben: Prüfung', () => {
  for (const t of TASKS) {
    it(`${t.id} ${t.title}: die Musterlösung besteht und benutzt nur erlaubte Blöcke`, () => {
      const p = SOLUTIONS[t.id];
      expect(p, 'Musterlösung fehlt').toBeDefined();
      const types = flatten(p).map((b) => b.type);
      for (const type of types) expect(t.allowed, `${t.id}: ${type}`).toContain(type);
      if (hasEvent(p, 'tap')) expect(t.allowed).toContain('whenTap');
      if (hasEvent(p, 'bump')) expect(t.allowed).toContain('whenBump');
      const r = checkTask(t, p);
      expect(r.checks.filter((c) => !c.ok).map((c) => c.id)).toEqual([]);
      expect(r.passed).toBe(true);
      expect(r.truncated).toBe(false);
    });

    it(`${t.id}: ein leeres Programm besteht nicht`, () => {
      expect(checkTask(t, emptyBlockProgram()).passed).toBe(false);
    });
  }

  it('checkTask liefert eine Zeile je Bedingung, in der Reihenfolge von requirements', () => {
    const t = task('t05');
    expect(checkTask(t, SOLUTIONS.t05).checks.map((c) => c.id)).toEqual(requirements(t).map((c) => c.id));
  });

  it('Umweg (t03): geradeaus in die Mauer besteht nicht', () => {
    const r = checkTask(task('t03'), build([fwd(8)]));
    expect(r.checks.find((c) => c.id === 'goal')?.ok).toBe(false);
  });

  it('Treppe (t05): derselbe Weg ohne Wiederholen braucht zu viele Blöcke', () => {
    const manual = build([fwd(1), right, fwd(1), left, fwd(1), right, fwd(1), left, fwd(1), right, fwd(1), left, fwd(1), right, fwd(1), left]);
    const r = checkTask(task('t05'), manual);
    expect(r.checks.find((c) => c.id === 'goal')?.ok).toBe(true);
    expect(r.checks.find((c) => c.id === 'stars')?.ok).toBe(true);
    expect(r.checks.find((c) => c.id === 'max')?.ok).toBe(false);
    expect(r.passed).toBe(false);
  });

  it('Treppe (t05): der kurze Weg um die Ecke sammelt die Sterne nicht ein', () => {
    const r = checkTask(task('t05'), build([fwd(4), right, fwd(4)]));
    expect(r.checks.find((c) => c.id === 'goal')?.ok).toBe(true);
    expect(r.checks.find((c) => c.id === 'stars')?.ok).toBe(false);
  });

  it('Quadrat (t06): ohne Rückkehr zum Start fehlt das Ziel', () => {
    const r = checkTask(task('t06'), build([['repeat', { n: 3 }, [fwd(3), right]]]));
    expect(r.checks.find((c) => c.id === 'goal')?.ok).toBe(false);
  });

  it('Bis zur Wand (t09): Vorwärts 20 reicht nicht ohne Wiederhole bis', () => {
    const r = checkTask(task('t09'), build([fwd(10)]));
    expect(r.checks.find((c) => c.id === 'goal')?.ok).toBe(true);
    expect(r.checks.find((c) => c.id === 'use-repeatUntil')?.ok).toBe(false);
    expect(r.passed).toBe(false);
  });

  it('Rundkurs (t10): auch mit Wiederhole bis statt Vorwärts 20', () => {
    const p = build([['repeat', { n: 4 }, [['repeatUntil', { cond: 'wall' }, [fwd(1)]], right]]]);
    expect(checkTask(task('t10'), p).passed).toBe(true);
  });

  it('Umweg mit Wenn (t11): zu wenige Durchgänge erreichen das Ziel nicht, mehr als 11 schon', () => {
    const body = (n: number) => build([['repeat', { n }, [['if', { cond: 'wall' }, [left, fwd(1), right]], fwd(1)]]]);
    expect(checkTask(task('t11'), body(10)).passed).toBe(false);
    expect(checkTask(task('t11'), body(11)).passed).toBe(true);
    expect(checkTask(task('t11'), body(14)).passed).toBe(true);
  });

  it('Umweg mit Wenn (t11): ohne Wenn-Block fehlt die Pflicht', () => {
    const r = checkTask(task('t11'), build([['repeat', { n: 11 }, [fwd(1)]]]));
    expect(r.checks.find((c) => c.id === 'use-if')?.ok).toBe(false);
  });

  it('Zähle bis 5 (t12): ein Ton zu wenig oder Zähler falsch besteht nicht', () => {
    const four = build([['repeat', { n: 4 }, [['addCount', { n: 1 }], ['beep', { note: 'c' }]]]]);
    const r = checkTask(task('t12'), four);
    expect(r.checks.find((c) => c.id === 'count')?.ok).toBe(false);
    expect(r.checks.find((c) => c.id === 'does-beep')?.ok).toBe(false);
  });

  it('Drei Schritte (t13): das Bild ohne Zähler-Vergleich besteht nicht', () => {
    const p = build([['repeat', { n: 3 }, [fwd(1), ['addCount', { n: 1 }]]], ['showImage', { img: 'heart' }]]);
    const r = checkTask(task('t13'), p);
    expect(r.checks.find((c) => c.id === 'use-ifCount')?.ok).toBe(false);
  });

  it('Tippen (t14): das Bild im Hauptprogramm statt im Ereignis-Skript besteht nicht', () => {
    const r = checkTask(task('t14'), build([['showImage', { img: 'heart' }]]));
    expect(r.checks.find((c) => c.id === 'use-whenTap')?.ok).toBe(false);
    expect(r.checks.find((c) => c.id === 'does-event')?.ok).toBe(false);
    expect(r.passed).toBe(false);
  });

  it('Aua, Wand (t15): das Bild allein im Hauptprogramm genügt nicht', () => {
    const p = build([fwd(20), ['showImage', { img: 'sad' }], ['beep', { note: 'c' }]]);
    const r = checkTask(task('t15'), p);
    expect(r.checks.find((c) => c.id === 'use-whenBump')?.ok).toBe(false);
    expect(r.checks.find((c) => c.id === 'does-event')?.ok).toBe(false);
    expect(r.passed).toBe(false);
  });

  it('Endlosschleife wird erkannt und gilt als nicht bestanden, ohne zu hängen', () => {
    const r = checkTask(task('t01'), build([['forever', {}, [['turnRight', { deg: 45 }]]]]));
    expect(r.truncated).toBe(true);
    expect(r.passed).toBe(false);
  });
});

describe('Fortschritt', () => {
  it('parseDone behält nur bekannte ids ohne Doppelte', () => {
    expect(parseDone(['t01', 't02', 't01', 'nope', 5])).toEqual(['t01', 't02']);
    expect(parseDone(null)).toEqual([]);
    expect(parseDone({ a: 1 })).toEqual([]);
  });
});
