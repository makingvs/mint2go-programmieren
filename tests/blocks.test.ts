import { describe, expect, it } from 'vitest';
import {
  BLOCK_DEFS,
  CATEGORIES,
  LED_IMAGES,
  MAX_BLOCKS,
  MAX_NEST,
  NOTES,
  addAtCursor,
  blockDef,
  canInsert,
  canMove,
  clearBlocks,
  countBlocks,
  defaultParams,
  descendantIds,
  duplicateBlock,
  emptyBlockProgram,
  findBlock,
  flatten,
  insertBlock,
  moveBlock,
  normalizeParam,
  parseBlockProgram,
  removeBlock,
  serializeBlocks,
  setParam,
  type Block,
  type BlockProgram,
} from '../src/blocks';
import { blockIcon, categoryIcon, ledSvg, noteBadge } from '../src/blockIcons';
import { BlockSession } from '../src/session';
import { memoryKV } from '../src/store';

const types = (blocks: Block[]) => blocks.map((b) => b.type);

/** Programm aus Kurzschreibweise: ['forward', ['repeat', ['beep']]] */
type Spec = string | [string, Spec[]];
function build(specs: Spec[]): BlockProgram {
  let p = emptyBlockProgram();
  const add = (list: Spec[], parentId: number | null) => {
    list.forEach((s, i) => {
      const [type, kids] = typeof s === 'string' ? [s, []] : s;
      const r = insertBlock(p, type, parentId, i);
      if (r.id === null) throw new Error('insert failed ' + type);
      p = r.program;
      if (kids.length) add(kids, r.id);
    });
  };
  add(specs, null);
  return p;
}

describe('Katalog', () => {
  it('jeder Block ist vollständig beschrieben', () => {
    const seen = new Set<string>();
    for (const d of BLOCK_DEFS) {
      expect(seen.has(d.type)).toBe(false);
      seen.add(d.type);
      expect(CATEGORIES.some((c) => c.id === d.category)).toBe(true);
      expect(blockIcon(d.type)).toMatch(/^<svg /);
      for (const p of d.params) {
        if (p.kind === 'number') {
          expect(p.min).toBeLessThanOrEqual(p.def);
          expect(p.def).toBeLessThanOrEqual(p.max);
          expect((p.def - p.min) % p.step).toBe(0); // Standardwert liegt im Raster
        } else {
          expect(p.options).toContain(p.def);
          expect(new Set(p.options).size).toBe(p.options.length);
        }
      }
    }
    for (const c of CATEGORIES) {
      expect(BLOCK_DEFS.some((d) => d.category === c.id)).toBe(true);
      expect(categoryIcon(c.id)).toMatch(/^<svg /);
    }
  });

  it('Lichtbilder sind 5 x 5 und verschieden, Töne haben eine Tonhöhe', () => {
    const imgs = Object.values(LED_IMAGES);
    for (const rows of imgs) {
      expect(rows).toHaveLength(5);
      for (const r of rows) expect(r).toMatch(/^[.#]{5}$/);
      expect(rows.join('').includes('#')).toBe(true);
    }
    expect(new Set(imgs.map((r) => r.join(''))).size).toBe(imgs.length);
    expect(ledSvg('heart')).toMatch(/^<svg /);
    const freqs = Object.values(NOTES).map((n) => n.freq);
    expect([...freqs].sort((a, b) => a - b)).toEqual(freqs); // aufsteigend
    expect(noteBadge('c')).toContain('C');
    for (const d of BLOCK_DEFS) for (const p of d.params) if (p.kind === 'choice' && p.key === 'img') expect(p.options.every((o) => o in LED_IMAGES)).toBe(true);
  });

  it('Container und Ereignis-Köpfe', () => {
    expect(BLOCK_DEFS.filter((d) => d.container).map((d) => d.type)).toEqual(['repeat', 'repeatUntil', 'forever', 'if', 'ifCount']);
    expect(BLOCK_DEFS.filter((d) => d.hat).map((d) => d.hat)).toEqual(['tap', 'bump']);
    expect(BLOCK_DEFS.filter((d) => d.hat).every((d) => d.category === 'event' && !d.container)).toBe(true);
    for (const d of BLOCK_DEFS) if (d.hat) expect(blockIcon(d.type)).toMatch(/^<svg /);
  });
});

describe('Einfügen', () => {
  it('fügt mit Standardwerten ein und vergibt fortlaufende ids', () => {
    let p = emptyBlockProgram();
    p = insertBlock(p, 'forward', null, 0).program;
    p = insertBlock(p, 'turnLeft', null, 1).program;
    expect(types(p.blocks)).toEqual(['forward', 'turnLeft']);
    expect(p.blocks[0].params).toEqual({ n: 2 });
    expect(p.blocks[1].params).toEqual({ deg: 90 });
    expect(p.blocks.map((b) => b.id)).toEqual([1, 2]);
    expect(p.nextId).toBe(3);
  });

  it('Position wird begrenzt, auch am Anfang', () => {
    const p = build(['forward', 'beep']);
    expect(types(insertBlock(p, 'wait', null, 0).program.blocks)).toEqual(['wait', 'forward', 'beep']);
    expect(types(insertBlock(p, 'wait', null, 1).program.blocks)).toEqual(['forward', 'wait', 'beep']);
    expect(types(insertBlock(p, 'wait', null, 99).program.blocks)).toEqual(['forward', 'beep', 'wait']);
    expect(types(insertBlock(p, 'wait', null, -5).program.blocks)).toEqual(['wait', 'forward', 'beep']);
  });

  it('Wiederholen bekommt eine leere Liste, andere Blöcke nicht', () => {
    const p = build(['repeat', 'forward']);
    expect(p.blocks[0].children).toEqual([]);
    expect(p.blocks[1].children).toBeUndefined();
  });

  it('in einen Wiederholen-Block einfügen, nicht in einen anderen Block', () => {
    const p = build([['repeat', ['forward']], 'beep']);
    const rep = p.blocks[0].id;
    const r = insertBlock(p, 'turnRight', rep, 1);
    expect(types(r.program.blocks[0].children!)).toEqual(['forward', 'turnRight']);
    expect(insertBlock(p, 'turnRight', p.blocks[1].id, 0).id).toBeNull(); // beep ist kein Container
    expect(insertBlock(p, 'turnRight', 999, 0).id).toBeNull();
    expect(insertBlock(p, 'gibtEsNicht', null, 0).id).toBeNull();
  });

  it('begrenzt die Verschachtelung und die Gesamtzahl', () => {
    let p = emptyBlockProgram();
    let parent: number | null = null;
    for (let i = 0; i < MAX_NEST; i++) {
      const r = insertBlock(p, 'repeat', parent, 0);
      expect(r.id).not.toBeNull();
      p = r.program;
      parent = r.id;
    }
    expect(insertBlock(p, 'repeat', parent, 0).id).toBeNull(); // zu tief
    expect(canInsert(p, 'repeat', parent)).toBe(false);
    expect(canInsert(p, 'forward', parent)).toBe(true); // normale Blöcke gehen noch

    let q = emptyBlockProgram();
    for (let i = 0; i < MAX_BLOCKS + 5; i++) q = insertBlock(q, 'forward', null, i).program;
    expect(countBlocks(q)).toBe(MAX_BLOCKS);
    expect(insertBlock(q, 'forward', null, 0).id).toBeNull();
  });
});

describe('Antippen in der Palette (addAtCursor)', () => {
  it('ohne Auswahl ans Ende', () => {
    const p = build(['forward', 'beep']);
    expect(types(addAtCursor(p, 'wait', null).program.blocks)).toEqual(['forward', 'beep', 'wait']);
  });

  it('mit Auswahl hinter den gewählten Block', () => {
    const p = build(['forward', 'beep', 'wait']);
    const r = addAtCursor(p, 'turnLeft', p.blocks[0].id);
    expect(types(r.program.blocks)).toEqual(['forward', 'turnLeft', 'beep', 'wait']);
  });

  it('mit gewähltem Wiederholen-Block ans Ende seines Inhalts', () => {
    const p = build([['repeat', ['forward']], 'beep']);
    const r = addAtCursor(p, 'turnLeft', p.blocks[0].id);
    expect(types(r.program.blocks[0].children!)).toEqual(['forward', 'turnLeft']);
    expect(types(r.program.blocks)).toEqual(['repeat', 'beep']);
  });

  it('gewählter Block im Wiederholen: neuer Block bleibt dort', () => {
    const p = build([['repeat', ['forward', 'beep']], 'wait']);
    const inner = p.blocks[0].children![0].id;
    const r = addAtCursor(p, 'turnLeft', inner);
    expect(types(r.program.blocks[0].children!)).toEqual(['forward', 'turnLeft', 'beep']);
  });

  it('Wiederholen in vollem Container: fällt auf eine Ebene höher', () => {
    let p = emptyBlockProgram();
    let parent: number | null = null;
    for (let i = 0; i < MAX_NEST; i++) {
      const r = insertBlock(p, 'repeat', parent, 0);
      p = r.program;
      parent = r.id;
    }
    const r = addAtCursor(p, 'repeat', parent);
    expect(r.id).not.toBeNull();
    expect(findBlock(r.program, r.id!)!.parentId).toBe(findBlock(p, parent!)!.parentId); // hinter dem innersten, auf gleicher Ebene
  });

  it('unbekannte Auswahl wird ignoriert', () => {
    const p = build(['forward']);
    expect(types(addAtCursor(p, 'beep', 999).program.blocks)).toEqual(['forward', 'beep']);
  });
});

describe('Verschieben', () => {
  it('nach oben und nach unten in der gleichen Liste', () => {
    const p = build(['forward', 'beep', 'wait', 'lightOff']);
    const [a, , c] = p.blocks.map((b) => b.id);
    // Slot-Positionen: 0 = vor dem ersten, 4 = nach dem letzten
    expect(types(moveBlock(p, c, null, 0).blocks)).toEqual(['wait', 'forward', 'beep', 'lightOff']);
    expect(types(moveBlock(p, a, null, 3).blocks)).toEqual(['beep', 'wait', 'forward', 'lightOff']);
    expect(types(moveBlock(p, a, null, 4).blocks)).toEqual(['beep', 'wait', 'lightOff', 'forward']);
  });

  it('auf die eigene Stelle: keine Änderung', () => {
    const p = build(['forward', 'beep', 'wait']);
    const b = p.blocks[1].id;
    expect(moveBlock(p, b, null, 1)).toBe(p); // direkt davor
    expect(moveBlock(p, b, null, 2)).toBe(p); // direkt danach
  });

  it('in einen Wiederholen-Block hinein und wieder heraus', () => {
    let p = build([['repeat', ['forward']], 'beep']);
    const rep = p.blocks[0].id;
    const beep = p.blocks[1].id;
    p = moveBlock(p, beep, rep, 0);
    expect(types(p.blocks)).toEqual(['repeat']);
    expect(types(p.blocks[0].children!)).toEqual(['beep', 'forward']);
    p = moveBlock(p, beep, null, 0);
    expect(types(p.blocks)).toEqual(['beep', 'repeat']);
    expect(types(p.blocks[1].children!)).toEqual(['forward']);
  });

  it('ein Wiederholen-Block darf nicht in sich selbst oder in seinen Inhalt', () => {
    const p = build([['repeat', [['repeat', ['forward']]]]]);
    const outer = p.blocks[0];
    const inner = outer.children![0];
    expect(canMove(p, outer.id, outer.id)).toBe(false);
    expect(canMove(p, outer.id, inner.id)).toBe(false);
    expect(moveBlock(p, outer.id, inner.id, 0)).toBe(p);
    expect(canMove(p, inner.id, null)).toBe(true);
  });

  it('Container mit Inhalt kann wegen der Tiefe nicht überall hin', () => {
    // repeat > repeat > (leer)  und daneben ein zweites repeat > repeat
    let p = build([['repeat', [['repeat', []]]], ['repeat', [['repeat', []]]]]);
    const target = p.blocks[0].children![0].id; // Ebene 2 -> darin darf nur noch ein Blatt oder ein Container der Höhe 0 stehen
    const moving = p.blocks[1].id; // Höhe 2
    expect(canMove(p, moving, target)).toBe(false);
    p = build([['repeat', [['repeat', []]]], 'forward']);
    expect(canMove(p, p.blocks[1].id, p.blocks[0].children![0].id)).toBe(true);
  });

  it('Move bewahrt Blöcke und ids', () => {
    const p = build([['repeat', ['forward', 'beep']], 'wait']);
    const before = flatten(p).map((b) => b.id).sort();
    const q = moveBlock(p, p.blocks[1].id, p.blocks[0].id, 1);
    expect(flatten(q).map((b) => b.id).sort()).toEqual(before);
    expect(countBlocks(q)).toBe(countBlocks(p));
  });
});

describe('Löschen, Kopieren, Werte', () => {
  it('löscht einen Block samt Inhalt', () => {
    const p = build([['repeat', ['forward', 'beep']], 'wait']);
    const q = removeBlock(p, p.blocks[0].id);
    expect(types(q.blocks)).toEqual(['wait']);
    expect(removeBlock(p, 999)).toBe(p);
    expect(removeBlock(p, p.blocks[0].children![0].id).blocks[0].children!.length).toBe(1);
  });

  it('Kopie bekommt neue ids, auch im Inhalt, und steht dahinter', () => {
    const p = build([['repeat', ['forward']], 'beep']);
    const r = duplicateBlock(p, p.blocks[0].id);
    expect(r.id).not.toBeNull();
    expect(types(r.program.blocks)).toEqual(['repeat', 'repeat', 'beep']);
    const ids = flatten(r.program).map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(r.program.blocks[1].children![0].type).toBe('forward');
    expect(r.program.nextId).toBeGreaterThan(Math.max(...ids));
  });

  it('Kopie überschreitet das Limit nicht', () => {
    let p = emptyBlockProgram();
    for (let i = 0; i < MAX_BLOCKS; i++) p = insertBlock(p, 'forward', null, i).program;
    expect(duplicateBlock(p, p.blocks[0].id).id).toBeNull();
  });

  it('setzt Werte nur gültig: Raster, Bereich, Auswahl', () => {
    let p = build(['forward', 'turnLeft', 'showImage']);
    const [f, t, s] = p.blocks.map((b) => b.id);
    p = setParam(p, f, 'n', 7);
    expect(p.blocks[0].params.n).toBe(7);
    expect(setParam(p, f, 'n', 99).blocks[0].params.n).toBe(20); // Obergrenze
    expect(setParam(p, f, 'n', -4).blocks[0].params.n).toBe(1); // Untergrenze
    expect(setParam(p, t, 'deg', 100)).toBe(p); // Raster 45 ab 45: 100 wird zu 90 = unverändert
    expect(setParam(p, t, 'deg', 140).blocks[1].params.deg).toBe(135);
    expect(setParam(p, t, 'deg', 1000).blocks[1].params.deg).toBe(360);
    expect(setParam(p, s, 'img', 'star').blocks[2].params.img).toBe('star');
    expect(setParam(p, s, 'img', 'unbekannt')).toBe(p);
    expect(setParam(p, s, 'nope', 1)).toBe(p);
    expect(setParam(p, 999, 'n', 1)).toBe(p);
    expect(setParam(p, f, 'n', 7)).toBe(p); // gleicher Wert
    expect(setParam(p, f, 'n', Number.NaN)).toBe(p);
  });

  it('setzt Werte auch in verschachtelten Blöcken', () => {
    let p = build([['repeat', ['forward']]]);
    const id = p.blocks[0].children![0].id;
    p = setParam(p, id, 'n', 5);
    expect(p.blocks[0].children![0].params.n).toBe(5);
    p = setParam(p, p.blocks[0].id, 'n', 6);
    expect(p.blocks[0].params.n).toBe(6);
  });

  it('normalizeParam und defaultParams', () => {
    const wait = blockDef('wait')!.params[0];
    expect(normalizeParam(wait, 2.4)).toBe(2);
    expect(normalizeParam(wait, '3')).toBeNull();
    expect(defaultParams('repeat')).toEqual({ n: 3 });
    expect(defaultParams('lightOff')).toEqual({});
    expect(descendantIds(build([['repeat', [['repeat', ['forward']]]]]).blocks[0])).toHaveLength(2);
  });

  it('alles löschen', () => {
    const p = build(['forward', 'beep']);
    const q = clearBlocks(p);
    expect(q.blocks).toEqual([]);
    expect(q.nextId).toBe(p.nextId); // ids werden nicht neu vergeben
    expect(clearBlocks(q)).toBe(q);
  });
});

describe('Speichern und Laden', () => {
  it('Hin und zurück ohne Verlust', () => {
    let p = build([['repeat', ['forward', ['repeat', ['beep']]]], 'showImage']);
    p = setParam(p, p.blocks[0].id, 'n', 7);
    expect(parseBlockProgram(JSON.parse(serializeBlocks(p)))).toEqual(p);
  });

  it('lehnt kaputte Daten ab', () => {
    expect(parseBlockProgram(null)).toBeNull();
    expect(parseBlockProgram({})).toBeNull();
    expect(parseBlockProgram({ blocks: [{ id: 1, type: 'xx', params: {} }] })).toBeNull();
    expect(parseBlockProgram({ blocks: [{ id: 1, type: 'forward', params: {} }, { id: 1, type: 'beep', params: {} }] })).toBeNull();
    expect(parseBlockProgram({ blocks: [{ id: 0, type: 'forward', params: {} }] })).toBeNull();
    expect(parseBlockProgram({ blocks: [{ id: 1, type: 'forward', params: {}, children: [{ id: 2, type: 'beep', params: {} }] }] })).toBeNull(); // Blatt mit Inhalt
    const deep = { id: 1, type: 'repeat', params: {}, children: [{ id: 2, type: 'repeat', params: {}, children: [{ id: 3, type: 'repeat', params: {}, children: [{ id: 4, type: 'repeat', params: {}, children: [] }] }] }] };
    expect(parseBlockProgram({ blocks: [deep] })).toBeNull(); // zu tief
  });

  it('repariert fehlende oder ungültige Werte und nextId', () => {
    const p = parseBlockProgram({ blocks: [{ id: 5, type: 'forward', params: { n: 999 } }, { id: 6, type: 'showImage', params: { img: 'x' } }, { id: 7, type: 'repeat', params: {} }], nextId: 2 })!;
    expect(p.blocks[0].params.n).toBe(20);
    expect(p.blocks[1].params.img).toBe('heart');
    expect(p.blocks[2].params.n).toBe(3);
    expect(p.blocks[2].children).toEqual([]);
    expect(p.nextId).toBe(8);
  });

  it('zu viele Blöcke werden abgelehnt', () => {
    const blocks = Array.from({ length: MAX_BLOCKS + 1 }, (_, i) => ({ id: i + 1, type: 'forward', params: {} }));
    expect(parseBlockProgram({ blocks })).toBeNull();
  });
});

describe('Sitzung der Kinder', () => {
  it('Rückgängig und Wiederholen', () => {
    const s = new BlockSession('test', emptyBlockProgram(), memoryKV());
    s.commit(insertBlock(s.program, 'forward', null, 0).program);
    s.commit(insertBlock(s.program, 'beep', null, 1).program);
    expect(types(s.program.blocks)).toEqual(['forward', 'beep']);
    expect(s.undo()).toBe(true);
    expect(types(s.program.blocks)).toEqual(['forward']);
    expect(s.redo()).toBe(true);
    expect(types(s.program.blocks)).toEqual(['forward', 'beep']);
    expect(s.commit(s.program)).toBe(false);
  });
});
