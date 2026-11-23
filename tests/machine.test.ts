import { describe, expect, it } from 'vitest';
import {
  HAT_PARENT,
  MAX_BLOCKS,
  MAX_NEST,
  addEvent,
  canInsert,
  canMove,
  clearBlocks,
  countBlocks,
  duplicateBlock,
  emptyBlockProgram,
  findBlock,
  flatten,
  hasEvent,
  insertBlock,
  moveBlock,
  parseBlockProgram,
  removeBlock,
  removeEvent,
  serializeBlocks,
  setParam,
  usesCounter,
  type BlockProgram,
  type HatType,
} from '../src/blocks';
import { MAX_INSTRS, Machine, simulate } from '../src/machine';
import { DEFAULT_WORLD, evalCompare, evalCondition, initialState, wallAhead, type Instr, type World } from '../src/sim';
import { SimPlayer, type Clock, type Mode } from '../src/simPlayer';

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

const kinds = (instrs: Instr[]) => instrs.map((i) => i.kind);
const W = DEFAULT_WORLD;

describe('Machine: Ablauf', () => {
  it('einfache Blöcke werden zu Anweisungen mit Block-id', () => {
    const p = build([['forward', { n: 3 }], ['turnLeft', { deg: 45 }], ['showImage', { img: 'star' }], 'lightOff', ['beep', { note: 'g' }], ['wait', { s: 2 }]]);
    const { instrs } = simulate(p);
    expect(kinds(instrs)).toEqual(['forward', 'turnLeft', 'showImage', 'lightOff', 'beep', 'wait']);
    expect(instrs.map((i) => i.id)).toEqual(p.blocks.map((b) => b.id));
    expect([instrs[0].n, instrs[1].deg, instrs[2].img, instrs[4].note, instrs[5].s]).toEqual([3, 45, 'star', 'g', 2]);
  });

  it('Wiederholen: Marke je Durchlauf, dann der Inhalt', () => {
    const { instrs } = simulate(build([['repeat', { n: 3 }, ['forward', 'turnRight']]]));
    expect(kinds(instrs)).toEqual(['loop', 'forward', 'turnRight', 'loop', 'forward', 'turnRight', 'loop', 'forward', 'turnRight']);
    expect(instrs.filter((i) => i.kind === 'loop').map((l) => `${l.iter}/${l.total}`)).toEqual(['1/3', '2/3', '3/3']);
  });

  it('verschachtelte Wiederholungen multiplizieren sich', () => {
    const { instrs } = simulate(build([['repeat', { n: 2 }, [['repeat', { n: 4 }, ['beep']]]]]));
    expect(instrs.filter((i) => i.kind === 'beep')).toHaveLength(8);
    expect(instrs.filter((i) => i.kind === 'loop')).toHaveLength(2 + 8);
  });

  it('leeres Programm, leeres Wiederholen', () => {
    expect(simulate(emptyBlockProgram()).instrs).toEqual([]);
    expect(kinds(simulate(build([['repeat', { n: 2 }]])).instrs)).toEqual(['loop', 'loop']);
  });

  it('Endlosschleife wird nach MAX_INSTRS abgebrochen', () => {
    const r = simulate(build([['forever', {}, ['beep']]]));
    expect(r.truncated).toBe(true);
    expect(r.instrs).toHaveLength(MAX_INSTRS);
    // auch leere Endlosschleife und leeres "Wiederhole bis" (Bedingung nie wahr) hängen nicht
    expect(simulate(build([['forever', {}]])).truncated).toBe(true);
    expect(simulate(build([['repeatUntil', { cond: 'wall' }]])).truncated).toBe(true);
  });

  it('riesige verschachtelte Wiederholungen werden begrenzt', () => {
    let p = build([['repeat', { n: 20 }, [['repeat', { n: 20 }, [['repeat', { n: 20 }, ['beep']]]]]]]);
    p = setParam(p, p.blocks[0].id, 'n', 20);
    expect(simulate(p).truncated).toBe(true);
  });
});

describe('Bedingungen und Sensor', () => {
  const s0 = initialState(W);

  it('Wand vor mir: erst wenn kein ganzer Schritt mehr geht', () => {
    expect(wallAhead(s0, W)).toBe(false); // 6 Felder frei
    expect(wallAhead({ ...s0, y: 1.5 }, W)).toBe(false); // genau ein Schritt frei
    expect(wallAhead({ ...s0, y: 1.4 }, W)).toBe(true);
    expect(wallAhead({ ...s0, y: 0.5 }, W)).toBe(true);
    expect(wallAhead({ ...s0, heading: 90, x: 10.5 }, W)).toBe(false);
    expect(wallAhead({ ...s0, heading: 90, x: 11 }, W)).toBe(true);
    expect(wallAhead({ ...s0, heading: 180, y: 6.6 }, W)).toBe(true);
    expect(evalCondition('wall', { ...s0, y: 0.5 }, W)).toBe(true);
    expect(evalCondition('free', { ...s0, y: 0.5 }, W)).toBe(false);
    expect(evalCondition('free', s0, W)).toBe(true);
  });

  it('Vergleiche mit dem Zähler', () => {
    expect(evalCompare('lt', 2, 3)).toBe(true);
    expect(evalCompare('lt', 3, 3)).toBe(false);
    expect(evalCompare('eq', 3, 3)).toBe(true);
    expect(evalCompare('gt', 4, 3)).toBe(true);
    expect(evalCompare('gt', 3, 3)).toBe(false);
  });

  it('Wenn: der Inhalt läuft nur bei wahrer Bedingung, die Prüfung wird gemeldet', () => {
    const yes = simulate(build([['if', { cond: 'free' }, [['forward', { n: 1 }]]]]));
    expect(kinds(yes.instrs)).toEqual(['check', 'forward']);
    expect(yes.instrs[0].result).toBe(true);
    expect(yes.state.y).toBe(5.5);
    const no = simulate(build([['if', { cond: 'wall' }, [['forward', { n: 1 }]]]]));
    expect(kinds(no.instrs)).toEqual(['check']);
    expect(no.instrs[0].result).toBe(false);
    expect(no.state.y).toBe(6.5);
  });

  it('Wiederhole bis Wand: fährt bis kurz vor die Wand (jede Prüfung ist eine Anweisung)', () => {
    const r = simulate(build([['repeatUntil', { cond: 'wall' }, [['forward', { n: 1 }]]]]));
    expect(r.truncated).toBe(false);
    expect(r.state.y).toBe(0.5);
    expect(r.bumps).toBe(0); // nie gegen die Wand gestoßen: nach jedem Schritt wird geprüft
    const checks = r.instrs.filter((i) => i.kind === 'check');
    expect(checks.map((c) => c.result)).toEqual([false, false, false, false, false, false, true]);
    expect(kinds(r.instrs).filter((k) => k === 'forward')).toHaveLength(6);
  });

  it('Wiederhole bis: schon wahr -> Inhalt läuft gar nicht', () => {
    const r = simulate(build([['forward', { n: 6 }], ['repeatUntil', { cond: 'wall' }, ['beep']]]));
    expect(kinds(r.instrs)).toEqual(['forward', 'check']);
  });

  it('Labyrinth-Klassiker: bis zur Wand, dann drehen, wieder bis zur Wand', () => {
    const r = simulate(
      build([
        ['repeatUntil', { cond: 'wall' }, ['forward']],
        ['turnRight', { deg: 90 }],
        ['repeatUntil', { cond: 'wall' }, ['forward']],
      ]),
    );
    expect(r.state).toMatchObject({ x: 11.5, y: 0.5, heading: 90 });
    expect(r.bumps).toBe(0);
  });

  it('Wenn Zähler: Vergleich mit dem aktuellen Wert', () => {
    const p = (cmp: string, n: number) => build([['setCount', { n: 5 }], ['ifCount', { cmp, n }, ['beep']]]);
    expect(kinds(simulate(p('gt', 3)).instrs)).toEqual(['setCount', 'check', 'beep']);
    expect(kinds(simulate(p('lt', 3)).instrs)).toEqual(['setCount', 'check']);
    expect(kinds(simulate(p('eq', 5)).instrs)).toEqual(['setCount', 'check', 'beep']);
  });

  it('Bedingungen in Bedingungen und in Wiederholungen', () => {
    const r = simulate(build([['repeat', { n: 3 }, [['if', { cond: 'free' }, [['if', { cond: 'free' }, ['forward']]]]]]]));
    expect(kinds(r.instrs).filter((k) => k === 'forward')).toHaveLength(3);
    expect(r.state.y).toBe(0.5); // 3 x 2 Schritte
  });
});

describe('Zähler', () => {
  it('setzen und ändern, Grenzen -99..99', () => {
    expect(simulate(build([['setCount', { n: 7 }], ['addCount', { n: -2 }]])).state.count).toBe(5);
    expect(simulate(build([['repeat', { n: 5 }, [['addCount', { n: 1 }]]]])).state.count).toBe(5);
    expect(simulate(build([['setCount', { n: 99 }], ['addCount', { n: 9 }]])).state.count).toBe(99);
    expect(simulate(build([['setCount', { n: -99 }], ['addCount', { n: -9 }]])).state.count).toBe(-99);
    expect(simulate(emptyBlockProgram()).state.count).toBe(0);
  });

  it('Wiederholen bis der Zähler groß genug ist (Zählschleife mit Wenn)', () => {
    const r = simulate(build([['repeat', { n: 10 }, [['addCount', { n: 1 }], ['ifCount', { cmp: 'gt', n: 6 }, [['beep']]]]]]));
    expect(r.state.count).toBe(10);
    expect(r.instrs.filter((i) => i.kind === 'beep')).toHaveLength(4); // bei 7, 8, 9, 10
  });

  it('usesCounter erkennt Zähler-Blöcke auch in Ereignis-Skripten', () => {
    expect(usesCounter(build(['forward']))).toBe(false);
    expect(usesCounter(build(['forward'], { tap: ['addCount'] }))).toBe(true);
    expect(usesCounter(build([['if', { cond: 'wall' }, [['ifCount', { cmp: 'gt', n: 1 }]]]]))).toBe(true);
  });
});

describe('Ereignisse in der Machine', () => {
  it('Wand berührt: das Ereignis-Skript läuft sofort nach dem Stoß, dann geht es weiter', () => {
    const p = build([['forward', { n: 20 }], ['beep']], { bump: [['turnRight', { deg: 180 }], ['forward', { n: 2 }]] });
    const r = simulate(p);
    expect(kinds(r.instrs)).toEqual(['forward', 'event', 'turnRight', 'forward', 'beep']);
    expect(r.instrs[1]).toMatchObject({ kind: 'event', hat: 'bump', id: HAT_PARENT.bump });
    expect(r.state).toMatchObject({ y: 2.5, heading: 180 });
  });

  it('das Ereignis-Skript wird nicht verschachtelt aufgerufen (stößt es selbst an, ignoriert)', () => {
    // Das Skript fährt rückwärts gegen die untere Wand -> "Wand berührt" feuert wieder, läuft aber schon
    const p = build([['forward', { n: 20 }]], { bump: [['backward', { n: 20 }]] });
    const r = simulate(p);
    expect(kinds(r.instrs)).toEqual(['forward', 'event', 'backward']);
    expect(r.bumps).toBe(2);
    expect(r.truncated).toBe(false);
  });

  it('fire: nur vorhandene Skripte, nicht doppelt', () => {
    const m = new Machine(build(['forward'], { tap: ['beep'] }), W);
    expect(m.hasEvents).toBe(true);
    expect(m.fire('bump')).toBe(false);
    expect(m.fire('tap')).toBe(true);
    expect(m.fire('tap')).toBe(false); // läuft schon
    expect(kinds([m.next()!, m.next()!, m.next()!].filter(Boolean))).toEqual(['event', 'beep', 'forward']); // Ereignis zuerst, dann weiter
    expect(m.next()).toBeNull();
    expect(m.idle).toBe(true);
    expect(m.fire('tap')).toBe(true); // nach dem Ende wieder möglich
  });

  it('ohne Ereignis-Skripte: hasEvents ist false', () => {
    expect(new Machine(build(['forward']), W).hasEvents).toBe(false);
  });
});

// ---------- Player mit Ereignissen (künstliche Uhr) ----------

function fakeClock() {
  let t = 0;
  let next = 1;
  const pending = new Map<number, (t: number) => void>();
  const clock: Clock = {
    now: () => t,
    request: (cb) => {
      const id = next++;
      pending.set(id, cb);
      return id;
    },
    cancel: (id) => void pending.delete(id),
  };
  const advance = (ms: number) => {
    const end = t + ms;
    while (t < end) {
      t = Math.min(end, t + 16);
      const cbs = [...pending.values()];
      pending.clear();
      for (const cb of cbs) cb(t);
    }
  };
  return { clock, advance };
}

function makePlayer(world: World = W) {
  const fc = fakeClock();
  const log = { modes: [] as Mode[], instrs: [] as Instr[] };
  const p = new SimPlayer(
    world,
    { onFrame: () => undefined, onInstr: (i) => void (i && log.instrs.push(i)), onMode: (m) => void log.modes.push(m), onSound: () => undefined },
    fc.clock,
  );
  return { p, fc, log };
}

describe('SimPlayer: Ereignisse', () => {
  it('Programm mit Ereignis-Skript wartet nach dem Ende (listening) und reagiert auf Tippen', () => {
    const { p, fc } = makePlayer();
    p.play(build([['forward', { n: 1 }]], { tap: [['addCount', { n: 1 }], ['turnRight', { deg: 90 }]] }));
    fc.advance(10000);
    expect(p.mode).toBe('listening');
    expect(p.state.count).toBe(0);
    expect(p.event('tap')).toBe(true);
    fc.advance(10000);
    expect(p.state).toMatchObject({ count: 1, heading: 90 });
    expect(p.mode).toBe('listening'); // wartet weiter
    expect(p.event('tap')).toBe(true);
    fc.advance(10000);
    expect(p.state).toMatchObject({ count: 2, heading: 180 });
  });

  it('Tippen ohne passendes Skript oder ohne laufendes Programm tut nichts', () => {
    const { p, fc } = makePlayer();
    expect(p.event('tap')).toBe(false); // noch nicht gestartet
    p.play(build(['forward'], { bump: ['beep'] }));
    fc.advance(10000);
    expect(p.mode).toBe('listening');
    expect(p.event('tap')).toBe(false); // kein Tipp-Skript
    const q = makePlayer();
    q.p.play(build(['forward']));
    q.fc.advance(10000);
    expect(q.p.mode).toBe('done');
    expect(q.p.event('tap')).toBe(false);
  });

  it('Tippen während das Hauptprogramm läuft: Ereignis kommt zwischen zwei Anweisungen dazwischen', () => {
    const { p, fc, log } = makePlayer();
    p.play(build([['forward', { n: 2 }], ['turnRight', { deg: 90 }], ['forward', { n: 1 }]], { tap: [['beep']] }));
    fc.advance(200); // mitten in der ersten Fahrt
    expect(p.event('tap')).toBe(true);
    fc.advance(60000);
    expect(log.instrs.map((i) => i.kind)).toEqual(['forward', 'event', 'beep', 'turnRight', 'forward']);
    expect(p.mode).toBe('listening');
  });

  it('Wand berührt löst das Skript im Player aus', () => {
    const { p, fc, log } = makePlayer();
    p.play(build([['forward', { n: 20 }]], { bump: [['showImage', { img: 'sad' }]] }));
    fc.advance(60000);
    expect(log.instrs.map((i) => i.kind)).toEqual(['forward', 'event', 'showImage']);
    expect(p.state.image).toBe('sad');
    expect(p.mode).toBe('listening');
  });

  it('Stopp beendet das Warten und setzt alles zurück', () => {
    const { p, fc } = makePlayer();
    p.play(build(['forward'], { tap: ['beep'] }));
    fc.advance(10000);
    expect(p.mode).toBe('listening');
    p.stop();
    expect(p.mode).toBe('idle');
    expect(p.state).toEqual(initialState(W));
    expect(p.event('tap')).toBe(false);
  });

  it('in listening sind Start und Schritt gesperrt', () => {
    const { p, fc } = makePlayer();
    const prog = build(['forward'], { tap: ['beep'] });
    p.play(prog);
    fc.advance(10000);
    p.play(prog);
    p.step(prog);
    expect(p.mode).toBe('listening');
    expect(p.executed).toBe(1);
  });

  it('Endlosschleife im Player: wird abgebrochen und meldet truncated, bleibt aber nicht im Warten', () => {
    const { p, fc } = makePlayer();
    p.setSpeed(1000); // sehr schnell
    p.play(build([['forever', {}, ['beep']]], { tap: ['beep'] }));
    fc.advance(1000000);
    expect(p.truncated).toBe(true);
    expect(p.mode).toBe('done');
  });

  it('Einzelschritt mit Ereignis: Ereignis wartet auf den nächsten Tipp', () => {
    const { p, fc, log } = makePlayer();
    const prog = build([['forward', { n: 1 }], ['turnRight', { deg: 90 }]], { tap: [['beep']] });
    p.step(prog);
    fc.advance(5000);
    expect(p.event('tap')).toBe(true);
    fc.advance(5000);
    expect(log.instrs.map((i) => i.kind)).toEqual(['forward']); // noch nichts passiert
    p.step(prog);
    fc.advance(5000);
    expect(log.instrs.map((i) => i.kind)).toEqual(['forward', 'event']);
  });
});

// ---------- Programm-Modell mit Ereignis-Skripten ----------

describe('Modell: Ereignis-Skripte', () => {
  it('anlegen, doppelt anlegen, löschen', () => {
    let p = emptyBlockProgram();
    expect(hasEvent(p, 'tap')).toBe(false);
    p = addEvent(p, 'tap');
    expect(hasEvent(p, 'tap')).toBe(true);
    expect(addEvent(p, 'tap')).toBe(p);
    p = addEvent(p, 'bump');
    p = removeEvent(p, 'tap');
    expect(hasEvent(p, 'tap')).toBe(false);
    expect(hasEvent(p, 'bump')).toBe(true);
    p = removeEvent(p, 'bump');
    expect(p.events).toBeUndefined();
    expect(removeEvent(p, 'bump')).toBe(p);
  });

  it('Blöcke in ein Ereignis-Skript einfügen; nur wenn es das Skript gibt', () => {
    let p = emptyBlockProgram();
    expect(insertBlock(p, 'beep', HAT_PARENT.tap, 0).id).toBeNull();
    p = addEvent(p, 'tap');
    const r = insertBlock(p, 'beep', HAT_PARENT.tap, 0);
    expect(r.id).not.toBeNull();
    expect(r.program.events!.tap!.map((b) => b.type)).toEqual(['beep']);
    expect(findBlock(r.program, r.id!)!.parentId).toBe(HAT_PARENT.tap);
    expect(r.program.blocks).toEqual([]);
  });

  it('Köpfe sind keine Blöcke in einer Liste', () => {
    const p = addEvent(emptyBlockProgram(), 'tap');
    expect(canInsert(p, 'whenTap', null)).toBe(false);
    expect(canInsert(p, 'whenBump', HAT_PARENT.tap)).toBe(false);
    expect(insertBlock(p, 'whenTap', null, 0).id).toBeNull();
  });

  it('Blöcke zwischen Hauptprogramm und Ereignis-Skript verschieben', () => {
    let p = build(['forward', 'beep'], { tap: ['lightOff'] });
    const beep = p.blocks[1].id;
    p = moveBlock(p, beep, HAT_PARENT.tap, 0);
    expect(p.blocks.map((b) => b.type)).toEqual(['forward']);
    expect(p.events!.tap!.map((b) => b.type)).toEqual(['beep', 'lightOff']);
    const light = p.events!.tap![1].id;
    p = moveBlock(p, light, null, 0);
    expect(p.blocks.map((b) => b.type)).toEqual(['lightOff', 'forward']);
    // in ein nicht vorhandenes Skript geht es nicht
    expect(canMove(p, beep, HAT_PARENT.bump)).toBe(false);
  });

  it('Container im Ereignis-Skript: Verschachtelung zählt ab dort', () => {
    let p = addEvent(emptyBlockProgram(), 'bump');
    let parent: number = HAT_PARENT.bump;
    for (let i = 0; i < MAX_NEST; i++) {
      const r = insertBlock(p, 'if', parent, 0);
      expect(r.id).not.toBeNull();
      p = r.program;
      parent = r.id!;
    }
    expect(insertBlock(p, 'repeat', parent, 0).id).toBeNull();
  });

  it('Löschen, Kopieren und Werte ändern wirken auch in Ereignis-Skripten', () => {
    let p = build(['forward'], { tap: [['repeat', { n: 2 }, ['beep']]] });
    const rep = p.events!.tap![0];
    p = setParam(p, rep.id, 'n', 5);
    expect(p.events!.tap![0].params.n).toBe(5);
    const d = duplicateBlock(p, rep.id);
    expect(d.program.events!.tap!.map((b) => b.type)).toEqual(['repeat', 'repeat']);
    expect(new Set(flatten(d.program).map((b) => b.id)).size).toBe(flatten(d.program).length);
    p = removeBlock(p, rep.id);
    expect(p.events!.tap).toEqual([]);
    expect(countBlocks(p)).toBe(1);
  });

  it('Blöcke der Ereignis-Skripte zählen zur Gesamtzahl', () => {
    let p = build([], { tap: [] });
    for (let i = 0; i < MAX_BLOCKS; i++) p = insertBlock(p, 'beep', HAT_PARENT.tap, i).program;
    expect(countBlocks(p)).toBe(MAX_BLOCKS);
    expect(insertBlock(p, 'forward', null, 0).id).toBeNull();
  });

  it('Leeren löscht alle Skripte', () => {
    const p = build(['forward'], { tap: ['beep'], bump: ['beep'] });
    const q = clearBlocks(p);
    expect(q.blocks).toEqual([]);
    expect(q.events).toBeUndefined();
    expect(q.nextId).toBe(p.nextId);
    expect(clearBlocks(q)).toBe(q);
    expect(clearBlocks(addEvent(emptyBlockProgram(), 'tap')).events).toBeUndefined(); // nur ein leeres Skript: auch weg
  });

  it('Speichern und Laden mit Ereignis-Skripten', () => {
    const p = build([['repeat', { n: 4 }, ['forward']]], { tap: [['setCount', { n: 3 }]], bump: [['if', { cond: 'free' }, ['beep']]] });
    expect(parseBlockProgram(JSON.parse(serializeBlocks(p)))).toEqual(p);
    const old = { blocks: [{ id: 1, type: 'forward', params: { n: 1 } }], nextId: 2 }; // altes Format ohne events
    expect(parseBlockProgram(old)!.events).toBeUndefined();
  });

  it('lehnt kaputte Ereignis-Daten ab', () => {
    const base = { blocks: [], nextId: 1 };
    expect(parseBlockProgram({ ...base, events: 5 })).toBeNull();
    expect(parseBlockProgram({ ...base, events: [] })).toBeNull();
    expect(parseBlockProgram({ ...base, events: { tap: 'x' } })).toBeNull();
    expect(parseBlockProgram({ ...base, events: { tap: [{ id: 1, type: 'whenTap', params: {} }] } })).toBeNull(); // Kopf als Block
    expect(parseBlockProgram({ blocks: [{ id: 1, type: 'beep', params: {} }], nextId: 5, events: { tap: [{ id: 1, type: 'beep', params: {} }] } })).toBeNull(); // doppelte id
    expect(parseBlockProgram({ ...base, events: { gibtEs: [] } })!.events).toBeUndefined(); // unbekanntes Ereignis wird ignoriert
  });
});
