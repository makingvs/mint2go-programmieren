import { describe, expect, it } from 'vitest';
import { NOTES, emptyBlockProgram, insertBlock, setParam, type BlockProgram } from '../src/blocks';
import { simulate } from '../src/machine';
import { DEFAULT_WORLD, WALL_MARGIN, apply, durationFor, durationMs, initialState, noteFreq, type Instr, type World } from '../src/sim';
import { SimPlayer, type Clock, type Mode, type SoundEvent } from '../src/simPlayer';

type Spec = string | [string, Spec[]] | [string, Record<string, number | string>];

/** Programm aus Kurzschreibweise: ['forward', ['repeat', ['forward']]] bzw. ['forward', {n: 3}] */
function build(specs: Spec[]): BlockProgram {
  let p = emptyBlockProgram();
  const add = (list: Spec[], parent: number | null) => {
    list.forEach((s, i) => {
      const [type, rest] = typeof s === 'string' ? [s, undefined] : s;
      const kids = Array.isArray(rest) ? rest : [];
      const params = rest && !Array.isArray(rest) ? rest : {};
      const r = insertBlock(p, type, parent, i, params);
      if (r.id === null) throw new Error('insert failed ' + type);
      p = r.program;
      if (kids.length) add(kids, r.id);
    });
  };
  add(specs, null);
  return p;
}

const W: World = DEFAULT_WORLD;

describe('apply (Roboter bewegen)', () => {
  const s0 = initialState(W);
  const fw = (n: number): Instr => ({ id: 1, kind: 'forward', n });

  it('Start: unten links, schaut nach oben, Spur beginnt am Start', () => {
    expect(s0).toMatchObject({ x: 1.5, y: 6.5, heading: 0, image: null, bumped: false });
    expect(s0.trail).toEqual([[1.5, 6.5]]);
  });

  it('vorwärts geht in Blickrichtung, rückwärts zurück', () => {
    expect(apply(s0, fw(3), W)).toMatchObject({ x: 1.5, y: 3.5 });
    expect(apply(s0, { id: 1, kind: 'backward', n: 1 }, W)).toMatchObject({ x: 1.5, y: 7.5 });
  });

  it('Drehen: rechts = im Uhrzeigersinn, links dagegen, Winkel bleibt in 0..360', () => {
    const r = apply(s0, { id: 1, kind: 'turnRight', deg: 90 }, W);
    expect(r.heading).toBe(90);
    expect(apply(r, fw(2), W)).toMatchObject({ x: 3.5, y: 6.5 }); // nach rechts, exakt ohne Rundungsrest
    expect(apply(s0, { id: 1, kind: 'turnLeft', deg: 90 }, W).heading).toBe(270);
    expect(apply(s0, { id: 1, kind: 'turnLeft', deg: 360 }, W).heading).toBe(0);
    expect(apply(s0, { id: 1, kind: 'turnRight', deg: 45 }, W).heading).toBe(45);
    const diag = apply({ ...s0, heading: 45 }, fw(2), W);
    expect(diag.x).toBeCloseTo(1.5 + Math.SQRT2, 5);
    expect(diag.y).toBeCloseTo(6.5 - Math.SQRT2, 5);
  });

  it('Wand: Roboter bleibt vor der Wand stehen und meldet bumped', () => {
    const r = apply(s0, fw(20), W);
    expect(r.y).toBe(WALL_MARGIN);
    expect(r.bumped).toBe(true);
    expect(apply(s0, fw(1), W).bumped).toBe(false);
    // genau bis an die Wand: kein Stoß
    expect(apply(s0, fw(6), W)).toMatchObject({ y: 0.5, bumped: false });
    const left = apply({ ...s0, heading: 270 }, fw(5), W);
    expect(left.x).toBe(WALL_MARGIN);
    expect(left.bumped).toBe(true);
  });

  it('Teilfortschritt t: Position/Winkel dazwischen, Spur erst am Ende', () => {
    const half = apply(s0, fw(4), W, 0.5);
    expect(half).toMatchObject({ x: 1.5, y: 4.5 });
    expect(half.trail).toEqual(s0.trail);
    const full = apply(s0, fw(4), W, 1);
    expect(full.trail).toEqual([[1.5, 6.5], [1.5, 2.5]]);
    expect(apply(s0, { id: 1, kind: 'turnRight', deg: 90 }, W, 0.5).heading).toBe(45);
    expect(apply(s0, fw(4), W, 0)).toMatchObject({ x: 1.5, y: 6.5 });
    expect(apply(s0, fw(4), W, 7).y).toBe(2.5); // t wird begrenzt
    expect(apply(s0, fw(4), W, -1).y).toBe(6.5);
  });

  it('Fahrt bis zur Wand: Teilfortschritt läuft nur bis zur Wand, Stoß erst am Ende', () => {
    const half = apply(s0, fw(20), W, 0.5); // Weg bis zur Wand: 6 Felder
    expect(half.y).toBe(3.5);
    expect(half.bumped).toBe(false);
    expect(apply(s0, fw(20), W, 1).bumped).toBe(true);
    expect(durationFor(s0, fw(20), W)).toBe(6 * 450); // nicht 20 x 450
    expect(durationFor(s0, fw(2), W)).toBe(900);
    expect(durationFor({ ...s0, y: 0.5 }, fw(3), W)).toBe(250); // steht schon an der Wand
    expect(durationFor(s0, { id: 1, kind: 'turnRight', deg: 90 }, W)).toBe(450);
  });

  it('Bilder, Licht aus; Ton und Warten ändern den Roboter nicht', () => {
    const a = apply(s0, { id: 1, kind: 'showImage', img: 'heart' }, W);
    expect(a.image).toBe('heart');
    expect(apply(a, { id: 2, kind: 'lightOff' }, W).image).toBeNull();
    const b = apply(a, { id: 3, kind: 'beep', note: 'c' }, W);
    expect(b).toEqual({ ...a, bumped: false });
    expect(apply(a, { id: 4, kind: 'wait', s: 1 }, W)).toEqual({ ...a, bumped: false });
  });

  it('verändert den alten Zustand nicht', () => {
    const before = JSON.stringify(s0);
    apply(s0, fw(3), W);
    expect(JSON.stringify(s0)).toBe(before);
  });
});

describe('simulate (ganzes Programm)', () => {
  it('Quadrat: Wiederholen 4x (2 vor, 90° rechts) endet am Start, Spur hat 5 Ecken', () => {
    const p = build([['repeat', [['forward', { n: 2 }], ['turnRight', { deg: 90 }]]]]);
    const q = setParamRepeat(p, 4);
    const r = simulate(q);
    expect(r.state).toMatchObject({ x: 1.5, y: 6.5, heading: 0 });
    expect(r.state.trail).toEqual([[1.5, 6.5], [1.5, 4.5], [3.5, 4.5], [3.5, 6.5], [1.5, 6.5]]);
    expect(r.bumps).toBe(0);
  });

  it('zählt Stöße gegen die Wand', () => {
    const r = simulate(build([['forward', { n: 20 }], ['forward', { n: 1 }]]));
    expect(r.bumps).toBe(2);
    expect(r.state.y).toBe(0.5);
  });

  it('Bild bleibt stehen, bis ein anderes kommt oder das Licht aus geht', () => {
    expect(simulate(build([['showImage', { img: 'smile' }], 'forward'])).state.image).toBe('smile');
    expect(simulate(build([['showImage', { img: 'smile' }], 'lightOff'])).state.image).toBeNull();
  });

  it('leeres Programm: Roboter bleibt am Start', () => {
    expect(simulate(emptyBlockProgram()).state).toEqual(initialState(W));
  });

  it('eigene Welt mit anderem Start', () => {
    const w: World = { w: 5, h: 5, start: { x: 2.5, y: 2.5, heading: 90 } };
    const r = simulate(build([['forward', { n: 9 }]]), w);
    expect(r.state.x).toBe(4.5);
    expect(r.bumps).toBe(1);
  });
});

function setParamRepeat(p: BlockProgram, n: number): BlockProgram {
  return setParam(p, p.blocks[0].id, 'n', n);
}

describe('Dauer und Töne', () => {
  it('Dauer wächst mit Schritten, Grad und Sekunden', () => {
    expect(durationMs({ id: 1, kind: 'forward', n: 4 })).toBeGreaterThan(durationMs({ id: 1, kind: 'forward', n: 1 }));
    expect(durationMs({ id: 1, kind: 'turnRight', deg: 180 })).toBeGreaterThan(durationMs({ id: 1, kind: 'turnRight', deg: 45 }));
    expect(durationMs({ id: 1, kind: 'wait', s: 3 })).toBe(3000);
    for (const kind of ['forward', 'backward', 'turnLeft', 'turnRight', 'showImage', 'lightOff', 'beep', 'wait', 'loop', 'check', 'setCount', 'addCount', 'event'] as const) {
      expect(durationMs({ id: 1, kind })).toBeGreaterThan(0);
    }
  });

  it('Tonhöhe nur bei Ton-Anweisungen', () => {
    expect(noteFreq({ id: 1, kind: 'beep', note: 'a' })).toBe(NOTES.a.freq);
    expect(noteFreq({ id: 1, kind: 'beep', note: 'x' })).toBe(0);
    expect(noteFreq({ id: 1, kind: 'forward', n: 1 })).toBe(0);
  });
});

// ---------- Player mit künstlicher Uhr ----------

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
  /** Zeit um ms vorstellen, in kleinen Schritten (16 ms) */
  const advance = (ms: number) => {
    const end = t + ms;
    while (t < end) {
      t = Math.min(end, t + 16);
      const cbs = [...pending.entries()];
      pending.clear();
      for (const [, cb] of cbs) cb(t);
    }
  };
  return { clock, advance, pendingCount: () => pending.size };
}

function makePlayer(world = W) {
  const fc = fakeClock();
  const log = { modes: [] as Mode[], instrs: [] as (Instr | null)[], sounds: [] as SoundEvent[], frames: 0 };
  const p = new SimPlayer(
    world,
    {
      onFrame: () => void log.frames++,
      onInstr: (i) => void log.instrs.push(i),
      onMode: (m) => void log.modes.push(m),
      onSound: (e) => void log.sounds.push(e),
    },
    fc.clock,
  );
  return { p, fc, log };
}

describe('SimPlayer', () => {
  const prog = build([['forward', { n: 2 }], ['turnRight', { deg: 90 }], ['forward', { n: 1 }]]);

  it('spielt das Programm bis zum Ende und bleibt dann stehen', () => {
    const { p, fc, log } = makePlayer();
    p.play(prog);
    expect(p.mode).toBe('playing');
    fc.advance(60000);
    expect(p.mode).toBe('done');
    expect(p.state).toMatchObject({ x: 2.5, y: 4.5, heading: 90 });
    expect(log.modes).toEqual(['playing', 'done']);
    expect(log.instrs[log.instrs.length - 1]).toBeNull();
    expect(fc.pendingCount()).toBe(0);
  });

  it('meldet die laufende Anweisung der Reihe nach', () => {
    const { p, fc, log } = makePlayer();
    p.play(prog);
    fc.advance(60000);
    const kinds = log.instrs.filter((i): i is Instr => !!i).map((i) => i.kind);
    expect(kinds).toEqual(['forward', 'turnRight', 'forward']);
  });

  it('Einzelschritt: eine Anweisung pro Tipp', () => {
    const { p, fc } = makePlayer();
    p.step(prog);
    expect(p.mode).toBe('stepping');
    fc.advance(5000);
    expect(p.executed).toBe(1);
    expect(p.state.y).toBe(4.5);
    expect(p.mode).toBe('stepping');
    p.step(prog);
    fc.advance(5000);
    expect(p.state.heading).toBe(90);
    p.step(prog);
    fc.advance(5000);
    expect(p.state).toMatchObject({ x: 2.5, y: 4.5 });
    expect(p.mode).toBe('stepping'); // erst der nächste Tipp merkt, dass nichts mehr kommt
    p.step(prog);
    expect(p.mode).toBe('done');
  });

  it('Einzelschritt während der Anzeige einer Anweisung wird ignoriert', () => {
    const { p, fc } = makePlayer();
    p.step(prog);
    fc.advance(100); // erst ein Teil der ersten Anweisung
    p.step(prog);
    fc.advance(5000);
    expect(p.executed).toBe(1);
  });

  it('aus dem Einzelschritt mit Start weiterspielen', () => {
    const { p, fc } = makePlayer();
    p.step(prog);
    fc.advance(5000);
    p.play(prog);
    expect(p.mode).toBe('playing');
    fc.advance(60000);
    expect(p.mode).toBe('done');
    expect(p.state).toMatchObject({ x: 2.5, y: 4.5 });
  });

  it('Stop setzt den Roboter an den Start zurück und stoppt die Zeit', () => {
    const { p, fc, log } = makePlayer();
    p.play(prog);
    fc.advance(500);
    p.stop();
    expect(p.mode).toBe('idle');
    expect(p.state).toEqual(initialState(W));
    expect(fc.pendingCount()).toBe(0);
    expect(log.instrs[log.instrs.length - 1]).toBeNull();
    fc.advance(5000);
    expect(p.state).toEqual(initialState(W));
  });

  it('nach dem Ende startet Start wieder von vorn', () => {
    const { p, fc } = makePlayer();
    p.play(prog);
    fc.advance(60000);
    p.play(prog);
    expect(p.mode).toBe('playing');
    expect(p.executed).toBe(1); // die erste Anweisung läuft schon
    expect(p.state).toMatchObject({ x: 1.5, y: 6.5 });
    fc.advance(60000);
    expect(p.mode).toBe('done');
  });

  it('doppeltes Start ändert nichts', () => {
    const { p, fc } = makePlayer();
    p.play(prog);
    fc.advance(300);
    const pos = p.executed;
    p.play(prog);
    expect(p.executed).toBe(pos);
  });

  it('doppeltes Tempo ist schneller', () => {
    const slow = makePlayer();
    slow.p.play(prog);
    slow.fc.advance(1200);
    const fast = makePlayer();
    fast.p.setSpeed(2.5);
    fast.p.play(prog);
    fast.fc.advance(1200);
    expect(fast.p.executed).toBeGreaterThan(slow.p.executed);
    fast.fc.advance(60000);
    expect(fast.p.mode).toBe('done');
  });

  it('Tempo mitten in einer Anweisung: kein Rückwärtssprung', () => {
    const { p, fc } = makePlayer();
    const frames: number[] = [];
    const q = new SimPlayer(W, { onFrame: (s) => frames.push(s.y), onInstr: () => undefined, onMode: () => undefined, onSound: () => undefined }, fc.clock);
    void p;
    q.play(build([['forward', { n: 4 }]]));
    fc.advance(400);
    q.setSpeed(2.5);
    fc.advance(60000);
    for (let i = 1; i < frames.length; i++) expect(frames[i]).toBeLessThanOrEqual(frames[i - 1] + 1e-9); // y wird nur kleiner
    expect(q.state.y).toBe(2.5);
  });

  it('Ton beim Start der Ton-Anweisung, Stoß-Geräusch bei Wandberührung', () => {
    const { p, fc, log } = makePlayer();
    p.play(build([['beep', { note: 'e' }], ['forward', { n: 20 }]]));
    fc.advance(60000);
    expect(log.sounds).toEqual([{ kind: 'beep', freq: NOTES.e.freq }, { kind: 'bump' }]);
  });

  it('leeres Programm ist sofort fertig', () => {
    const { p } = makePlayer();
    p.play(emptyBlockProgram());
    expect(p.mode).toBe('done');
  });

  it('Wiederholen läuft alle Durchgänge ab', () => {
    const { p, fc, log } = makePlayer();
    const q = setParamRepeat(build([['repeat', [['turnRight', { deg: 90 }]]]]), 4);
    p.play(q);
    fc.advance(60000);
    expect(p.mode).toBe('done');
    expect(p.state.heading).toBe(0); // 4 x 90°
    const loops = log.instrs.filter((i): i is Instr => !!i && i.kind === 'loop');
    expect(loops.map((l) => l.iter)).toEqual([1, 2, 3, 4]);
  });

  it('Programm wird beim Start festgehalten (spätere Änderung wirkt erst beim nächsten Start)', () => {
    const { p, fc } = makePlayer();
    p.play(prog);
    fc.advance(60000);
    expect(p.executed).toBe(3);
  });
});
